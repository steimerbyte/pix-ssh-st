import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerSsh, { validatorFor } from "./index.ts";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRuntime } from "@xynogen/pix-runtime";
import {
	type ApprovalEntry,
	baseScpArgs,
	baseSshArgs,
	buildRunSshArgs,
	capStream,
	clearIdentityFileOverride,
	commandEscalatesPrivilege,
	controlPathFor,
	DEFAULT_SSH_RUN_CONFIG,
	detectSshFailure,
	detectSudoFailure,
	filterSudoPrompt,
	hostApproved,
	hostTarget,
	markHostApproved,
	isUnreachable,
	loadSshConfig,
	parseHost,
	parseHostAliases,
	parseHostInfo,
	parseSshConfig,
	remoteCommand,
	remoteTransferPath,
	shellQuote,
	transferApprovalDecision,
	transferArgs,
	truncate,
} from "./lib.ts";

describe("parseHost", () => {
	beforeEach(() => {
		// clearIdentityFileOverride is not relevant for parseHost but keeps
		// module-state-clean between tests so connectionArgs tests are not
		// affected by leftover ssh.json state.
		clearIdentityFileOverride();
	});

	it("parses bare host", () => {
		expect(parseHost("example.com")).toEqual({ host: "example.com" });
	});
	it("parses user@host", () => {
		expect(parseHost("deploy@10.0.0.5")).toEqual({ user: "deploy", host: "10.0.0.5" });
	});
	it("parses user@host:port", () => {
		expect(parseHost("deploy@10.0.0.5:2222")).toEqual({
			user: "deploy",
			host: "10.0.0.5",
			port: 2222,
		});
	});
	it("parses bracketed IPv6 with port", () => {
		expect(parseHost("root@[::1]:22")).toEqual({ user: "root", host: "::1", port: 22 });
	});
	it("leaves bare IPv6 (multiple colons) as host", () => {
		expect(parseHost("fe80::1")).toEqual({ host: "fe80::1" });
	});
	it("rejects empty host", () => {
		expect(() => parseHost("   ")).toThrow();
		expect(() => parseHost("user@")).toThrow();
	});
	it("rejects invalid port", () => {
		expect(() => parseHost("h:0")).toThrow();
		expect(() => parseHost("h:70000")).toThrow();
		expect(() => parseHost("h:abc")).toThrow();
	});

	// Regression: v0.2.0 audit fix 3.3 — a bare IPv6 with a trailing port
	// (e.g. fe80::1:22) is ambiguous (the last colon could be a port or part
	// of the address). OpenSSH requires brackets, so we accept the whole
	// string as the host and warn via stderr instead of throwing.
	it("accepts bare IPv6 with ambiguous trailing port as host and warns on stderr", () => {
		const spy = spyOn(process.stderr, "write").mockImplementation(() => true);
		try {
			expect(() => parseHost("fe80::1:22")).not.toThrow();
			expect(parseHost("fe80::1:22")).toEqual({ host: "fe80::1:22" });
			const text = spy.mock.calls.map((c) => String(c[0])).join("");
			expect(text).toContain("fe80::1:22");
			expect(text).toContain("bare IPv6");
		} finally {
			spy.mockRestore();
		}
	});

	it("parses bracketed IPv6 with port (no user prefix)", () => {
		expect(parseHost("[fe80::1]:22")).toEqual({ host: "fe80::1", port: 22 });
	});

	it("parses bare IPv6 ::1 (no port)", () => {
		expect(parseHost("::1")).toEqual({ host: "::1" });
	});
});

describe("parseSshConfig", () => {
	it("reads effective user, hostname, and port from ssh -G output", () => {
		expect(parseSshConfig("host orin\nuser jetson\nhostname 10.10.21.251\nport 2222\n")).toEqual({
			user: "jetson",
			host: "10.10.21.251",
			port: 2222,
		});
	});

	it("rejects incomplete ssh -G output", () => {
		expect(parseSshConfig("hostname 10.10.21.251\n")).toBeUndefined();
	});
});

