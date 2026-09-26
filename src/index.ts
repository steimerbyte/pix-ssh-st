/**
 * pix-ssh — Pi extension
 *
 * Registers an `ssh_run` tool: run a command or transfer files/directories over
 * SSH. Commands may optionally run as root through remote sudo. One overlay
 * handles confirmation and any needed password entry, mirroring pix-sudo.
 *
 * Auth:
 *   - SSH: key/agent/existing-master first (BatchMode probe). If that fails,
 *     a masked overlay collects the login password (fed to `sshpass -e` via
 *     env — never argv, never disk). Login password is cached in-memory per
 *     host for the session.
 *   - Remote sudo (`sudo: true`): a separate masked prompt collects the remote
 *     sudo password, piped to the remote `sudo -S` on stdin (inside the
 *     encrypted channel). Cached in-memory per host for the session.
 *
 * Connection reuse: OpenSSH ControlMaster multiplexing keeps one authenticated
 * connection per host alive (ControlPersist window), so repeat calls skip
 * re-auth.
 *
 * Security notes:
 *   - Passwords never leave JS memory; never written to disk; never in argv.
 *   - File transfers are warning-level and show their overwrite risk in the UI.
 *   - No UI (RPC / JSON mode) = blocked immediately.
 *   - Output truncated to 50 KB / 2000 lines.
 */

