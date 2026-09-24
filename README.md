# pix-ssh-st

Fork of [`@xynogen/pix-ssh`](https://www.npmjs.com/package/@xynogen/pix-ssh) v0.5.2 with a relaxed approval policy. Registers the `ssh_run` tool — run a command or transfer files/directories over SSH, optionally through remote POSIX sudo, behind the same `pix-pretty` overlay the upstream uses.

## What changed vs upstream

| | `@xynogen/pix-ssh` v0.5.2 | `@steimerbyte/pix-ssh-st` v0.1.0 |
|---|---|---|
| Non-privileged command approval | re-prompt every 15 min per host | **once per session** per host (Map holds Infinity, cleared on process exit) |
| Sudo command approval | always re-prompted (`sudo:true` and any `sudo`/`su`/`doas`/`pkexec` token in the command text always confirm) | **30-min rolling window** per host; `marked` after each successful privileged run |
| File transfer approval | unchanged (warning-level, ask every time, AFK denies, YOLO allows) | unchanged |
| Auth, password cache, ControlMaster, output truncation | unchanged | unchanged |

Both windows are per `(user@host:port)` cache key and live only in process memory; Pi exit clears them.

## Why

Pi agents iterating on the same remote host inside one session (e.g. a long inspection or deploy script) trigger ~4–8 ssh_run prompts per host per 15 min upstream. Once a user has approved a host for the session, every subsequent non-privileged call on that host should not ask again. Sudo is bumped to a 30-min window — still recoverable in case of misuse — instead of never re-prompting.

## What it does

Registers the `ssh_run` tool — run a command through the configured SSH shell on a remote machine.

- **Privileged calls** (`sudo:true`, or sudo/su/doas/pkexec anywhere in the command) → Allow/Deny overlay, **30-min rolling window** per host.
- **Non-privileged calls** → Allow/Deny overlay first call per host per session; later calls auto-approve for the rest of the Pi session.
- **File transfers** → confirm every time (YOLO may auto-approve when no password is missing; each auto-approval emits a notify).
- Output truncated to 50 KB / 2000 lines. Non-interactive (RPC/JSON) mode blocks the tool immediately.

`action`: `"command"` (default) · `"file"` · `"info"`. `host` as `[user@]host[:port]` (e.g. `deploy@10.0.0.5:2222`). Optional `sudo`, `reason`.

## Install

```bash
pi install npm:@steimerbyte/pix-ssh-st
```

Standalone/opt-in — **not** bundled by `pix-core`. Replace `@xynogen/pix-ssh` in `~/.pi/agent/settings.json` with this name; remove the upstream entry.

## License

MIT — fork of xynogen/pix-ssh (MIT). Source: <https://github.com/steimerbyte/pix-ssh-st>. Upstream: <https://github.com/xynogen/pix-mono>.