describe("parseHostAliases", () => {
	it("extracts aliases with hostname/user/port/proxyjump", () => {
		const cfg = [
			"Host web",
			"  HostName 10.0.0.5",
			"  User deploy",
			"  Port 2222",
			"  ProxyJump bastion",
			"",
			"Host db",
			"  HostName db.internal",
		].join("\n");
		expect(parseHostAliases(cfg)).toEqual([
			{ alias: "web", hostname: "10.0.0.5", user: "deploy", port: "2222", proxyJump: "bastion" },
			{ alias: "db", hostname: "db.internal" },
		]);
	});
	it("splits a multi-alias Host line and skips wildcard patterns", () => {
		const cfg = ["Host a b *.example", "  User root", "", "Host *", "  User nobody"].join("\n");
		expect(parseHostAliases(cfg)).toEqual([
			{ alias: "a", user: "root" },
			{ alias: "b", user: "root" },
		]);
	});
	it("ignores comments and keeps first value per key", () => {
		const cfg = ["# comment", "Host x", "  User first", "  User second"].join("\n");
		expect(parseHostAliases(cfg)).toEqual([{ alias: "x", user: "first" }]);
	});
});

describe("parseHostInfo", () => {
	it("reads effective fields from ssh -G output, first value wins", () => {
		const out = [
			"host web",
			"hostname 10.0.0.5",
			"user deploy",
			"port 2222",
			"identityfile ~/.ssh/id_ed25519",
			"proxyjump bastion",
			"user ignored",
		].join("\n");
		expect(parseHostInfo(out)).toEqual({
			hostname: "10.0.0.5",
			user: "deploy",
			port: "2222",
			identityFile: "~/.ssh/id_ed25519",
			proxyJump: "bastion",
		});
	});
});

describe("hostTarget", () => {
	it("joins user and host", () => {
		expect(hostTarget({ user: "a", host: "b" })).toBe("a@b");
		expect(hostTarget({ host: "b" })).toBe("b");
	});
});

describe("controlPathFor", () => {
	it("is stable per host+user+port and differs across hosts", () => {
		const a = controlPathFor({ user: "u", host: "h", port: 22 });
		expect(a).toBe(controlPathFor({ user: "u", host: "h", port: 22 }));
		expect(a).not.toBe(controlPathFor({ user: "u", host: "h", port: 23 }));
		expect(a).not.toBe(controlPathFor({ user: "x", host: "h", port: 22 }));
		expect(a).toContain("pix-ssh-");
		expect(a.endsWith(".sock")).toBe(true);
	});
});

describe("baseSshArgs", () => {
	it("enables multiplexing and includes the control path", () => {
		const args = baseSshArgs({ host: "h" }, "/tmp/x.sock");
		expect(args).toContain("ControlMaster=auto");
		expect(args).toContain("ControlPath=/tmp/x.sock");
		expect(args.some((a) => a.startsWith("ControlPersist="))).toBe(true);
	});
	it("adds -p only when a port is set", () => {
		expect(baseSshArgs({ host: "h" }, "s")).not.toContain("-p");
		const withPort = baseSshArgs({ host: "h", port: 2222 }, "s");
		expect(withPort).toContain("-p");
		expect(withPort).toContain("2222");
	});
});

describe("buildRunSshArgs", () => {
	// Regression: a run without a login password must be non-interactive so ssh
	// never opens its own /dev/tty prompt (which leaked `host's password:` into
	// the TUI). All password entry goes through the overlay + sshpass instead.
	it("forces BatchMode=yes when no password is in hand", () => {
		const { bin, args } = buildRunSshArgs({ host: "h" }, "whoami", { controlPath: "s" });
		expect(bin).toBe("ssh");
		expect(args).toContain("BatchMode=yes");
	});
	it("keeps BatchMode off on the sshpass path so it can answer the prompt", () => {
		const { bin, args } = buildRunSshArgs({ host: "h" }, "whoami", {
			controlPath: "s",
			loginPassword: "pw",
		});
		expect(bin).toBe("sshpass");
		expect(args).not.toContain("BatchMode=yes");
		expect(args.slice(0, 2)).toEqual(["-e", "ssh"]);
	});
});

describe("transfer unattended approval", () => {
	it("treats transfer as warning-level in AFK and YOLO", () => {
		expect(transferApprovalDecision("off", false)).toBe("ask");
		// AFK denies transfers even when a login password is cached — matches
		// the command path which always denies under AFK (audit UX/UI HIGH fix).
		expect(transferApprovalDecision("afk", false)).toBe("deny");
		expect(transferApprovalDecision("yolo", false)).toBe("allow");
	});

	it("denies unattended transfer when a login password is missing", () => {
		expect(transferApprovalDecision("afk", true)).toBe("deny");
		expect(transferApprovalDecision("yolo", true)).toBe("deny");
	});
});