import type { AgentToolUpdateCallback, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { FG_DIM, RST, resolveBaseBackground } from "@xynogen/pix-pretty/ansi";
import { MAX_PREVIEW_LINES } from "@xynogen/pix-pretty/config";
import { type OverlayResult, showOverlay } from "@xynogen/pix-pretty/gate-overlay";
import { icon } from "@xynogen/pix-pretty/icon-catalog";
import { renderBashOutput } from "@xynogen/pix-pretty/renderers";
import type {
	Theme,
	ToolRenderContext,
	ToolRenderResultOptions,
	AgentToolResult,
} from "@earendil-works/pi-coding-agent";
import {
	dotJoin,
	fillToolBackground,
	frameToolResult,
	getTextContent,
	hideCollapsedToolCall,
	normalizeLineEndings,
	renderCollapsedToolRow,
	renderToolError,
	ruleFrame,
	sectionRule,
	termW,
	unframeToolResult,
} from "@xynogen/pix-pretty/utils";
import { SPINNER } from "@xynogen/pix-pretty/widget-format";
import { getUnattendedMode, withAgentBlock } from "@xynogen/pix-runtime";
import { type CollapseState, tickCollapse } from "@xynogen/pix-runtime/collapse";
import { Type } from "typebox";
import {
	commandEscalatesPrivilege,
	controlPathFor,
	detectSshFailure,
	type ApprovalEntry,
	detectSudoFailure,
	type HostAlias,
	type HostInfo,
	type HostSpec,
	hostApproved,
	hostTarget,
	markHostApproved,
	MAX_OUTPUT_BYTES,
	MAX_OUTPUT_LINES,
	parseHost,
	probeKeyAuth,
	probePasswordAuth,
	probeSudoNoPassword,
	readSshConfigAliases,
	resolveHostInfo,
	resolveSshHost,
	runSsh,
	runTransfer,
	type TransferDirection,
	transferApprovalDecision,
	truncate,
	SESSION_APPROVAL_TTL_MS,
	SUDO_APPROVAL_TTL_MS,
	loadSshConfig,
	setIdentityFileOverride,
} from "./lib.ts";

const PROMPT_TIMEOUT_MS = 60_000;
const MAX_PASSWORD_ATTEMPTS = 3;
// Spinner refresh interval — exported so tests can override it without
// monkey-patching the module. Kept short enough for liveness but slow
// enough to avoid burning cycles on long transfers.
export const SPINNER_INTERVAL_MS = 120;

// In-memory per-host credential cache (session-scoped, never persisted).
// Key = canonical "user@host:port". Cleared on process exit.
interface HostCreds {
	loginPassword?: string;
	sudoPassword?: string;
}
const credCache = new Map<string, HostCreds>();

// Per-host allow-memory (fork policy):
//   - `approvedHosts` covers NON-privileged commands and never expires for the
//     life of the Pi session (Infinity). One Allow per host per session.
//   - `approvedSudoHosts` covers PRIVILEGED commands (`sudo:true` or any
//     sudo/su/doas/pkexec token in the command text). 30-min rolling window.
// Password prompts are NOT skipped — a still-missing login or sudo password
// always re-prompts. Each auto-approve emits a visible notify so the decision is
// never silent. Maps never leave process memory (process exit clears them).

// Local override (read once at plugin load): `~/.pi/agent/ssh.json`. NOT
// committed to git — the user sets it on their own machine.
//
//   confirm: false → immer erlauben. Overlay wird komplett uebergangen,
//                    Password-Prompt laeuft weiter wenn noetig, die
//                    approvedHosts / approvedSudoHosts Maps bleiben ungenutzt.
//   confirm: true  (default) → fork's TTL-Map Verhalten: ein Allow pro Host
//                    pro Session (non-priv) bzw. 30-min Rolling (sudo).
const sshRunConfig = loadSshConfig();
setIdentityFileOverride(sshRunConfig.defaultIdentityFile);
const approvedHosts = new Map<string, ApprovalEntry>();
const approvedSudoHosts = new Map<string, ApprovalEntry>();

function cacheKey(spec: HostSpec): string {
	return `${spec.user ?? ""}@${spec.host}:${spec.port ?? 22}`;
}

/**
 * Overlay password validator for a prompt stage. The login stage tests the
 * password against the host (wrong one re-prompts up to MAX_PASSWORD_ATTEMPTS);
 * the sudo stage can't be probed before login, so it only rejects a blank entry
 * and surfaces a real failure on the run.
 */
export function validatorFor(
	stage: "login" | "sudo",
	spec: HostSpec,
	controlPath: string,
	sig?: AbortSignal,
): (pw: string) => Promise<boolean> {
	if (stage !== "login") return (pw) => Promise.resolve(pw.trim().length > 0);
	return (pw) =>
		pw.trim().length === 0 ? Promise.resolve(false) : probePasswordAuth(spec, controlPath, pw, sig);
}

type SshOutcome =
	| "awaiting-approval"
	| "running"
	| "success"
	| "denied"
	| "timed-out"
	| "cancelled"
	| "error";

type SshCancellationKind = "denied" | "timeout" | "missing-password" | "aborted";
type SshErrorKind = "no-ui" | "auth-ssh" | "auth-sudo" | "execution" | "no-result" | "exit-code";

export interface SshResultDetails {
	_type: "sshResult";
	command: string;
	host: string;
	sudo?: boolean;
	reason?: string;
	outcome: SshOutcome;
	exitCode?: number;
	lineCount?: number;
	truncated?: boolean;
	cancellationKind?: SshCancellationKind;
	errorKind?: SshErrorKind;
	_render?: string;
}

// Flat shape mirroring the single Type.Object schema. Conditional fields are
// optional here and validated at runtime by normalizeOperation.
type SshParams = {
	action?: "command" | "file" | "info";
	host?: string;
	command?: string;
	sudo?: boolean;
	direction?: TransferDirection;
	source?: string;
	destination?: string;
	recursive?: boolean;
	reason?: string;
};

/**
	 * Discriminated union of every supported ssh_run operation. Each
	 * variant carries only the fields it needs — `command` and `sudo`
	 * are absent for file/info because they don't apply. Consumers
	 * narrow on `kind` and TypeScript proves exhaustiveness via the
	 * `never` guard in each switch's default branch.
	 */
export type Op =
	| { kind: "command"; command: string; sudo: boolean; reason?: string }
	| { kind: "file"; source: string; destination: string; direction: TransferDirection; recursive: boolean; reason?: string }
	| { kind: "info"; host?: string };

function normalizeOperation(params: SshParams): Op {
	const action = params.action ?? "command";
	switch (action) {
		case "command":
			return {
				kind: "command",
				command: params.command ?? "",
				sudo: params.sudo === true,
					...(params.reason ? { reason: params.reason } : {}),
			};
		case "file": {
			const source = (params.source ?? "").trim();
			const destination = (params.destination ?? "").trim();
			// Pre-flight guard for missing direction (BLOCKING UX/UI #1). The
			// previous code silently defaulted to "upload" which is a
			// data-loss risk. Fail loudly so the model fixes its call shape.
			if (!params.direction) {
				throw new Error('direction ("upload"|"download") is required when action is "file"');
			}
			return {
				kind: "file",
				source,
				destination,
				direction: params.direction,
				recursive: params.recursive === true,
					...(params.reason ? { reason: params.reason } : {}),
			};
		}
		case "info":
			return {
				kind: "info",
					...(params.host ? { host: params.host } : {}),
			};
		default: {
			// Exhaustiveness guard — adding a new action variant to the SshParams
			// union breaks here at compile time so this switch is kept in sync.
			const _exhaustive: never = action;
			throw new Error(`unknown action: ${String(_exhaustive)}`);
		}
	}
}

function approvalBody(op: Op, host: string, port?: number): string[] {
	const base = [
		op.reason?.trim() ? `Intent: ${op.reason.trim()}` : "No reason provided by AI",
		`Host: ${host}${port ? ` (port ${port})` : ""}`,
	];
	switch (op.kind) {
		case "command":
			return [...base, `Command: ${op.sudo ? "sudo " : ""}${op.command}`];
		case "file":
			return [
				...base,
					`Direction: ${op.direction === "download" ? "Download" : "Upload"}`,
					`From: ${op.source}`,
					`To: ${op.destination}`,
					`Mode: ${op.recursive ? "Recursive copy" : "Single item"}`,
					"Warning: existing destination may be overwritten",
				];
		case "info":
			return [...base, "Action: info (read SSH config)"];
		default: {
			const _exhaustive: never = op;
			throw new Error(`unknown op kind: ${String(_exhaustive)}`);
		}
	}
}

function safeOneLine(value: string): string {
	return value
		.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function makeDetails(
	command: string,
	host: string,
	sudo: boolean,
	reason: string | undefined,
	fields: Omit<SshResultDetails, "_type" | "command" | "host" | "sudo" | "reason">,
): SshResultDetails {
	return {
		_type: "sshResult",
		command,
		host,
		sudo,
		...(reason?.trim() ? { reason: reason.trim() } : {}),
		...fields,
	};
}

function outputLineCount(output: string): number {
	const normalized = normalizeLineEndings(output).replace(/^\n+|\n+$/g, "");
	return normalized ? normalized.split("\n").length : 0;
}

function updatePresentation(
	onUpdate: AgentToolUpdateCallback<SshResultDetails> | undefined,
	command: string,
	host: string,
	sudo: boolean,
	reason: string | undefined,
	outcome: "awaiting-approval" | "running",
	message?: string,
): void {
	onUpdate?.({
		content: [
			{
				type: "text",
				text:
					message ??
					(outcome === "awaiting-approval" ? "Awaiting approval…" : `Running on ${host}…`),
			},
		],
		details: makeDetails(command, host, sudo, reason, { outcome }),
	});
}

function terminalMeta(details: SshResultDetails): string {
	if (details.outcome === "denied") return "denied";
	if (details.outcome === "timed-out") return "timed out";
	if (details.outcome === "cancelled") {
		return details.cancellationKind === "missing-password" ? "no password" : "cancelled";
	}
	if (details.errorKind === "no-ui") return "interactive session required";
	if (details.errorKind === "auth-ssh") return "ssh auth failed";
	if (details.errorKind === "auth-sudo") return "sudo auth failed";
	if (details.errorKind === "execution" || details.errorKind === "no-result") return "failed";

	const hasLines = typeof details.lineCount === "number" && details.lineCount > 0;
	return dotJoin([
		typeof details.exitCode === "number" ? `failed exit ${details.exitCode}` : "failed",
		hasLines && `${details.lineCount} ${details.lineCount === 1 ? "line" : "lines"}`,
		details.truncated && "truncated",
	]);
}

function isTerminal(details: SshResultDetails): boolean {
	return details.outcome !== "awaiting-approval" && details.outcome !== "running";
}

function cancelResult(
	command: string,
	host: string,
	sudo: boolean,
	reason: string | undefined,
	action: OverlayResult["action"],
): { content: { type: "text"; text: string }[]; details: SshResultDetails } {
	// Exhaustive switch on OverlayResult action so adding a new variant
	// (e.g. "aborted") surfaces a TypeScript error here rather than
	// silently falling through to the missing-password case.
	let cancellationKind: SshCancellationKind;
	let outcome: SshOutcome;
	let msg: string;
	switch (action) {
		case "timeout":
			cancellationKind = "timeout";
			outcome = "timed-out";
			msg = "Timed out — auto-denied.";
			break;
		case "denied":
			cancellationKind = "denied";
			outcome = "denied";
			msg = "Denied by user or password attempts exhausted.";
			break;
		case "approved":
			cancellationKind = "missing-password";
			outcome = "cancelled";
			msg = "No password entered.";
			break;
		default: {
			// Exhaustiveness guard.
			const _exhaustive: never = action;
			cancellationKind = "missing-password";
			outcome = "cancelled";
			msg = `Cancelled — ${String(_exhaustive)}`;
		}
	}
	return {
		content: [{ type: "text", text: `Cancelled — ${msg}` }],
		details: makeDetails(command, host, sudo, reason, { outcome, cancellationKind }),
	};
}

function formatHostInfo(host: string, info: HostInfo): string {
	const rows = [
		["HostName", info.hostname],
		["User", info.user],
		["Port", info.port],
		["ProxyJump", info.proxyJump && info.proxyJump !== "none" ? info.proxyJump : undefined],
		["IdentityFile", info.identityFile],
	].filter((r): r is [string, string] => Boolean(r[1]));
	if (rows.length === 0) return `No SSH config found for ${host}.`;
	return [`Effective SSH config for ${host}:`, ...rows.map(([k, v]) => `  ${k} ${v}`)].join("\n");
}

function formatAliasList(aliases: HostAlias[]): string {
	if (aliases.length === 0) {
		return "No SSH host aliases found in ~/.ssh/config.";
	}
	// De-dupe by alias, first block wins (OpenSSH semantics).
	const seen = new Set<string>();
	const lines: string[] = [];
	for (const a of aliases) {
		if (seen.has(a.alias)) continue;
		seen.add(a.alias);
		let target = "";
		if (a.hostname) {
			const userPart = a.user ? `${a.user}@` : "";
			const portPart = a.port ? `:${a.port}` : "";
			target = `${userPart}${a.hostname}${portPart}`;
		}
		const via = a.proxyJump && a.proxyJump !== "none" ? ` via ${a.proxyJump}` : "";
		lines.push(`  ${a.alias}${target ? ` → ${target}` : ""}${via}`);
	}
	return [`SSH host aliases (${lines.length}):`, ...lines].join("\n");
}

/** Build the info-action result: per-host effective config when `host` is
 * given, otherwise the alias inventory from ~/.ssh/config. Read-only.
 * Details carry `_type: "sshInfo"` so renderResult falls to its generic
 * plain-text branch (no collapse, no exit-code framing). */
// Tiny notification bridge so infoResult (called without ctx) can still
// emit a completion toast. Bound by execute before the call.
let _infoNotify: ((msg: string) => void) | undefined;
function bindInfoNotify(notifyFn: (msg: string) => void): void {
	_infoNotify = notifyFn;
}

async function infoResult(host: string | undefined, sig?: AbortSignal) {
	const details = { _type: "sshInfo" as const };
	if (host?.trim()) {
		let spec: HostSpec;
		try {
			spec = parseHost(host);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			return {
				content: [{ type: "text" as const, text: `ssh_run failed: ${msg}` }],
				details,
				isError: true,
			};
		}
		const text = formatHostInfo(hostTarget(spec), await resolveHostInfo(spec, sig));
		_infoNotify?.(`info: resolved ${spec.user ? spec.user + "@" : ""}${spec.host}`);
		return { content: [{ type: "text" as const, text }], details };
	}
	const aliasCount = readSshConfigAliases().length;
	const text = formatAliasList(readSshConfigAliases());
	_infoNotify?.(`info: ${aliasCount} host aliases listed`);
	return {
		content: [{ type: "text" as const, text }],
		details,
	};
}

// ── Extension entry point ─────────────────────────────────────────────────────

export default function (pi: ExtensionAPI): void {
	pi.registerTool({
		name: "ssh_run",
		label: "Run over SSH",
		description:
			"Run a command or transfer files/directories on a REMOTE host over SSH. " +
			"For the LOCAL machine use `bash` (or `sudo_run` for local root) instead — do not use ssh_run for local work. " +
			"Requires a `host`. Windows/PowerShell shells are best-effort (elevation and PowerShell stream/encoding semantics unsupported). " +
			"Set `sudo: true` to run the command as root on the remote machine. " +
			'For transfer, set `action: "file"`, `direction`, `source`, `destination`, and optional `recursive` — ' +
			"transfers may overwrite the destination. " +
			'To discover hosts without reading `~/.ssh/config`, use `action: "info"` — omit `host` to list configured aliases, or pass a `host` to get its effective config (no connection). ' +
			"Always provide a clear `reason`.",
		promptSnippet: "Run a remote command, transfer files, or read SSH config over SSH",
		promptGuidelines: [
			'ssh_run: REMOTE host only — use `bash`/`sudo_run` for the local machine. `host` as `[user@]host[:port]`; `sudo` covers remote POSIX sudo only. For transfer use `action: "file"` with `direction: "upload"|"download"`, `source`, `destination`, optional `recursive` (may overwrite). Use `action: "info"` (no `host` = list aliases, with `host` = its effective config) instead of reading `~/.ssh/config` yourself. Always set `reason`.',
		],

		renderShell: "self",

		// Single Type.Object (root `type: "object"`) rather than Type.Union — a union
		// serializes to `anyOf` with no root type, which strict OpenAI-compatible
		// providers (e.g. DeepSeek) reject with `type: null`. Conditional fields are
		// optional and normalized/validated at runtime via normalizeOperation.
		parameters: Type.Object({
			action: Type.Optional(
				Type.Union([Type.Literal("command"), Type.Literal("file"), Type.Literal("info")], {
					description:
						'"command" (default) runs a remote command; "file" transfers a file/directory; "info" reports SSH config (no connection) — list configured host aliases, or resolve one host\'s effective config when `host` is given.',
				}),
			),
			host: Type.Optional(
				Type.String({
					description:
						"Remote target as `[user@]host[:port]` (e.g. `deploy@10.0.0.5:2222`). Required for command/file; for info, omit to list all aliases or set it to resolve one host.",
				}),
			),
			command: Type.Optional(
				Type.String({
					description:
						'Command sent to the remote host\'s configured SSH shell. Required when action is "command".',
				}),
			),
			sudo: Type.Optional(
				Type.Boolean({
					description:
						"Run the command as root on the remote host via sudo. Default false. Command action only.",
				}),
			),
			direction: Type.Optional(
				Type.Union([Type.Literal("upload"), Type.Literal("download")], {
					description: 'Transfer direction. Required when action is "file".',
				}),
			),
			source: Type.Optional(
				Type.String({
					description:
						'Source path (local for upload, remote for download). Required when action is "file".',
				}),
			),
			destination: Type.Optional(
				Type.String({
					description:
						'Destination path (remote for upload, local for download). Required when action is "file".',
				}),
			),
			recursive: Type.Optional(
				Type.Boolean({
					description: "Copy a directory recursively. Default false. File action only.",
				}),
			),
			reason: Type.Optional(
				Type.String({
					description: "Short plain-English explanation of intent, shown to the user.",
				}),
			),
		}),

		async execute(_toolCallId, params, sig, onUpdate, ctx) {
			// info: read-only SSH config report (no connection, no approval).
			if (params.action === "info") {
				// infoResult needs ctx.ui for the completion notify; bind a tiny shim
				// so the read-only path can still emit a single low-priority toast.
				bindInfoNotify((m) => ctx.ui.notify(`ssh_run: ${m}`, "info"));
				return infoResult(params.host, sig);
			}

			if (!params.host?.trim()) {
				return {
					content: [{ type: "text", text: "ssh_run failed: host is required" }],
					details: makeDetails("", "", false, params.reason, {
						outcome: "error",
						errorKind: "execution",
					}),
					isError: true,
				};
			}
			const op = normalizeOperation(params);
			// Project Op discriminated union into local vars used by the rest of
			// execute(). After normalizeOperation, op is command or file (info
			// was handled by the early-return above). Using `kind` discrimination
			// keeps the union's safety: each variant contributes only its own fields.
			const isCommand = op.kind === "command";
			const isFile = op.kind === "file";
			const command = isCommand
				? op.command
				: `${op.direction ?? ""} ${op.source || "(empty source)"} → ${op.destination || "(empty destination)"}`;
			const sudo = isCommand && op.sudo;
			const source = isFile ? op.source : "";
			const destination = isFile ? op.destination : "";
			const direction = isFile ? op.direction : undefined;
			const recursive = isFile && op.recursive;
			const reason = op.reason;
			const action: "command" | "file" = isCommand ? "command" : "file";

			if (action === "file" && (!source || !destination)) {
				return {
					content: [{ type: "text", text: "ssh_run failed: source and destination are required" }],
					details: makeDetails(command, params.host, false, reason, {
						outcome: "error",
						errorKind: "execution",
					}),
					isError: true,
				};
			}
			if (action === "file" && !direction) {
				// Pre-flight guard: missing direction silently defaulted to "upload"
				// (data-loss risk). Fail loudly so the model fixes its call shape.
				return {
					content: [{ type: "text", text: 'ssh_run failed: direction ("upload"|"download") is required when action is "file"' }],
					details: makeDetails(command, params.host, false, reason, {
						outcome: "error",
						errorKind: "execution",
					}),
					isError: true,
				};
			}

			if (action === "command" && !command.trim()) {
				return {
					content: [{ type: "text", text: "ssh_run failed: command is required" }],
					details: makeDetails(command, params.host, sudo, reason, {
						outcome: "error",
						errorKind: "execution",
					}),
					isError: true,
				};
			}

			let spec: HostSpec;
			try {
				spec = parseHost(params.host);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				return {
					// Include the original spec in the error so the user sees what was rejected.
					content: [{ type: "text", text: `ssh_run failed: invalid host "${params.host}" — ${msg}` }],
					details: makeDetails(command, params.host, sudo, reason, {
						outcome: "error",
						errorKind: "execution",
					}),
					isError: true,
				};
			}
			// ponytail: let OpenSSH own config parsing; `ssh -G` handles aliases,
			// Include, and Match rules without duplicating its config grammar.
			const effectiveSpec = await resolveSshHost(spec, sig);
			const host = hostTarget(effectiveSpec);
			// Keep original target for execution so alias-specific IdentityFile,
			// ProxyJump, and other SSH config options still apply.
			const controlPath = controlPathFor(effectiveSpec);
			const key = cacheKey(effectiveSpec);
			const creds = credCache.get(key) ?? {};

			const mode = getUnattendedMode(pi.events);
			const yolo = mode === "yolo";
			if (action === "command" && mode === "afk") {
				ctx.ui.notify("ssh_run denied: AFK mode blocks remote commands", "info");
				return {
					content: [{ type: "text", text: "ssh_run denied immediately — AFK mode is active." }],
					details: makeDetails(command, host, sudo, reason, {
						outcome: "denied",
						cancellationKind: "denied",
					}),
				};
			}

			if (!ctx.hasUI) {
				return {
					content: [
						{ type: "text", text: "ssh_run requires an interactive session (no UI available)." },
					],
					details: makeDetails(command, host, sudo, reason, {
						outcome: "error",
						errorKind: "no-ui",
					}),
					isError: true,
				};
			}

			updatePresentation(onUpdate, command, host, sudo, reason, "awaiting-approval");

			// Probe key/agent/existing-master auth (no password needed on success).
			// Only prompt for a login password when the host is reachable but rejects
			// key auth ("auth"). If it's unreachable (timeout/DNS/refused) a password
			// can't help — skip the prompt and let runSsh surface the real error.
			const probe = creds.loginPassword ? "ok" : await probeKeyAuth(spec, controlPath, sig);
			const keyOk = probe === "ok";
			// Which passwords must the overlay collect this call?
			const needLogin = probe === "auth" && !creds.loginPassword;
			// Remote sudo password only when NOT already cached, NOT NOPASSWD, and
			// the SSH connection is passwordless (so the probe can open its own
			// channel without prompting). When login still needs a password we
			// can't probe yet, so fall back to prompting for the sudo password.
			const sudoNoPassword =
				sudo && !creds.sudoPassword && !needLogin && (keyOk || Boolean(creds.loginPassword))
					? await probeSudoNoPassword(spec, controlPath, command, sig)
					: false;
			const needSudo = sudo && !creds.sudoPassword && !sudoNoPassword;
			// The overlay stage pipeline: any password we still need is prompted
			// (login first, then sudo). Confirm-only when nothing is missing.
			const promptFor: ("login" | "sudo")[] = [
				...(needLogin ? (["login"] as const) : []),
				...(needSudo ? (["sudo"] as const) : []),
			];
			const transferDecision =
				action === "file" ? transferApprovalDecision(mode, needLogin) : "ask";
			if (transferDecision === "deny") {
				return {
					content: [
						{
							type: "text",
							text: "ssh_run file transfer denied — unattended mode cannot enter a missing SSH login password.",
						},
					],
					details: makeDetails(command, host, false, reason, {
						outcome: "denied",
						cancellationKind: "denied",
					}),
				};
			}

			const body = [
				...approvalBody(operation, host, spec.port),
				...(keyOk && !creds.loginPassword ? ["Auth: SSH key (no password)"] : []),
			];

			const collected: { login?: string; sudo?: string } = {};

			// Collect each still-missing password through the same overlay pattern
			// pix-sudo uses (masked input, N attempts). We can't validate remote
			// passwords without connecting, so validatePassword just accepts a
			// non-empty entry; a wrong password surfaces as an auth error after run.
			// Session allow-memory: host already approved + no password missing → skip
			// the confirm overlay entirely (visible notify below).
			//
			// Fork change:
			//   - Privileged commands now use the SEPARATE `approvedSudoHosts` map
			//     (30-min rolling window). They are not always re-confirmed.
			//   - Non-privileged commands use `approvedHosts` with `Infinity` TTL
			//     → approved once per session, never again.
			const privileged = action === "command" && (sudo || commandEscalatesPrivilege(command));
			const sessionAlive = hostApproved(approvedHosts, key);
			const sudoAlive = hostApproved(approvedSudoHosts, key);
			// sudoConfirm: false → masked sudo-password overlay skipped when no
			// other prompt is outstanding. Pair this with NOPASSWD sudo on the
			// remote (or `sudoNoPassword` will detect it) so promptFor stays
			// empty and the call goes through without user input.
			const sudoOnlyNoPrompt =
				promptFor.length === 1 &&
				promptFor[0] === "sudo" &&
				sshRunConfig.sudoConfirm === false;
			// sshRunConfig.confirm: false → immer erlauben (kein Overlay, Maps
			// ungenutzt). true (default) → TTL-Map Verhalten des Forks.
			// configFullAutoAllow: when ssh.json sets BOTH confirm:false AND
			// sudoConfirm:false, the plugin must NEVER prompt for any auth.
			// SSH call goes through with empty passwords; remote auth decides.
			const configFullAutoAllow =
				sshRunConfig.confirm === false && sshRunConfig.sudoConfirm === false;
			const alreadyApproved =
				action === "command" &&
				(configFullAutoAllow || promptFor.length === 0 || sudoOnlyNoPrompt) &&
				(configFullAutoAllow || !sshRunConfig.confirm || (privileged ? sudoAlive : sessionAlive));
			if (alreadyApproved) {
				// confirm:false means config-driven auto-allow, not TTL-reuse.
				// Pick a kind label that tells the user which path was taken,
				// so "reused sudo (30-min)" is never shown when the call was
				// actually auto-allowed by ssh.json flags.
				let kind: string;
				if (!sshRunConfig.confirm) {
					kind = sudoOnlyNoPrompt
						? "config (confirm:false + sudoConfirm:false)"
						: "config (confirm:false)";
				} else if (sudoOnlyNoPrompt) {
					kind = "config (sudoConfirm:false)";
				} else if (privileged) {
					kind = "sudo (30-min)";
				} else {
					kind = "session";
				}
				// sudo (30-min) reuse is a security-relevant signal — surface as warning
			// so it does not drown in the info stream. Config + session stay info.
			const notifySeverity = kind === "sudo (30-min)" ? "warning" : "info";
			ctx.ui.notify(`ssh_run: auto allow turned on via ${kind} — ${host}`, notifySeverity);
				// TUI: when config auto-allows, skip the "Awaiting approval…" message
				// in the result pane by jumping straight to "running" with the
				// auto-allow kind in the text. The later updatePresentation call
				// (after runOverlay) overwrites this once execution starts.
				if (!sshRunConfig.confirm) {
					updatePresentation(
						onUpdate,
						command,
						host,
						sudo,
						reason,
						"running",
						`Auto allow via ${kind} — running on ${host}…`,
					);
				}
			} else if (transferDecision === "allow") {
				ctx.ui.notify(
					`⚠ ssh_run file transfer — YOLO mode auto-approved`,
					"warning",
				);
			}

			const runOverlay = (): Promise<OverlayResult> =>
				withAgentBlock(pi.events, "ssh_run", "SSH approval required", async () => {
					if (
						(transferDecision === "allow" || yolo || alreadyApproved) &&
						(promptFor.length === 0 || sudoOnlyNoPrompt)
					) {
						return { action: "approved", password: "" } as OverlayResult;
					}
					// Confirm-only when no password is missing.
					if (promptFor.length === 0) {
						return showOverlay(ctx.ui, {
							mode: "confirm",
							icon: action === "file" ? icon("warn") : icon("lock"),
							title:
								action === "file"
									? `SSH ${direction === "download" ? "Download" : "Upload"}`
									: "SSH Command Request",
							body,
							accent: sudo ? "error" : action === "file" ? "warning" : "accent",
							timeoutMs: PROMPT_TIMEOUT_MS,
							choices: [
								{
									value: "yes",
									label: "Allow",
									description:
										action === "file" ? "Copy to destination (may overwrite)" : "Run the command",
								},
								{
									value: "no",
									label: "Deny",
									description: action === "file" ? "Cancel transfer" : "Block the command",
								},
							],
						});
					}
					// One masked prompt per missing password, in order.
					let last: OverlayResult = { action: "approved", password: "" };
					for (const stage of promptFor) {
						const label = stage === "login" ? "SSH login password" : "Remote sudo password";
						last = await showOverlay(ctx.ui, {
							mode: "sudo",
							icon: action === "file" ? icon("warn") : icon("lock"),
							title:
								action === "file"
									? `SSH ${direction === "download" ? "Download" : "Upload"}`
									: "SSH Command Request",
							body: [...body, `Enter: ${label}`],
							accent: sudo ? "error" : action === "file" ? "warning" : "accent",
							timeoutMs: PROMPT_TIMEOUT_MS,
							maxPasswordAttempts: MAX_PASSWORD_ATTEMPTS,
							passwordLabel: `${label}:`,
							// Login stage: actually test the password against the host so a
							// wrong one re-prompts (up to MAX_PASSWORD_ATTEMPTS), mirroring
							// pix-sudo. Sudo stage can't be validated until login succeeds, so
							// it keeps the non-empty check and surfaces failures on the run.
							validatePassword: validatorFor(stage, spec, controlPath, sig),
							choices: [
								{
									value: "yes",
									label: "Allow",
									description: `Enter ${label.toLowerCase()}`,
								},
								{ value: "no", label: "Deny", description: "Block the command" },
							],
						});
						if (last.action !== "approved" || !last.password?.trim()) return last;
						if (stage === "login") collected.login = last.password;
						else collected.sudo = last.password;
					}
					return last;
				});

			// Config auto-allow: skip runOverlay (no withAgentBlock "SSH approval
			// required" status-bar event). Otherwise await the real overlay.
			const overlayResult: OverlayResult =
				alreadyApproved
					? ({ action: "approved", password: "" } as OverlayResult)
					: await runOverlay();
			const missing =
				overlayResult.action === "approved" &&
				((needLogin && !collected.login) || (needSudo && !collected.sudo));
			if (overlayResult.action !== "approved" || missing) {
				const r = cancelResult(command, host, sudo, reason, overlayResult.action);
				ctx.ui.notify(`🔐 ${r.content[0]?.text}`, "warning");
				return r;
			}

			// File transfers remain warning-level: normal mode asks every time,
			// AFK denies above, and YOLO may approve when no password is missing.
			// Command runs: record approval in the matching window.
			//   - non-privileged → session map, Infinity TTL (once per session)
			//   - privileged     → sudo map, 30-min rolling
			if (action === "command") {
				if (privileged) {
					markHostApproved(approvedSudoHosts, key, Date.now(), SUDO_APPROVAL_TTL_MS);
				} else {
					markHostApproved(approvedHosts, key, Date.now(), SESSION_APPROVAL_TTL_MS);
				}
			}

			// Persist newly-entered passwords in the session cache.
			const loginPassword = creds.loginPassword ?? collected.login;
			const sudoPassword = creds.sudoPassword ?? collected.sudo;
			credCache.set(key, {
				...(loginPassword ? { loginPassword } : {}),
				...(sudoPassword ? { sudoPassword } : {}),
			});

			let spinnerFrame = 0;
			const updateTransferPresentation = () => {
				const verb = direction === "download" ? "Downloading from" : "Uploading to";
				updatePresentation(
					onUpdate,
					command,
					host,
					sudo,
					reason,
					"running",
					`${SPINNER[spinnerFrame] ?? ""} ${verb} ${host}…`,
				);
			};
			if (action === "file") updateTransferPresentation();
			else updatePresentation(onUpdate, command, host, sudo, reason, "running");

			// Live-stream partial output to the UI during the run. Throttled to
			// 150ms (trailing edge) so a chatty command does not flood the
			// render pipeline but the user still sees movement. Each partial
			// push carries a 20-line / 4KB tail of accumulated output plus a
			// compact header so the render-result's running branch has
			// something to show.
			const STREAM_THROTTLE_MS = 150;
			const STREAM_MAX_LINES = 20;
			const STREAM_MAX_BYTES = 4 * 1024;
			let streamBuffer = { stdout: "", stderr: "" };
			let streamLastPush = 0;
			let streamPending: ReturnType<typeof setTimeout> | undefined;
			const fmtStreamTail = () => {
				const merged = [streamBuffer.stdout, streamBuffer.stderr]
					.filter(Boolean)
					.join("\n");
				if (!merged) return "";
				const lines = merged.split("\n");
				const tail = lines.slice(-STREAM_MAX_LINES).join("\n");
				let trimmed = tail;
				if (Buffer.byteLength(tail, "utf8") > STREAM_MAX_BYTES) {
					const buf = Buffer.from(tail, "utf8");
					let end = buf.length;
					while (end > 0 && Buffer.byteLength(buf.subarray(0, end).toString("utf8"), "utf8") > STREAM_MAX_BYTES) {
						end = Math.max(0, end - Math.ceil(STREAM_MAX_BYTES * 0.1));
					}
					trimmed = buf.subarray(0, end).toString("utf8");
				}
				const dropped = lines.length - tail.split("\n").length + (merged !== tail ? 1 : 0);
				const dropHint = dropped > 0 ? `\n[...${dropped} earlier lines hidden, streaming tail...]` : "\n[streaming...]";
				return `${trimmed}${dropHint}`;
			};
			const pushStreamUpdate = () => {
				if (!onUpdate) return;
				const now = Date.now();
				const elapsed = now - streamLastPush;
				const doIt = () => {
					streamLastPush = Date.now();
					streamPending = undefined;
					onUpdate({
						content: [
							{
								type: "text",
								text: `${SPINNER[spinnerFrame] ?? ""} Running on ${host}…\n\n${fmtStreamTail()}`,
							},
						],
						details: makeDetails(command, host, sudo, reason, { outcome: "running" }),
					});
				};
				if (elapsed >= STREAM_THROTTLE_MS) {
					doIt();
				} else if (!streamPending) {
					streamPending = setTimeout(doIt, STREAM_THROTTLE_MS - elapsed);
				}
			};
			const onChunk = (out: string, err: string) => {
				streamBuffer.stdout = out;
				streamBuffer.stderr = err;
				pushStreamUpdate();
			};

			// ponytail: spinner shows liveness only; SCP has no stable byte-progress API.
			// Use an SFTP client with byte callbacks if percentage progress is needed.
			const spinnerTimer =
				action === "file" && onUpdate
					? setInterval(() => {
							spinnerFrame = (spinnerFrame + 1) % SPINNER.length;
							updateTransferPresentation();
						}, SPINNER_INTERVAL_MS)
					: undefined;

			let result: { stdout: string; stderr: string; code: number } | undefined;
			try {
				result =
					action === "file"
						? await runTransfer(spec, direction ?? "upload", source, destination, recursive, {
								controlPath,
								...(loginPassword ? { loginPassword } : {}),
								...(sig ? { signal: sig } : {}),
								onChunk,
							})
						: await runSsh(spec, command, {
								controlPath,
								...(loginPassword ? { loginPassword } : {}),
								sudo,
								...(sudo ? { sudoPassword: sudoPassword ?? "" } : {}),
								...(sig ? { signal: sig } : {}),
								onChunk,
							});
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				// Distinguish plugin-aborted runs from generic spawn failures so the
				// user sees "cancelled by abort" instead of the raw "Cancelled" / ENOENT.
				const aborted = sig?.aborted === true;
				const prefix = aborted ? "ssh_run cancelled" : "ssh_run failed";
				return {
					content: [{ type: "text", text: `${prefix} on ${host}: ${msg}` }],
					details: makeDetails(
						command,
						host,
						sudo,
						reason,
						aborted
							? { outcome: "cancelled", cancellationKind: "aborted" }
							: { outcome: "error", errorKind: "execution" },
					),
					isError: !aborted,
				};
			} finally {
				if (spinnerTimer) clearInterval(spinnerTimer);
				if (streamPending) clearTimeout(streamPending);
			}

			if (!result) {
				return {
					content: [{ type: "text", text: "ssh_run failed: command produced no result" }],
					details: makeDetails(command, host, sudo, reason, {
						outcome: "error",
						errorKind: "no-result",
					}),
					isError: true,
				};
			}

			// SSH auth failure → drop the bad login password from the cache so the
			// next call re-prompts.
			if (detectSshFailure(result.code, result.stderr)) {
				credCache.delete(key);
ctx.ui.notify(`🔐 SSH authentication failed for ${host}`, "error");
				return {
					content: [{ type: "text", text: `SSH authentication failed:\n${result.stderr}` }],
					details: makeDetails(command, host, sudo, reason, {
						outcome: "error",
						exitCode: result.code,
						lineCount: outputLineCount(result.stderr),
						errorKind: "auth-ssh",
						_render: normalizeLineEndings(result.stderr),
					}),
					isError: true,
				};
			}

			// Remote sudo password failure → drop the bad sudo password.
			if (sudo && detectSudoFailure(result.stderr)) {
				credCache.set(key, loginPassword ? { loginPassword } : {});
ctx.ui.notify(`🔐 Remote sudo authentication failed on ${host}`, "error");
				return {
					content: [{ type: "text", text: `Remote sudo authentication failed:\n${result.stderr}` }],
					details: makeDetails(command, host, sudo, reason, {
						outcome: "error",
						exitCode: result.code,
						lineCount: outputLineCount(result.stderr),
						errorKind: "auth-sudo",
						_render: normalizeLineEndings(result.stderr),
					}),
					isError: true,
				};
			}

			const combined = [result.stdout, result.stderr].filter(Boolean).join("\n") || "(no output)";
			// earlyTruncated comes from runSshChild's in-place capStream: when
			// set, the source was already bounded at MAX_OUTPUT_BYTES * 2 per
			// stream, so truncate() skips the line/byte count short-circuit
			// and goes straight to applying the display caps. The suffix
			// message still fires (truncated === true either way).
			const { text: truncatedText, truncated } = truncate(combined, undefined, undefined, result.earlyTruncated);
			const suffix = truncated
				? `\n\n[Output truncated to ${MAX_OUTPUT_LINES} lines / ${MAX_OUTPUT_BYTES / 1024}KB]`
				: "";
			const rendered = normalizeLineEndings(combined)
				.replace(/\n{3,}/g, "\n\n")
				.replace(/^\n+|\n+$/g, "");

			// Completion notify — short signal so long-running calls are easier to
			// spot in the stream. Severity mirrors the exit code. On non-zero exit,
			// include the first non-empty stderr line as a hint so the user can tell
			// "exit 127" (command not found) from "exit 1" (auth/refusal) without
			// opening the tool result. Truncate to 100 chars + strip control bytes.
			const stderrHint = result.stderr
				.split("\n")
				.map((l) => l.trim())
				.find((l) => l.length > 0);
			const cleanHint = stderrHint
				? stderrHint
						.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
						.replace(/\s+/g, " ")
						.slice(0, 100)
				: "";
			const failureLine = cleanHint
				? `⚠ ssh_run exit ${result.code} on ${host} — ${cleanHint}`
				: `⚠ ssh_run exit ${result.code} on ${host}`;
			ctx.ui.notify(
				result.code === 0 ? `✓ ssh_run completed on ${host}` : failureLine,
				result.code === 0 ? "info" : "warning",
			);
			return {
				content: [{ type: "text", text: `Exit code: ${result.code}\n\n${truncatedText}${suffix}` }],
				details: makeDetails(command, host, sudo, reason, {
					outcome: result.code === 0 ? "success" : "error",
					exitCode: result.code,
					lineCount: outputLineCount(rendered),
					truncated,
					...(result.code === 0 ? {} : { errorKind: "exit-code" as const }),
					_render: rendered,
				}),
				isError: result.code !== 0,
			};
		},

		renderCall: (args: SshParams, theme: Theme, renderCtx: ToolRenderContext): unknown => {
			resolveBaseBackground(theme);
			const text = renderCtx.lastComponent ?? new Text("", 0, 0);
			if (
				hideCollapsedToolCall(renderCtx.state as CollapseState, renderCtx.expanded, (value) =>
					text.setText(value),
				)
			)
				return text;

			const host = safeOneLine(args.host ?? "");
			if (args.action === "info") {
				text.setText(
					fillToolBackground(
						`${theme.fg("toolTitle", theme.bold("ssh info"))} ${theme.fg("dim", host || "list aliases")}`,
					),
				);
				return text;
			}
			const op = normalizeOperation(args);
			// Project the Op discriminated union into render-local vars. Each
			// variant contributes only its own fields; kind-narrowing here gives
			// us type-safe access without scattered action==='command' checks.
			let label = "ssh";
			let command = "";
			let prefix = "";
			switch (op.kind) {
				case "command":
					command = safeOneLine(op.command) || "(empty command)";
					prefix = op.sudo ? "sudo " : "";
					label = "ssh";
				break;
				case "file":
					command = `${op.direction ?? ""} ${op.source || "(empty source)"} → ${op.destination || "(empty destination)"}`;
					prefix = "";
					label = "ssh file";
				break;
				case "info":
					// info is short-circuited above by the args.action === "info" branch;
					// guard for new variants so adding a kind doesn't silently misrender.
					label = "ssh info";
				break;
				default: {
					const _exhaustive: never = op;
					throw new Error(`unknown op kind: ${String(_exhaustive)}`);
				}
			}
			text.setText(
				fillToolBackground(
					`${theme.fg("toolTitle", theme.bold(label))} ${theme.fg("dim", host)} ${theme.fg("muted", prefix + command)}`,
				),
			);
			return text;
		},

		renderResult: (
			result: AgentToolResult,
			_opt: ToolRenderResultOptions,
			theme: Theme,
			renderCtx: ToolRenderContext,
		): unknown => {
			resolveBaseBackground(theme);
			const text = unframeToolResult(renderCtx.lastComponent ?? new Text("", 0, 0));
			const details = result.details as SshResultDetails | undefined;
			const isPartial = _opt.isPartial === true;
			const completed = (isError: boolean) => frameToolResult(text, theme, isError);

			if (details?._type !== "sshResult") {
				if (renderCtx.isError) {
					text.setText(renderToolError(getTextContent(result) || "Error", theme));
				} else {
					text.setText(
						fillToolBackground(`  ${theme.fg("muted", getTextContent(result) || "done")}`),
					);
				}
				return isPartial ? text : completed(renderCtx.isError);
			}

			if (
				!isPartial &&
				isTerminal(details) &&
				tickCollapse(
					"ssh",
					renderCtx.state as CollapseState,
					renderCtx.invalidate,
					renderCtx.expanded,
				)
			) {
				const status = details.outcome === "success" ? "success" : "error";
				text.setText(
					renderCollapsedToolRow(
						theme,
						"ssh",
						`${details.host}  ${safeOneLine(details.command)}`,
						terminalMeta(details),
						status,
					),
				);
				return text;
			}

			if (details.outcome === "awaiting-approval" || details.outcome === "running") {
				text.setText(
					fillToolBackground(`  ${theme.fg("muted", getTextContent(result) || "working")}`),
				);
				return text;
			}

			if (details.outcome !== "success" && details.errorKind !== "exit-code") {
				const diagnostic = getTextContent(result) || "Error";
				text.setText(
					details.outcome === "error"
						? renderToolError(diagnostic, theme)
						: fillToolBackground(`  ${theme.fg("warning", diagnostic)}`),
				);
				return isPartial ? text : completed(true);
			}

			const code = typeof details.exitCode === "number" ? details.exitCode : null;
			const rendered = typeof details._render === "string" ? details._render : "";
			const { summary } = renderBashOutput(rendered, code, theme);
			const lines = rendered ? rendered.split("\n") : [];
			const lineCount = lines.length;

			if (!rendered) {
				text.setText(fillToolBackground(`  ${summary}`));
				return isPartial ? text : completed(details.outcome !== "success");
			}

			const maxShow = renderCtx.expanded ? lineCount : MAX_PREVIEW_LINES;
			const show = lines.slice(0, maxShow);
			const footer =
				lineCount > maxShow ? [`${FG_DIM}  … ${lineCount - maxShow} more lines${RST}`] : [];
			const statusKey = details.outcome === "success" ? "success" : "error";
			const paint = (s: string) => theme.fg(statusKey, s);
			const sw = Math.max(8, termW() - 4); // section-rule width inside the 2-space indent
			const body = show.map((line) => `  ${sectionRule(line, theme, sw) ?? line}`);
			const out = isPartial ? [...body, ...footer] : ruleFrame(body, footer, termW(), paint);
			text.setText(fillToolBackground(out.join("\n")));
			return text;
		},
	});
}
