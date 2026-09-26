/**
 * Pure / side-effect-free helpers for pix-ssh, extracted so they can be
 * unit-tested without opening real SSH connections or loading the Pi host.
 *
 * Security model:
 *   - SSH login password (when key auth fails) is fed to `sshpass -e` via the
 *     SSHPASS env var of the child only — never as an argv (no `ps` leak),
 *     never written to disk.
 *   - Remote sudo password is piped to the remote `sudo -S -p ''` on stdin,
 *     so it travels inside the encrypted SSH channel, not as an argv.
 *   - ControlMaster multiplexing means one authenticated connection per host
 *     is reused by later calls (ControlPersist window), so the password is
 *     entered once per session per host.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, resolve as resolvePath } from "node:path";

/** Centralised binary/env-var names. Extracted so a custom ssh path (e.g.
 * a Windows-distributed ssh.exe) can be wired in one place instead of 9. */
export const SSH_BIN = "ssh";
export const SCP_BIN = "scp";
export const SSHPASS_BIN = "sshpass";
export const SSHPASS_ENV = "SSHPASS";

export const MAX_OUTPUT_BYTES = 50 * 1024;
export const MAX_OUTPUT_LINES = 2000;

/**
 * Approval TTLs (ms) — pix-ssh-st fork.
 *
 * - `SESSION_APPROVAL_TTL_MS`: for NON-privileged commands the user has approved
 *   once, the in-process Map never expires the entry (`+Infinity`), so the
 *   overlay is skipped for the rest of the Pi session. Approving a `whoami` on
 *   `deploy@host` covers every later non-privileged call on that same host
 *   until Pi exits — there is no rolling 15-min window like upstream.
 * - `SUDO_APPROVAL_TTL_MS`: for sudo-style calls a SEPARATE map uses a rolling
 *   30-min window per host. Re-approving extends the window. Set true on each
 *   privileged run that follows its own overlay.
 *
 * Fork change vs `xynogen/pix-ssh@v0.5.2`:
 *   - non-privileged: per-session (was 15 min rolling)
 *   - privileged: 30 min rolling (new map; was always re-prompted via
 *     `commandEscalatesPrivilege`/`sudo:true` short-circuit)
 *
 * Both windows are per `(user@host:port)` cache key and never persisted.
 */
export const SESSION_APPROVAL_TTL_MS = Number.POSITIVE_INFINITY;
export const SUDO_APPROVAL_TTL_MS = 30 * 60_000;

/**
 * True when `key` has a live (non-expired) approval in `map`; deletes the entry
 * on expiry so the map self-prunes. `now` and `ttlMs` are injectable for tests.
 *
 * TTL semantics:
 *   - finite positive TTL → entry stores its expiry epoch, checked against `now`
 *   - `Number.POSITIVE_INFINITY` TTL → entry stores `Infinity` and is always live
 *     for the life of the in-process Map (process exit self-clears it)
 */
export function hostApproved(
	map: Map<string, number>,
	key: string,
	now = Date.now(),
	ttlMs: number = SESSION_APPROVAL_TTL_MS,
): boolean {
	const expiry = map.get(key);
	if (expiry === undefined) return false;
	// Guard NaN: any comparison with NaN is false, so without this check a
	// NaN-tagged entry would be treated as live forever and never pruned.
	if (!Number.isFinite(expiry)) {
		map.delete(key);
		return false;
	}
	if (now >= expiry) {
		map.delete(key);
		return false;
	}
	return true;
}

/**
 * Mark `key` approved. If `ttlMs` is finite, store the absolute expiry epoch;
 * otherwise store `Infinity` so the entry stays live until process exit (no
 * prune work needed).
 */
export function markHostApproved(
	map: Map<string, number>,
	key: string,
	now = Date.now(),
	ttlMs: number = SESSION_APPROVAL_TTL_MS,
): void {
	map.set(key, ttlMs === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : now + ttlMs);
}

/**
 * True when the command text itself escalates privilege (sudo/su/doas/pkexec),
 * so per-host allow-memory must NOT auto-approve it even when `sudo:true` was
 * not passed. Word-boundary match; catches leading and mid-chain occurrences
 * (`… && sudo …`).
 */