describe("SCP transfer arguments", () => {
	it("builds upload and download endpoints", () => {
		const spec = { user: "deploy", host: "example.com", port: 2222 };
		expect(remoteTransferPath(spec, "/srv/app file")).toBe("deploy@example.com:/srv/app file");
		expect(transferArgs(spec, "upload", "./build", "/srv/app")).toEqual([
			"./build",
			"deploy@example.com:/srv/app",
		]);
		expect(transferArgs(spec, "download", "/var/log/app.log", "./app.log")).toEqual([
			"deploy@example.com:/var/log/app.log",
			"./app.log",
		]);
		expect(baseScpArgs(spec, "/tmp/control.sock", true)).toEqual([
			"-o",
			"ControlMaster=auto",
			"-o",
			"ControlPath=/tmp/control.sock",
			"-o",
			"ControlPersist=120",
			"-o",
			"ConnectTimeout=10",
			"-o",
			"StrictHostKeyChecking=accept-new",
			"-P",
			"2222",
			"-r",
		]);
	});

	it("brackets IPv6 hosts for SCP remote-path syntax", () => {
		expect(remoteTransferPath({ user: "root", host: "::1" }, "/tmp/x")).toBe("root@[::1]:/tmp/x");
	});
});

describe("remoteCommand + shellQuote", () => {
	it("returns the command unchanged without sudo", () => {
		expect(remoteCommand("whoami", false)).toBe("whoami");
	});
	it("wraps in sudo -S with a quoted inner command", () => {
		const out = remoteCommand("apt update", true);
		expect(out).toStartWith("sudo -S -p '' -- sh -c ");
		expect(out).toContain("'apt update'");
	});
	it("escapes embedded single quotes safely", () => {
		expect(shellQuote("it's")).toBe(`'it'\\''s'`);
		// The wrapped form has no unescaped quote that would break out of the string.
		const wrapped = remoteCommand("echo 'hi'", true);
		expect(wrapped).toContain(`'echo '\\''hi'\\'''`);
	});
});

describe("detectSshFailure", () => {
	it("is false on exit 0", () => {
		expect(detectSshFailure(0, "permission denied")).toBe(false);
	});
	it("flags common ssh errors", () => {
		expect(detectSshFailure(255, "Permission denied (publickey,password).")).toBe(true);
		expect(detectSshFailure(255, "ssh: connect to host x: Connection refused")).toBe(true);
		expect(detectSshFailure(255, "Could not resolve hostname x")).toBe(true);
	});
	it("does not flag a normal nonzero command exit", () => {
		expect(detectSshFailure(1, "ls: no such file")).toBe(false);
	});
});

describe("isUnreachable", () => {
	it("flags connection/DNS failures (not auth)", () => {
		expect(isUnreachable("ssh: connect to host x port 22: Connection timed out")).toBe(true);
		expect(isUnreachable("ssh: connect to host x port 22: Connection refused")).toBe(true);
		expect(isUnreachable("ssh: Could not resolve hostname x")).toBe(true);
		expect(isUnreachable("ssh: connect to host x: No route to host")).toBe(true);
	});
	it("does NOT flag a password rejection (that's an auth failure)", () => {
		expect(isUnreachable("Permission denied, please try again.")).toBe(false);
		expect(isUnreachable("Permission denied (publickey,password).")).toBe(false);
	});
});

describe("detectSudoFailure", () => {
	it("flags wrong sudo password", () => {
		expect(detectSudoFailure("Sorry, try again.")).toBe(true);
		expect(detectSudoFailure("sudo: 1 incorrect password attempt")).toBe(true);
		expect(detectSudoFailure("sudo: a password is required")).toBe(true);
	});
	it("ignores unrelated stderr", () => {
		expect(detectSudoFailure("warning: something")).toBe(false);
	});
});

describe("filterSudoPrompt", () => {
	it("strips bare password prompt lines", () => {
		expect(filterSudoPrompt("[sudo] password for u:\nreal output")).toBe("real output");
		expect(filterSudoPrompt("Password:\nx")).toBe("x");
	});
	it("keeps normal lines", () => {
		expect(filterSudoPrompt("line one\nline two")).toBe("line one\nline two");
	});
});

describe("hostApproved", () => {
	it("is false for an unknown host", () => {
		expect(hostApproved(new Map(), "u@h:22")).toBe(false);
	});
	it("is true within the TTL window", () => {
		const m = new Map<string, ApprovalEntry>([["u@h:22", { kind: "ttl", expiresAt: 1000 }]]);
		expect(hostApproved(m, "u@h:22", 500)).toBe(true);
	});
	it("expires and self-prunes at/after the deadline", () => {
		const m = new Map<string, ApprovalEntry>([["u@h:22", { kind: "ttl", expiresAt: 1000 }]]);
		expect(hostApproved(m, "u@h:22", 1000)).toBe(false);
		expect(m.has("u@h:22")).toBe(false);
	});
	it("session-scoped entry is live indefinitely (no expiry field)", () => {
		const m = new Map<string, ApprovalEntry>([
			["u@h:22", { kind: "session", sessionScoped: true }],
		]);
		// Past the typical TTL horizon — must still be live.
		expect(hostApproved(m, "u@h:22", Number.MAX_SAFE_INTEGER)).toBe(true);
		expect(m.has("u@h:22")).toBe(true);
	});
	it("NaN-tagged ttl entry is treated as dead and self-prunes", () => {
		// Mirrors the v0.2.0 NaN guard: any comparison with NaN is false,
		// so without the guard a NaN-tagged entry would live forever.
		const m = new Map<string, ApprovalEntry>([["u@h:22", { kind: "ttl", expiresAt: Number.NaN }]]);
		expect(hostApproved(m, "u@h:22", 0)).toBe(false);
		expect(m.has("u@h:22")).toBe(false);
	});

	it("Infinity-tagged ttl entry is treated as dead and self-prunes", () => {
		// The same Number.isFinite guard catches Infinity (the `now >= expiresAt`
		// check would always be true for Infinity, but the guard rejects it
		// before that comparison so the entry is pruned instead of returning
		// false forever). Mirrors the v0.2.0 fix on the finite-TTL code path
		// even though markHostApproved would normally store `Infinity` via the
		// session variant path.
		const m = new Map<string, ApprovalEntry>([
			["u@h:22", { kind: "ttl", expiresAt: Number.POSITIVE_INFINITY }],
		]);
		expect(hostApproved(m, "u@h:22", 0)).toBe(false);
		expect(m.has("u@h:22")).toBe(false);
	});
});

describe("markHostApproved", () => {
	it("stores a session variant for Infinity TTL", () => {
		const m = new Map<string, ApprovalEntry>();
		markHostApproved(m, "u@h:22", 0, Number.POSITIVE_INFINITY);
		expect(m.get("u@h:22")).toEqual({ kind: "session", sessionScoped: true });
	});
	it("stores a ttl variant with absolute expiry for finite TTL", () => {
		const m = new Map<string, ApprovalEntry>();
		markHostApproved(m, "u@h:22", 1_000, 30 * 60_000);
		expect(m.get("u@h:22")).toEqual({ kind: "ttl", expiresAt: 1_000 + 30 * 60_000 });
	});
});