export function commandEscalatesPrivilege(command: string): boolean {
	// Boundary class covers whitespace, semicolons, pipes, redirects,
	// backticks, single/double quotes, curly braces, square brackets,
	// and path separators (full/relative path invocation). Without the
	// extra classes, `` `sudo cmd` ``, `'sudo cmd'`, `/usr/bin/sudo cmd`,
	// `./sudo cmd`, `{sudo cmd}`, `[sudo cmd]` all bypassed detection.
	// Case-insensitive so `SUDO=1 sudo cmd` is still caught.
	return /(^|[\s;&|`'\"{}\[\]\/(])(sudo|su|doas|pkexec)\b/i.test(command);
}

// ── Local config override ────────────────────────────────────────────────────

/**
 * User-overridable config, read from `~/.pi/agent/ssh.json` at plugin load.
 * Intentionally outside the repo so the file is never committed by accident.
 * Missing file → fork defaults apply. Malformed JSON or wrong shape → warning
 * to stderr, fork defaults apply. Never throws.
 */
export interface SshRunConfig {
	/**
	 * When `false`, every ssh_run command is auto-approved without showing the
	 * confirmation overlay — the per-host approval-map TTLs are ignored.
	 * Password prompts still run when a login/sudo password is missing.
	 * Lets a local user lock the fork into "immer erlauben" mode for their
	 * own machine without editing package code.
	 *
	 * When `true` (default), the fork's TTL-map behavior applies: one Allow
	 * per host per session (non-priv, Infinity) and a 30-min rolling window
	 * for sudo.
	 */
	confirm: boolean;
	/**
	 * When set, overrides the IdentityFile used by `ssh`/`sshpass` invocations
	 * with this local path AND forces `IdentitiesOnly=yes`. Lets a user point
	 * the plugin at a key that lives elsewhere than what `~/.ssh/config`
	 * specifies (e.g. a Windows-hosted key when running on agent-pc).
	 * Falls back to the SSH-config IdentityFile if omitted.
	 */
	defaultIdentityFile?: string;
	/**
	 * When `false`, the masked password overlay for a missing sudo password
	 * is skipped — ssh_run sends the command with an empty sudo password.
	 * This is meant for hosts where `bsteimer` (or equivalent) has been given
	 * `NOPASSWD` sudo via /etc/sudoers.d/ (the probe for `sudoNoPassword` then
	 * succeeds before the overlay stage and promptFor stays empty). On hosts
	 * without NOPASSWD sudo, the remote sudo call will fail with a password
	 * prompt visible in the run output. Lets a local user lock the fork into
	 * "sudo: niemals nachfragen" mode for machines where the sudo policy is
	 * already strict on the remote side.
	 *
	 * When `true` (default), the fork's behavior applies: the masked sudo
	 * password overlay shows whenever a sudo password is missing.
	 */
	sudoConfirm?: boolean;
}

/** What the plugin uses when no config file is present. */
export const DEFAULT_SSH_RUN_CONFIG: SshRunConfig = {
	confirm: true,
};

/** Default path to the local config file. */
export const DEFAULT_SSH_RUN_CONFIG_PATH = join(homedir(), ".pi", "agent", "ssh.json");

/**
 * Read and validate the local config. Returns the fork defaults when the file
 * is missing, malformed, or carries the wrong shape. The path is injectable so
 * tests use a temp file instead of touching the user's real config.
 */
export function loadSshConfig(path: string = DEFAULT_SSH_RUN_CONFIG_PATH): SshRunConfig {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch {
		return DEFAULT_SSH_RUN_CONFIG;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`ssh_run: ignoring malformed ${path}: ${msg}\n`);
		return DEFAULT_SSH_RUN_CONFIG;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		process.stderr.write(`ssh_run: ignoring ${path} — expected JSON object\n`);
		return DEFAULT_SSH_RUN_CONFIG;
	}
	const obj = parsed as Record<string, unknown>;
	// Default identity / sudoConfirm-only configs are valid — fall through to
	// the per-key parser and inherit confirm:true from the defaults. The old
	// early-out dropped defaultIdentityFile silently (Logic #45).
	if (!("confirm" in obj) && !("defaultIdentityFile" in obj) && !("sudoConfirm" in obj)) {
		return DEFAULT_SSH_RUN_CONFIG;
	}
	if (typeof obj.confirm !== "boolean") {
		process.stderr.write(`ssh_run: ignoring ${path} — "confirm" must be boolean\n`);
		return DEFAULT_SSH_RUN_CONFIG;
	}
	let defaultIdentityFile: string | undefined;
	if ("defaultIdentityFile" in obj) {
		if (typeof obj.defaultIdentityFile !== "string" || obj.defaultIdentityFile.length === 0) {
			process.stderr.write(`ssh_run: ignoring ${path} — "defaultIdentityFile" must be non-empty string\n`);
		} else {
			defaultIdentityFile = obj.defaultIdentityFile;
		}
	}
	let sudoConfirm: boolean | undefined;
	if ("sudoConfirm" in obj) {
		if (typeof obj.sudoConfirm !== "boolean") {
			process.stderr.write(`ssh_run: ignoring ${path} — "sudoConfirm" must be boolean\n`);
		} else {
			sudoConfirm = obj.sudoConfirm;
		}
	}
	return { confirm: obj.confirm, defaultIdentityFile, sudoConfirm };
}

/** ControlPersist window (seconds) — the multiplexed connection lingers this
 * long after the last call, so repeat commands skip re-auth. */
const CONTROL_PERSIST_SECONDS = 120;
const CONNECT_TIMEOUT_SECONDS = 10;

export interface HostSpec {
	user?: string;
	host: string;
	port?: number;
}

export interface SshResult {
	stdout: string;
	stderr: string;
	code: number;
}

export type TransferDirection = "upload" | "download";
export type UnattendedMode = "off" | "afk" | "yolo";

/** Warning-level transfer policy. Password prompts cannot run unattended. */
export function transferApprovalDecision(
	mode: UnattendedMode,
	loginPasswordMissing: boolean,
): "ask" | "allow" | "deny" {
	if (mode === "off") return "ask";
		// AFK: user is away — never auto-approve a transfer (mirrors command
		// path which already denies on AFK). YOLO/AFK+OOPasswordMissing → deny.
		if (mode === "afk") return "deny";
		return loginPasswordMissing ? "deny" : "allow";
	return loginPasswordMissing ? "deny" : "allow";
}

// ── Host parsing ─────────────────────────────────────────────────────────────

/** Parse `[user@]host[:port]` into parts. Throws on empty host. */
export function parseHost(spec: string): HostSpec {
	const trimmed = spec.trim();
	if (!trimmed) throw new Error("Empty host");

	let user: string | undefined;
	let rest = trimmed;
	const at = rest.lastIndexOf("@");
	if (at !== -1) {
		user = rest.slice(0, at) || undefined;
		rest = rest.slice(at + 1);
	}

	let port: number | undefined;
	// IPv6 literals use brackets: [::1]:22 — only split a port off the tail
	// when there is exactly one colon (plain host:port), leaving bare IPv6 alone.
	// A bare IPv6 with a port (e.g. fe80::1:22) is ambiguous (last colon could
	// be a port or part of the address) — OpenSSH requires brackets, so we
	// accept it as the host and warn via stderr (Logic #53).
	const colons = rest.split(":").length - 1;
	if (rest.startsWith("[")) {
		const end = rest.indexOf("]");
		const hostPart = rest.slice(1, end);
		const tail = rest.slice(end + 1);
		if (tail.startsWith(":")) port = parsePort(tail.slice(1));
		rest = hostPart;
	} else if (colons === 1) {
		const [h, p] = rest.split(":");
		rest = h ?? "";
		port = parsePort(p ?? "");
	} else if (colons > 1) {
		// Bare IPv6 — keep as host, no port parse (RFC requires brackets).
	}

	if (!rest) throw new Error(`Invalid host: ${spec}`);
	// Hint when a user typed a likely-typo bare IPv6:port (fe80::1:22).
	if (colons > 1 && rest.split(":").length > 2) {
		process.stderr.write(
			`ssh_run: host "${rest}" looks like a bare IPv6 with a port — ` +
			`use [${rest}]:22 form to disambiguate\n`,
		);
	}
	return { user, host: rest, ...(port !== undefined ? { port } : {}) };
}

function parsePort(value: string): number {
	const trimmed = value.trim();
	const n = Number.parseInt(trimmed, 10);
	// Strict check: parseInt("22extra") returns 22 silently. Require the
	// trimmed input to round-trip as a decimal integer literal so trailing
	// garbage is rejected instead of silently accepting a partial port.
	if (!Number.isInteger(n) || n < 1 || n > 65535 || String(n) !== trimmed) {
		throw new Error(`Invalid port: ${value}`);
	}
	return n;
}

/** Parse effective destination fields emitted by OpenSSH's `ssh -G`. */
export function parseSshConfig(output: string): HostSpec | undefined {
	const values = new Map(
		output
			.split("\n")
			.map((line) => line.trim().split(/\s+/, 2))
			.filter((parts): parts is [string, string] => parts.length === 2),
	);
	const user = values.get("user");
	const host = values.get("hostname");
	const port = values.get("port");
	if (!user || !host || !port) return undefined;
	return { user, host, port: parsePort(port) };
}

/** Resolve aliases through OpenSSH config, including Include and Match rules. */
export function resolveSshHost(spec: HostSpec, signal?: AbortSignal): Promise<HostSpec> {
	const args = ["-G"];
	if (spec.port !== undefined) args.push("-p", String(spec.port));
	args.push(hostTarget(spec));

	return new Promise((resolve) => {
		let stdout = "";
		const proc = spawn(SSH_BIN, args, { stdio: ["ignore", "pipe", "ignore"] });
		proc.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		proc.on("error", () => resolve(spec));
		proc.on("close", (code) => resolve(code === 0 ? (parseSshConfig(stdout) ?? spec) : spec));
		signal?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
	});
}

// ── Host inventory (info action) ─────────────────────────────────────────────

export interface HostAlias {
	alias: string;
	hostname?: string;
	user?: string;
	port?: string;
	proxyJump?: string;
	identityFile?: string;
}

export interface HostInfo {
	hostname?: string;
	user?: string;
	port?: string;
	proxyJump?: string;
	identityFile?: string;
}

/** Fields we surface from an ssh config Host block or `ssh -G` output. */
const INFO_KEYS: Record<string, keyof HostInfo> = {
	hostname: "hostname",
	user: "user",
	port: "port",
	proxyjump: "proxyJump",
	identityfile: "identityFile",
};

/**
 * Parse `Host` blocks out of an ssh_config text. Returns one entry per alias
 * token (a single `Host a b` line yields two aliases). Wildcard-only patterns
 * (`*`, `?`, `!`) are skipped since they aren't connectable targets. Keys are
 * matched case-insensitively; the first value for a key within a block wins
 * (OpenSSH "first obtained value" semantics).
 */
export function parseHostAliases(text: string): HostAlias[] {
	const out: HostAlias[] = [];
	let current: HostAlias[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.replace(/#.*$/, "").trim();
		if (!line) continue;
		const [keyRaw, ...rest] = line.split(/\s+/);
		const key = (keyRaw ?? "").toLowerCase();
		const value = rest.join(" ");
		if (key === "host") {
			current = rest.filter((p) => !/[*?!]/.test(p)).map((alias) => ({ alias }));
			out.push(...current);
		} else if (current.length > 0) {
			const field = INFO_KEYS[key];
			if (field && value) {
				for (const entry of current) {
					if (entry[field] === undefined) entry[field] = value;
				}
			}
		}
	}
	return out;
}

/** Expand a Path with a leading `~` and resolve relative Includes against
 * the containing config's directory (OpenSSH semantics). */
function expandConfigPath(pattern: string, baseDir: string): string {
	let p = pattern;
	if (p.startsWith("~/")) p = join(homedir(), p.slice(2));
	else if (p === "~") p = homedir();
	return isAbsolute(p) ? p : resolvePath(baseDir, p);
}

/**
 * Read an ssh_config file and every file it pulls in via `Include`, returning
 * the concatenated Host aliases. Missing files and glob misses are ignored
 * (OpenSSH tolerates them). `seen` guards against Include cycles.
 */
export function readSshConfigAliases(
	path = join(homedir(), ".ssh", "config"),
	seen = new Set<string>(),
): HostAlias[] {
	if (seen.has(path)) return [];
	seen.add(path);
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch {
		return [];
	}
	const baseDir = join(homedir(), ".ssh");
	const out: HostAlias[] = [];
	for (const raw of text.split("\n")) {
		const line = raw.replace(/#.*$/, "").trim();
		const [keyRaw, ...rest] = line.split(/\s+/);
		if ((keyRaw ?? "").toLowerCase() === "include") {
			for (const pattern of rest) {
				const expanded = expandConfigPath(pattern, baseDir);
				let matches: string[] = [];
				try {
					matches = globSync(expanded);
				} catch {
					matches = [];
				}
				for (const file of matches.sort()) out.push(...readSshConfigAliases(file, seen));
			}
		}
	}
	out.push(...parseHostAliases(text));
	return out;
}

/** Full effective config for one host via `ssh -G` (no connection made). */
export function parseHostInfo(output: string): HostInfo {
	const info: HostInfo = {};
	for (const line of output.split("\n")) {
		const [keyRaw, ...rest] = line.trim().split(/\s+/);
		const field = INFO_KEYS[(keyRaw ?? "").toLowerCase()];
		const value = rest.join(" ");
		if (field && value && info[field] === undefined) info[field] = value;
	}
	return info;
}

/** Run `ssh -G <host>` and return its effective config. Never connects. */
export function resolveHostInfo(spec: HostSpec, signal?: AbortSignal): Promise<HostInfo> {
	const args = ["-G"];
	if (spec.port !== undefined) args.push("-p", String(spec.port));
	args.push(hostTarget(spec));
	return new Promise((resolve) => {
		let stdout = "";
		const proc = spawn(SSH_BIN, args, { stdio: ["ignore", "pipe", "ignore"] });
		proc.stdout.on("data", (c: Buffer) => {
			stdout += c.toString();
		});
		proc.on("error", () => resolve({}));
		proc.on("close", (code) => resolve(code === 0 ? parseHostInfo(stdout) : {}));
		signal?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
	});
}

/** Canonical `[user@]host` target string for ssh argv. */
export function hostTarget(spec: HostSpec): string {
	return spec.user ? `${spec.user}@${spec.host}` : spec.host;
}

/** Stable per-host ControlMaster socket path (survives across calls in a
 * session so multiplexing can reuse the connection). */
export function controlPathFor(spec: HostSpec): string {
	const key = `${spec.user ?? ""}@${spec.host}:${spec.port ?? 22}`;
	const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
	return join(tmpdir(), `pix-ssh-${hash}.sock`);
}

// ── ssh argv construction ────────────────────────────────────────────────────

/** Module-level override for the SSH identity file. Set by src/index.ts once
 * at plugin load (from ssh.json). When set, every ssh/sshpass invocation
 * uses this key with `IdentitiesOnly=yes`, bypassing whatever the user's
 * `~/.ssh/config` says (which can point at a Windows path that doesn't
 * exist on the agent-pc runtime). */
let identityFileOverride: string | undefined;

export function setIdentityFileOverride(path: string | undefined): void {
	identityFileOverride = path;
}

/** Base ssh options shared by every invocation: multiplexing + timeouts +
 * non-interactive prompts (BatchMode is toggled by the caller). */
function connectionArgs(spec: HostSpec, controlPath: string, portFlag: "-p" | "-P"): string[] {
	const args = [
		"-o",
		"ControlMaster=auto",
		"-o",
		`ControlPath=${controlPath}`,
		"-o",
		`ControlPersist=${CONTROL_PERSIST_SECONDS}`,
		"-o",
		`ConnectTimeout=${CONNECT_TIMEOUT_SECONDS}`,
		"-o",
		"StrictHostKeyChecking=accept-new",
	];
	if (identityFileOverride) {
		args.push("-i", identityFileOverride, "-o", "IdentitiesOnly=yes");
	}
	if (spec.port !== undefined) args.push(portFlag, String(spec.port));
	return args;
}

export function baseSshArgs(spec: HostSpec, controlPath: string): string[] {
	return connectionArgs(spec, controlPath, "-p");
}

/** SCP shares SSH connection options but uses uppercase `-P` for its port. */
export function baseScpArgs(spec: HostSpec, controlPath: string, recursive: boolean): string[] {
	return [...connectionArgs(spec, controlPath, "-P"), ...(recursive ? ["-r"] : [])];
}

/** Format SCP's remote endpoint, bracketing IPv6 literals. */
export function remoteTransferPath(spec: HostSpec, path: string): string {
	const host = spec.host.includes(":") ? `[${spec.host}]` : spec.host;
	return `${spec.user ? `${spec.user}@` : ""}${host}:${path}`;
}

export function transferArgs(
	spec: HostSpec,
	direction: TransferDirection,
	source: string,
	destination: string,
): string[] {
	return direction === "upload"
		? [source, remoteTransferPath(spec, destination)]
		: [remoteTransferPath(spec, source), destination];
}

/** Wrap a command for optional remote sudo. `sudo -S -p ''` reads the sudo
 * password from stdin with no prompt echo; the command runs under `sh -c`. */
export function remoteCommand(command: string, sudo: boolean): string {
	if (!sudo) return command;
	return `sudo -S -p '' -- sh -c ${shellQuote(command)}`;
}

/** Single-quote a string for POSIX sh (wrap in quotes, escape embedded quotes). */
export function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

// ── Auth-failure detection ───────────────────────────────────────────────────

/** SSH-level auth/connection failure (wrong login password, refused, etc.). */
export function detectSshFailure(code: number, stderr: string): boolean {
	if (code === 0) return false;
	const lower = stderr.toLowerCase();
	return (
		lower.includes("permission denied") ||
		lower.includes("connection refused") ||
		lower.includes("connection timed out") ||
		lower.includes("could not resolve hostname") ||
		lower.includes("no route to host") ||
		lower.includes("host key verification failed")
	);
}

/** Remote sudo password failure. */
export function detectSudoFailure(stderr: string): boolean {
	const lower = stderr.toLowerCase();
	return (
		lower.includes("incorrect password") ||
		lower.includes("sudo: a password is required") ||
		lower.includes("authentication failure") ||
		lower.includes("sorry, try again")
	);
}

/** Strip the remote sudo prompt lines from stderr (we pass `-p ''` but some
 * sudo builds still emit a newline or prompt fragment). */
export function filterSudoPrompt(raw: string): string {
	return raw
		.split("\n")
		.filter((l) => !/^\s*(\[sudo\] )?password( for .*)?:?\s*$/i.test(l))
		.join("\n");
}

// ── Output truncation ────────────────────────────────────────────────────────

/**
	 * Roll back to the last valid UTF-8 boundary inside a Buffer subarray.
	 * Required because `Buffer.subarray(0, n)` keeps raw bytes — if n lands
	 * mid-codepoint, `toString("utf8")` injects U+FFFD for the partial
	 * sequence. A 4-byte emoji cut at byte 50 produces a string with a
	 * replacement char; rolling back the trailing continuation bytes
	 * gives a clean truncation.
	 */
function sliceAtUtf8Boundary(buf: Buffer, maxBytes: number): number {
	let end = Math.min(maxBytes, buf.length);
	// 0b10xxxxxx is a continuation byte; back up while we see them so the
	// preceding byte (a lead byte) is followed by its full codepoint.
	while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
	// If we walked back to within a lead byte that has no room for its
	// sequence, drop the lead byte too. (Lead bytes are 0xxxxxxx or
	// 11xxxxxx; ASCII lead (0xxxxxxx) is fine to keep.)
	if (end > 0) {
		const lead = buf[end - 1];
		if ((lead & 0x80) !== 0) {
			// Multi-byte lead: figure out expected length from the first byte.
			const expectedLen =
				(lead & 0xe0) === 0xc0 ? 2 : (lead & 0xf0) === 0xe0 ? 3 : (lead & 0xf8) === 0xf0 ? 4 : 1;
			const have = buf.length - (end - 1);
			if (have < expectedLen) end--;
		}
	}
	return end;
}

export function truncate(
	text: string,
	maxLines = MAX_OUTPUT_LINES,
	maxBytes = MAX_OUTPUT_BYTES,
): { text: string; truncated: boolean } {
	const lines = text.split("\n");
	const byteLen = Buffer.byteLength(text, "utf8");
	if (lines.length <= maxLines && byteLen <= maxBytes) {
		return { text, truncated: false };
	}
	const kept = lines.slice(0, maxLines);
	let result = kept.join("\n");
	if (Buffer.byteLength(result, "utf8") > maxBytes) {
		const buf = Buffer.from(result, "utf8");
		const safeEnd = sliceAtUtf8Boundary(buf, maxBytes);
		result = buf.subarray(0, safeEnd).toString("utf8");
	}
	return { text: result, truncated: true };
}

// ── Runners ──────────────────────────────────────────────────────────────────

/** Outcome of the key-auth probe. `ok` = connected without a password;
 * `auth` = reachable but needs a password; `unreachable` = host down / timeout
 * / DNS — a password won't help, so don't prompt. */
export type ProbeResult = "ok" | "auth" | "unreachable";

/**
 * Probe key-based (or agent, or existing-master) auth with `BatchMode=yes` so
 * ssh never prompts. Distinguishes three cases from the exit code + stderr:
 * clean connect (ok), auth rejected but host reachable (auth), and
 * connection/DNS failure (unreachable) — the last must NOT trigger a password
 * prompt, since a login password can't fix an unreachable host.
 */
export function probeKeyAuth(
	spec: HostSpec,
	controlPath: string,
	signal?: AbortSignal,
): Promise<ProbeResult> {
	const args = [...baseSshArgs(spec, controlPath), "-o", "BatchMode=yes", hostTarget(spec), "true"];
	return new Promise((resolve) => {
		let stderr = "";
		const proc = spawn(SSH_BIN, args, { stdio: ["ignore", "ignore", "pipe"] });
		proc.stderr.on("data", (c: Buffer) => {
			stderr += c.toString();
		});
		proc.on("error", () => resolve("unreachable"));
		proc.on("close", (code) => {
			if (code === 0) return resolve("ok");
			if (isUnreachable(stderr)) return resolve("unreachable");
			resolve("auth");
		});
		signal?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
	});
}

/**
 * Validate an SSH *login* password by attempting one real password auth. Forces
 * password auth (no pubkey/agent) with a single prompt, fed via `sshpass -e`
 * (env, never argv). Returns true only on a clean login; an auth rejection
 * returns false so the overlay can re-prompt. Unreachable/spawn errors return
 * true — a password can't fix connectivity, so defer to the real run instead of
 * burning retry attempts. ponytail: each call is one fresh connection (its own
 * MaxAuthTries counter, NumberOfPasswordPrompts=1), so retries don't stack
 * toward a per-connection lockout; a host with fail2ban-style IP banning is the
 * ceiling — then drop back to a single prompt.
 */
export function probePasswordAuth(
	spec: HostSpec,
	controlPath: string,
	password: string,
	signal?: AbortSignal,
): Promise<boolean> {
	const args = [
		"-e",
		"ssh",
		...baseSshArgs(spec, controlPath),
		"-o",
		"BatchMode=no",
		"-o",
		"PubkeyAuthentication=no",
		"-o",
		"PreferredAuthentications=password",
		"-o",
		"NumberOfPasswordPrompts=1",
		hostTarget(spec),
		"true",
	];
	return new Promise((resolve) => {
		let stderr = "";
		const proc = spawn(SSHPASS_BIN, args, {
			stdio: ["ignore", "ignore", "pipe"],
			env: { ...process.env, [SSHPASS_ENV]: password },
		});
		proc.stderr.on("data", (c: Buffer) => {
			stderr += c.toString();
		});
		proc.on("error", () => resolve(true));
		proc.on("close", (code) => {
			if (code === 0) return resolve(true);
			if (isUnreachable(stderr)) return resolve(true);
			resolve(false);
		});
		signal?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
	});
}

/**
 * Probe whether remote sudo runs without a password (NOPASSWD sudoers).
 * Probes with the ACTUAL command wrapped via shellQuote rather than the
 * generic `sudo -n true` — sudoers rules are command-specific
 * (`deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx`), so a
 * true-probe would false-negative and trigger an overlay prompt for a
 * NOPASSWD-only command. Returns true when no sudo password is needed
 * for this command. Requires a passwordless SSH connection (key/agent
 * /existing-master or a cached login password) — the probe opens its
 * own channel with `BatchMode=yes`, so callers must only probe when
 * SSH login auth already succeeds without prompting.
 */
export function probeSudoNoPassword(
	spec: HostSpec,
	controlPath: string,
	command: string,
	signal?: AbortSignal,
): Promise<boolean> {
	const args = [
		...baseSshArgs(spec, controlPath),
		"-o",
		"BatchMode=yes",
		hostTarget(spec),
		`sudo -n -- sh -c ${shellQuote(command)}`,
	];
	return new Promise((resolve) => {
		const proc = spawn(SSH_BIN, args, { stdio: ["ignore", "ignore", "ignore"] });
		proc.on("error", () => resolve(false));
		proc.on("close", (code) => resolve(code === 0));
		signal?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
	});
}

/** Connection/DNS-level failure (not an auth rejection) — a password can't fix it. */
export function isUnreachable(stderr: string): boolean {
	const lower = stderr.toLowerCase();
	return (
		lower.includes("connection timed out") ||
		lower.includes("connection refused") ||
		lower.includes("could not resolve hostname") ||
		lower.includes("no route to host") ||
		lower.includes("network is unreachable") ||
		lower.includes("operation timed out")
	);
}

export interface RunOptions {
	/** SSH login password (only used when key auth failed). Fed via SSHPASS env. */
	loginPassword?: string;
	/** Run the remote command under sudo -S. */
	sudo?: boolean;
	/** Remote sudo password, piped to sudo's stdin. */
	sudoPassword?: string;
	controlPath: string;
	signal?: AbortSignal;
}

/**
 * Run `command` on the remote host. When `loginPassword` is set, ssh is wrapped
 * in `sshpass -e` (password via env, not argv). When `sudo` is set, the command
 * is wrapped in `sudo -S` and `sudoPassword` is written to the remote stdin.
 */
export function runTransfer(
	spec: HostSpec,
	direction: TransferDirection,
	source: string,
	destination: string,
	recursive: boolean,
	opts: Pick<RunOptions, "controlPath" | "loginPassword" | "signal">,
): Promise<SshResult> {
	const endpoint = ["--", ...transferArgs(spec, direction, source, destination)];
	const bin = opts.loginPassword ? SSHPASS_BIN : SCP_BIN;
	// Same rule as runSsh: without a password in hand, force BatchMode so scp
	// never opens its own /dev/tty prompt. sshpass path keeps prompts on.
	const args = opts.loginPassword
		? ["-e", "scp", ...baseScpArgs(spec, opts.controlPath, recursive), ...endpoint]
		: [...baseScpArgs(spec, opts.controlPath, recursive), "-o", "BatchMode=yes", ...endpoint];
	const env = opts.loginPassword ? { ...process.env, [SSHPASS_ENV]: opts.loginPassword } : process.env;
	return spawnResult(bin, args, env, opts.signal);
}

/**
 * Build the ssh/sshpass argv for a run.
 *
 * Without a login password, force `BatchMode=yes` so ssh NEVER falls back to a
 * `/dev/tty` password prompt (which leaks into the TUI). A run-time auth failure
 * then returns a clean error the caller surfaces — all interactive password
 * entry goes through the overlay + `sshpass`. With a password, BatchMode stays
 * off so sshpass can answer ssh's own prompt.
 */
export function buildRunSshArgs(
	spec: HostSpec,
	command: string,
	opts: Pick<RunOptions, "controlPath" | "loginPassword" | "sudo">,
): { bin: string; args: string[] } {
	const remote = remoteCommand(command, opts.sudo === true);
	const base = baseSshArgs(spec, opts.controlPath);
	if (opts.loginPassword) {
		return { bin: "sshpass", args: ["-e", "ssh", ...base, hostTarget(spec), remote] };
	}
	return { bin: "ssh", args: [...base, "-o", "BatchMode=yes", hostTarget(spec), remote] };
}

export function runSsh(spec: HostSpec, command: string, opts: RunOptions): Promise<SshResult> {
	const { bin, args } = buildRunSshArgs(spec, command, opts);
	const env = opts.loginPassword ? { ...process.env, [SSHPASS_ENV]: opts.loginPassword } : process.env;

	// Remote sudo reads its password from stdin (first line); anything else
	// closes stdin so the remote command sees EOF.
	const stdin = opts.sudo && opts.sudoPassword !== undefined ? `${opts.sudoPassword}\n` : undefined;
	return spawnResult(bin, args, env, opts.signal, opts.sudo ? filterSudoPrompt : undefined, stdin);
}

function spawnResult(
	bin: string,
	args: string[],
	env: NodeJS.ProcessEnv,
	sig?: AbortSignal,
	filterStderr?: (value: string) => string,
	stdin?: string,
): Promise<SshResult> {
	return new Promise((resolve, reject) => {
		const proc = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], env });
		let stdout = "";
		let stderr = "";
		proc.stdout.on("data", (c: Buffer) => {
			stdout += c.toString();
		});
		proc.stderr.on("data", (c: Buffer) => {
			const value = filterStderr ? filterStderr(c.toString()) : c.toString();
			if (value) stderr += value;
		});
		proc.on("error", reject);
		proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
		if (stdin) proc.stdin.write(stdin);
		proc.stdin.end();
		signal(sig, proc, reject);
	});
}

function signal(
	sig: AbortSignal | undefined,
	proc: ReturnType<typeof spawn>,
	reject: (e: Error) => void,
): void {
	if (!sig) return;
	let killed = false;
	const handler = () => {
		if (killed) return;
		killed = true;
		// Try graceful first; if the child ignores SIGTERM (stuck in a 3rd-party
		// binary, ControlMaster socket, etc.) escalate to SIGKILL after 5s.
		proc.kill("SIGTERM");
		setTimeout(() => {
			if (!proc.killed) proc.kill("SIGKILL");
		}, 5000);
		// Distinct error so the caller can render "cancelled by abort" instead
		// of generic "Cancelled".
		reject(new Error("aborted by signal"));
	};
	sig.addEventListener("abort", handler, { once: true });
	// Drop the listener once the child exits naturally so long-lived signals
	// don't accumulate listeners across many spawn calls.
	proc.once("close", () => sig.removeEventListener("abort", handler));
}