describe("commandEscalatesPrivilege", () => {
	it("flags leading and mid-chain escalation tokens", () => {
		expect(commandEscalatesPrivilege("sudo apt update")).toBe(true);
		expect(commandEscalatesPrivilege("apt update && sudo apt install x")).toBe(true);
		expect(commandEscalatesPrivilege("foo; su -c 'x'")).toBe(true);
		expect(commandEscalatesPrivilege("doas reboot")).toBe(true);
		expect(commandEscalatesPrivilege("pkexec whoami")).toBe(true);
	});
	it("does not flag plain commands or substrings", () => {
		expect(commandEscalatesPrivilege("ls -la")).toBe(false);
		expect(commandEscalatesPrivilege("pseudo-tty")).toBe(false);
		expect(commandEscalatesPrivilege("cat sudoku.txt")).toBe(false);
	});

	// Regression: v0.2.0 audit expanded the boundary class to cover quote,
	// brace, bracket, and path-separator characters AND added case-insensitivity.
	// Pre-fix the regex `/(\s|;|&|...)sudo\b/` skipped these inputs and let a
	// wrapped sudo call bypass per-host allow-memory.
	it("catches v0.2.0 escape vectors (quote, path, brace, bracket, case)", () => {
		expect(commandEscalatesPrivilege("`sudo whoami`")).toBe(true);
		expect(commandEscalatesPrivilege("bash -c 'sudo whoami'")).toBe(true);
		expect(commandEscalatesPrivilege("/usr/bin/sudo cmd")).toBe(true);
		expect(commandEscalatesPrivilege("./sudo cmd")).toBe(true);
		expect(commandEscalatesPrivilege("{sudo cmd}")).toBe(true);
		expect(commandEscalatesPrivilege("[sudo cmd]")).toBe(true);
		expect(commandEscalatesPrivilege("SUDO=1 sudo cmd")).toBe(true);
	});

	it("does not flag words that contain 'su' or 'sudo' as a non-boundary substring", () => {
		// \b word boundary must keep these negative: myuser (no 'su' substring
		// match), sudoku (sudo followed by k, no \b), systemd-tmpfiles (systemd,
		// 'su' followed by s, no \b).
		expect(commandEscalatesPrivilege("myuser")).toBe(false);
		expect(commandEscalatesPrivilege("sudoku")).toBe(false);
		expect(commandEscalatesPrivilege("systemd-tmpfiles")).toBe(false);
	});
});

describe("loadSshConfig", () => {
	let dir: string;
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "pix-ssh-cfg-"));
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});
	const file = (name: string) => join(dir, name);

	it("returns defaults when the file is missing", () => {
		expect(loadSshConfig(file("nope.json"))).toEqual(DEFAULT_SSH_RUN_CONFIG);
	});

	it("reads confirm: false", () => {
		writeFileSync(file("ssh.json"), JSON.stringify({ confirm: false }));
		expect(loadSshConfig(file("ssh.json"))).toEqual({ confirm: false });
	});

	it("reads confirm: true explicitly", () => {
		writeFileSync(file("ssh.json"), JSON.stringify({ confirm: true }));
		expect(loadSshConfig(file("ssh.json"))).toEqual({ confirm: true });
	});

	it("ignores unknown keys and falls back to default confirm", () => {
		writeFileSync(file("ssh.json"), JSON.stringify({ unknown: 42 }));
		expect(loadSshConfig(file("ssh.json"))).toEqual(DEFAULT_SSH_RUN_CONFIG);
	});

	it("ignores malformed JSON", () => {
		writeFileSync(file("ssh.json"), "{ not valid json");
		expect(loadSshConfig(file("ssh.json"))).toEqual(DEFAULT_SSH_RUN_CONFIG);
	});

	it("ignores a non-object root", () => {
		writeFileSync(file("ssh.json"), JSON.stringify(["confirm", false]));
		expect(loadSshConfig(file("ssh.json"))).toEqual(DEFAULT_SSH_RUN_CONFIG);
	});

	it("ignores a non-boolean confirm value", () => {
		writeFileSync(file("ssh.json"), JSON.stringify({ confirm: "off" }));
		expect(loadSshConfig(file("ssh.json"))).toEqual(DEFAULT_SSH_RUN_CONFIG);
	});
});

describe("validatorFor", () => {
	const spec = { host: "h", user: "root" };
	it("sudo stage: rejects blank, accepts any non-empty (no host probe)", async () => {
		const v = validatorFor("sudo", spec, "/tmp/cp");
		expect(await v("")).toBe(false);
		expect(await v("   ")).toBe(false);
		expect(await v("anything")).toBe(true);
	});
	it("login stage: rejects blank without probing the host", async () => {
		const v = validatorFor("login", spec, "/tmp/cp");
		expect(await v("")).toBe(false);
		expect(await v("  ")).toBe(false);
	});
});

describe("truncate", () => {
	it("passes short text through", () => {
		expect(truncate("a\nb").truncated).toBe(false);
	});
	it("caps by line count", () => {
		const many = Array.from({ length: 3000 }, (_, i) => `l${i}`).join("\n");
		const out = truncate(many, 2000);
		expect(out.truncated).toBe(true);
		expect(out.text.split("\n").length).toBe(2000);
	});
	it("alreadyTruncated: skips the line/byte short-circuit, returns truncated=true", () => {
		// Short input that would normally pass through unchanged. With
		// alreadyTruncated=true the caller signals the source was bounded
		// upstream (e.g. runSshChild hit capStream), so truncate() must
		// still report truncated=true without inspecting line/byte counts.
		expect(truncate("a\nb", undefined, undefined, true)).toEqual({
			text: "a\nb",
			truncated: true,
		});
	});
	it("alreadyTruncated: still applies the byte cap to bounded source", () => {
		// 100 KB of input would normally exceed MAX_OUTPUT_BYTES (50 KB) and
		// trigger the byte cap. alreadyTruncated=true must not skip that
		// work — it just skips the cheap line/byte count short-circuit.
		const big = "x".repeat(100 * 1024);
		const out = truncate(big, undefined, undefined, true);
		expect(out.truncated).toBe(true);
		expect(Buffer.byteLength(out.text, "utf8")).toBeLessThanOrEqual(50 * 1024);
	});
});

describe("capStream", () => {
	// Small caps keep the test data tiny while still exercising the cap
	// boundary: maxBytes=20, rollbackBytes=10 means anything beyond 20
	// bytes total rolls back to the last 10 bytes.
	const MAX = 20;
	const ROLLBACK = 10;

	it("passes a single chunk that fits through unchanged", () => {
		const r = capStream(Buffer.alloc(0), Buffer.from("hello"), MAX, ROLLBACK);
		expect(r.truncated).toBe(false);
		expect(r.buf.toString("utf8")).toBe("hello");
	});
	it("passes an empty chunk through unchanged", () => {
		const r = capStream(Buffer.from("abc"), Buffer.alloc(0), MAX, ROLLBACK);
		expect(r.truncated).toBe(false);
		expect(r.buf.toString("utf8")).toBe("abc");
	});
	it("accumulates chunks below the cap without truncation", () => {
		let buf = Buffer.alloc(0);
		for (let i = 0; i < 4; i++) {
			const r = capStream(buf, Buffer.from("abcd"), MAX, ROLLBACK);
			buf = r.buf;
		}
		expect(buf.toString("utf8")).toBe("abcdabcdabcdabcd");
	});
	it("rolls back to the last rollbackBytes when the cap is exceeded", () => {
		// 30 bytes total exceeds MAX=20; expect the last 10 bytes kept.
		const r = capStream(
			Buffer.from("AAAAAAAAAAAAAAAAAAAA"), // 20 bytes
			Buffer.from("BBBBBBBBBB"), // 10 bytes → 30 total
			MAX,
			ROLLBACK,
		);
		expect(r.truncated).toBe(true);
		expect(r.buf.toString("utf8")).toBe("BBBBBBBBBB");
	});
	it("stays bounded after the cap fires (no unbounded growth)", () => {
		// Force the first cap, then keep appending. The buffer must not
		// grow past MAX — this is the memory-bomb guarantee. (It oscillates
		// between ROLLBACK right after a cap and MAX just before the next
		// cap fires; the important property is that MAX is the ceiling.)
		let buf = Buffer.alloc(0);
		for (let i = 0; i < 50; i++) {
			const r = capStream(buf, Buffer.from("X"), MAX, ROLLBACK);
			buf = r.buf;
		}
		expect(buf.length).toBeLessThanOrEqual(MAX);
	});
	it("keeps the tail aligned to a UTF-8 codepoint boundary", () => {
		// "🌍" is a 4-byte codepoint (F0 9F 8C 8D). Build a buffer that ends
		// mid-codepoint after the cap fires, then assert the kept tail has
		// no U+FFFD replacement chars — i.e. UTF-8 alignment held.
		const earth = "🌍"; // 4 bytes
		const prefix = "a".repeat(17); // 17 ASCII + 4 emoji = 21 bytes
		const r = capStream(Buffer.from(prefix), Buffer.from(earth), MAX, ROLLBACK);
		expect(r.truncated).toBe(true);
		const text = r.buf.toString("utf8");
		expect(text).not.toContain("\uFFFD");
	});
	it("drops a chunk whose first bytes fall inside the rollback window", () => {
		// Two chunks that together exceed MAX, where the second chunk's
		// start would otherwise land inside the rollback window — verify
		// the kept tail is exactly the second chunk's bytes, not split.
		const r = capStream(
			Buffer.from("aaaaaaaaaaaaaaaaaaaa"), // 20 bytes
			Buffer.from("0123456789"), // 10 bytes → 30 total
			MAX,
			ROLLBACK,
		);
		expect(r.truncated).toBe(true);
		expect(r.buf.toString("utf8")).toBe("0123456789");
	});
});

describe("ssh result renderer", () => {
	// The renderer's collapsed branch is gated by `shouldCollapse("ssh")`, which
	// reads the global pix-runtime singleton. A user's pix.json can disable
	// collapse globally (enabled: false), so without swapping in an isolated
	// runtime that uses the defaults, `tickCollapse` returns false and the
	// collapsed row path is never exercised — even though the test seeds
	// `state.collapsed = true`. Swap the singleton for these tests so they
	// observe the real collapse code path under its default config
	// (enabled: true, delaySec: 10).
	const SINGLETON_KEY = Symbol.for("@xynogen/pix-runtime");
	let originalRuntime: unknown;
	let agentDir: string;
	beforeEach(() => {
		originalRuntime = (globalThis as Record<symbol, unknown>)[SINGLETON_KEY];
		agentDir = mkdtempSync(join(tmpdir(), "pix-ssh-st-collapse-"));
		(globalThis as Record<symbol, unknown>)[SINGLETON_KEY] = createRuntime({ agentDir });
	});
	afterEach(() => {
		(globalThis as Record<symbol, unknown>)[SINGLETON_KEY] = originalRuntime;
		rmSync(agentDir, { recursive: true, force: true });
	});

	const theme = {
		fg: (key: string, text: string) => `[${key}]${text}[/]`,
		bold: (text: string) => text,
	};
	const register = () => {
		let renderer: ((...args: unknown[]) => { render(width: number): string[] }) | undefined;
		registerSsh({
			registerTool(tool: unknown) {
				renderer = (tool as { renderResult: typeof renderer }).renderResult;
			},
		} as unknown as ExtensionAPI);
		if (!renderer) throw new Error("renderResult not registered");
		return renderer;
	};
	const render = (
		renderer: (...args: unknown[]) => { render(width: number): string[] },
		details: Record<string, unknown> | undefined,
		isError = false,
		isPartial = false,
		state: Record<string, unknown> = {},
		expanded = false,
	) =>
		renderer(
			{ content: [{ type: "text", text: String(details?.outcome ?? "done") }], details },
			{ isPartial },
			theme,
			{ expanded, isError, invalidate: () => {}, state },
		)
			.render(24)
			.join("\n");

	it("uses dashed status closes in normal and expanded output", () => {
		const renderer = register();
		const success = render(renderer, undefined).split("\n");
		expect(success[0]).toContain("done");
		expect(success.at(-1)).toBe(`[success]${"- ".repeat(12)}[/]`);
		expect(render(renderer, undefined, false, false, {}, true).split("\n").at(-1)).toBe(
			`[success]${"- ".repeat(12)}[/]`,
		);
		expect(render(renderer, undefined, true).split("\n").at(-1)).toBe(
			`[error]${"- ".repeat(12)}[/]`,
		);
		for (const outcome of ["denied", "timed-out", "cancelled", "error"]) {
			expect(
				render(renderer, {
					_type: "sshResult",
					command: "id",
					host: "host",
					sudo: false,
					outcome,
				}),
			).toContain("[error]- - ");
		}
	});

	it("leaves partial, running, and collapsed rows unframed", () => {
		const renderer = register();
		const running = {
			_type: "sshResult",
			command: "id",
			host: "host",
			sudo: false,
			outcome: "running",
		};
		const partial = render(renderer, running, false, true);
		expect(partial.split("\n")[0]).toContain("running");
		expect(partial).not.toContain(`[success]${"- ".repeat(12)}[/]`);
		const open = render(renderer, running);
		expect(open.split("\n")[0]).toContain("running");
		expect(open).not.toContain(`[success]${"- ".repeat(12)}[/]`);
		const success = { ...running, outcome: "success", exitCode: 0, _render: "done" };
		const collapsed = render(renderer, success, false, false, { collapsed: true }, false);
		expect(collapsed.split("\n")[0]).toContain("success");
		expect(collapsed).not.toContain(`[success]${"- ".repeat(12)}[/]`);
	});
});
