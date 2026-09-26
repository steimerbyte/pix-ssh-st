var __defProp = Object.defineProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
import { Text } from "@earendil-works/pi-tui";

// node_modules/@xynogen/pix-pretty/src/ansi.ts
var RST = "\x1B[0m";
var FG_DIM = "\x1B[38;2;80;80;80m";
var FG_RULE = "\x1B[38;2;50;50;50m";
var BG_DEFAULT = "\x1B[49m";
var BG_BASE = BG_DEFAULT;
var BG_ERROR = BG_DEFAULT;
function resolveBaseBackground(_theme) {
  BG_BASE = BG_DEFAULT;
  BG_ERROR = BG_DEFAULT;
  RST = "\x1B[0m";
}
var ANSI_CAPTURE_RE = /\x1b\[([0-9;]*)m/g;
var ESC = "\x1B";
function hasAnsi(s) {
  return s.includes(ESC);
}

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/runtime.ts
import { getAgentDir } from "@earendil-works/pi-coding-agent";

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/diagnostics.ts
var DiagnosticSink = class {
  constructor(limit = 100) {
    this.limit = limit;
  }
  limit;
  items = [];
  push(d) {
    this.items.push({ ...d, at: Date.now() });
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
  }
  all() {
    return [...this.items];
  }
  /** Diagnostics newer than a timestamp — used for session-start aggregation. */
  since(ts) {
    return this.items.filter((d) => d.at >= ts);
  }
  clear() {
    this.items.length = 0;
  }
};

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/schema.ts
var CONFIG_FORMAT_VERSION = 1;
function defineSection(definition) {
  return {
    key: definition.key,
    defaults: definition.defaults,
    __section: definition
  };
}
function isObj(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function boolOr(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}
function posNumOr(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}
function enumOr(v, allowed, fallback) {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}
function strArr(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}
function stripDefaults(section, defaults) {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const value = section[key];
    if (isObj(value) && isObj(defaultValue)) {
      const nested = { ...value };
      if (stripDefaults(nested, defaultValue) > 0) section[key] = nested;
      else delete section[key];
    } else if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
      delete section[key];
    }
  }
  return Object.keys(section).length;
}
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze(value[key]);
    }
  }
  return value;
}
function clone(value) {
  return structuredClone(value);
}
function deepMerge(base, patch) {
  if (!isObj(base) || !isObj(patch)) return patch ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === void 0) continue;
    const prev = out[key];
    if (isObj(prev) && isObj(value)) {
      out[key] = deepMerge(
        prev,
        value
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}
function diffPaths(prefix, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!isObj(a) || !isObj(b)) return [prefix];
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const key of keys) {
    out.push(...diffPaths(prefix ? `${prefix}.${key}` : key, a[key], b[key]));
  }
  return out;
}
function pathMatches(changed, filters) {
  return filters.some((f) => {
    if (f === changed) return true;
    if (f.endsWith(".*")) {
      const base = f.slice(0, -2);
      return changed === base || changed.startsWith(`${base}.`);
    }
    return false;
  });
}

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/events.ts
function makeSnapshot(revision, values) {
  const frozen = /* @__PURE__ */ new Map();
  for (const [key, value] of values) frozen.set(key, deepFreeze(value));
  const loadedAt = Date.now();
  return {
    revision,
    formatVersion: CONFIG_FORMAT_VERSION,
    loadedAt,
    get(section) {
      return frozen.get(section.key) ?? section.defaults;
    }
  };
}
var EventBus = class {
  regs = /* @__PURE__ */ new Set();
  subscribe(reg) {
    this.regs.add(reg);
    return () => this.regs.delete(reg);
  }
  /** Dispatch in registration order over a copied list (unsubscribe-safe). */
  emit(change, onError) {
    for (const reg of [...this.regs]) {
      if (reg.paths && !change.changed.some((c) => pathMatches(c, reg.paths))) {
        continue;
      }
      try {
        reg.listener(change);
      } catch (err) {
        onError(err);
      }
    }
  }
  clear() {
    this.regs.clear();
  }
};

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/migrations.ts
import { existsSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";
var LEGACY_PRETTY_COLOR_KEYS = ["theme", "syntaxTheme", "diffColors"];
var LEGACY_DIFF_COLOR_KEYS = [
  "bgAdd",
  "bgDel",
  "bgAddHighlight",
  "bgDelHighlight",
  "bgGutterAdd",
  "bgGutterDel",
  "fgAdd",
  "fgDel"
];
var OPTIMIZER_KEYS = ["caveman", "rtk", "ponytail"];
function detectVersion(doc) {
  const v = doc.$version;
  return typeof v === "number" && Number.isFinite(v) ? v : "unversioned";
}
function migrate(input, ctx) {
  const version = detectVersion(input);
  if (typeof version === "number" && version > CONFIG_FORMAT_VERSION) {
    ctx.diagnostic({
      code: "UNSUPPORTED_CONFIG_VERSION",
      severity: "error",
      message: `config $version ${version} is newer than supported ${CONFIG_FORMAT_VERSION}`
    });
    return { document: input, changed: false };
  }
  const doc = structuredClone(input);
  let changed = false;
  if (isObj(doc.pretty)) {
    const pretty = { ...doc.pretty };
    for (const key of LEGACY_PRETTY_COLOR_KEYS) {
      if (key in pretty) {
        delete pretty[key];
        changed = true;
      }
    }
    if (isObj(pretty.diff)) {
      const diff = { ...pretty.diff };
      for (const key of LEGACY_DIFF_COLOR_KEYS) {
        if (key in diff) {
          delete diff[key];
          changed = true;
        }
      }
      pretty.diff = diff;
    }
    doc.pretty = pretty;
  }
  if (isObj(doc.optimizer) && "toon" in doc.optimizer) {
    doc.optimizer = Object.fromEntries(
      Object.entries(doc.optimizer).filter(([key]) => key !== "toon")
    );
    changed = true;
  }
  if (doc.$version !== CONFIG_FORMAT_VERSION) {
    doc.$version = CONFIG_FORMAT_VERSION;
    changed = true;
  }
  return { document: doc, changed };
}
function importOptimizerSidecar(doc, agentDir, ctx) {
  const sidecarPath = join(agentDir, "optimizer.json");
  if (!existsSync(sidecarPath)) return { changed: false };
  let raw;
  try {
    const parsed = JSON.parse(readFileSync(sidecarPath, "utf-8"));
    if (!isObj(parsed)) throw new Error("not an object");
    raw = parsed;
  } catch (err) {
    ctx.diagnostic({
      code: "MIGRATION_FAILED",
      severity: "warning",
      path: "optimizer.json",
      message: "malformed optimizer sidecar left untouched",
      cause: err
    });
    return { changed: false };
  }
  const existing = isObj(doc.optimizer) ? { ...doc.optimizer } : {};
  let changed = false;
  for (const key of OPTIMIZER_KEYS) {
    const value = raw[key];
    if (typeof value === "string" && !(key in existing)) {
      existing[key] = value;
      changed = true;
    }
  }
  if (changed) doc.optimizer = existing;
  const hasLegacyToon = typeof raw.toon === "string";
  const archive = () => {
    let target = `${sidecarPath}.migrated-v1`;
    if (existsSync(target)) target = `${target}.${Date.now()}`;
    try {
      renameSync(sidecarPath, target);
    } catch {
    }
  };
  return { changed: changed || hasLegacyToon, archive };
}

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/persistence.ts
import {
  closeSync,
  existsSync as existsSync2,
  mkdirSync,
  openSync,
  readFileSync as readFileSync2,
  renameSync as renameSync2,
  rmSync,
  statSync,
  writeFileSync,
  writeSync
} from "node:fs";
import { dirname, join as join2 } from "node:path";
var ConfigWriteError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ConfigWriteError";
  }
  cause;
};
var ConfigLockError = class extends ConfigWriteError {
  constructor(message, cause) {
    super(message, cause);
    this.name = "ConfigLockError";
  }
};
var LOCK_STALE_MS = 3e4;
var LOCK_RETRY_MS = 25;
var LOCK_MAX_RETRIES = 200;
var FileStorage = class {
  path;
  lockPath;
  constructor(agentDir) {
    this.path = join2(agentDir, "pix.json");
    this.lockPath = `${this.path}.lock`;
  }
  ensureDir() {
    mkdirSync(dirname(this.path), { recursive: true });
  }
  readRaw() {
    try {
      if (!existsSync2(this.path)) return void 0;
      return readFileSync2(this.path, "utf-8");
    } catch (err) {
      throw new ConfigWriteError(`read failed: ${this.path}`, err);
    }
  }
  acquireLock() {
    for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
      try {
        const fd = openSync(this.lockPath, "wx", 384);
        writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
        closeSync(fd);
        return;
      } catch {
        try {
          const age = Date.now() - statSync(this.lockPath).mtimeMs;
          if (age > LOCK_STALE_MS) {
            rmSync(this.lockPath, { force: true });
            continue;
          }
        } catch {
          continue;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
      }
    }
    throw new ConfigLockError(`could not acquire ${this.lockPath}`);
  }
  releaseLock() {
    try {
      rmSync(this.lockPath, { force: true });
    } catch {
    }
  }
  writeAtomic(contents) {
    this.ensureDir();
    this.acquireLock();
    const tmp = `${this.path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
      writeFileSync(tmp, contents, { mode: 384 });
      renameSync2(tmp, this.path);
    } catch (err) {
      try {
        rmSync(tmp, { force: true });
      } catch {
      }
      throw new ConfigWriteError(`write failed: ${this.path}`, err);
    } finally {
      this.releaseLock();
    }
  }
};
var WriteQueue = class {
  tail = Promise.resolve();
  run(task) {
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => void 0,
      () => void 0
    );
    return next;
  }
};
function parseRawDocument(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function serializeRawDocument(doc) {
  return `${JSON.stringify(doc, null, 2)}
`;
}

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/collapse.ts
var DEFAULTS = {
  enabled: true,
  delaySec: 10,
  tools: {}
};
var collapseSection = defineSection({
  key: "collapse",
  defaults: DEFAULTS,
  parse(raw) {
    if (!isObj(raw)) return { ...DEFAULTS, tools: {} };
    const tools = {};
    if (isObj(raw.tools)) {
      for (const [k, v] of Object.entries(raw.tools)) {
        if (typeof v === "boolean") tools[k] = v;
      }
    }
    return {
      enabled: boolOr(raw.enabled, DEFAULTS.enabled),
      delaySec: posNumOr(raw.delaySec, DEFAULTS.delaySec),
      tools
    };
  }
});

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/compaction.ts
var MINIMUM_TOKEN_FLOOR = 25e3;
var MINIMUM_TOKEN_DEFAULT = 1e5;
var DEFAULTS2 = {
  triggerPercent: 60,
  minimumTokens: MINIMUM_TOKEN_DEFAULT
};
function pctOr(v, fallback) {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}
function minimumTokensOr(v, fallback) {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(MINIMUM_TOKEN_FLOOR, Math.round(v));
}
function parseTokenString(label) {
  const raw = label.trim();
  if (!raw) return void 0;
  const m = raw.match(/^([0-9]*\.?[0-9]+)\s*([km])?$/i);
  if (!m) return void 0;
  const numStr = m[1] ?? "";
  const n = Number.parseFloat(numStr);
  if (!Number.isFinite(n)) return void 0;
  const suf = (m[2] ?? "").toLowerCase();
  if (suf === "m") return Math.round(n * 1e6);
  if (suf === "k") return Math.round(n * 1e3);
  return Math.round(n);
}
var compactionSection = defineSection({
  key: "compaction",
  defaults: DEFAULTS2,
  parse(raw) {
    if (!isObj(raw)) return { ...DEFAULTS2 };
    const rawMin = raw.minimumTokens;
    const coercedMin = typeof rawMin === "string" ? parseTokenString(rawMin) ?? Number.NaN : rawMin;
    return {
      triggerPercent: pctOr(raw.triggerPercent, DEFAULTS2.triggerPercent),
      minimumTokens: minimumTokensOr(coercedMin, DEFAULTS2.minimumTokens)
    };
  }
});

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/gate.ts
var SEVERITIES = ["risky", "dangerous", "critical"];
var DEFAULTS3 = {
  guardrails: "on",
  autoApprove: [],
  extraRules: []
};
function regexError(pattern, flags) {
  try {
    new RegExp(pattern, flags);
    return void 0;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
var gateSection = defineSection({
  key: "gate",
  defaults: DEFAULTS3,
  parse(raw, ctx) {
    if (!isObj(raw)) return { guardrails: "on", autoApprove: [], extraRules: [] };
    const extraRules = [];
    if (Array.isArray(raw.extraRules)) {
      raw.extraRules.forEach((r, i) => {
        if (!isObj(r) || typeof r.pattern !== "string") return;
        const flags = typeof r.flags === "string" ? r.flags : void 0;
        const err = regexError(r.pattern, flags);
        if (err) {
          ctx.diagnostic({
            code: "INVALID_VALUE",
            severity: "warning",
            path: `gate.extraRules[${i}]`,
            message: `invalid regex: ${err}`
          });
          return;
        }
        const rule2 = { pattern: r.pattern };
        if (flags) rule2.flags = flags;
        if (typeof r.severity === "string" && SEVERITIES.includes(r.severity)) {
          rule2.severity = r.severity;
        }
        if (typeof r.reason === "string") rule2.reason = r.reason;
        extraRules.push(rule2);
      });
    }
    return {
      guardrails: enumOr(raw.guardrails, ["on", "off"], DEFAULTS3.guardrails),
      autoApprove: strArr(raw.autoApprove),
      extraRules
    };
  }
});

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/io.ts
var DEFAULTS4 = {
  timeoutSec: 30
};
var ioSection = defineSection({
  key: "io",
  defaults: DEFAULTS4,
  parse(raw) {
    if (!isObj(raw)) return { ...DEFAULTS4 };
    return {
      timeoutSec: posNumOr(raw.timeoutSec, DEFAULTS4.timeoutSec)
    };
  }
});

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/optimizer.ts
var CAVEMAN = ["off", "lite", "full", "ultra", "micro"];
var PONYTAIL = ["off", "lite", "full", "ultra"];
var TOGGLE = ["off", "on"];
var DEFAULTS5 = {
  caveman: "off",
  rtk: "on",
  ponytail: "off"
};
var optimizerSection = defineSection({
  key: "optimizer",
  defaults: DEFAULTS5,
  parse(raw) {
    if (!isObj(raw)) return { ...DEFAULTS5 };
    return {
      caveman: enumOr(raw.caveman, CAVEMAN, DEFAULTS5.caveman),
      rtk: enumOr(raw.rtk, TOGGLE, DEFAULTS5.rtk),
      ponytail: enumOr(raw.ponytail, PONYTAIL, DEFAULTS5.ponytail)
    };
  }
});

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/pretty.ts
var ICON_MODES = ["nerd", "unicode", "ascii"];
var LS_STYLES = ["grid", "tree"];
function renderSizeOr(value, fallback) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : fallback;
  if (typeof value !== "string") return fallback;
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return fallback;
  const percent = Number(match[1]);
  return percent > 0 && percent <= 100 ? value : fallback;
}
var DEFAULTS6 = {
  icons: "nerd",
  lsStyle: "grid",
  maxRenderWidth: "65%",
  maxRenderHeight: "80%",
  maxPreviewLines: 80,
  maxRenderLines: 150,
  maxHighlightChars: 8e4,
  cacheLimit: 128,
  diff: { splitMinWidth: 150, splitMinCodeWidth: 60 }
};
var prettySection = defineSection({
  key: "pretty",
  defaults: DEFAULTS6,
  parse(raw) {
    if (!isObj(raw)) return { ...DEFAULTS6, diff: { ...DEFAULTS6.diff } };
    const rawDiff = isObj(raw.diff) ? raw.diff : {};
    return {
      icons: enumOr(raw.icons, ICON_MODES, DEFAULTS6.icons),
      lsStyle: enumOr(raw.lsStyle, LS_STYLES, DEFAULTS6.lsStyle),
      maxRenderWidth: renderSizeOr(raw.maxRenderWidth, DEFAULTS6.maxRenderWidth),
      maxRenderHeight: renderSizeOr(raw.maxRenderHeight, DEFAULTS6.maxRenderHeight),
      maxPreviewLines: posNumOr(raw.maxPreviewLines, DEFAULTS6.maxPreviewLines),
      maxRenderLines: posNumOr(raw.maxRenderLines, DEFAULTS6.maxRenderLines),
      maxHighlightChars: posNumOr(raw.maxHighlightChars, DEFAULTS6.maxHighlightChars),
      cacheLimit: posNumOr(raw.cacheLimit, DEFAULTS6.cacheLimit),
      diff: {
        splitMinWidth: posNumOr(rawDiff.splitMinWidth, DEFAULTS6.diff.splitMinWidth),
        splitMinCodeWidth: posNumOr(rawDiff.splitMinCodeWidth, DEFAULTS6.diff.splitMinCodeWidth)
      }
    };
  }
});

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/sections/index.ts
var builtinSections = [
  collapseSection,
  prettySection,
  ioSection,
  optimizerSection,
  gateSection,
  compactionSection
];

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/registry.ts
var SectionRegistry = class {
  byKey = /* @__PURE__ */ new Map();
  constructor(handles = builtinSections) {
    for (const handle of handles) this.add(handle);
  }
  add(handle) {
    if (this.byKey.has(handle.key)) {
      throw new Error(`pix-runtime: duplicate section key "${handle.key}"`);
    }
    this.byKey.set(handle.key, handle.__section);
  }
  get(key) {
    return this.byKey.get(key);
  }
  all() {
    return [...this.byKey.values()];
  }
  keys() {
    return [...this.byKey.keys()];
  }
};

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/runtime.ts
var RuntimeImpl = class {
  storage;
  registry;
  queue = new WriteQueue();
  bus = new EventBus();
  sink = new DiagnosticSink();
  revision = 0;
  current = null;
  agentDir;
  initPromise = null;
  readOnly = false;
  constructor(adapters = {}) {
    this.agentDir = adapters.agentDir ?? getAgentDir();
    this.storage = adapters.storage ?? new FileStorage(this.agentDir);
    this.registry = adapters.registry ?? new SectionRegistry();
  }
  get path() {
    return this.storage.path;
  }
  get ready() {
    return this.current !== null;
  }
  parseContext() {
    return { diagnostic: (d) => this.sink.push(d) };
  }
  /** Resolve every section from a raw document into a values map. */
  resolve(doc) {
    const ctx = this.parseContext();
    const values = /* @__PURE__ */ new Map();
    for (const section of this.registry.all()) {
      values.set(section.key, section.parse(doc[section.key], ctx));
    }
    return values;
  }
  publish(values) {
    this.revision += 1;
    this.current = makeSnapshot(this.revision, values);
    return this.current;
  }
  /** Synchronous lazy load — read-only, never migrates or writes. */
  lazyLoad() {
    if (this.current) return this.current;
    let doc = {};
    try {
      doc = parseRawDocument(this.storage.readRaw());
    } catch (err) {
      this.sink.push({
        code: "READ_FAILED",
        severity: "warning",
        message: "config read failed; using defaults",
        cause: err
      });
    }
    return this.publish(this.resolve(doc));
  }
  snapshot() {
    return this.current ?? this.lazyLoad();
  }
  get(section) {
    return this.snapshot().get(section);
  }
  diagnostics() {
    return this.sink.all();
  }
  subscribe(listener, options = {}) {
    const unsub = this.bus.subscribe({ listener, paths: options.paths });
    if (options.immediate) {
      listener({
        revision: this.revision,
        origin: "init",
        changed: [],
        current: this.snapshot(),
        persisted: false
      });
    }
    return unsub;
  }
  /** Single-flight initialization: migrate, import sidecars, publish. */
  init(options = {}) {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.queue.run(async () => {
      const hadLazy = this.current !== null;
      const previous = this.current;
      this.storage.ensureDir();
      const doc = parseRawDocument(this.storage.readRaw());
      const ctx = this.parseContext();
      const migrated = migrate(doc, ctx);
      this.readOnly = migrated.document.$version !== CONFIG_FORMAT_VERSION;
      let working = migrated.document;
      let needsWrite = migrated.changed;
      let archive;
      if (!this.readOnly) {
        const sidecar = importOptimizerSidecar(working, this.agentDir, ctx);
        if (sidecar.changed) needsWrite = true;
        archive = sidecar.archive;
      }
      if (needsWrite && !this.readOnly) {
        try {
          this.persist(working);
          archive?.();
        } catch (err) {
          this.sink.push({
            code: "WRITE_FAILED",
            severity: "error",
            message: "initial migration write failed",
            cause: err
          });
        }
      } else if (this.readOnly) {
        working = doc;
      }
      const values = this.resolve(working);
      const snapshot2 = this.publish(values);
      if (previous) {
        const changed = this.changedPaths(previous, snapshot2);
        if (changed.length > 0) {
          this.dispatch({
            revision: this.revision,
            origin: hadLazy ? "migration" : options.origin ?? "init",
            source: options.source,
            changed,
            previous,
            current: snapshot2,
            persisted: needsWrite
          });
        }
      } else {
        this.dispatch({
          revision: this.revision,
          origin: options.origin ?? "init",
          source: options.source,
          changed: [],
          current: snapshot2,
          persisted: needsWrite
        });
      }
      return snapshot2;
    });
    return this.initPromise;
  }
  /** Serialize the current resolved values into a sparse raw document. */
  buildRawFromValues(values, base) {
    const doc = { ...base, $version: CONFIG_FORMAT_VERSION };
    for (const section of this.registry.all()) {
      const value = values.get(section.key);
      const serialized = section.serialize ? section.serialize(value, section.defaults) : this.defaultStrip(value, section.defaults);
      if (serialized === void 0) delete doc[section.key];
      else doc[section.key] = serialized;
    }
    return doc;
  }
  defaultStrip(value, defaults) {
    if (!isObj(value) || !isObj(defaults)) {
      return JSON.stringify(value) === JSON.stringify(defaults) ? void 0 : value;
    }
    const copy = { ...value };
    return stripDefaults(copy, defaults) > 0 ? copy : void 0;
  }
  persist(doc) {
    this.storage.writeAtomic(serializeRawDocument(doc));
  }
  changedPaths(prev, next) {
    const out = [];
    for (const section of this.registry.all()) {
      const handle = { key: section.key, defaults: section.defaults, __section: section };
      out.push(...diffPaths(section.key, prev.get(handle), next.get(handle)));
    }
    return out;
  }
  dispatch(change) {
    this.bus.emit(
      change,
      (err) => this.sink.push({
        code: "LISTENER_FAILED",
        severity: "warning",
        message: "config listener threw",
        cause: err
      })
    );
  }
  update(section, updater, options = {}) {
    return this.queue.run(async () => this.commit(section, updater, options, "api"));
  }
  reset(section, paths, options = {}) {
    return this.queue.run(async () => {
      const updater = (current) => {
        if (!paths || paths.length === 0) return clone(section.defaults);
        const next = clone(current);
        const defs = section.defaults;
        for (const p of paths) {
          const key = p.startsWith(`${section.key}.`) ? p.slice(section.key.length + 1) : p;
          if (key in defs) next[key] = clone(defs[key]);
        }
        return next;
      };
      return this.commit(section, updater, options, "api");
    });
  }
  /** Core transaction: read latest on-disk, apply update, persist, publish. */
  commit(section, updater, options, defaultOrigin) {
    if (this.readOnly) {
      this.sink.push({
        code: "UNSUPPORTED_CONFIG_VERSION",
        severity: "error",
        path: section.key,
        message: "config is read-only (newer $version)"
      });
      return void 0;
    }
    const previous = this.snapshot();
    const base = parseRawDocument(this.storage.readRaw());
    const ctx = this.parseContext();
    const values = /* @__PURE__ */ new Map();
    for (const s of this.registry.all()) values.set(s.key, s.parse(base[s.key], ctx));
    const currentValue = values.has(section.key) ? values.get(section.key) : section.__section.parse(base[section.key], ctx);
    const mergedValue = typeof updater === "function" ? updater(currentValue) : deepMerge(currentValue, updater);
    const nextValue = section.__section.parse(mergedValue, ctx);
    if (JSON.stringify(currentValue) === JSON.stringify(nextValue)) return void 0;
    values.set(section.key, nextValue);
    const doc = this.buildRawFromValues(values, base);
    try {
      this.persist(doc);
    } catch (err) {
      this.sink.push({
        code: "WRITE_FAILED",
        severity: "error",
        path: section.key,
        message: "config write failed; snapshot unchanged",
        cause: err
      });
      if (err instanceof ConfigWriteError) return void 0;
      return void 0;
    }
    const snapshot2 = this.publish(values);
    const change = {
      revision: this.revision,
      origin: options.origin ?? defaultOrigin,
      source: options.source,
      changed: this.changedPaths(previous, snapshot2),
      previous,
      current: snapshot2,
      persisted: true
    };
    if (change.changed.length === 0) return void 0;
    this.dispatch(change);
    return change;
  }
  reload(options = {}) {
    return this.queue.run(async () => {
      const previous = this.snapshot();
      const doc = parseRawDocument(this.storage.readRaw());
      const values = this.resolve(doc);
      const snapshot2 = this.publish(values);
      const changed = this.changedPaths(previous, snapshot2);
      if (changed.length === 0) return void 0;
      const change = {
        revision: this.revision,
        origin: options.origin ?? "reload",
        source: options.source,
        changed,
        previous,
        current: snapshot2,
        persisted: false
      };
      this.dispatch(change);
      return change;
    });
  }
  flush() {
    return this.queue.run(async () => void 0);
  }
  async shutdown() {
    await this.flush();
    this.bus.clear();
  }
};
var SINGLETON_KEY = /* @__PURE__ */ Symbol.for("@xynogen/pix-runtime");
function pixRuntime() {
  const g = globalThis;
  if (!g[SINGLETON_KEY]) g[SINGLETON_KEY] = new RuntimeImpl();
  return g[SINGLETON_KEY];
}
function config(section) {
  return pixRuntime().get(section);
}

// node_modules/@xynogen/pix-pretty/src/config.ts
function envInt(name, fallback) {
  const v = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function pixOrEnvInt(envName, pixValue, fallback) {
  const env = process.env[envName];
  if (env) {
    const v = Number.parseInt(env, 10);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return pixValue !== fallback ? pixValue : fallback;
}
var pc = config(prettySection);
var MAX_HL_CHARS = pixOrEnvInt("PRETTY_MAX_HL_CHARS", pc.maxHighlightChars, 8e4);
var MAX_HL_LINE_CHARS = envInt("PRETTY_MAX_HL_LINE_CHARS", 2e3);
var MAX_PREVIEW_LINES = pixOrEnvInt("PRETTY_MAX_PREVIEW_LINES", pc.maxPreviewLines, 80);
var CACHE_LIMIT = pixOrEnvInt("PRETTY_CACHE_LIMIT", pc.cacheLimit, 128);
var MAX_RENDER_LINES = pixOrEnvInt("PRETTY_MAX_RENDER_LINES", pc.maxRenderLines, 150);

// node_modules/@xynogen/pix-pretty/src/gate-overlay.ts
import { Input, SelectList } from "@earendil-works/pi-tui";

// node_modules/@xynogen/pix-pretty/src/modal-frame.ts
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi
} from "@earendil-works/pi-tui";
var MIN_WIDTH = 40;
var CHROME = 4;
function resolveRenderSize(limit, available) {
  if (typeof limit === "number") return Math.floor(limit);
  return Math.floor(available * Number.parseFloat(limit) / 100);
}
function modalWidth(termWidth, limit = "100%") {
  const available = Number.isFinite(termWidth) ? Math.max(1, Math.floor(termWidth)) : MIN_WIDTH;
  return Math.max(1, Math.min(available, resolveRenderSize(limit, available)));
}
function modalOverlayOptions() {
  const pretty = config(prettySection);
  return {
    anchor: "center",
    width: pretty.maxRenderWidth,
    maxHeight: pretty.maxRenderHeight,
    margin: 2
  };
}
var ELLIPSIS = "\u2026";
function fitModalLine(line, inner, wrap = true) {
  const width = Number.isFinite(inner) ? Math.max(1, Math.floor(inner)) : 1;
  if (line === "") return { rows: [""], truncated: false };
  if (visibleWidth(line) <= width) return { rows: [line], truncated: false };
  if (!wrap) return { rows: [truncateToWidth(line, width, ELLIPSIS)], truncated: true };
  const wrapped = wrapTextWithAnsi(line, width);
  if (wrapped.length === 0) {
    return { rows: [truncateToWidth(line, width, ELLIPSIS)], truncated: true };
  }
  return { rows: wrapped, truncated: false };
}
function fitModalLines(lines, inner, wrap = true) {
  const rows = [];
  let truncated = false;
  for (const line of lines) {
    const fit = fitModalLine(line, inner, wrap);
    rows.push(...fit.rows);
    truncated = truncated || fit.truncated;
  }
  return { rows, truncated };
}
function frameLines(opts) {
  const { color, top } = opts;
  const width = Number.isFinite(opts.width) ? Math.max(1, Math.floor(opts.width)) : 1;
  if (width < CHROME) {
    const first = top ?? opts.lines[0] ?? "";
    return [truncateToWidth(first, width)];
  }
  const bg = opts.bg ?? ((s) => s);
  const fg = opts.fg;
  const inner = width - CHROME;
  const dashes = "\u2500".repeat(width - 2);
  const wrap = opts.wrap ?? true;
  const topBorder = (() => {
    const span = width - 5;
    if (!opts.title || span < 3) return color(`\u256D${dashes}\u256E`);
    const paint = opts.titleColor ?? color;
    const label = truncateToWidth(opts.title, span - 1, ELLIPSIS);
    const tail = "\u2500".repeat(Math.max(1, span - visibleWidth(label)));
    return `${color("\u256D\u2500 ")}${paint(label)}${color(` ${tail}\u256E`)}`;
  })();
  const { rows: lines } = fitModalLines(opts.lines, inner, wrap);
  const SENTINEL = "\0";
  const bgOpen = bg(SENTINEL).split(SENTINEL)[0] ?? "";
  const fgOpen = fg ? fg(SENTINEL).split(SENTINEL)[0] ?? "" : "";
  const reassert = (s) => bgOpen || fgOpen ? s.replace(/\x1b\[([0-9;]*)m/g, (seq, p) => {
    const parts = p.split(";");
    const isFull = p === "0";
    let tail = seq;
    if (isFull || parts.includes("49")) tail += bgOpen;
    if (isFull || parts.includes("39")) tail += fgOpen;
    return tail;
  }) : s;
  const row2 = (content) => {
    const pad = inner - visibleWidth(content);
    const padded = pad > 0 ? content + " ".repeat(pad) : truncateToWidth(content, inner, ELLIPSIS);
    const body = fgOpen ? reassert(fg?.(padded) ?? padded) : reassert(padded);
    return bg(`${color("\u2502")} ${body} ${color("\u2502")}`);
  };
  const out = [bg(topBorder)];
  if (top !== void 0) out.push(row2(top));
  for (const line of lines) out.push(row2(line));
  out.push(bg(color(`\u2570${dashes}\u256F`)));
  return out;
}
var MIN_PERMISSION_MODAL_HEIGHT = 12;
function modalHeight(terminalRows, limit = config(prettySection).maxRenderHeight) {
  const rows = Number.isFinite(terminalRows) ? Math.max(1, Math.floor(terminalRows)) : 24;
  return Math.max(1, Math.min(rows, resolveRenderSize(limit, rows)));
}
function terminalModalHeight(terminalRows = process.stdout.rows ?? 24, limit = config(prettySection).maxRenderHeight) {
  return modalHeight(terminalRows, limit);
}
function ensureVisibleOffset(bodyOffset, viewportRows, totalRows, selectedStart, selectedEnd) {
  const viewport = Number.isFinite(viewportRows) ? Math.max(0, Math.floor(viewportRows)) : 0;
  const total = Number.isFinite(totalRows) ? Math.max(0, Math.floor(totalRows)) : 0;
  if (viewport === 0 || total === 0) return 0;
  const maxOffset = Math.max(0, total - viewport);
  let offset = Number.isFinite(bodyOffset) ? Math.min(maxOffset, Math.max(0, Math.floor(bodyOffset))) : 0;
  const start = Number.isFinite(selectedStart) ? Math.min(total, Math.max(0, Math.floor(selectedStart))) : 0;
  const end = Number.isFinite(selectedEnd) ? Math.min(total, Math.max(start, Math.floor(selectedEnd))) : start;
  if (start < offset) offset = start;
  else if (end > offset + viewport) offset = end - viewport;
  return Math.min(maxOffset, Math.max(0, offset));
}
function pageBodyOffset(bodyOffset, visibleBodyLines, maxBodyOffset, direction) {
  const current = Number.isFinite(bodyOffset) ? Math.max(0, Math.floor(bodyOffset)) : 0;
  const size = Number.isFinite(visibleBodyLines) ? Math.max(1, Math.floor(visibleBodyLines)) : 1;
  const max = Number.isFinite(maxBodyOffset) ? Math.max(0, Math.floor(maxBodyOffset)) : 0;
  const step = Math.max(1, Math.floor(size / 2));
  return Math.min(max, Math.max(0, current + direction * step));
}
var ModalPager = class {
  bodyOffset = 0;
  visibleBodyLines = 1;
  maxBodyOffset = 0;
  inspecting = false;
  sync(result) {
    this.bodyOffset = result.bodyOffset;
    this.visibleBodyLines = Math.max(1, result.visibleBodyLines);
    this.maxBodyOffset = result.maxBodyOffset;
  }
  page(direction) {
    const next = pageBodyOffset(
      this.bodyOffset,
      this.visibleBodyLines,
      this.maxBodyOffset,
      direction
    );
    if (next === this.bodyOffset) return false;
    this.bodyOffset = next;
    this.inspecting = true;
    return true;
  }
  /** Resume auto-scroll to the selected row after arrows/filtering. */
  followSelection() {
    this.inspecting = false;
  }
  selectedLine(line) {
    return this.inspecting ? void 0 : line;
  }
  selectedRange(range) {
    return this.inspecting ? void 0 : range;
  }
  reset() {
    this.bodyOffset = 0;
    this.visibleBodyLines = 1;
    this.maxBodyOffset = 0;
    this.inspecting = false;
  }
  /**
   * Handle paging input. Set `arrowPages` to also accept ←/→ as page up/down
   * (only safe when the overlay doesn't use left/right for other navigation).
   */
  handleInput(data, keybindings, arrowPages) {
    if (keybindings?.matches(data, "tui.select.pageUp") || matchesKey(data, Key.pageUp) || arrowPages && matchesKey(data, Key.left)) {
      return this.page(-1);
    }
    if (keybindings?.matches(data, "tui.select.pageDown") || matchesKey(data, Key.pageDown) || arrowPages && matchesKey(data, Key.right)) {
      return this.page(1);
    }
    return false;
  }
};
var defaultOverflowLine = ({ page, totalPages }) => `PageUp/PageDown inspect \u2022 ${page}/${totalPages}`;
function frameModal(opts) {
  const { width, maxHeight, color, bg, fg, top } = opts;
  const overflowLine = opts.overflowLine ?? defaultOverflowLine;
  const wrap = opts.wrap ?? true;
  const inner = Math.max(1, width - CHROME);
  const headerFit = fitModalLines(opts.header ?? [], inner, wrap);
  const footerFit = fitModalLines(opts.footer ?? [], inner, wrap);
  const bodyFit = fitModalLines(opts.body, inner, wrap);
  let selectedBodyRange = opts.selectedBodyRange;
  if (Number.isFinite(opts.selectedBodyLine)) {
    const index = Math.min(
      Math.max(0, Math.floor(opts.selectedBodyLine ?? 0)),
      Math.max(0, opts.body.length - 1)
    );
    const start = fitModalLines(opts.body.slice(0, index), inner, wrap).rows.length;
    const length = fitModalLine(opts.body[index] ?? "", inner, wrap).rows.length;
    selectedBodyRange = { start, end: start + Math.max(1, length) };
  }
  const header = headerFit.rows;
  const footer = footerFit.rows;
  const body = bodyFit.rows;
  const topTruncated = top !== void 0 && visibleWidth(top) > inner;
  const textTruncated = topTruncated || headerFit.truncated || footerFit.truncated || bodyFit.truncated;
  const cap = Number.isFinite(maxHeight) ? Math.max(1, Math.floor(maxHeight)) : 1;
  const minHeight = Number.isFinite(opts.minHeight) ? Math.max(1, Math.floor(opts.minHeight ?? 1)) : 1;
  const diagnostic = "Terminal too short \u2014 resize or press esc to cancel";
  if (cap < Math.max(3, minHeight)) {
    return {
      lines: [truncateToWidth(diagnostic, Math.max(1, width))].slice(0, cap),
      bodyOffset: 0,
      maxBodyOffset: 0,
      visibleBodyLines: 0,
      bodyOverflowed: body.length > 0,
      textTruncated: true,
      pinnedRowsFit: false
    };
  }
  const chrome = 2 + (top !== void 0 ? 1 : 0);
  const contentBudget = cap - chrome;
  const pinned = header.length + footer.length;
  const needed = pinned + (body.length > 0 ? 1 : 0);
  const bodyBudget = contentBudget - pinned;
  const overflows = body.length > Math.max(0, bodyBudget);
  const canShowOverflow = !overflows || bodyBudget >= 2;
  if (contentBudget < needed || !canShowOverflow) {
    const diag = fitModalLines(
      [...header.length > 0 ? [header[0]] : [], diagnostic],
      inner,
      wrap
    ).rows.slice(0, Math.max(1, cap - 2));
    return {
      lines: frameLines({
        width,
        lines: diag,
        color,
        bg,
        fg,
        title: opts.title,
        titleColor: opts.titleColor,
        wrap: false
      }),
      bodyOffset: 0,
      maxBodyOffset: 0,
      visibleBodyLines: 0,
      bodyOverflowed: body.length > 0,
      textTruncated,
      pinnedRowsFit: false
    };
  }
  const visibleBodyLines = overflows ? bodyBudget - 1 : bodyBudget;
  const maxBodyOffset = Math.max(0, body.length - visibleBodyLines);
  let offset = Math.min(Math.max(0, Math.floor(opts.bodyOffset ?? 0)), maxBodyOffset);
  if (selectedBodyRange) {
    offset = ensureVisibleOffset(
      offset,
      visibleBodyLines,
      body.length,
      selectedBodyRange.start,
      selectedBodyRange.end
    );
  }
  const end = Math.min(body.length, offset + visibleBodyLines);
  const lines = [...header];
  if (overflows) {
    const step = Math.max(1, Math.floor(visibleBodyLines / 2));
    const totalPages = Math.max(1, Math.ceil(maxBodyOffset / step) + 1);
    const page = offset >= maxBodyOffset ? totalPages : Math.floor(offset / step) + 1;
    lines.push(
      overflowLine({
        start: offset,
        end,
        total: body.length,
        hiddenBefore: offset,
        hiddenAfter: body.length - end,
        page,
        totalPages
      })
    );
  }
  lines.push(...body.slice(offset, end), ...footer);
  return {
    // Already fitted above — pass wrap:false so rows are not re-expanded.
    lines: frameLines({
      width,
      lines,
      color,
      bg,
      fg,
      top,
      title: opts.title,
      titleColor: opts.titleColor,
      wrap: false
    }),
    bodyOffset: offset,
    maxBodyOffset,
    visibleBodyLines,
    bodyOverflowed: overflows,
    textTruncated,
    pinnedRowsFit: true
  };
}
function selectListTheme(theme, accent = "accent") {
  return {
    selectedPrefix: (t) => theme.fg(accent, t),
    selectedText: (t) => theme.fg(accent, t),
    description: (t) => theme.fg("dim", t),
    scrollInfo: (t) => theme.fg("muted", t),
    noMatch: (t) => theme.fg("warning", t)
  };
}

// node_modules/@xynogen/pix-pretty/src/gate-overlay.ts
var DEFAULT_CHOICES = [
  { value: "yes", label: "Allow", description: "Proceed" },
  { value: "no", label: "Deny", description: "Block" }
];
function asPageKeybindings(value) {
  if (!value || typeof value !== "object") return void 0;
  return typeof value.matches === "function" ? value : void 0;
}
var MaskedInput = class extends Input {
  render(width) {
    const real = this.getValue();
    this.setValue("\u25CF".repeat(real.length));
    const lines = super.render(width);
    this.setValue(real);
    return lines;
  }
};
function buildSections(opts) {
  const {
    theme,
    accent,
    config: config3,
    stage,
    selectList,
    maskedInput,
    countdownLine,
    passwordStatus,
    width
  } = opts;
  const inner = width - 4;
  const titleText = config3.icon ? `${config3.icon} ${config3.title}` : config3.title;
  const header = [theme.fg(accent, theme.bold(titleText))];
  const body = (config3.body ?? []).map((line) => {
    if (line.startsWith("Warning:")) return theme.fg("warning", line);
    if (line.startsWith("(") && line.endsWith(")")) return theme.fg("muted", line);
    const separator = line.indexOf(":");
    if (separator < 1) return theme.fg("text", line);
    const label = line.slice(0, separator + 1);
    const value = line.slice(separator + 1).trimStart();
    const valueColors = {
      "Intent:": "text",
      "Command:": "dim",
      "Host:": "accent",
      "Direction:": "warning",
      "From:": "text",
      "To:": "accent",
      "Mode:": "muted",
      "Auth:": "success"
    };
    const valueColor = valueColors[label];
    return valueColor ? `${theme.fg("dim", label)} ${theme.fg(valueColor, value)}` : theme.fg("text", line);
  });
  const footer = [theme.fg("muted", "\u2500".repeat(inner))];
  if (countdownLine !== void 0) footer.push(countdownLine);
  if (stage === "select") {
    footer.push(...selectList.render(inner));
    footer.push("");
    footer.push(theme.fg("muted", "\u2191\u2193 choose \u2022 \u2190\u2192/PgUp/PgDn inspect \u2022 enter select \u2022 esc deny"));
  } else {
    const label = config3.mode === "sudo" ? config3.passwordLabel ?? "Sudo password:" : "Password:";
    footer.push(theme.fg("dim", label));
    if (passwordStatus)
      footer.push(
        theme.fg(passwordStatus === "Checking password\u2026" ? "dim" : "error", passwordStatus)
      );
    footer.push(...maskedInput.render(inner));
    footer.push("");
    footer.push(theme.fg("muted", "\u2190\u2192/PgUp/PgDn inspect \u2022 enter confirm \u2022 esc cancel"));
  }
  return { header, body, footer };
}
function showOverlay(ui, config3) {
  const accent = config3.accent ?? "accent";
  const choices = config3.choices ?? DEFAULT_CHOICES;
  const approveVal = config3.approveValue ?? "yes";
  return new Promise((resolve) => {
    ui.custom(
      (tui, theme, kb, done) => {
        const pageKeybindings = asPageKeybindings(kb);
        let stage = "select";
        let countdownLine;
        let passwordStatus;
        let passwordAttempts = 0;
        let validatingPassword = false;
        const pager = new ModalPager();
        const timeoutMs = config3.timeoutMs ?? 0;
        let remaining = Math.ceil(timeoutMs / 1e3);
        let timer;
        const cancelTimer = () => {
          if (timer) clearInterval(timer);
          timer = void 0;
          countdownLine = void 0;
        };
        const selectItems = choices.map((c) => ({
          value: c.value,
          label: c.label,
          description: c.description
        }));
        const selectList = new SelectList(
          selectItems,
          selectItems.length,
          selectListTheme(theme, accent)
        );
        const maskedInput = new MaskedInput();
        const finish = (result) => {
          cancelTimer();
          done(result);
        };
        if (timeoutMs > 0) {
          const urgencyColor = (s) => s <= 5 ? "error" : s <= 15 ? "warning" : "muted";
          const countdownText = (s) => {
            const color = urgencyColor(s);
            const text = `auto-deny in ${s}s`;
            return s <= 5 ? theme.bold(theme.fg(color, text)) : theme.fg(color, text);
          };
          countdownLine = countdownText(remaining);
          timer = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              finish({ action: "timeout" });
              return;
            }
            countdownLine = countdownText(remaining);
            tui.requestRender();
          }, 1e3);
        }
        selectList.onSelect = (item) => {
          if (item.value !== approveVal) {
            finish({ action: "denied" });
          } else if (config3.mode === "sudo") {
            stage = "password";
            tui.requestRender();
          } else {
            finish({ action: "approved" });
          }
        };
        selectList.onCancel = () => finish({ action: "denied" });
        maskedInput.onSubmit = async (pw) => {
          if (config3.mode !== "sudo" || !config3.validatePassword) {
            finish({ action: "approved", password: pw });
            return;
          }
          if (!pw.trim() || validatingPassword) return;
          validatingPassword = true;
          passwordStatus = "Checking password\u2026";
          tui.requestRender();
          const valid = await config3.validatePassword(pw);
          validatingPassword = false;
          if (valid) {
            finish({ action: "approved", password: pw });
            return;
          }
          passwordAttempts += 1;
          const maxAttempts = config3.maxPasswordAttempts ?? 3;
          if (passwordAttempts >= maxAttempts) {
            finish({ action: "approved", password: pw, passwordAttemptsExhausted: true });
            return;
          }
          maskedInput.setValue("");
          passwordStatus = `Incorrect password \u2014 attempt ${passwordAttempts} of ${maxAttempts}`;
          tui.requestRender();
        };
        maskedInput.onEscape = () => {
          if (!validatingPassword) finish({ action: "denied" });
        };
        return {
          render: (w) => {
            const mw = modalWidth(w);
            const sections = buildSections({
              theme,
              accent,
              config: config3,
              stage,
              selectList,
              maskedInput,
              countdownLine,
              passwordStatus,
              width: mw
            });
            const result = frameModal({
              width: mw,
              maxHeight: terminalModalHeight(tui.terminal?.rows),
              minHeight: MIN_PERMISSION_MODAL_HEIGHT,
              ...sections,
              bodyOffset: pager.bodyOffset,
              color: (s) => theme.fg(accent, s),
              bg: (s) => theme.bg("customMessageBg", s),
              fg: (s) => theme.fg("text", s),
              overflowLine: ({ page, totalPages }) => theme.fg("muted", `\u2190\u2192/PgUp/PgDn inspect \u2022 ${page}/${totalPages}`)
            });
            pager.sync(result);
            return result.lines;
          },
          invalidate: () => {
          },
          handleInput: (data) => {
            cancelTimer();
            if (validatingPassword) return;
            if (pager.handleInput(data, pageKeybindings, true)) {
              tui.requestRender();
              return;
            }
            if (stage === "select") selectList.handleInput(data);
            else maskedInput.handleInput(data);
            tui.requestRender();
          }
        };
      },
      { overlay: true, overlayOptions: modalOverlayOptions() }
    ).then((result) => {
      resolve(result ?? { action: "denied" });
    });
  });
}

// node_modules/@xynogen/pix-pretty/node_modules/@xynogen/pix-runtime/src/icon-catalog.ts
var VS = "\uFE0E";
var CATALOG = {
  // ── footer / status segments ──────────────────────────────────────────
  model: { nerd: "\u{F06A9}", unicode: `\u25C8${VS}`, ascii: "M" },
  lsp: { nerd: "\u{F0626}", unicode: `\u25C9${VS}`, ascii: "LSP" },
  mcp: { nerd: "\u{F048D}", unicode: `\u25D0${VS}`, ascii: "MCP" },
  cwd: { nerd: "\u{F024B}", unicode: `\u2302${VS}`, ascii: "~" },
  process: { nerd: "\u{F018D}", unicode: `\u25B8${VS}`, ascii: ">_" },
  "audio.play": { nerd: "\uF04B", unicode: `\u25B6${VS}`, ascii: ">" },
  "audio.pause": { nerd: "\uF04C", unicode: `\u23F8${VS}`, ascii: "||" },
  "audio.stop": { nerd: "\uF04D", unicode: `\u25A0${VS}`, ascii: "[]" },
  "audio.file": { nerd: "\uF1C7", unicode: `\u266B${VS}`, ascii: "audio" },
  folder: { nerd: "\u{F024B}", unicode: `\u2302${VS}`, ascii: "/" },
  afk: { nerd: "\u{F0310}", unicode: `\u2328${VS}`, ascii: "kbd" },
  // ── footer indicators (git status, score) ─────────────────────────────
  "git.unstaged": { nerd: "\u2717", unicode: "\u2717", ascii: "x" },
  "git.ahead": { nerd: "\u21E1", unicode: "\u21E1", ascii: "^" },
  "git.behind": { nerd: "\u21E3", unicode: "\u21E3", ascii: "v" },
  "net.in": { nerd: "\u21E1", unicode: "\u21E1", ascii: "in" },
  "net.out": { nerd: "\u21E3", unicode: "\u21E3", ascii: "out" },
  score: { nerd: "\u26A1", unicode: "\u26A1", ascii: "S" },
  // ── misc ──────────────────────────────────────────────────────────────
  ok: { nerd: "\u2713", unicode: "\u2713", ascii: "ok" },
  warn: { nerd: "\u26A0", unicode: "\u26A0", ascii: "!" },
  error: { nerd: "\u2717", unicode: "\u2717", ascii: "x" },
  // ── permission / security modal titles ────────────────────────────────
  // Semantic keys for the danger prompts (🔐 root, 🔑 secret). nerd = Nerd
  // Font glyph, unicode = a widely-shipped BMP symbol forced to text
  // presentation, ascii = tofu-free token.
  lock: { nerd: "\u{F0341}", unicode: `\u{1F512}${VS}`, ascii: "[!]" },
  secret: { nerd: "\u{F0306}", unicode: `\u{1F511}${VS}`, ascii: "[key]" },
  "data.boolean": { nerd: "\u25C6", unicode: `\u25C6${VS}`, ascii: "bool" },
  "data.int": { nerd: "#", unicode: "#", ascii: "int" },
  "data.float": { nerd: "\u2248", unicode: `\u2248${VS}`, ascii: "float" },
  "data.string": { nerd: "\u201C", unicode: `\u201C${VS}`, ascii: "str" },
  settings: { nerd: "\u{F0493}", unicode: `\u2699${VS}`, ascii: "[*]" },
  update: { nerd: "\u{F01DA}", unicode: `\u2193${VS}`, ascii: "[v]" },
  // ── shared status glyphs (checklists, panels, markers) ────────────────
  // nerd/unicode keep the historical literal so mixed-glyph rows stay
  // aligned; ascii mode swaps in tofu-free tokens. `⚡` (energetic
  // warning/killed/denied) intentionally stays a local literal — it is not
  // part of this set.
  "status.ok": { nerd: "\u2713", unicode: `\u2713${VS}`, ascii: "ok" },
  "status.error": { nerd: "\u2717", unicode: `\u2717${VS}`, ascii: "x" },
  // `⚠` is East-Asian wide (2 cells); consumers that place it in an aligned
  // marker column must normalize width via `padIcon` (pix-pretty/utils).
  "status.warn": { nerd: "\u26A0", unicode: `\u26A0${VS}`, ascii: "!" },
  "status.pending": { nerd: "\u25CB", unicode: `\u25CB${VS}`, ascii: "o" },
  "status.running": { nerd: "\u25D0", unicode: `\u25D0${VS}`, ascii: "*" },
  "status.active": { nerd: "\u25CF", unicode: `\u25CF${VS}`, ascii: "*" },
  "status.done": { nerd: "\u25CF", unicode: `\u25CF${VS}`, ascii: "x" },
  "status.blocked": { nerd: "\u2298", unicode: `\u2298${VS}`, ascii: "!" },
  // ── welcome banner ────────────────────────────────────────────────────
  ready: { nerd: "\u{F0633}", unicode: `\u2713${VS}`, ascii: "ok" },
  // ── paste chips (pix-display) ─────────────────────────────────────────
  "paste.image": { nerd: "\u{F02E9}", unicode: `\u25A3${VS}`, ascii: "img" },
  "paste.text": { nerd: "\u{F027F}", unicode: `\u25A4${VS}`, ascii: "txt" },
  // ── model picker (pix-models) ─────────────────────────────────────────
  "picker.model": { nerd: "\u{F0229}", unicode: `\u25C8${VS}`, ascii: "M" },
  // ── optimizer suite (pix-optimizer) ───────────────────────────────────
  "opt.caveman": { nerd: "\u{F0710}", unicode: `\u2664${VS}`, ascii: "Cv" },
  "opt.rtk": { nerd: "\u{F04E5}", unicode: `\u2661${VS}`, ascii: "Rk" },
  "opt.toon": { nerd: "\u{F05C0}", unicode: `\u2662${VS}`, ascii: "Tn" },
  "opt.ponytail": { nerd: "\u{F0190}", unicode: `\u2667${VS}`, ascii: "Pt" },
  "opt.title": { nerd: "\u{F0DAB}", unicode: `\u25C8${VS}`, ascii: "*" },
  // ── subagent widget (pix-subagent) ────────────────────────────────────
  agent: { nerd: "\u{F0BA0}", unicode: `\u2699${VS}`, ascii: "@" },
  turns: { nerd: "\u{F006A}", unicode: `\u21BB${VS}`, ascii: "~" },
  tools: { nerd: "\u{F1064}", unicode: `\u2692${VS}`, ascii: "T" },
  tokens: { nerd: "\u{F027F}", unicode: `\u25A4${VS}`, ascii: "tk" }
};
var ICON_KEYS = Object.keys(CATALOG);
function envMode() {
  const raw = (process.env.PRETTY_ICONS ?? "").toLowerCase();
  if (raw === "nerd" || raw === "unicode" || raw === "ascii") return raw;
  if (raw === "none" || raw === "off") return "ascii";
  return "nerd";
}
var activeMode = envMode();
function icon(key) {
  const entry = CATALOG[key];
  return entry ? entry[activeMode] : "";
}

// node_modules/@xynogen/pix-pretty/src/renderers.ts
import { truncateToWidth as truncateToWidth3, visibleWidth as visibleWidth3, wrapTextWithAnsi as wrapTextWithAnsi2 } from "@earendil-works/pi-tui";

// node_modules/@xynogen/pix-pretty/src/highlight.ts
if (process.env.FORCE_COLOR === void 0 && process.env.NO_COLOR === void 0) {
  process.env.FORCE_COLOR = "3";
}

// node_modules/@xynogen/pix-pretty/src/icons.ts
import { basename, extname } from "node:path";
var ICONS_MODE = (process.env.PRETTY_ICONS ?? "nerd").toLowerCase();

// node_modules/@xynogen/pix-pretty/src/lang.ts
import { basename as basename2, extname as extname2 } from "node:path";

// node_modules/@xynogen/pix-pretty/src/utils.ts
import { relative } from "node:path";
import { truncateToWidth as truncateToWidth2, visibleWidth as visibleWidth2 } from "@earendil-works/pi-tui";
function renderToolError(error, theme) {
  return fillToolBackground(theme.fg("error", error), BG_ERROR);
}
function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function preserveToolBackground(ansi, bg) {
  return ansi.replace(ANSI_CAPTURE_RE, (seq, params) => {
    const codes = params.split(";");
    return params === "0" || codes.includes("49") ? `${seq}${bg}` : seq;
  });
}
function fillToolBackground(text, bg = BG_BASE, width) {
  const resolvedWidth = width ?? termW();
  return text.split("\n").map((line) => {
    const normalized = preserveToolBackground(line, bg);
    const fitted = preserveToolBackground(truncateToWidth2(normalized, resolvedWidth, ""), bg);
    const padding = Math.max(0, resolvedWidth - visibleWidth2(fitted));
    return `${bg}${fitted}${" ".repeat(padding)}${RST}`;
  }).join("\n");
}
var RESULT_FRAME = /* @__PURE__ */ Symbol("pix.resultFrame");
function pluralize(count, noun, plural) {
  return `${count} ${count === 1 ? noun : plural ?? `${noun}s`}`;
}
var COLLAPSED_TOOL_GLYPH = {
  success: "\u2713",
  warning: "\u26A0",
  error: "\u2717"
};
function padIcon(glyph, width = 2) {
  const pad = width - visibleWidth2(glyph);
  return pad > 0 ? glyph + " ".repeat(pad) : glyph;
}
function dotJoin(parts, paint) {
  const sep = paint ? paint(" \xB7 ") : " \xB7 ";
  return parts.filter((p) => Boolean(p)).join(sep);
}
function formatCollapsedToolRow(theme, tool, target, meta = "", status = "success") {
  const icon3 = padIcon(COLLAPSED_TOOL_GLYPH[status]);
  const parts = [
    `${theme.fg(status, icon3)} ${theme.fg("toolTitle", theme.bold(tool))}`,
    target ? theme.fg("dim", target) : "",
    meta ? `${theme.fg("muted", "\xB7")} ${theme.fg("muted", meta)}` : ""
  ].filter(Boolean);
  return parts.join(" ");
}
function renderCollapsedToolRow(theme, tool, target, meta = "", status = "success", width) {
  return fillToolBackground(
    formatCollapsedToolRow(theme, tool, target, meta, status),
    BG_BASE,
    width
  );
}
function hideCollapsedToolCall(state, expanded, setText) {
  if (!state.collapsed || expanded) return false;
  setText("");
  return true;
}
var _cachedTermW;
var _termWResizeBound = false;
function _bindTermWResize() {
  if (_termWResizeBound) return;
  _termWResizeBound = true;
  const invalidate = () => {
    _cachedTermW = void 0;
  };
  process.stdout.on("resize", invalidate);
  process.stdin.on("resize", invalidate);
}
function termW() {
  _bindTermWResize();
  if (_cachedTermW !== void 0) return _cachedTermW;
  const stderrWithColumns = process.stderr;
  const raw = process.stdout.columns || stderrWithColumns.columns || Number.parseInt(process.env.COLUMNS ?? "", 10) || _readTtyColumns() || 120;
  _cachedTermW = Math.max(1, raw);
  return _cachedTermW;
}
function _readTtyColumns() {
  try {
    const { getWindowSize } = __require("node:tty");
    if (getWindowSize) {
      for (const fd of [1, 2, 0]) {
        try {
          const [cols] = getWindowSize(fd);
          if (cols && cols > 0) return cols;
        } catch {
        }
      }
    }
  } catch {
  }
  return void 0;
}
function rule(w, paint, style = "solid") {
  const glyphs = style === "dashed" ? "- ".repeat(Math.ceil(w / 2)).slice(0, w) : "\u2500".repeat(w);
  return paint ? paint(glyphs) : `${FG_RULE}${glyphs}${RST}`;
}
var SECTION_RE = /^\s*={2,}\s*(.+?)\s*={2,}\s*$/;
var SECTION_RULE_LEAD = 4;
function sectionRule(line, theme, width) {
  const m = SECTION_RE.exec(line);
  if (!m || hasAnsi(line)) return null;
  const label = ` ${m[1]} `;
  const trail = width - SECTION_RULE_LEAD - visibleWidth2(label);
  const [lead, tail] = trail >= 2 ? [SECTION_RULE_LEAD, trail] : [2, 2];
  return theme.fg("muted", `${"\u2500".repeat(lead)}${label}${"\u2500".repeat(tail)}`);
}
function frameToolResult(component, theme, isError) {
  return decorateToolResult(component, theme, isError, false);
}
function decorateToolResult(component, theme, isError, section) {
  const existing = component;
  if (existing[RESULT_FRAME]) {
    existing[RESULT_FRAME].update(theme, isError, section);
    return component;
  }
  let frameTheme = theme;
  let failed = isError;
  let solid = section;
  const framed = {
    [RESULT_FRAME]: {
      component,
      update(nextTheme, nextError, nextSection) {
        frameTheme = nextTheme;
        failed = nextError;
        solid = nextSection;
      }
    },
    wantsKeyRelease: component.wantsKeyRelease,
    render(width) {
      const paint = (line) => frameTheme.fg(failed ? "error" : "success", line);
      const lines = component.render?.(width) ?? [];
      return solid ? sectionFrame(lines, [], width, paint) : ruleFrame(lines, [], width, paint);
    },
    invalidate() {
      component.invalidate?.();
    },
    handleInput: component.handleInput ? (data) => component.handleInput?.(data) : void 0
  };
  if (component.setText) framed.setText = (value) => component.setText?.(value);
  if (component.getText) framed.getText = () => component.getText?.() ?? "";
  return framed;
}
function unframeToolResult(component) {
  const framed = component;
  return framed[RESULT_FRAME]?.component ?? component;
}
function ruleFrame(bodyLines, footerLines = [], width, paint) {
  return [...bodyLines, rule(width ?? termW(), paint, "dashed"), ...footerLines];
}
function sectionFrame(bodyLines, footerLines = [], width, paint) {
  const r = rule(width ?? termW(), paint);
  return [r, ...bodyLines, r, ...footerLines];
}
function isTextContent(content) {
  return content.type === "text";
}
function getTextContent(result) {
  return result.content?.filter(isTextContent).map((content) => content.text || "").join("\n") ?? "";
}

// node_modules/@xynogen/pix-pretty/src/renderers.ts
function renderBashOutput(text, exitCode, theme) {
  const isOk = exitCode === 0;
  const statusIcon = isOk ? "\u2713" : "\u2717";
  const semantic = isOk ? "success" : "error";
  const codeText = exitCode !== null ? `${statusIcon} exit ${exitCode}` : "\u26A1 killed";
  const codeStr = theme ? theme.fg(exitCode !== null ? semantic : "warning", codeText) : codeText;
  const lines = text.split("\n");
  const maxShow = MAX_PREVIEW_LINES;
  const show = lines.slice(0, maxShow);
  const remaining = lines.length - maxShow;
  let body = show.join("\n");
  if (remaining > 0) {
    body += `
${FG_DIM}  \u2026 ${pluralize(remaining, "more line")}${RST}`;
  }
  return { summary: codeStr, body };
}

// node_modules/@xynogen/pix-pretty/src/widget-format.ts
var SPINNER = [
  "\u280B",
  "\u2819",
  "\u2839",
  "\u2838",
  "\u283C",
  "\u2834",
  "\u2826",
  "\u2827",
  "\u2807",
  "\u280F"
];

// node_modules/@xynogen/pix-runtime/src/atomic-write.ts
import { mkdirSync as mkdirSync2, renameSync as renameSync3, rmSync as rmSync2, writeFileSync as writeFileSync2 } from "node:fs";
import { dirname as dirname2 } from "node:path";

// node_modules/@xynogen/pix-runtime/src/runtime.ts
import { getAgentDir as getAgentDir2 } from "@earendil-works/pi-coding-agent";

// node_modules/@xynogen/pix-runtime/src/diagnostics.ts
var DiagnosticSink2 = class {
  constructor(limit = 100) {
    this.limit = limit;
  }
  limit;
  items = [];
  push(d) {
    this.items.push({ ...d, at: Date.now() });
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
  }
  all() {
    return [...this.items];
  }
  /** Diagnostics newer than a timestamp — used for session-start aggregation. */
  since(ts) {
    return this.items.filter((d) => d.at >= ts);
  }
  clear() {
    this.items.length = 0;
  }
};

// node_modules/@xynogen/pix-runtime/src/schema.ts
var CONFIG_FORMAT_VERSION2 = 1;
function defineSection2(definition) {
  return {
    key: definition.key,
    defaults: definition.defaults,
    __section: definition
  };
}
function isObj2(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function boolOr2(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}
function posNumOr2(v, fallback) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}
function enumOr2(v, allowed, fallback) {
  return typeof v === "string" && allowed.includes(v) ? v : fallback;
}
function strArr2(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string");
}
function stripDefaults2(section, defaults) {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const value = section[key];
    if (isObj2(value) && isObj2(defaultValue)) {
      const nested = { ...value };
      if (stripDefaults2(nested, defaultValue) > 0) section[key] = nested;
      else delete section[key];
    } else if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
      delete section[key];
    }
  }
  return Object.keys(section).length;
}
function deepFreeze2(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      deepFreeze2(value[key]);
    }
  }
  return value;
}
function clone2(value) {
  return structuredClone(value);
}
function deepMerge2(base, patch) {
  if (!isObj2(base) || !isObj2(patch)) return patch ?? base;
  const out = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === void 0) continue;
    const prev = out[key];
    if (isObj2(prev) && isObj2(value)) {
      out[key] = deepMerge2(
        prev,
        value
      );
    } else {
      out[key] = value;
    }
  }
  return out;
}
function diffPaths2(prefix, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!isObj2(a) || !isObj2(b)) return [prefix];
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const key of keys) {
    out.push(...diffPaths2(prefix ? `${prefix}.${key}` : key, a[key], b[key]));
  }
  return out;
}
function pathMatches2(changed, filters) {
  return filters.some((f) => {
    if (f === changed) return true;
    if (f.endsWith(".*")) {
      const base = f.slice(0, -2);
      return changed === base || changed.startsWith(`${base}.`);
    }
    return false;
  });
}

// node_modules/@xynogen/pix-runtime/src/events.ts
function makeSnapshot2(revision, values) {
  const frozen = /* @__PURE__ */ new Map();
  for (const [key, value] of values) frozen.set(key, deepFreeze2(value));
  const loadedAt = Date.now();
  return {
    revision,
    formatVersion: CONFIG_FORMAT_VERSION2,
    loadedAt,
    get(section) {
      return frozen.get(section.key) ?? section.defaults;
    }
  };
}
var EventBus2 = class {
  regs = /* @__PURE__ */ new Set();
  subscribe(reg) {
    this.regs.add(reg);
    return () => this.regs.delete(reg);
  }
  /** Dispatch in registration order over a copied list (unsubscribe-safe). */
  emit(change, onError) {
    for (const reg of [...this.regs]) {
      if (reg.paths && !change.changed.some((c) => pathMatches2(c, reg.paths))) {
        continue;
      }
      try {
        reg.listener(change);
      } catch (err) {
        onError(err);
      }
    }
  }
  clear() {
    this.regs.clear();
  }
};

// node_modules/@xynogen/pix-runtime/src/migrations.ts
import { existsSync as existsSync3, readFileSync as readFileSync3, renameSync as renameSync4 } from "node:fs";
import { join as join3 } from "node:path";
var LEGACY_PRETTY_COLOR_KEYS2 = ["theme", "syntaxTheme", "diffColors"];
var LEGACY_DIFF_COLOR_KEYS2 = [
  "bgAdd",
  "bgDel",
  "bgAddHighlight",
  "bgDelHighlight",
  "bgGutterAdd",
  "bgGutterDel",
  "fgAdd",
  "fgDel"
];
var OPTIMIZER_KEYS2 = ["caveman", "rtk", "ponytail"];
function detectVersion2(doc) {
  const v = doc.$version;
  return typeof v === "number" && Number.isFinite(v) ? v : "unversioned";
}
function migrate2(input, ctx) {
  const version = detectVersion2(input);
  if (typeof version === "number" && version > CONFIG_FORMAT_VERSION2) {
    ctx.diagnostic({
      code: "UNSUPPORTED_CONFIG_VERSION",
      severity: "error",
      message: `config $version ${version} is newer than supported ${CONFIG_FORMAT_VERSION2}`
    });
    return { document: input, changed: false };
  }
  const doc = structuredClone(input);
  let changed = false;
  if (isObj2(doc.pretty)) {
    const pretty = { ...doc.pretty };
    for (const key of LEGACY_PRETTY_COLOR_KEYS2) {
      if (key in pretty) {
        delete pretty[key];
        changed = true;
      }
    }
    if (isObj2(pretty.diff)) {
      const diff = { ...pretty.diff };
      for (const key of LEGACY_DIFF_COLOR_KEYS2) {
        if (key in diff) {
          delete diff[key];
          changed = true;
        }
      }
      pretty.diff = diff;
    }
    doc.pretty = pretty;
  }
  if (isObj2(doc.optimizer) && "toon" in doc.optimizer) {
    doc.optimizer = Object.fromEntries(
      Object.entries(doc.optimizer).filter(([key]) => key !== "toon")
    );
    changed = true;
  }
  if (doc.$version !== CONFIG_FORMAT_VERSION2) {
    doc.$version = CONFIG_FORMAT_VERSION2;
    changed = true;
  }
  return { document: doc, changed };
}
function importOptimizerSidecar2(doc, agentDir, ctx) {
  const sidecarPath = join3(agentDir, "optimizer.json");
  if (!existsSync3(sidecarPath)) return { changed: false };
  let raw;
  try {
    const parsed = JSON.parse(readFileSync3(sidecarPath, "utf-8"));
    if (!isObj2(parsed)) throw new Error("not an object");
    raw = parsed;
  } catch (err) {
    ctx.diagnostic({
      code: "MIGRATION_FAILED",
      severity: "warning",
      path: "optimizer.json",
      message: "malformed optimizer sidecar left untouched",
      cause: err
    });
    return { changed: false };
  }
  const existing = isObj2(doc.optimizer) ? { ...doc.optimizer } : {};
  let changed = false;
  for (const key of OPTIMIZER_KEYS2) {
    const value = raw[key];
    if (typeof value === "string" && !(key in existing)) {
      existing[key] = value;
      changed = true;
    }
  }
  if (changed) doc.optimizer = existing;
  const hasLegacyToon = typeof raw.toon === "string";
  const archive = () => {
    let target = `${sidecarPath}.migrated-v1`;
    if (existsSync3(target)) target = `${target}.${Date.now()}`;
    try {
      renameSync4(sidecarPath, target);
    } catch {
    }
  };
  return { changed: changed || hasLegacyToon, archive };
}

// node_modules/@xynogen/pix-runtime/src/persistence.ts
import {
  closeSync as closeSync2,
  existsSync as existsSync4,
  mkdirSync as mkdirSync3,
  openSync as openSync2,
  readFileSync as readFileSync4,
  renameSync as renameSync5,
  rmSync as rmSync3,
  statSync as statSync2,
  writeFileSync as writeFileSync3,
  writeSync as writeSync2
} from "node:fs";
import { dirname as dirname3, join as join4 } from "node:path";
var ConfigWriteError2 = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ConfigWriteError";
  }
  cause;
};
var ConfigLockError2 = class extends ConfigWriteError2 {
  constructor(message, cause) {
    super(message, cause);
    this.name = "ConfigLockError";
  }
};
var LOCK_STALE_MS2 = 3e4;
var LOCK_RETRY_MS2 = 25;
var LOCK_MAX_RETRIES2 = 200;
var FileStorage2 = class {
  path;
  lockPath;
  constructor(agentDir) {
    this.path = join4(agentDir, "pix.json");
    this.lockPath = `${this.path}.lock`;
  }
  ensureDir() {
    mkdirSync3(dirname3(this.path), { recursive: true });
  }
  readRaw() {
    try {
      if (!existsSync4(this.path)) return void 0;
      return readFileSync4(this.path, "utf-8");
    } catch (err) {
      throw new ConfigWriteError2(`read failed: ${this.path}`, err);
    }
  }
  acquireLock() {
    for (let i = 0; i < LOCK_MAX_RETRIES2; i++) {
      try {
        const fd = openSync2(this.lockPath, "wx", 384);
        writeSync2(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
        closeSync2(fd);
        return;
      } catch {
        try {
          const age = Date.now() - statSync2(this.lockPath).mtimeMs;
          if (age > LOCK_STALE_MS2) {
            rmSync3(this.lockPath, { force: true });
            continue;
          }
        } catch {
          continue;
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS2);
      }
    }
    throw new ConfigLockError2(`could not acquire ${this.lockPath}`);
  }
  releaseLock() {
    try {
      rmSync3(this.lockPath, { force: true });
    } catch {
    }
  }
  writeAtomic(contents) {
    this.ensureDir();
    this.acquireLock();
    const tmp = `${this.path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
      writeFileSync3(tmp, contents, { mode: 384 });
      renameSync5(tmp, this.path);
    } catch (err) {
      try {
        rmSync3(tmp, { force: true });
      } catch {
      }
      throw new ConfigWriteError2(`write failed: ${this.path}`, err);
    } finally {
      this.releaseLock();
    }
  }
};
var WriteQueue2 = class {
  tail = Promise.resolve();
  run(task) {
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => void 0,
      () => void 0
    );
    return next;
  }
};
function parseRawDocument2(text) {
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function serializeRawDocument2(doc) {
  return `${JSON.stringify(doc, null, 2)}
`;
}

// node_modules/@xynogen/pix-runtime/src/sections/collapse.ts
var DEFAULTS7 = {
  enabled: true,
  delaySec: 10,
  tools: {}
};
var collapseSection2 = defineSection2({
  key: "collapse",
  defaults: DEFAULTS7,
  parse(raw) {
    if (!isObj2(raw)) return { ...DEFAULTS7, tools: {} };
    const tools = {};
    if (isObj2(raw.tools)) {
      for (const [k, v] of Object.entries(raw.tools)) {
        if (typeof v === "boolean") tools[k] = v;
      }
    }
    return {
      enabled: boolOr2(raw.enabled, DEFAULTS7.enabled),
      delaySec: posNumOr2(raw.delaySec, DEFAULTS7.delaySec),
      tools
    };
  }
});

// node_modules/@xynogen/pix-runtime/src/sections/compaction.ts
var MINIMUM_TOKEN_FLOOR2 = 25e3;
var MINIMUM_TOKEN_DEFAULT2 = 1e5;
var DEFAULTS8 = {
  triggerPercent: 60,
  minimumTokens: MINIMUM_TOKEN_DEFAULT2
};
function pctOr2(v, fallback) {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}
function minimumTokensOr2(v, fallback) {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(MINIMUM_TOKEN_FLOOR2, Math.round(v));
}
function parseTokenString2(label) {
  const raw = label.trim();
  if (!raw) return void 0;
  const m = raw.match(/^([0-9]*\.?[0-9]+)\s*([km])?$/i);
  if (!m) return void 0;
  const numStr = m[1] ?? "";
  const n = Number.parseFloat(numStr);
  if (!Number.isFinite(n)) return void 0;
  const suf = (m[2] ?? "").toLowerCase();
  if (suf === "m") return Math.round(n * 1e6);
  if (suf === "k") return Math.round(n * 1e3);
  return Math.round(n);
}
var compactionSection2 = defineSection2({
  key: "compaction",
  defaults: DEFAULTS8,
  parse(raw) {
    if (!isObj2(raw)) return { ...DEFAULTS8 };
    const rawMin = raw.minimumTokens;
    const coercedMin = typeof rawMin === "string" ? parseTokenString2(rawMin) ?? Number.NaN : rawMin;
    return {
      triggerPercent: pctOr2(raw.triggerPercent, DEFAULTS8.triggerPercent),
      minimumTokens: minimumTokensOr2(coercedMin, DEFAULTS8.minimumTokens)
    };
  }
});

// node_modules/@xynogen/pix-runtime/src/sections/gate.ts
var SEVERITIES2 = ["risky", "dangerous", "critical"];
var DEFAULTS9 = {
  guardrails: "on",
  autoApprove: [],
  extraRules: []
};
function regexError2(pattern, flags) {
  try {
    new RegExp(pattern, flags);
    return void 0;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
var gateSection2 = defineSection2({
  key: "gate",
  defaults: DEFAULTS9,
  parse(raw, ctx) {
    if (!isObj2(raw)) return { guardrails: "on", autoApprove: [], extraRules: [] };
    const extraRules = [];
    if (Array.isArray(raw.extraRules)) {
      raw.extraRules.forEach((r, i) => {
        if (!isObj2(r) || typeof r.pattern !== "string") return;
        const flags = typeof r.flags === "string" ? r.flags : void 0;
        const err = regexError2(r.pattern, flags);
        if (err) {
          ctx.diagnostic({
            code: "INVALID_VALUE",
            severity: "warning",
            path: `gate.extraRules[${i}]`,
            message: `invalid regex: ${err}`
          });
          return;
        }
        const rule2 = { pattern: r.pattern };
        if (flags) rule2.flags = flags;
        if (typeof r.severity === "string" && SEVERITIES2.includes(r.severity)) {
          rule2.severity = r.severity;
        }
        if (typeof r.reason === "string") rule2.reason = r.reason;
        extraRules.push(rule2);
      });
    }
    return {
      guardrails: enumOr2(raw.guardrails, ["on", "off"], DEFAULTS9.guardrails),
      autoApprove: strArr2(raw.autoApprove),
      extraRules
    };
  }
});

// node_modules/@xynogen/pix-runtime/src/sections/io.ts
var DEFAULTS10 = {
  timeoutSec: 30
};
var ioSection2 = defineSection2({
  key: "io",
  defaults: DEFAULTS10,
  parse(raw) {
    if (!isObj2(raw)) return { ...DEFAULTS10 };
    return {
      timeoutSec: posNumOr2(raw.timeoutSec, DEFAULTS10.timeoutSec)
    };
  }
});

// node_modules/@xynogen/pix-runtime/src/sections/optimizer.ts
var CAVEMAN2 = ["off", "lite", "full", "ultra", "micro"];
var PONYTAIL2 = ["off", "lite", "full", "ultra"];
var TOGGLE2 = ["off", "on"];
var DEFAULTS11 = {
  caveman: "off",
  rtk: "on",
  ponytail: "off"
};
var optimizerSection2 = defineSection2({
  key: "optimizer",
  defaults: DEFAULTS11,
  parse(raw) {
    if (!isObj2(raw)) return { ...DEFAULTS11 };
    return {
      caveman: enumOr2(raw.caveman, CAVEMAN2, DEFAULTS11.caveman),
      rtk: enumOr2(raw.rtk, TOGGLE2, DEFAULTS11.rtk),
      ponytail: enumOr2(raw.ponytail, PONYTAIL2, DEFAULTS11.ponytail)
    };
  }
});

// node_modules/@xynogen/pix-runtime/src/sections/pretty.ts
var ICON_MODES3 = ["nerd", "unicode", "ascii"];
var LS_STYLES2 = ["grid", "tree"];
function renderSizeOr2(value, fallback) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : fallback;
  if (typeof value !== "string") return fallback;
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  if (!match) return fallback;
  const percent = Number(match[1]);
  return percent > 0 && percent <= 100 ? value : fallback;
}
var DEFAULTS12 = {
  icons: "nerd",
  lsStyle: "grid",
  maxRenderWidth: "65%",
  maxRenderHeight: "80%",
  maxPreviewLines: 80,
  maxRenderLines: 150,
  maxHighlightChars: 8e4,
  cacheLimit: 128,
  diff: { splitMinWidth: 150, splitMinCodeWidth: 60 }
};
var prettySection2 = defineSection2({
  key: "pretty",
  defaults: DEFAULTS12,
  parse(raw) {
    if (!isObj2(raw)) return { ...DEFAULTS12, diff: { ...DEFAULTS12.diff } };
    const rawDiff = isObj2(raw.diff) ? raw.diff : {};
    return {
      icons: enumOr2(raw.icons, ICON_MODES3, DEFAULTS12.icons),
      lsStyle: enumOr2(raw.lsStyle, LS_STYLES2, DEFAULTS12.lsStyle),
      maxRenderWidth: renderSizeOr2(raw.maxRenderWidth, DEFAULTS12.maxRenderWidth),
      maxRenderHeight: renderSizeOr2(raw.maxRenderHeight, DEFAULTS12.maxRenderHeight),
      maxPreviewLines: posNumOr2(raw.maxPreviewLines, DEFAULTS12.maxPreviewLines),
      maxRenderLines: posNumOr2(raw.maxRenderLines, DEFAULTS12.maxRenderLines),
      maxHighlightChars: posNumOr2(raw.maxHighlightChars, DEFAULTS12.maxHighlightChars),
      cacheLimit: posNumOr2(raw.cacheLimit, DEFAULTS12.cacheLimit),
      diff: {
        splitMinWidth: posNumOr2(rawDiff.splitMinWidth, DEFAULTS12.diff.splitMinWidth),
        splitMinCodeWidth: posNumOr2(rawDiff.splitMinCodeWidth, DEFAULTS12.diff.splitMinCodeWidth)
      }
    };
  }
});

// node_modules/@xynogen/pix-runtime/src/sections/index.ts
var builtinSections2 = [
  collapseSection2,
  prettySection2,
  ioSection2,
  optimizerSection2,
  gateSection2,
  compactionSection2
];

// node_modules/@xynogen/pix-runtime/src/registry.ts
var SectionRegistry2 = class {
  byKey = /* @__PURE__ */ new Map();
  constructor(handles = builtinSections2) {
    for (const handle of handles) this.add(handle);
  }
  add(handle) {
    if (this.byKey.has(handle.key)) {
      throw new Error(`pix-runtime: duplicate section key "${handle.key}"`);
    }
    this.byKey.set(handle.key, handle.__section);
  }
  get(key) {
    return this.byKey.get(key);
  }
  all() {
    return [...this.byKey.values()];
  }
  keys() {
    return [...this.byKey.keys()];
  }
};

// node_modules/@xynogen/pix-runtime/src/runtime.ts
var RuntimeImpl2 = class {
  storage;
  registry;
  queue = new WriteQueue2();
  bus = new EventBus2();
  sink = new DiagnosticSink2();
  revision = 0;
  current = null;
  agentDir;
  initPromise = null;
  readOnly = false;
  constructor(adapters = {}) {
    this.agentDir = adapters.agentDir ?? getAgentDir2();
    this.storage = adapters.storage ?? new FileStorage2(this.agentDir);
    this.registry = adapters.registry ?? new SectionRegistry2();
  }
  get path() {
    return this.storage.path;
  }
  get ready() {
    return this.current !== null;
  }
  parseContext() {
    return { diagnostic: (d) => this.sink.push(d) };
  }
  /** Resolve every section from a raw document into a values map. */
  resolve(doc) {
    const ctx = this.parseContext();
    const values = /* @__PURE__ */ new Map();
    for (const section of this.registry.all()) {
      values.set(section.key, section.parse(doc[section.key], ctx));
    }
    return values;
  }
  publish(values) {
    this.revision += 1;
    this.current = makeSnapshot2(this.revision, values);
    return this.current;
  }
  /** Synchronous lazy load — read-only, never migrates or writes. */
  lazyLoad() {
    if (this.current) return this.current;
    let doc = {};
    try {
      doc = parseRawDocument2(this.storage.readRaw());
    } catch (err) {
      this.sink.push({
        code: "READ_FAILED",
        severity: "warning",
        message: "config read failed; using defaults",
        cause: err
      });
    }
    return this.publish(this.resolve(doc));
  }
  snapshot() {
    return this.current ?? this.lazyLoad();
  }
  get(section) {
    return this.snapshot().get(section);
  }
  diagnostics() {
    return this.sink.all();
  }
  subscribe(listener, options = {}) {
    const unsub = this.bus.subscribe({ listener, paths: options.paths });
    if (options.immediate) {
      listener({
        revision: this.revision,
        origin: "init",
        changed: [],
        current: this.snapshot(),
        persisted: false
      });
    }
    return unsub;
  }
  /** Single-flight initialization: migrate, import sidecars, publish. */
  init(options = {}) {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.queue.run(async () => {
      const hadLazy = this.current !== null;
      const previous = this.current;
      this.storage.ensureDir();
      const doc = parseRawDocument2(this.storage.readRaw());
      const ctx = this.parseContext();
      const migrated = migrate2(doc, ctx);
      this.readOnly = migrated.document.$version !== CONFIG_FORMAT_VERSION2;
      let working = migrated.document;
      let needsWrite = migrated.changed;
      let archive;
      if (!this.readOnly) {
        const sidecar = importOptimizerSidecar2(working, this.agentDir, ctx);
        if (sidecar.changed) needsWrite = true;
        archive = sidecar.archive;
      }
      if (needsWrite && !this.readOnly) {
        try {
          this.persist(working);
          archive?.();
        } catch (err) {
          this.sink.push({
            code: "WRITE_FAILED",
            severity: "error",
            message: "initial migration write failed",
            cause: err
          });
        }
      } else if (this.readOnly) {
        working = doc;
      }
      const values = this.resolve(working);
      const snapshot2 = this.publish(values);
      if (previous) {
        const changed = this.changedPaths(previous, snapshot2);
        if (changed.length > 0) {
          this.dispatch({
            revision: this.revision,
            origin: hadLazy ? "migration" : options.origin ?? "init",
            source: options.source,
            changed,
            previous,
            current: snapshot2,
            persisted: needsWrite
          });
        }
      } else {
        this.dispatch({
          revision: this.revision,
          origin: options.origin ?? "init",
          source: options.source,
          changed: [],
          current: snapshot2,
          persisted: needsWrite
        });
      }
      return snapshot2;
    });
    return this.initPromise;
  }
  /** Serialize the current resolved values into a sparse raw document. */
  buildRawFromValues(values, base) {
    const doc = { ...base, $version: CONFIG_FORMAT_VERSION2 };
    for (const section of this.registry.all()) {
      const value = values.get(section.key);
      const serialized = section.serialize ? section.serialize(value, section.defaults) : this.defaultStrip(value, section.defaults);
      if (serialized === void 0) delete doc[section.key];
      else doc[section.key] = serialized;
    }
    return doc;
  }
  defaultStrip(value, defaults) {
    if (!isObj2(value) || !isObj2(defaults)) {
      return JSON.stringify(value) === JSON.stringify(defaults) ? void 0 : value;
    }
    const copy = { ...value };
    return stripDefaults2(copy, defaults) > 0 ? copy : void 0;
  }
  persist(doc) {
    this.storage.writeAtomic(serializeRawDocument2(doc));
  }
  changedPaths(prev, next) {
    const out = [];
    for (const section of this.registry.all()) {
      const handle = { key: section.key, defaults: section.defaults, __section: section };
      out.push(...diffPaths2(section.key, prev.get(handle), next.get(handle)));
    }
    return out;
  }
  dispatch(change) {
    this.bus.emit(
      change,
      (err) => this.sink.push({
        code: "LISTENER_FAILED",
        severity: "warning",
        message: "config listener threw",
        cause: err
      })
    );
  }
  update(section, updater, options = {}) {
    return this.queue.run(async () => this.commit(section, updater, options, "api"));
  }
  reset(section, paths, options = {}) {
    return this.queue.run(async () => {
      const updater = (current) => {
        if (!paths || paths.length === 0) return clone2(section.defaults);
        const next = clone2(current);
        const defs = section.defaults;
        for (const p of paths) {
          const key = p.startsWith(`${section.key}.`) ? p.slice(section.key.length + 1) : p;
          if (key in defs) next[key] = clone2(defs[key]);
        }
        return next;
      };
      return this.commit(section, updater, options, "api");
    });
  }
  /** Core transaction: read latest on-disk, apply update, persist, publish. */
  commit(section, updater, options, defaultOrigin) {
    if (this.readOnly) {
      this.sink.push({
        code: "UNSUPPORTED_CONFIG_VERSION",
        severity: "error",
        path: section.key,
        message: "config is read-only (newer $version)"
      });
      return void 0;
    }
    const previous = this.snapshot();
    const base = parseRawDocument2(this.storage.readRaw());
    const ctx = this.parseContext();
    const values = /* @__PURE__ */ new Map();
    for (const s of this.registry.all()) values.set(s.key, s.parse(base[s.key], ctx));
    const currentValue = values.has(section.key) ? values.get(section.key) : section.__section.parse(base[section.key], ctx);
    const mergedValue = typeof updater === "function" ? updater(currentValue) : deepMerge2(currentValue, updater);
    const nextValue = section.__section.parse(mergedValue, ctx);
    if (JSON.stringify(currentValue) === JSON.stringify(nextValue)) return void 0;
    values.set(section.key, nextValue);
    const doc = this.buildRawFromValues(values, base);
    try {
      this.persist(doc);
    } catch (err) {
      this.sink.push({
        code: "WRITE_FAILED",
        severity: "error",
        path: section.key,
        message: "config write failed; snapshot unchanged",
        cause: err
      });
      if (err instanceof ConfigWriteError2) return void 0;
      return void 0;
    }
    const snapshot2 = this.publish(values);
    const change = {
      revision: this.revision,
      origin: options.origin ?? defaultOrigin,
      source: options.source,
      changed: this.changedPaths(previous, snapshot2),
      previous,
      current: snapshot2,
      persisted: true
    };
    if (change.changed.length === 0) return void 0;
    this.dispatch(change);
    return change;
  }
  reload(options = {}) {
    return this.queue.run(async () => {
      const previous = this.snapshot();
      const doc = parseRawDocument2(this.storage.readRaw());
      const values = this.resolve(doc);
      const snapshot2 = this.publish(values);
      const changed = this.changedPaths(previous, snapshot2);
      if (changed.length === 0) return void 0;
      const change = {
        revision: this.revision,
        origin: options.origin ?? "reload",
        source: options.source,
        changed,
        previous,
        current: snapshot2,
        persisted: false
      };
      this.dispatch(change);
      return change;
    });
  }
  flush() {
    return this.queue.run(async () => void 0);
  }
  async shutdown() {
    await this.flush();
    this.bus.clear();
  }
};
var SINGLETON_KEY2 = /* @__PURE__ */ Symbol.for("@xynogen/pix-runtime");
function pixRuntime2() {
  const g = globalThis;
  if (!g[SINGLETON_KEY2]) g[SINGLETON_KEY2] = new RuntimeImpl2();
  return g[SINGLETON_KEY2];
}

// node_modules/@xynogen/pix-runtime/src/collapse.ts
function shouldCollapse(toolName) {
  const c = pixRuntime2().get(collapseSection2);
  const perTool = c.tools[toolName];
  if (typeof perTool === "boolean") return perTool;
  return c.enabled;
}
function collapseDelayMs() {
  return pixRuntime2().get(collapseSection2).delaySec * 1e3;
}
function tickCollapse(toolName, state, invalidate, expanded = false) {
  if (!shouldCollapse(toolName)) return false;
  if (!state.timer && !state.collapsed) {
    state.timer = setTimeout(() => {
      state.collapsed = true;
      invalidate();
    }, collapseDelayMs());
  }
  return state.collapsed === true && !expanded;
}

// node_modules/@xynogen/pix-runtime/src/herdr-notify.ts
import { spawn } from "node:child_process";

// node_modules/@xynogen/pix-runtime/src/herdr-state.ts
function coordinators() {
  const global = globalThis;
  global.__pixAgentState ??= /* @__PURE__ */ new WeakMap();
  return global.__pixAgentState;
}
function coordinator(events) {
  const registry = coordinators();
  let state = registry.get(events);
  if (!state) {
    state = {
      activities: /* @__PURE__ */ new Map(),
      blocks: /* @__PURE__ */ new Map(),
      unattendedMode: "off",
      yoloConsent: false
    };
    registry.set(events, state);
  }
  return state;
}
function snapshot(state) {
  const blocked = [...state.blocks.values()].at(-1);
  if (blocked) {
    return {
      state: "blocked",
      ...blocked.message ? { message: blocked.message } : {},
      activities: state.activities.size,
      blocks: state.blocks.size
    };
  }
  const active = [...state.activities.values()].at(-1);
  if (active) {
    return {
      state: "working",
      ...active.message ? { message: active.message } : {},
      activities: state.activities.size,
      blocks: 0
    };
  }
  return { state: "idle", activities: 0, blocks: 0 };
}
function publish(events) {
  events.emit("pix:agent-state", snapshot(coordinator(events)));
}
function begin(events, kind, source, message) {
  const state = coordinator(events);
  const token = Symbol(source);
  state[kind].set(token, { source, message });
  publish(events);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    state[kind].delete(token);
    publish(events);
  };
}
function beginAgentBlock(events, source, message) {
  return begin(events, "blocks", source, message);
}
async function withAgentBlock(events, source, message, prompt) {
  const release = beginAgentBlock(events, source, message);
  try {
    return await prompt();
  } finally {
    release();
  }
}
function getUnattendedMode(events) {
  return coordinator(events).unattendedMode;
}

// node_modules/@xynogen/pix-runtime/src/pix-command.ts
import {
  Key as Key2,
  matchesKey as matchesKey2,
  truncateToWidth as truncateToWidth4,
  visibleWidth as visibleWidth4,
  wrapTextWithAnsi as wrapTextWithAnsi3
} from "@earendil-works/pi-tui";

// node_modules/@xynogen/pix-runtime/src/icon-catalog.ts
var VS2 = "\uFE0E";
var CATALOG2 = {
  // ── footer / status segments ──────────────────────────────────────────
  model: { nerd: "\u{F06A9}", unicode: `\u25C8${VS2}`, ascii: "M" },
  lsp: { nerd: "\u{F0626}", unicode: `\u25C9${VS2}`, ascii: "LSP" },
  mcp: { nerd: "\u{F048D}", unicode: `\u25D0${VS2}`, ascii: "MCP" },
  cwd: { nerd: "\u{F024B}", unicode: `\u2302${VS2}`, ascii: "~" },
  folder: { nerd: "\u{F024B}", unicode: `\u2302${VS2}`, ascii: "/" },
  afk: { nerd: "\u{F0310}", unicode: `\u2328${VS2}`, ascii: "kbd" },
  // ── footer indicators (git status, score) ─────────────────────────────
  "git.unstaged": { nerd: "\u2717", unicode: "\u2717", ascii: "x" },
  "git.ahead": { nerd: "\u21E1", unicode: "\u21E1", ascii: "^" },
  "git.behind": { nerd: "\u21E3", unicode: "\u21E3", ascii: "v" },
  "net.in": { nerd: "\u21E1", unicode: "\u21E1", ascii: "in" },
  "net.out": { nerd: "\u21E3", unicode: "\u21E3", ascii: "out" },
  score: { nerd: "\u26A1", unicode: "\u26A1", ascii: "S" },
  // ── misc ──────────────────────────────────────────────────────────────
  ok: { nerd: "\u2713", unicode: "\u2713", ascii: "ok" },
  warn: { nerd: "\u26A0", unicode: "\u26A0", ascii: "!" },
  error: { nerd: "\u2717", unicode: "\u2717", ascii: "x" },
  // ── permission / security modal titles ────────────────────────────────
  // Semantic keys for the danger prompts (🔐 root, 🔑 secret). nerd = Nerd
  // Font glyph, unicode = a widely-shipped BMP symbol forced to text
  // presentation, ascii = tofu-free token.
  lock: { nerd: "\u{F0341}", unicode: `\u{1F512}${VS2}`, ascii: "[!]" },
  secret: { nerd: "\u{F0306}", unicode: `\u{1F511}${VS2}`, ascii: "[key]" },
  settings: { nerd: "\u{F0493}", unicode: `\u2699${VS2}`, ascii: "[*]" },
  update: { nerd: "\u{F01DA}", unicode: `\u2193${VS2}`, ascii: "[v]" },
  // ── shared status glyphs (checklists, panels, markers) ────────────────
  // nerd/unicode keep the historical literal so mixed-glyph rows stay
  // aligned; ascii mode swaps in tofu-free tokens. `⚡` (energetic
  // warning/killed/denied) intentionally stays a local literal — it is not
  // part of this set.
  "status.ok": { nerd: "\u2713", unicode: `\u2713${VS2}`, ascii: "ok" },
  "status.error": { nerd: "\u2717", unicode: `\u2717${VS2}`, ascii: "x" },
  // `⚠` is East-Asian wide (2 cells); consumers that place it in an aligned
  // marker column must normalize width via `padIcon` (pix-pretty/utils).
  "status.warn": { nerd: "\u26A0", unicode: `\u26A0${VS2}`, ascii: "!" },
  "status.pending": { nerd: "\u25CB", unicode: `\u25CB${VS2}`, ascii: "o" },
  "status.running": { nerd: "\u25D0", unicode: `\u25D0${VS2}`, ascii: "*" },
  "status.active": { nerd: "\u25CF", unicode: `\u25CF${VS2}`, ascii: "*" },
  "status.done": { nerd: "\u25CF", unicode: `\u25CF${VS2}`, ascii: "x" },
  "status.blocked": { nerd: "\u2298", unicode: `\u2298${VS2}`, ascii: "!" },
  // ── welcome banner ────────────────────────────────────────────────────
  ready: { nerd: "\u{F0633}", unicode: `\u2713${VS2}`, ascii: "ok" },
  // ── paste chips (pix-display) ─────────────────────────────────────────
  "paste.image": { nerd: "\u{F02E9}", unicode: `\u25A3${VS2}`, ascii: "img" },
  "paste.text": { nerd: "\u{F027F}", unicode: `\u25A4${VS2}`, ascii: "txt" },
  // ── model picker (pix-models) ─────────────────────────────────────────
  "picker.model": { nerd: "\u{F0229}", unicode: `\u25C8${VS2}`, ascii: "M" },
  // ── optimizer suite (pix-optimizer) ───────────────────────────────────
  "opt.caveman": { nerd: "\u{F0710}", unicode: `\u2664${VS2}`, ascii: "Cv" },
  "opt.rtk": { nerd: "\u{F04E5}", unicode: `\u2661${VS2}`, ascii: "Rk" },
  "opt.toon": { nerd: "\u{F05C0}", unicode: `\u2662${VS2}`, ascii: "Tn" },
  "opt.ponytail": { nerd: "\u{F0190}", unicode: `\u2667${VS2}`, ascii: "Pt" },
  "opt.title": { nerd: "\u{F0DAB}", unicode: `\u25C8${VS2}`, ascii: "*" },
  // ── subagent widget (pix-subagent) ────────────────────────────────────
  agent: { nerd: "\u{F0BA0}", unicode: `\u2699${VS2}`, ascii: "@" },
  turns: { nerd: "\u{F006A}", unicode: `\u21BB${VS2}`, ascii: "~" },
  tools: { nerd: "\u{F1064}", unicode: `\u2692${VS2}`, ascii: "T" },
  tokens: { nerd: "\u{F027F}", unicode: `\u25A4${VS2}`, ascii: "tk" }
};
var ICON_KEYS2 = Object.keys(CATALOG2);
function envMode2() {
  const raw = (process.env.PRETTY_ICONS ?? "").toLowerCase();
  if (raw === "nerd" || raw === "unicode" || raw === "ascii") return raw;
  if (raw === "none" || raw === "off") return "ascii";
  return "nerd";
}
var activeMode2 = envMode2();

// node_modules/@xynogen/pix-runtime/src/pix-command.ts
function row(r) {
  return r;
}
function formatTokens(tokens) {
  return tokens % 1e6 === 0 ? `${tokens / 1e6}M` : `${tokens / 1e3}k`;
}
function parseRenderSize(value) {
  return value.endsWith("%") ? value : Number.parseFloat(value);
}
function parseTokens(label) {
  const raw = label.trim();
  const m = raw.match(/^([0-9]*\.?[0-9]+)\s*([km])?$/i);
  if (!m) return Number.NaN;
  const numStr = m[1] ?? "";
  const n = Number.parseFloat(numStr);
  if (!Number.isFinite(n)) return Number.NaN;
  const suf = (m[2] ?? "").toLowerCase();
  return suf === "m" ? Math.round(n * 1e6) : Math.round(n * 1e3);
}
var SETTINGS = [
  row({
    section: "Pretty",
    label: "icons",
    handle: prettySection2,
    values: ["nerd", "unicode", "ascii"],
    read: (v) => v.icons,
    patch: (value) => ({ icons: value })
  }),
  row({
    section: "Pretty",
    label: "ls style",
    handle: prettySection2,
    values: ["grid", "tree"],
    read: (v) => v.lsStyle,
    patch: (value) => ({ lsStyle: value })
  }),
  row({
    section: "Pretty",
    label: "max modal width",
    handle: prettySection2,
    values: [
      "50%",
      "55%",
      "60%",
      "65%",
      "70%",
      "75%",
      "80%",
      "85%",
      "90%",
      "95%",
      "100%",
      "72 cols",
      "80 cols",
      "88 cols",
      "96 cols",
      "104 cols",
      "120 cols"
    ],
    read: (v) => typeof v.maxRenderWidth === "number" ? `${v.maxRenderWidth} cols` : v.maxRenderWidth,
    patch: (value) => ({ maxRenderWidth: parseRenderSize(value) })
  }),
  row({
    section: "Pretty",
    label: "max modal height",
    handle: prettySection2,
    values: [
      "50%",
      "55%",
      "60%",
      "65%",
      "70%",
      "75%",
      "80%",
      "85%",
      "90%",
      "95%",
      "100%",
      "12 rows",
      "16 rows",
      "20 rows",
      "24 rows"
    ],
    read: (v) => typeof v.maxRenderHeight === "number" ? `${v.maxRenderHeight} rows` : v.maxRenderHeight,
    patch: (value) => ({ maxRenderHeight: parseRenderSize(value) })
  }),
  row({
    section: "Collapse",
    label: "enabled",
    handle: collapseSection2,
    values: ["true", "false"],
    read: (v) => String(v.enabled),
    patch: (value) => ({ enabled: value === "true" })
  }),
  row({
    section: "Collapse",
    label: "delay (sec)",
    handle: collapseSection2,
    values: ["5", "10", "15", "20", "30", "60"],
    read: (v) => String(v.delaySec),
    patch: (value) => ({ delaySec: Number(value) })
  }),
  row({
    section: "Network",
    label: "timeout (sec)",
    handle: ioSection2,
    values: ["30", "10", "60", "120", "300"],
    read: (v) => String(v.timeoutSec),
    patch: (value) => ({ timeoutSec: Number(value) })
  }),
  row({
    section: "Compaction",
    label: "Trigger (% ctx)",
    handle: compactionSection2,
    // 0–100 in 5% steps.
    values: Array.from({ length: 21 }, (_, i) => String(i * 5)),
    read: (v) => String(v.triggerPercent),
    patch: (value) => ({ triggerPercent: Number(value) })
  }),
  row({
    section: "Compaction",
    label: "Minimum tokens",
    handle: compactionSection2,
    values: ["25k", "50k", "100k", "150k", "200k", "300k", "400k", "600k", "800k", "1M"],
    read: (v) => formatTokens(v.minimumTokens),
    patch: (value) => ({ minimumTokens: parseTokens(value) })
  }),
  row({
    section: "Gate",
    label: "Guardrails",
    handle: gateSection2,
    values: ["on", "off"],
    read: (v) => v.guardrails,
    patch: (guardrails) => ({ guardrails })
  })
];

// node_modules/typebox/build/system/memory/memory.mjs
var memory_exports = {};
__export(memory_exports, {
  Assign: () => Assign,
  Clone: () => Clone,
  Create: () => Create,
  Discard: () => Discard,
  Metrics: () => Metrics,
  Update: () => Update
});

// node_modules/typebox/build/system/memory/metrics.mjs
var Metrics = {
  assign: 0,
  create: 0,
  clone: 0,
  discard: 0,
  update: 0
};

// node_modules/typebox/build/system/settings/settings.mjs
var settings_exports = {};
__export(settings_exports, {
  Get: () => Get,
  Reset: () => Reset,
  Set: () => Set2
});

// node_modules/typebox/build/guard/guard.mjs
var guard_exports = {};
__export(guard_exports, {
  CodePointCount: () => CodePointCount2,
  Counted: () => Counted,
  Entries: () => Entries,
  EntriesRegExp: () => EntriesRegExp,
  Every: () => Every,
  EveryAll: () => EveryAll,
  GraphemeCount: () => GraphemeCount2,
  HasPropertyKey: () => HasPropertyKey,
  IsArray: () => IsArray,
  IsBigInt: () => IsBigInt,
  IsBoolean: () => IsBoolean,
  IsClassInstance: () => IsClassInstance,
  IsConstructor: () => IsConstructor,
  IsDeepEqual: () => IsDeepEqual,
  IsEqual: () => IsEqual,
  IsFunction: () => IsFunction,
  IsGreaterEqualThan: () => IsGreaterEqualThan,
  IsGreaterThan: () => IsGreaterThan,
  IsInteger: () => IsInteger,
  IsLessEqualThan: () => IsLessEqualThan,
  IsLessThan: () => IsLessThan,
  IsMaxLength: () => IsMaxLength2,
  IsMinLength: () => IsMinLength2,
  IsMultipleOf: () => IsMultipleOf,
  IsNull: () => IsNull,
  IsNumber: () => IsNumber,
  IsObject: () => IsObject,
  IsObjectNotArray: () => IsObjectNotArray,
  IsString: () => IsString,
  IsSymbol: () => IsSymbol,
  IsUndefined: () => IsUndefined,
  IsUnsafePropertyKey: () => IsUnsafePropertyKey,
  IsValueLike: () => IsValueLike,
  Keys: () => Keys,
  ShiftLeft: () => ShiftLeft,
  Some: () => Some,
  SomeAll: () => SomeAll,
  Symbols: () => Symbols,
  Values: () => Values
});

// node_modules/typebox/build/guard/unicode/unicode_segment.mjs
function IsBetween(value, min, max) {
  return value >= min && value <= max;
}
function IsZeroWidthJoiner(value) {
  return value === 8205;
}
function IsRegionalIndicator(value) {
  return IsBetween(value, 127462, 127487);
}
function IsVariationSelector(value) {
  return IsBetween(value, 65024, 65039);
}
function IsCombiningMark(value) {
  return IsBetween(value, 768, 879) || IsBetween(value, 6832, 6911) || IsBetween(value, 7616, 7679) || IsBetween(value, 65056, 65071);
}
function CodePointLength(value) {
  return value > 65535 ? 2 : 1;
}
function ConsumeModifiers(value, index) {
  while (index < value.length) {
    const point = value.codePointAt(index);
    if (IsCombiningMark(point) || IsVariationSelector(point)) {
      index += CodePointLength(point);
    } else {
      break;
    }
  }
  return index;
}
function NextGraphemeClusterIndex(value, clusterStart) {
  const startCP = value.codePointAt(clusterStart);
  let clusterEnd = clusterStart + CodePointLength(startCP);
  clusterEnd = ConsumeModifiers(value, clusterEnd);
  while (clusterEnd < value.length - 1 && IsZeroWidthJoiner(value.codePointAt(clusterEnd))) {
    const nextCP = value.codePointAt(clusterEnd + 1);
    clusterEnd += 1 + CodePointLength(nextCP);
    clusterEnd = ConsumeModifiers(value, clusterEnd);
  }
  if (IsRegionalIndicator(startCP) && clusterEnd < value.length && IsRegionalIndicator(value.codePointAt(clusterEnd))) {
    clusterEnd += CodePointLength(value.codePointAt(clusterEnd));
  }
  return clusterEnd;
}
function GraphemeCount(value) {
  let count = 0, index = 0;
  while (index < value.length) {
    index = NextGraphemeClusterIndex(value, index);
    count++;
  }
  return count;
}

// node_modules/typebox/build/guard/unicode/unicode.mjs
function CodePointCount(value) {
  let result = 0, index = 0, prev = 0;
  while (index < value.length) {
    const next = value.charCodeAt(index++) >> 10;
    result += +((prev << 8 | next) !== 13879);
    prev = next;
  }
  return result;
}
function IsMaxLength(value, maxLength) {
  return value.length <= maxLength || value.length <= maxLength << 1 && CodePointCount(value) <= maxLength;
}
function IsMinLength(value, minLength) {
  return value.length >= minLength << 1 || value.length >= minLength && CodePointCount(value) >= minLength;
}

// node_modules/typebox/build/guard/guard.mjs
function IsArray(value) {
  return Array.isArray(value);
}
function IsBigInt(value) {
  return IsEqual(typeof value, "bigint");
}
function IsBoolean(value) {
  return IsEqual(typeof value, "boolean");
}
function IsConstructor(value) {
  if (IsUndefined(value) || !IsFunction(value))
    return false;
  const result = Function.prototype.toString.call(value);
  if (/^class\s/.test(result))
    return true;
  if (/\[native code\]/.test(result))
    return true;
  return false;
}
function IsFunction(value) {
  return IsEqual(typeof value, "function");
}
function IsInteger(value) {
  return Number.isInteger(value);
}
function IsNull(value) {
  return IsEqual(value, null);
}
function IsNumber(value) {
  return Number.isFinite(value);
}
function IsObjectNotArray(value) {
  return IsObject(value) && !IsArray(value);
}
function IsObject(value) {
  return IsEqual(typeof value, "object") && !IsNull(value);
}
function IsString(value) {
  return IsEqual(typeof value, "string");
}
function IsSymbol(value) {
  return IsEqual(typeof value, "symbol");
}
function IsUndefined(value) {
  return IsEqual(value, void 0);
}
function IsEqual(left, right) {
  return left === right;
}
function IsGreaterThan(left, right) {
  return left > right;
}
function IsLessThan(left, right) {
  return left < right;
}
function IsLessEqualThan(left, right) {
  return left <= right;
}
function IsGreaterEqualThan(left, right) {
  return left >= right;
}
function IsMultipleOf(dividend, divisor) {
  if (IsBigInt(dividend) || IsBigInt(divisor)) {
    return BigInt(dividend) % BigInt(divisor) === 0n;
  }
  const tolerance = 1e-10;
  if (!IsNumber(dividend))
    return true;
  if (IsInteger(dividend) && 1 / divisor % 1 === 0)
    return true;
  const mod = dividend % divisor;
  return Math.min(Math.abs(mod), Math.abs(mod - divisor), Math.abs(mod + divisor)) < tolerance;
}
function IsClassInstance(value) {
  if (!IsObject(value))
    return false;
  const proto = globalThis.Object.getPrototypeOf(value);
  if (IsNull(proto))
    return false;
  return IsEqual(typeof proto.constructor, "function") && !(IsEqual(proto.constructor, globalThis.Object) || IsEqual(proto.constructor.name, "Object"));
}
function IsValueLike(value) {
  return IsBigInt(value) || IsBoolean(value) || IsNull(value) || IsNumber(value) || IsString(value) || IsUndefined(value);
}
function GraphemeCount2(value) {
  return GraphemeCount(value);
}
function CodePointCount2(value) {
  return CodePointCount(value);
}
function IsMaxLength2(value, maxLength) {
  return IsMaxLength(value, maxLength);
}
function IsMinLength2(value, minLength) {
  return IsMinLength(value, minLength);
}
function Every(value, offset, callback) {
  return value.every((item, index) => index < offset || callback(item, index));
}
function EveryAll(value, offset, callback) {
  let result = true;
  value.forEach((item, index) => {
    if (index >= offset && !callback(item, index))
      result = false;
  });
  return result;
}
function Some(value, callback) {
  return value.some((value2, index) => callback(value2, index));
}
function SomeAll(value, callback) {
  let result = false;
  value.forEach((item, index) => {
    if (callback(item, index))
      result = true;
  });
  return result;
}
function Counted(value, callback) {
  return value.reduce((result, value2, index) => callback(value2, index) ? ++result : result, 0);
}
function ShiftLeft(array, true_, false_) {
  return IsEqual(array.length, 0) ? false_() : true_(array[0], array.slice(1));
}
function IsUnsafePropertyKey(key) {
  return IsEqual(key, "__proto__") || IsEqual(key, "constructor") || IsEqual(key, "prototype");
}
function HasPropertyKey(value, key) {
  return IsUnsafePropertyKey(key) ? Object.prototype.hasOwnProperty.call(value, key) : key in value;
}
function EntriesRegExp(value) {
  return Keys(value).map((key) => [new RegExp(`^${key}$`), value[key]]);
}
function Entries(value) {
  return Object.entries(value);
}
function Keys(value) {
  return Object.getOwnPropertyNames(value);
}
function Symbols(value) {
  return Object.getOwnPropertySymbols(value);
}
function Values(value) {
  return Object.values(value);
}
function DeepEqualObject(left, right) {
  if (!IsObject(right))
    return false;
  const keys = Keys(left);
  return IsEqual(keys.length, Keys(right).length) && keys.every((key) => IsDeepEqual(left[key], right[key]));
}
function DeepEqualArray(left, right) {
  return IsArray(right) && IsEqual(left.length, right.length) && left.every((_, index) => IsDeepEqual(left[index], right[index]));
}
function IsDeepEqual(left, right) {
  return IsArray(left) ? DeepEqualArray(left, right) : IsObject(left) ? DeepEqualObject(left, right) : IsEqual(left, right);
}

// node_modules/typebox/build/guard/globals.mjs
var globals_exports = {};
__export(globals_exports, {
  IsBigInt64Array: () => IsBigInt64Array,
  IsBigUint64Array: () => IsBigUint64Array,
  IsBoolean: () => IsBoolean2,
  IsDate: () => IsDate,
  IsFloat32Array: () => IsFloat32Array,
  IsFloat64Array: () => IsFloat64Array,
  IsInt16Array: () => IsInt16Array,
  IsInt32Array: () => IsInt32Array,
  IsInt8Array: () => IsInt8Array,
  IsMap: () => IsMap,
  IsNumber: () => IsNumber2,
  IsRegExp: () => IsRegExp,
  IsSet: () => IsSet,
  IsString: () => IsString2,
  IsTypeArray: () => IsTypeArray,
  IsUint16Array: () => IsUint16Array,
  IsUint32Array: () => IsUint32Array,
  IsUint8Array: () => IsUint8Array,
  IsUint8ClampedArray: () => IsUint8ClampedArray
});
function IsBoolean2(value) {
  return value instanceof Boolean;
}
function IsNumber2(value) {
  return value instanceof Number;
}
function IsString2(value) {
  return value instanceof String;
}
function IsTypeArray(value) {
  return globalThis.ArrayBuffer.isView(value);
}
function IsInt8Array(value) {
  return value instanceof globalThis.Int8Array;
}
function IsUint8Array(value) {
  return value instanceof globalThis.Uint8Array;
}
function IsUint8ClampedArray(value) {
  return value instanceof globalThis.Uint8ClampedArray;
}
function IsInt16Array(value) {
  return value instanceof globalThis.Int16Array;
}
function IsUint16Array(value) {
  return value instanceof globalThis.Uint16Array;
}
function IsInt32Array(value) {
  return value instanceof globalThis.Int32Array;
}
function IsUint32Array(value) {
  return value instanceof globalThis.Uint32Array;
}
function IsFloat32Array(value) {
  return value instanceof globalThis.Float32Array;
}
function IsFloat64Array(value) {
  return value instanceof globalThis.Float64Array;
}
function IsBigInt64Array(value) {
  return value instanceof globalThis.BigInt64Array;
}
function IsBigUint64Array(value) {
  return value instanceof globalThis.BigUint64Array;
}
function IsRegExp(value) {
  return value instanceof globalThis.RegExp;
}
function IsDate(value) {
  return value instanceof globalThis.Date;
}
function IsSet(value) {
  return value instanceof globalThis.Set;
}
function IsMap(value) {
  return value instanceof globalThis.Map;
}

// node_modules/typebox/build/system/settings/settings.mjs
var settings = {
  immutableTypes: false,
  maxErrors: 8,
  maxParseErrors: 1,
  maxInstantiationCount: 128,
  useAcceleration: true,
  exactOptionalPropertyTypes: false,
  enumerableKind: false,
  correctiveParse: false,
  unionPrioritySort: true
};
function Reset() {
  settings.immutableTypes = false;
  settings.maxErrors = 8;
  settings.maxParseErrors = 1;
  settings.maxInstantiationCount = 128;
  settings.useAcceleration = true;
  settings.exactOptionalPropertyTypes = false;
  settings.enumerableKind = false;
  settings.correctiveParse = false;
  settings.unionPrioritySort = true;
}
function Set2(options) {
  for (const key of guard_exports.Keys(options)) {
    const value = options[key];
    if (value !== void 0) {
      Object.defineProperty(settings, key, { value });
    }
  }
}
function Get() {
  return settings;
}

// node_modules/typebox/build/system/memory/freeze.mjs
function Freeze(value) {
  return settings_exports.Get().immutableTypes ? Object.freeze(value) : value;
}

// node_modules/typebox/build/system/memory/assign.mjs
function Assign(left, right) {
  Metrics.assign += 1;
  return Freeze({ ...left, ...right });
}

// node_modules/typebox/build/system/memory/clone.mjs
function FromClassInstance(value) {
  return value;
}
function IsSchemaObject(value) {
  return guard_exports.HasPropertyKey(value, "~kind") || guard_exports.HasPropertyKey(value, "~unsafe");
}
function FromSchemaObject(value) {
  const result = {};
  for (const key of guard_exports.Keys(value)) {
    if (guard_exports.IsUnsafePropertyKey(key))
      continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    descriptor.value = FromValue(descriptor.value);
    if (guard_exports.IsEqual(descriptor.enumerable, true)) {
      result[key] = descriptor.value;
    } else {
      Object.defineProperty(result, key, descriptor);
    }
  }
  return result;
}
function FromPlainObject(value) {
  const result = {};
  for (const key of guard_exports.Keys(value)) {
    if (guard_exports.IsUnsafePropertyKey(key))
      continue;
    result[key] = FromValue(value[key]);
  }
  for (const key of guard_exports.Symbols(value)) {
    result[key] = FromValue(value[key]);
  }
  return result;
}
function FromObject(value) {
  return guard_exports.IsClassInstance(value) ? FromClassInstance(value) : IsSchemaObject(value) ? FromSchemaObject(value) : FromPlainObject(value);
}
function FromArray(value) {
  return value.map((element) => FromValue(element));
}
function FromTypedArray(value) {
  return value.slice();
}
function FromRegExp(value) {
  return new RegExp(value.source, value.flags);
}
function FromMap(value) {
  return new Map(FromValue([...value.entries()]));
}
function FromSet(value) {
  return new Set(FromValue([...value.values()]));
}
function FromValue(value) {
  return globals_exports.IsTypeArray(value) ? FromTypedArray(value) : globals_exports.IsRegExp(value) ? FromRegExp(value) : globals_exports.IsMap(value) ? FromMap(value) : globals_exports.IsSet(value) ? FromSet(value) : guard_exports.IsArray(value) ? FromArray(value) : guard_exports.IsObject(value) ? FromObject(value) : value;
}
function Clone(value) {
  Metrics.clone += 1;
  return FromValue(value);
}

// node_modules/typebox/build/system/memory/create.mjs
function MergeHidden(left, right) {
  for (const key of Object.keys(right)) {
    Object.defineProperty(left, key, {
      configurable: true,
      writable: true,
      enumerable: false,
      value: right[key]
    });
  }
  return left;
}
function Merge(left, right) {
  return { ...left, ...right };
}
function Create(hidden, enumerable, options = {}) {
  Metrics.create += 1;
  const withOptions = Merge(enumerable, options);
  const withHidden = settings_exports.Get().enumerableKind ? Merge(withOptions, hidden) : MergeHidden(withOptions, hidden);
  return Freeze(withHidden);
}

// node_modules/typebox/build/system/memory/discard.mjs
function Discard(value, propertyKeys) {
  Metrics.discard += 1;
  const result = {};
  for (const key of guard_exports.Keys(value)) {
    if (propertyKeys.includes(key))
      continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    descriptor.value = Clone(descriptor.value);
    Object.defineProperty(result, key, descriptor);
  }
  return Freeze(result);
}

// node_modules/typebox/build/system/memory/update.mjs
function Update(current, hidden, enumerable) {
  Metrics.update += 1;
  const settings2 = settings_exports.Get();
  const result = Clone(current);
  for (const key of Object.keys(hidden)) {
    Object.defineProperty(result, key, {
      configurable: true,
      writable: true,
      enumerable: settings2.enumerableKind,
      value: hidden[key]
    });
  }
  for (const key of Object.keys(enumerable)) {
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: enumerable[key]
    });
  }
  return Freeze(result);
}

// node_modules/typebox/build/type/types/schema.mjs
function IsKind(value, kind) {
  return guard_exports.IsObject(value) && guard_exports.HasPropertyKey(value, "~kind") && guard_exports.IsEqual(value["~kind"], kind);
}
function IsSchema(value) {
  return guard_exports.IsObject(value);
}

// node_modules/typebox/build/type/types/deferred.mjs
function Deferred(action, parameters, options) {
  return memory_exports.Create({ "~kind": "Deferred" }, { type: "deferred", action, parameters, options }, {});
}
function IsDeferred(value) {
  return IsKind(value, "Deferred");
}

// node_modules/typebox/build/type/engine/readonly/instantiate_add.mjs
function AddReadonlyOperation(type) {
  return memory_exports.Update(type, { "~readonly": true }, {});
}
function AddReadonlyAction(type, options) {
  const result = memory_exports.Update(AddReadonlyOperation(type), {}, options);
  return result;
}
function AddReadonlyInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return AddReadonlyAction(instantiatedType, options);
}

// node_modules/typebox/build/type/engine/optional/instantiate_add.mjs
function AddOptionalOperation(type) {
  return memory_exports.Update(type, { "~optional": true }, {});
}
function AddOptionalAction(type, options) {
  const result = memory_exports.Update(AddOptionalOperation(type), {}, options);
  return result;
}
function AddOptionalInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return AddOptionalAction(instantiatedType, options);
}

// node_modules/typebox/build/type/types/array.mjs
function _Array_(items, options) {
  return memory_exports.Create({ "~kind": "Array" }, { type: "array", items }, options);
}
function IsArray2(value) {
  return IsKind(value, "Array");
}
function ArrayOptions(type) {
  return memory_exports.Discard(type, ["~kind", "type", "items"]);
}

// node_modules/typebox/build/type/types/constructor.mjs
function Constructor(parameters, instanceType, options = {}) {
  return memory_exports.Create({ "~kind": "Constructor" }, { type: "constructor", parameters, instanceType }, options);
}
function IsConstructor2(value) {
  return IsKind(value, "Constructor");
}
function ConstructorOptions(type) {
  return memory_exports.Discard(type, ["~kind", "type", "parameters", "instanceType"]);
}

// node_modules/typebox/build/type/types/function.mjs
function _Function_(parameters, returnType, options = {}) {
  return memory_exports.Create({ ["~kind"]: "Function" }, { type: "function", parameters, returnType }, options);
}
function IsFunction2(value) {
  return IsKind(value, "Function");
}
function FunctionOptions(type) {
  return memory_exports.Discard(type, ["~kind", "type", "parameters", "returnType"]);
}

// node_modules/typebox/build/type/types/ref.mjs
function Ref(ref, options) {
  return memory_exports.Create({ ["~kind"]: "Ref" }, { $ref: ref }, options);
}
function IsRef(value) {
  return IsKind(value, "Ref");
}

// node_modules/typebox/build/type/types/generic.mjs
function Generic(parameters, expression) {
  return memory_exports.Create({ "~kind": "Generic" }, { type: "generic", parameters, expression });
}
function IsGeneric(value) {
  return IsKind(value, "Generic");
}

// node_modules/typebox/build/type/types/any.mjs
function Any(options) {
  return memory_exports.Create({ ["~kind"]: "Any" }, {}, options);
}
function IsAny(value) {
  return IsKind(value, "Any");
}

// node_modules/typebox/build/type/types/never.mjs
var NeverPattern = "(?!)";
function Never(options) {
  return memory_exports.Create({ "~kind": "Never" }, { not: {} }, options);
}
function IsNever(value) {
  return IsKind(value, "Never");
}

// node_modules/typebox/build/type/action/_add_optional.mjs
function AddOptionalDeferred(type, options = {}) {
  return Deferred("AddOptional", [type], options);
}
function AddOptional(type, options = {}) {
  return AddOptionalAction(type, options);
}

// node_modules/typebox/build/type/types/_optional.mjs
function Optional(type) {
  return AddOptional(type);
}
function IsOptional(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "~optional");
}

// node_modules/typebox/build/type/types/properties.mjs
function RequiredArray(properties) {
  return guard_exports.Keys(properties).filter((key) => !IsOptional(properties[key]));
}
function PropertyKeys(properties) {
  return guard_exports.Keys(properties);
}
function PropertyValues(properties) {
  return guard_exports.Values(properties);
}

// node_modules/typebox/build/type/types/object.mjs
function _Object_(properties, options = {}) {
  const requiredKeys = RequiredArray(properties);
  const required = requiredKeys.length > 0 ? { required: requiredKeys } : {};
  return memory_exports.Create({ "~kind": "Object" }, { type: "object", ...required, properties }, options);
}
function IsObject2(value) {
  return IsKind(value, "Object");
}
function ObjectOptions(type) {
  return memory_exports.Discard(type, ["~kind", "type", "properties", "required"]);
}

// node_modules/typebox/build/type/types/unknown.mjs
function Unknown(options) {
  return memory_exports.Create({ ["~kind"]: "Unknown" }, {}, options);
}
function IsUnknown(value) {
  return IsKind(value, "Unknown");
}

// node_modules/typebox/build/type/types/cyclic.mjs
function Cyclic($defs, $ref, options) {
  const defs = guard_exports.Keys($defs).reduce((result, key) => {
    return { ...result, [key]: memory_exports.Update($defs[key], {}, { $id: key }) };
  }, {});
  return memory_exports.Create({ ["~kind"]: "Cyclic" }, { $defs: defs, $ref }, options);
}
function IsCyclic(value) {
  return IsKind(value, "Cyclic");
}

// node_modules/typebox/build/type/types/unsafe.mjs
function Unsafe(schema) {
  return memory_exports.Update(schema, { ["~unsafe"]: null }, {});
}
function IsUnsafe(value) {
  return guard_exports.IsObjectNotArray(value) && guard_exports.HasPropertyKey(value, "~unsafe") && guard_exports.IsNull(value["~unsafe"]);
}

// node_modules/typebox/build/system/arguments/arguments.mjs
var arguments_exports = {};
__export(arguments_exports, {
  Match: () => Match
});
function Match(args, match) {
  return match[args.length]?.(...args) ?? (() => {
    throw Error("Invalid Arguments");
  })();
}

// node_modules/typebox/build/type/types/infer.mjs
function Infer(...args) {
  const [name, extends_] = arguments_exports.Match(args, {
    2: (name2, extends_2) => [name2, extends_2, extends_2],
    1: (name2) => [name2, Unknown(), Unknown()]
  });
  return memory_exports.Create({ ["~kind"]: "Infer" }, { type: "infer", name, extends: extends_ }, {});
}
function IsInfer(value) {
  return IsKind(value, "Infer");
}

// node_modules/typebox/build/type/types/dependent.mjs
function Dependent(if_, then_, else_, options = {}) {
  return memory_exports.Create({ "~kind": "Dependent" }, { if: if_, then: then_, else: else_ }, options);
}
function IsDependent(value) {
  return IsKind(value, "Dependent");
}
function DependentOptions(type) {
  return memory_exports.Discard(type, ["~kind", "if", "then", "else"]);
}

// node_modules/typebox/build/type/engine/enum/typescript_enum_to_enum_values.mjs
function IsTypeScriptEnumLike(value) {
  return guard_exports.IsObjectNotArray(value);
}
function TypeScriptEnumToEnumValues(type) {
  const keys = guard_exports.Keys(type).filter((key) => isNaN(key));
  return keys.reduce((result, key) => [...result, type[key]], []);
}

// node_modules/typebox/build/type/types/enum.mjs
function IsEnumValue(value) {
  return guard_exports.IsString(value) || guard_exports.IsNumber(value);
}
function Enum(value, options) {
  const values = IsTypeScriptEnumLike(value) ? TypeScriptEnumToEnumValues(value) : value;
  return memory_exports.Create({ "~kind": "Enum" }, { enum: values }, options);
}
function IsEnum(value) {
  return IsKind(value, "Enum");
}

// node_modules/typebox/build/type/types/intersect.mjs
function Intersect(types, options = {}) {
  return memory_exports.Create({ "~kind": "Intersect" }, { allOf: types }, options);
}
function IsIntersect(value) {
  return IsKind(value, "Intersect");
}
function IntersectOptions(type) {
  return memory_exports.Discard(type, ["~kind", "allOf"]);
}

// node_modules/typebox/build/system/unreachable/unreachable.mjs
function Unreachable() {
  throw new Error("Unreachable");
}

// node_modules/typebox/build/system/hashing/hash.mjs
var ByteMarker;
(function(ByteMarker2) {
  ByteMarker2[ByteMarker2["Array"] = 0] = "Array";
  ByteMarker2[ByteMarker2["BigInt"] = 1] = "BigInt";
  ByteMarker2[ByteMarker2["Boolean"] = 2] = "Boolean";
  ByteMarker2[ByteMarker2["Date"] = 3] = "Date";
  ByteMarker2[ByteMarker2["Constructor"] = 4] = "Constructor";
  ByteMarker2[ByteMarker2["Function"] = 5] = "Function";
  ByteMarker2[ByteMarker2["Null"] = 6] = "Null";
  ByteMarker2[ByteMarker2["Number"] = 7] = "Number";
  ByteMarker2[ByteMarker2["Object"] = 8] = "Object";
  ByteMarker2[ByteMarker2["RegExp"] = 9] = "RegExp";
  ByteMarker2[ByteMarker2["String"] = 10] = "String";
  ByteMarker2[ByteMarker2["Symbol"] = 11] = "Symbol";
  ByteMarker2[ByteMarker2["TypeArray"] = 12] = "TypeArray";
  ByteMarker2[ByteMarker2["Undefined"] = 13] = "Undefined";
})(ByteMarker || (ByteMarker = {}));
var Accumulator = BigInt("14695981039346656037");
var [Prime, Size] = [BigInt("1099511628211"), BigInt(
  "18446744073709551616"
  /* 2 ^ 64 */
)];
var Bytes = Array.from({ length: 256 }).map((_, i) => BigInt(i));
var F64 = new Float64Array(1);
var F64In = new DataView(F64.buffer);
var F64Out = new Uint8Array(F64.buffer);
var encoder = new TextEncoder();

// node_modules/typebox/build/type/types/_codec.mjs
var EncodeBuilder = class {
  constructor(type, decode) {
    this.type = type;
    this.decode = decode;
  }
  Encode(callback) {
    const type = this.type;
    const decode = IsCodec(type) ? (value) => this.decode(type["~codec"].decode(value)) : this.decode;
    const encode = IsCodec(type) ? (value) => type["~codec"].encode(callback(value)) : callback;
    const codec = { decode, encode };
    return memory_exports.Update(this.type, { "~codec": codec }, {});
  }
};
var DecodeBuilder = class {
  constructor(type) {
    this.type = type;
  }
  Decode(callback) {
    return new EncodeBuilder(this.type, callback);
  }
};
function Codec(type) {
  return new DecodeBuilder(type);
}
function Decode(type, callback) {
  return Codec(type).Decode(callback).Encode(() => {
    throw Error("Encode not implemented");
  });
}
function Encode(type, callback) {
  return Codec(type).Decode(() => {
    throw Error("Decode not implemented");
  }).Encode(callback);
}
function IsCodec(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "~codec") && guard_exports.IsObject(value["~codec"]) && guard_exports.HasPropertyKey(value["~codec"], "encode") && guard_exports.HasPropertyKey(value["~codec"], "decode");
}

// node_modules/typebox/build/type/types/_immutable.mjs
function Immutable(type) {
  return AddImmutable(type);
}
function IsImmutable(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "~immutable");
}

// node_modules/typebox/build/type/action/_add_readonly.mjs
function AddReadonlyDeferred(type, options = {}) {
  return Deferred("AddReadonly", [type], options);
}
function AddReadonly(type, options = {}) {
  return AddReadonlyAction(type, options);
}

// node_modules/typebox/build/type/types/_readonly.mjs
function Readonly(type) {
  return AddReadonly(type);
}
function IsReadonly(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "~readonly");
}

// node_modules/typebox/build/type/types/_refine.mjs
function RefineAdd(type, refinement) {
  const refinements = IsRefine(type) ? [...type["~refine"], refinement] : [refinement];
  return memory_exports.Update(type, { "~refine": refinements }, {});
}
function Refine(...args) {
  const [type, check, error] = arguments_exports.Match(args, {
    3: (type2, check2, error2) => [type2, check2, error2],
    2: (type2, check2) => [type2, check2, () => "Refine Error"]
  });
  return RefineAdd(type, { check, error });
}
function IsRefinement(value) {
  return guard_exports.IsObjectNotArray(value) && guard_exports.HasPropertyKey(value, "check") && guard_exports.HasPropertyKey(value, "error") && guard_exports.IsFunction(value.check) && guard_exports.IsFunction(value.error);
}
function IsRefine(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "~refine") && guard_exports.IsArray(value["~refine"]) && guard_exports.Every(value["~refine"], 0, (value2) => IsRefinement(value2));
}

// node_modules/typebox/build/type/types/bigint.mjs
var BigIntPattern = "-?(?:0|[1-9][0-9]*)n";
function BigInt2(options) {
  return memory_exports.Create({ "~kind": "BigInt" }, { type: "bigint" }, options);
}
function IsBigInt2(value) {
  return IsKind(value, "BigInt");
}

// node_modules/typebox/build/type/types/boolean.mjs
function Boolean2(options) {
  return memory_exports.Create({ "~kind": "Boolean" }, { type: "boolean" }, options);
}
function IsBoolean3(value) {
  return IsKind(value, "Boolean");
}

// node_modules/typebox/build/type/types/identifier.mjs
function Identifier(name) {
  return memory_exports.Create({ "~kind": "Identifier" }, { name });
}
function IsIdentifier(value) {
  return IsKind(value, "Identifier");
}

// node_modules/typebox/build/type/types/integer.mjs
var IntegerPattern = "-?(?:0|[1-9][0-9]*)";
function Integer(options) {
  return memory_exports.Create({ "~kind": "Integer" }, { type: "integer" }, options);
}
function IsInteger2(value) {
  return IsKind(value, "Integer");
}

// node_modules/typebox/build/type/types/literal.mjs
var InvalidLiteralValue = class extends Error {
  constructor(value) {
    super(`Invalid Literal value`);
    Object.defineProperty(this, "cause", {
      value: { value },
      writable: false,
      configurable: false,
      enumerable: false
    });
  }
};
function LiteralTypeName(value) {
  return guard_exports.IsBigInt(value) ? "bigint" : guard_exports.IsBoolean(value) ? "boolean" : guard_exports.IsNumber(value) ? "number" : guard_exports.IsString(value) ? "string" : (() => {
    throw new InvalidLiteralValue(value);
  })();
}
function Literal(value, options) {
  return memory_exports.Create({ "~kind": "Literal" }, { type: LiteralTypeName(value), const: value }, options);
}
function IsLiteralValue(value) {
  return guard_exports.IsBigInt(value) || guard_exports.IsBoolean(value) || guard_exports.IsNumber(value) || guard_exports.IsString(value);
}
function IsLiteralNumber(value) {
  return IsLiteral(value) && guard_exports.IsNumber(value.const);
}
function IsLiteralString(value) {
  return IsLiteral(value) && guard_exports.IsString(value.const);
}
function IsLiteral(value) {
  return IsKind(value, "Literal");
}

// node_modules/typebox/build/type/types/null.mjs
function Null(options) {
  return memory_exports.Create({ "~kind": "Null" }, { type: "null" }, options);
}
function IsNull2(value) {
  return IsKind(value, "Null");
}

// node_modules/typebox/build/type/types/number.mjs
var NumberPattern = "-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?";
function Number2(options) {
  return memory_exports.Create({ "~kind": "Number" }, { type: "number" }, options);
}
function IsNumber3(value) {
  return IsKind(value, "Number");
}

// node_modules/typebox/build/type/types/symbol.mjs
function Symbol2(options) {
  return memory_exports.Create({ "~kind": "Symbol" }, { type: "symbol" }, options);
}
function IsSymbol2(value) {
  return IsKind(value, "Symbol");
}

// node_modules/typebox/build/type/types/parameter.mjs
function Parameter(...args) {
  const [name, extends_, equals] = arguments_exports.Match(args, {
    3: (name2, extends_2, equals2) => [name2, extends_2, equals2],
    2: (name2, extends_2) => [name2, extends_2, extends_2],
    1: (name2) => [name2, Unknown(), Unknown()]
  });
  return memory_exports.Create({ "~kind": "Parameter" }, { name, extends: extends_, equals }, {});
}
function IsParameter(value) {
  return IsKind(value, "Parameter");
}

// node_modules/typebox/build/type/types/string.mjs
var StringPattern = ".*";
function String2(options) {
  return memory_exports.Create({ "~kind": "String" }, { type: "string" }, options);
}
function IsString3(value) {
  return IsKind(value, "String");
}

// node_modules/typebox/build/type/types/union.mjs
function Union(anyOf, options = {}) {
  return memory_exports.Create({ "~kind": "Union" }, { anyOf }, options);
}
function IsUnion(value) {
  return IsKind(value, "Union");
}
function UnionOptions(type) {
  return memory_exports.Discard(type, ["~kind", "anyOf"]);
}

// node_modules/typebox/build/type/engine/patterns/pattern.mjs
function ParsePatternIntoTypes(pattern) {
  const parsed = Pattern(pattern);
  const result = guard_exports.IsEqual(parsed.length, 2) ? parsed[0] : [];
  return result;
}

// node_modules/typebox/build/type/engine/template_literal/is_finite.mjs
function FromLiteral(_value) {
  return true;
}
function FromTypesReduce(types) {
  return guard_exports.ShiftLeft(types, (left, right) => FromType(left) ? FromTypesReduce(right) : false, () => true);
}
function FromTypes(types) {
  const result = guard_exports.IsEqual(types.length, 0) ? false : FromTypesReduce(types);
  return result;
}
function FromType(type) {
  return IsUnion(type) ? FromTypes(type.anyOf) : IsLiteral(type) ? FromLiteral(type.const) : false;
}
function IsTemplateLiteralFinite(types) {
  const result = FromTypes(types);
  return result;
}

// node_modules/typebox/build/type/engine/template_literal/create.mjs
function TemplateLiteralCreate(pattern) {
  return memory_exports.Create({ ["~kind"]: "TemplateLiteral" }, { type: "string", pattern }, {});
}

// node_modules/typebox/build/type/engine/template_literal/decode.mjs
function FromLiteralPush(variants, value, result = []) {
  return guard_exports.ShiftLeft(variants, (left, right) => FromLiteralPush(right, value, [...result, `${left}${value}`]), () => result);
}
function FromLiteral2(variants, value) {
  return guard_exports.IsEqual(variants.length, 0) ? [`${value}`] : FromLiteralPush(variants, value);
}
function FromUnion(variants, types, result = []) {
  return guard_exports.ShiftLeft(types, (left, right) => FromUnion(variants, right, [...result, ...FromType2(variants, left)]), () => result);
}
function FromType2(variants, type) {
  const result = IsUnion(type) ? FromUnion(variants, type.anyOf) : IsLiteral(type) ? FromLiteral2(variants, type.const) : Unreachable();
  return result;
}
function DecodeFromSpan(variants, types) {
  return guard_exports.ShiftLeft(types, (left, right) => DecodeFromSpan(FromType2(variants, left), right), () => variants);
}
function VariantsToLiterals(variants) {
  return variants.map((variant) => Literal(variant));
}
function DecodeTypesAsUnion(types) {
  const variants = DecodeFromSpan([], types);
  const literals = VariantsToLiterals(variants);
  const result = Union(literals);
  return result;
}
function DecodeTypes(types) {
  return guard_exports.IsEqual(types.length, 0) ? Unreachable() : (
    // Literal('') :
    guard_exports.IsEqual(types.length, 1) && IsLiteral(types[0]) ? types[0] : DecodeTypesAsUnion(types)
  );
}
function TemplateLiteralDecodeUnsafe(pattern) {
  const types = ParsePatternIntoTypes(pattern);
  const result = guard_exports.IsEqual(types.length, 0) ? String2() : IsTemplateLiteralFinite(types) ? DecodeTypes(types) : TemplateLiteralCreate(pattern);
  return result;
}
function TemplateLiteralDecode(pattern) {
  const decoded = TemplateLiteralDecodeUnsafe(pattern);
  const result = IsTemplateLiteral(decoded) ? String2() : decoded;
  return result;
}

// node_modules/typebox/build/type/engine/record/record_create.mjs
function CreateRecord(key, value) {
  const type = "object";
  const patternProperties = { [key]: value };
  return memory_exports.Create({ ["~kind"]: "Record" }, { type, patternProperties });
}

// node_modules/typebox/build/type/engine/record/from_key_any.mjs
function FromAnyKey(value) {
  return CreateRecord(StringKey, value);
}

// node_modules/typebox/build/type/engine/record/from_key_boolean.mjs
function FromBooleanKey(value) {
  return _Object_({ true: value, false: value });
}

// node_modules/typebox/build/type/types/tuple.mjs
function Tuple(types, options = {}) {
  const [items, minItems, additionalItems] = [types, types.length, false];
  return memory_exports.Create({ ["~kind"]: "Tuple" }, { type: "array", additionalItems, items, minItems }, options);
}
function IsTuple(value) {
  return IsKind(value, "Tuple");
}
function TupleOptions(type) {
  return memory_exports.Discard(type, ["~kind", "type", "items", "minItems", "additionalItems"]);
}

// node_modules/typebox/build/type/engine/readonly/instantiate_remove.mjs
function RemoveReadonlyOperation(type) {
  return memory_exports.Discard(type, ["~readonly"]);
}
function RemoveReadonlyAction(type, options) {
  const result = memory_exports.Update(RemoveReadonlyOperation(type), {}, options);
  return result;
}
function RemoveReadonlyInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return RemoveReadonlyAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/_remove_readonly.mjs
function RemoveReadonlyDeferred(type, options = {}) {
  return Deferred("RemoveReadonly", [type], options);
}
function RemoveReadonly(type, options = {}) {
  return RemoveReadonlyAction(type, options);
}

// node_modules/typebox/build/type/engine/optional/instantiate_remove.mjs
function RemoveOptionalOperation(type) {
  return memory_exports.Discard(type, ["~optional"]);
}
function RemoveOptionalAction(type, options) {
  const result = memory_exports.Update(RemoveOptionalOperation(type), {}, options);
  return result;
}
function RemoveOptionalInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return RemoveOptionalAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/_remove_optional.mjs
function RemoveOptionalDeferred(type, options = {}) {
  return Deferred("RemoveOptional", [type], options);
}
function RemoveOptional(type, options = {}) {
  return RemoveOptionalAction(type, options);
}

// node_modules/typebox/build/type/engine/tuple/to_object.mjs
function TupleElementsToProperties(types) {
  const result = types.reduceRight((result2, right, index) => {
    return { [index]: right, ...result2 };
  }, {});
  return result;
}
function TupleToObject(type) {
  const properties = TupleElementsToProperties(type.items);
  const result = _Object_(properties);
  return result;
}

// node_modules/typebox/build/type/engine/evaluate/composite.mjs
function CanComposite(type) {
  return IsObject2(type) || IsTuple(type);
}
function IsReadonlyProperty(left, right) {
  return IsReadonly(left) ? IsReadonly(right) ? true : false : false;
}
function IsOptionalProperty(left, right) {
  return IsOptional(left) ? IsOptional(right) ? true : false : false;
}
function CompositeProperty(left, right) {
  const isReadonly = IsReadonlyProperty(left, right);
  const isOptional = IsOptionalProperty(left, right);
  const evaluated = EvaluateIntersect([left, right]);
  const property = RemoveReadonly(RemoveOptional(evaluated));
  return isReadonly && isOptional ? AddReadonly(AddOptional(property)) : isReadonly && !isOptional ? AddReadonly(property) : !isReadonly && isOptional ? AddOptional(property) : property;
}
function CompositePropertyKey(left, right, key) {
  return key in left ? key in right ? CompositeProperty(left[key], right[key]) : left[key] : key in right ? right[key] : Never();
}
function CompositeProperties(left, right) {
  const keys = /* @__PURE__ */ new Set([...guard_exports.Keys(left), ...guard_exports.Keys(right)]);
  const result = [...keys].reduce((result2, key) => {
    return { ...result2, [key]: CompositePropertyKey(left, right, key) };
  }, {});
  return result;
}
function GetProperties(type) {
  const result = IsObject2(type) ? type.properties : IsTuple(type) ? TupleElementsToProperties(type.items) : {};
  return result;
}
function Composite(left, right) {
  const leftProperties = GetProperties(left);
  const rightProperties = GetProperties(right);
  const properties = CompositeProperties(leftProperties, rightProperties);
  const result = _Object_(properties);
  return result;
}

// node_modules/typebox/build/type/engine/evaluate/narrow.mjs
function NarrowCompareRule(left, right) {
  const result = Compare(left, right);
  return guard_exports.IsEqual(result, CompareResultLeftInside) ? left : guard_exports.IsEqual(result, CompareResultRightInside) ? right : guard_exports.IsEqual(result, CompareResultEqual) ? right : Never();
}
function NarrowCompositeRule(left, right) {
  const canCompositeLeft = CanComposite(left);
  const canCompositeRight = CanComposite(right);
  return canCompositeLeft && canCompositeRight ? Composite(left, right) : canCompositeLeft && !canCompositeRight ? left : !canCompositeLeft && canCompositeRight ? right : NarrowCompareRule(left, right);
}
function Narrow(left, right) {
  return IsNever(left) ? left : IsAny(left) ? left : IsUnknown(left) ? right : IsNever(right) ? right : IsAny(right) ? right : IsUnknown(right) ? left : NarrowCompositeRule(left, right);
}

// node_modules/typebox/build/type/engine/evaluate/distribute.mjs
function ShouldEvaluate(left, right) {
  const result = IsUnion(left) || IsUnion(right);
  return result;
}
function DistributeOperation(left, right) {
  const evaluatedLeft = EvaluateType(left);
  const evaluatedRight = EvaluateType(right);
  const shouldEvaluate = ShouldEvaluate(evaluatedLeft, evaluatedRight);
  const result = shouldEvaluate ? EvaluateIntersect([evaluatedLeft, evaluatedRight]) : Narrow(evaluatedLeft, evaluatedRight);
  return result;
}
function DistributeType(type, types, result = []) {
  return guard_exports.ShiftLeft(types, (left, right) => DistributeType(type, right, [...result, DistributeOperation(left, type)]), () => guard_exports.IsEqual(result.length, 0) ? [type] : result);
}
function DistributeUnion(types, distribution, result = []) {
  return guard_exports.ShiftLeft(types, (left, right) => DistributeUnion(right, distribution, [...result, ...Distribute([left], distribution)]), () => result);
}
function Distribute(types, result = []) {
  return guard_exports.ShiftLeft(types, (left, right) => IsUnion(left) ? Distribute(right, DistributeUnion(left.anyOf, result)) : Distribute(right, DistributeType(left, result)), () => result);
}

// node_modules/typebox/build/type/engine/exclude/operation.mjs
function ExcludeType(left, right) {
  const check = Extends({}, left, right);
  const result = result_exports.IsExtendsTrueLike(check) ? [] : [left];
  return result;
}
function ExcludeUnion(left, right, result = []) {
  return guard_exports.ShiftLeft(left, (head, tail) => ExcludeUnion(tail, right, [...result, ...ExcludeType(head, right)]), () => result);
}
function ExcludeOperation(left, right) {
  const evaluated = EvaluateType(left);
  const canonical = IsUnion(evaluated) ? evaluated.anyOf : [evaluated];
  const remaining = ExcludeUnion(canonical, right);
  const result = EvaluateUnion(remaining);
  return result;
}

// node_modules/typebox/build/type/engine/evaluate/evaluate.mjs
function EvaluateDependent(if_, then_, else_) {
  const intersected = EvaluateIntersect([if_, then_]);
  const excluded = ExcludeOperation(else_, if_);
  const result = EvaluateUnion([intersected, excluded]);
  return result;
}
function EvaluateEnum(values, result = []) {
  return guard_exports.ShiftLeft(values, (left, right) => EvaluateEnum(right, [...result, Literal(left)]), () => EvaluateUnion(result));
}
function EvaluateIntersect(types) {
  const distribution = Distribute(types);
  const broadend = Broaden(distribution);
  const result = EvaluateUnion(broadend);
  return result;
}
function EvaluateTemplateLiteral(pattern) {
  const evaluated = TemplateLiteralDecode(pattern);
  const result = EvaluateType(evaluated);
  return result;
}
function EvaluateUnion(types) {
  const broadend = Broaden(types);
  const result = EvaluateUnionFast(broadend);
  return result;
}
function EvaluateType(type) {
  const result = IsDependent(type) ? EvaluateDependent(type.if, type.then, type.else) : IsEnum(type) ? EvaluateEnum(type.enum) : IsIntersect(type) ? EvaluateIntersect(type.allOf) : IsTemplateLiteral(type) ? EvaluateTemplateLiteral(type.pattern) : IsUnion(type) ? EvaluateUnion(type.anyOf) : type;
  return result;
}
function EvaluateUnionFast(types) {
  const result = guard_exports.IsEqual(types.length, 1) ? types[0] : guard_exports.IsEqual(types.length, 0) ? Never() : Union(types);
  return result;
}

// node_modules/typebox/build/type/engine/record/from_key_enum.mjs
function FromEnumKey(values, value) {
  const unionKey = EvaluateEnum(values);
  const result = FromKey(unionKey, value);
  return result;
}

// node_modules/typebox/build/type/engine/record/from_key_integer.mjs
function FromIntegerKey(_key, value) {
  const result = CreateRecord(IntegerKey, value);
  return result;
}

// node_modules/typebox/build/type/engine/record/from_key_intersect.mjs
function FromIntersectKey(types, value) {
  const evaluatedKey = EvaluateIntersect(types);
  const result = FromKey(evaluatedKey, value);
  return result;
}

// node_modules/typebox/build/type/engine/record/from_key_literal.mjs
function FromLiteralKey(key, value) {
  return guard_exports.IsString(key) || guard_exports.IsNumber(key) ? _Object_({ [key]: value }) : guard_exports.IsEqual(key, false) ? _Object_({ false: value }) : guard_exports.IsEqual(key, true) ? _Object_({ true: value }) : _Object_({});
}

// node_modules/typebox/build/type/engine/record/from_key_number.mjs
function FromNumberKey(_key, value) {
  const result = CreateRecord(NumberKey, value);
  return result;
}

// node_modules/typebox/build/type/engine/record/from_key_string.mjs
function FromStringKey(key, value) {
  return guard_exports.HasPropertyKey(key, "pattern") && (guard_exports.IsString(key.pattern) || key.pattern instanceof RegExp) ? CreateRecord(key.pattern.toString(), value) : CreateRecord(StringKey, value);
}

// node_modules/typebox/build/type/engine/record/from_key_template_literal.mjs
function FromTemplateKey(pattern, value) {
  const types = ParsePatternIntoTypes(pattern);
  const finite = IsTemplateLiteralFinite(types);
  const result = finite ? FromKey(EvaluateTemplateLiteral(pattern), value) : CreateRecord(pattern, value);
  return result;
}

// node_modules/typebox/build/type/engine/evaluate/flatten.mjs
function FlattenType(type) {
  const result = IsUnion(type) ? Flatten(type.anyOf) : [type];
  return result;
}
function Flatten(types, result = []) {
  return guard_exports.ShiftLeft(types, (left, right) => Flatten(right, [...result, ...FlattenType(left)]), () => result);
}

// node_modules/typebox/build/type/engine/record/from_key_union.mjs
function StringOrNumberCheck(types) {
  return types.some((type) => IsString3(type) || IsNumber3(type) || IsInteger2(type));
}
function TryBuildRecord(types, value) {
  return guard_exports.IsEqual(StringOrNumberCheck(types), true) ? CreateRecord(StringKey, value) : void 0;
}
function CreateProperties(types, value) {
  return types.reduce((result, left) => {
    return IsLiteral(left) && (guard_exports.IsString(left.const) || guard_exports.IsNumber(left.const)) ? { ...result, [left.const]: value } : result;
  }, {});
}
function CreateObject(types, value) {
  const properties = CreateProperties(types, value);
  const result = _Object_(properties);
  return result;
}
function FromUnionKey(types, value) {
  const flattened = Flatten(types);
  const record = TryBuildRecord(flattened, value);
  return IsSchema(record) ? record : CreateObject(flattened, value);
}

// node_modules/typebox/build/type/engine/record/from_key.mjs
function FromKey(key, value) {
  const result = IsAny(key) ? FromAnyKey(value) : IsBoolean3(key) ? FromBooleanKey(value) : IsEnum(key) ? FromEnumKey(key.enum, value) : IsInteger2(key) ? FromIntegerKey(key, value) : IsIntersect(key) ? FromIntersectKey(key.allOf, value) : IsLiteral(key) ? FromLiteralKey(key.const, value) : IsNumber3(key) ? FromNumberKey(key, value) : IsUnion(key) ? FromUnionKey(key.anyOf, value) : IsString3(key) ? FromStringKey(key, value) : IsTemplateLiteral(key) ? FromTemplateKey(key.pattern, value) : _Object_({});
  return result;
}

// node_modules/typebox/build/type/engine/record/instantiate.mjs
function RecordAction(key, value, options) {
  const result = CanInstantiate([key]) ? memory_exports.Update(FromKey(key, value), {}, options) : RecordDeferred(key, value, options);
  return result;
}
function RecordInstantiate(context, state, key, value, options) {
  const instantiatedKey = InstantiateType(context, state, key);
  const instantiatedValue = InstantiateType(context, state, value);
  return RecordAction(instantiatedKey, instantiatedValue, options);
}

// node_modules/typebox/build/type/types/record.mjs
var IntegerKey = `^${IntegerPattern}$`;
var NumberKey = `^${NumberPattern}$`;
var StringKey = `^${StringPattern}$`;
function RecordDeferred(key, value, options = {}) {
  return Deferred("Record", [key, value], options);
}
function Record(key, value, options = {}) {
  return RecordAction(key, value, options);
}
function RecordFromPattern(pattern, value) {
  return CreateRecord(pattern, value);
}
function RecordPatternToType(pattern) {
  const result = guard_exports.IsEqual(pattern, StringKey) ? String2() : guard_exports.IsEqual(pattern, IntegerKey) ? Integer() : guard_exports.IsEqual(pattern, NumberKey) ? Number2() : TemplateLiteralDecodeUnsafe(pattern);
  return result;
}
function RecordPattern(type) {
  return guard_exports.Keys(type.patternProperties)[0];
}
function RecordKey(type) {
  const pattern = RecordPattern(type);
  const result = RecordPatternToType(pattern);
  return result;
}
function RecordValue(type) {
  return type.patternProperties[RecordPattern(type)];
}
function IsRecord(value) {
  return IsKind(value, "Record");
}

// node_modules/typebox/build/type/types/rest.mjs
function Rest(type) {
  return memory_exports.Create({ "~kind": "Rest" }, { type: "rest", items: type }, {});
}
function IsRest(value) {
  return IsKind(value, "Rest");
}

// node_modules/typebox/build/type/types/this.mjs
function This(options) {
  return memory_exports.Create({ ["~kind"]: "This" }, { $ref: "#" }, options);
}
function IsThis(value) {
  return IsKind(value, "This");
}

// node_modules/typebox/build/type/types/undefined.mjs
function Undefined(options) {
  return memory_exports.Create({ "~kind": "Undefined" }, { type: "undefined" }, options);
}
function IsUndefined2(value) {
  return IsKind(value, "Undefined");
}

// node_modules/typebox/build/type/types/void.mjs
function Void(options) {
  return memory_exports.Create({ "~kind": "Void" }, { type: "void" }, options);
}
function IsVoid(value) {
  return IsKind(value, "Void");
}

// node_modules/typebox/build/type/script/mapping.mjs
function IntrinsicOrCall(ref, parameters) {
  return guard_exports.IsEqual(ref, "Array") ? _Array_(parameters[0]) : guard_exports.IsEqual(ref, "Capitalize") ? CapitalizeDeferred(parameters[0]) : guard_exports.IsEqual(ref, "ConstructorParameters") ? ConstructorParametersDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Evaluate") ? EvaluateDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Exclude") ? ExcludeDeferred(parameters[0], parameters[1]) : guard_exports.IsEqual(ref, "Extract") ? ExtractDeferred(parameters[0], parameters[1]) : guard_exports.IsEqual(ref, "Index") ? IndexDeferred(parameters[0], parameters[1]) : guard_exports.IsEqual(ref, "InstanceType") ? InstanceTypeDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Lowercase") ? LowercaseDeferred(parameters[0]) : guard_exports.IsEqual(ref, "NonNullable") ? NonNullableDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Omit") ? OmitDeferred(parameters[0], parameters[1]) : guard_exports.IsEqual(ref, "Parameters") ? ParametersDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Partial") ? PartialDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Pick") ? PickDeferred(parameters[0], parameters[1]) : guard_exports.IsEqual(ref, "Readonly") ? ReadonlyObjectDeferred(parameters[0]) : guard_exports.IsEqual(ref, "KeyOf") ? KeyOfDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Record") ? RecordDeferred(parameters[0], parameters[1]) : guard_exports.IsEqual(ref, "Required") ? RequiredDeferred(parameters[0]) : guard_exports.IsEqual(ref, "ReturnType") ? ReturnTypeDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Uncapitalize") ? UncapitalizeDeferred(parameters[0]) : guard_exports.IsEqual(ref, "Uppercase") ? UppercaseDeferred(parameters[0]) : CallConstruct(Ref(ref), parameters);
}
function Unreachable2() {
  throw Error("Unreachable");
}
function DelimitedDecode(input, result = []) {
  return guard_exports.ShiftLeft(input, (left, right) => DelimitedDecode(right, [...result, left[1]]), () => result);
}
function Delimited(input) {
  return guard_exports.IsEqual(input.length, 3) ? [input[0], ...DelimitedDecode(input[1])] : [];
}
function GenericParameterExtendsEqualsMapping(input) {
  return Parameter(input[0], input[2], input[4]);
}
function GenericParameterExtendsMapping(input) {
  return Parameter(input[0], input[2], input[2]);
}
function GenericParameterEqualsMapping(input) {
  return Parameter(input[0], Unknown(), input[2]);
}
function GenericParameterIdentifierMapping(input) {
  return Parameter(input, Unknown(), Unknown());
}
function GenericParameterMapping(input) {
  return input;
}
function GenericParameterListMapping(input) {
  return Delimited(input);
}
function GenericParametersMapping(input) {
  return input[1];
}
function GenericCallArgumentListMapping(input) {
  return Delimited(input);
}
function GenericCallArgumentsMapping(input) {
  return input[1];
}
function GenericCallMapping(input) {
  return IntrinsicOrCall(input[0], input[1]);
}
function OptionalSemiColonMapping(input) {
  return null;
}
function KeywordStringMapping(input) {
  return String2();
}
function KeywordNumberMapping(input) {
  return Number2();
}
function KeywordBooleanMapping(input) {
  return Boolean2();
}
function KeywordUndefinedMapping(input) {
  return Undefined();
}
function KeywordNullMapping(input) {
  return Null();
}
function KeywordIntegerMapping(input) {
  return Integer();
}
function KeywordBigIntMapping(input) {
  return BigInt2();
}
function KeywordUnknownMapping(input) {
  return Unknown();
}
function KeywordAnyMapping(input) {
  return Any();
}
function KeywordObjectMapping(input) {
  return _Object_({});
}
function KeywordNeverMapping(input) {
  return Never();
}
function KeywordSymbolMapping(input) {
  return Symbol2();
}
function KeywordVoidMapping(input) {
  return Void();
}
function KeywordThisMapping(input) {
  return This();
}
function LiteralBigIntMapping(input) {
  return Literal(BigInt(input));
}
function LiteralBooleanMapping(input) {
  return Literal(guard_exports.IsEqual(input, "true"));
}
function LiteralNumberMapping(input) {
  return Literal(parseFloat(input));
}
function LiteralStringMapping(input) {
  return Literal(input);
}
function TemplateInterpolateMapping(input) {
  return input[1];
}
function TemplateSpanMapping(input) {
  return Literal(input);
}
function TemplateBodyMapping(input) {
  return guard_exports.IsEqual(input.length, 3) ? [input[0], input[1], ...input[2]] : [input[0]];
}
function TemplateLiteralTypesMapping(input) {
  return input[1];
}
function TemplateLiteralMapping(input) {
  return TemplateLiteralDeferred(input);
}
function DependentMapping(input) {
  return guard_exports.IsEqual(input.length, 6) ? Dependent(input[1], input[3], input[5]) : Dependent(input[1], input[3], Unknown());
}
function KeyOfMapping(input) {
  return input.length > 0;
}
function IndexArrayMapping(input) {
  return input.reduce((result, current) => {
    return guard_exports.IsEqual(current.length, 3) ? [...result, [current[1]]] : [...result, []];
  }, []);
}
function ExtendsMapping(input) {
  return guard_exports.IsEqual(input.length, 6) ? [input[1], input[3], input[5]] : [];
}
function BaseMapping(input) {
  return guard_exports.IsArray(input) && guard_exports.IsEqual(input.length, 3) ? input[1] : input;
}
function WithMapping(input) {
  return guard_exports.IsEqual(input.length, 2) ? input[1] : [];
}
function FactorIndexArray(Type2, indexArray) {
  return indexArray.reduce((result, left) => {
    const _left = left;
    return guard_exports.IsEqual(_left.length, 1) ? IndexDeferred(result, _left[0]) : guard_exports.IsEqual(_left.length, 0) ? _Array_(result) : Unreachable2();
  }, Type2);
}
function FactorExtends(type, extend) {
  return guard_exports.IsEqual(extend.length, 3) ? ConditionalDeferred(type, extend[0], extend[1], extend[2]) : type;
}
function FactorWith(type, withClause) {
  return guard_exports.IsArray(withClause) && guard_exports.IsEqual(withClause.length, 0) ? type : WithDeferred(type, withClause);
}
function FactorMapping(input) {
  const [keyOf, type, indexArray, extend, withClause] = input;
  return FactorWith(keyOf ? FactorExtends(KeyOfDeferred(FactorIndexArray(type, indexArray)), extend) : FactorExtends(FactorIndexArray(type, indexArray), extend), withClause);
}
function ExprBinaryMapping(left, rest) {
  return guard_exports.IsEqual(rest.length, 3) ? (() => {
    const [operator, right, next] = rest;
    const Schema = ExprBinaryMapping(right, next);
    if (guard_exports.IsEqual(operator, "&")) {
      return IsIntersect(Schema) ? Intersect([left, ...Schema.allOf]) : Intersect([left, Schema]);
    }
    if (guard_exports.IsEqual(operator, "|")) {
      return IsUnion(Schema) ? Union([left, ...Schema.anyOf]) : Union([left, Schema]);
    }
    Unreachable2();
  })() : left;
}
function ExprTermTailMapping(input) {
  return input;
}
function ExprTermMapping(input) {
  const [left, rest] = input;
  return ExprBinaryMapping(left, rest);
}
function ExprTailMapping(input) {
  return input;
}
function ExprMapping(input) {
  const [left, rest] = input;
  return ExprBinaryMapping(left, rest);
}
function ExprReadonlyMapping(input) {
  return AddImmutableDeferred(input[1]);
}
function ExprPipeMapping(input) {
  return input[1];
}
function GenericTypeMapping(input) {
  return Generic(input[0], input[2]);
}
function InferTypeMapping(input) {
  return guard_exports.IsEqual(input.length, 4) ? Infer(input[1], input[3]) : guard_exports.IsEqual(input.length, 2) ? Infer(input[1], Unknown()) : Unreachable2();
}
function TypeMapping(input) {
  return input;
}
function PropertyKeyNumberMapping(input) {
  return `${input}`;
}
function PropertyKeyIdentMapping(input) {
  return input;
}
function PropertyKeyQuotedMapping(input) {
  return input;
}
function PropertyKeyIndexMapping(input) {
  return IsInteger2(input[3]) ? IntegerKey : IsNumber3(input[3]) ? NumberKey : IsSymbol2(input[3]) ? StringKey : IsString3(input[3]) ? StringKey : Unreachable2();
}
function PropertyKeyMapping(input) {
  return input;
}
function ReadonlyMapping(input) {
  return input.length > 0;
}
function OptionalMapping(input) {
  return input.length > 0;
}
function PropertyMapping(input) {
  const [isReadonly, key, isOptional, _colon, type] = input;
  return {
    [key]: isReadonly && isOptional ? AddReadonlyDeferred(AddOptionalDeferred(type)) : isReadonly && !isOptional ? AddReadonlyDeferred(type) : !isReadonly && isOptional ? AddOptionalDeferred(type) : type
  };
}
function PropertyDelimiterMapping(input) {
  return input;
}
function PropertyListMapping(input) {
  return Delimited(input);
}
function PropertiesReduce(propertyList) {
  return propertyList.reduce((result, left) => {
    const isPatternProperties = guard_exports.HasPropertyKey(left, IntegerKey) || guard_exports.HasPropertyKey(left, NumberKey) || guard_exports.HasPropertyKey(left, StringKey);
    return isPatternProperties ? [result[0], memory_exports.Assign(result[1], left)] : [memory_exports.Assign(result[0], left), result[1]];
  }, [{}, {}]);
}
function PropertiesMapping(input) {
  return PropertiesReduce(input[1]);
}
function _Object_Mapping(input) {
  const [properties, patternProperties] = input;
  const options = guard_exports.IsEqual(guard_exports.Keys(patternProperties).length, 0) ? {} : { patternProperties };
  return _Object_(properties, options);
}
function ElementNamedMapping(input) {
  return guard_exports.IsEqual(input.length, 5) ? AddReadonlyDeferred(AddOptionalDeferred(input[4])) : guard_exports.IsEqual(input.length, 3) ? input[2] : guard_exports.IsEqual(input.length, 4) ? guard_exports.IsEqual(input[2], "readonly") ? AddReadonlyDeferred(input[3]) : AddOptionalDeferred(input[3]) : Unreachable2();
}
function ElementBaseMapping(input) {
  if (!guard_exports.IsArray(input) || !guard_exports.IsEqual(input.length, 3))
    return input;
  const [isReadonly, type, isOptional] = input;
  return isReadonly && isOptional ? AddReadonlyDeferred(AddOptionalDeferred(type)) : isReadonly && !isOptional ? AddReadonlyDeferred(type) : !isReadonly && isOptional ? AddOptionalDeferred(type) : type;
}
function ElementMapping(input) {
  return guard_exports.IsEqual(input.length, 2) ? Rest(input[1]) : guard_exports.IsEqual(input.length, 1) ? input[0] : Unreachable2();
}
function ElementListMapping(input) {
  return Delimited(input);
}
function _Tuple_Mapping(input) {
  return Tuple(input[1]);
}
function ParameterReadonlyOptionalMapping(input) {
  return AddReadonlyDeferred(AddOptionalDeferred(input[4]));
}
function ParameterReadonlyMapping(input) {
  return AddReadonlyDeferred(input[3]);
}
function ParameterOptionalMapping(input) {
  return AddOptionalDeferred(input[3]);
}
function ParameterTypeMapping(input) {
  return input[2];
}
function ParameterBaseMapping(input) {
  return input;
}
function ParameterMapping(input) {
  return guard_exports.IsEqual(input.length, 2) ? Rest(input[1]) : guard_exports.IsEqual(input.length, 1) ? input[0] : Unreachable2();
}
function ParameterListMapping(input) {
  return Delimited(input);
}
function _Function_Mapping(input) {
  return _Function_(input[1], input[4]);
}
function _Constructor_Mapping(input) {
  return Constructor(input[2], input[5]);
}
function ApplyReadonly(state, type) {
  return guard_exports.IsEqual(state, "remove") ? RemoveReadonlyDeferred(type) : guard_exports.IsEqual(state, "add") ? AddReadonlyDeferred(type) : type;
}
function MappedReadonlyMapping(input) {
  return guard_exports.IsEqual(input.length, 2) && guard_exports.IsEqual(input[0], "-") ? "remove" : guard_exports.IsEqual(input.length, 2) && guard_exports.IsEqual(input[0], "+") ? "add" : guard_exports.IsEqual(input.length, 1) ? "add" : "none";
}
function ApplyOptional(state, type) {
  return guard_exports.IsEqual(state, "remove") ? RemoveOptionalDeferred(type) : guard_exports.IsEqual(state, "add") ? AddOptionalDeferred(type) : type;
}
function MappedOptionalMapping(input) {
  return guard_exports.IsEqual(input.length, 2) && guard_exports.IsEqual(input[0], "-") ? "remove" : guard_exports.IsEqual(input.length, 2) && guard_exports.IsEqual(input[0], "+") ? "add" : guard_exports.IsEqual(input.length, 1) ? "add" : "none";
}
function MappedAsMapping(input) {
  return guard_exports.IsEqual(input.length, 2) ? [input[1]] : [];
}
function _Mapped_Mapping(input) {
  return guard_exports.IsArray(input[6]) && guard_exports.IsEqual(input[6].length, 1) ? MappedDeferred(Identifier(input[3]), input[5], input[6][0], ApplyReadonly(input[1], ApplyOptional(input[8], input[10]))) : MappedDeferred(Identifier(input[3]), input[5], Ref(input[3]), ApplyReadonly(input[1], ApplyOptional(input[8], input[10])));
}
function ReferenceMapping(input) {
  return Ref(input);
}
function WithBigIntMapping(input) {
  return BigInt(input);
}
function WithNumberMapping(input) {
  return parseFloat(input);
}
function WithBooleanMapping(input) {
  return guard_exports.IsEqual(input, "true");
}
function WithStringMapping(input) {
  return input;
}
function WithNullMapping(input) {
  return null;
}
function WithUndefinedMapping(input) {
  return void 0;
}
function WithPropertyMapping(input) {
  return { [input[0]]: input[2] };
}
function WithPropertyListMapping(input) {
  return Delimited(input);
}
function WithObjectMappingReduce(propertyList) {
  return propertyList.reduce((result, left) => {
    return memory_exports.Assign(result, left);
  }, {});
}
function WithObjectMapping(input) {
  return WithObjectMappingReduce(input[1]);
}
function WithElementListMapping(input) {
  return Delimited(input);
}
function WithArrayMapping(input) {
  return input[1];
}
function WithValueMapping(input) {
  return input;
}
function PatternBigIntMapping(input) {
  return BigInt2();
}
function PatternStringMapping(input) {
  return String2();
}
function PatternNumberMapping(input) {
  return Number2();
}
function PatternIntegerMapping(input) {
  return Integer();
}
function PatternNeverMapping(input) {
  return Never();
}
function PatternTextMapping(input) {
  return Literal(input);
}
function PatternBaseMapping(input) {
  return input;
}
function PatternGroupMapping(input) {
  return Union(input[1]);
}
function PatternUnionMapping(input) {
  return input.length === 3 ? [...input[0], ...input[2]] : input.length === 1 ? [...input[0]] : [];
}
function PatternTermMapping(input) {
  return [input[0], ...input[1]];
}
function PatternBodyMapping(input) {
  return input;
}
function PatternMapping(input) {
  return input[1];
}
function InterfaceDeclarationHeritageListMapping(input) {
  return Delimited(input);
}
function InterfaceDeclarationHeritageMapping(input) {
  return guard_exports.IsEqual(input.length, 2) ? input[1] : [];
}
function InterfaceDeclarationGenericMapping(input) {
  const parameters = input[2];
  const heritage = input[3];
  const [properties, patternProperties] = input[4];
  const options = guard_exports.IsEqual(guard_exports.Keys(patternProperties).length, 0) ? {} : { patternProperties };
  return { [input[1]]: Generic(parameters, InterfaceDeferred(heritage, properties, options)) };
}
function InterfaceDeclarationMapping(input) {
  const heritage = input[2];
  const [properties, patternProperties] = input[3];
  const options = guard_exports.IsEqual(guard_exports.Keys(patternProperties).length, 0) ? {} : { patternProperties };
  return { [input[1]]: InterfaceDeferred(heritage, properties, options) };
}
function TypeAliasDeclarationGenericMapping(input) {
  return { [input[1]]: Generic(input[2], input[4]) };
}
function TypeAliasDeclarationMapping(input) {
  return { [input[1]]: input[3] };
}
function ExportKeywordMapping(input) {
  return null;
}
function ModuleDeclarationDelimiterMapping(input) {
  return input;
}
function ModuleDeclarationListMapping(input) {
  return Delimited(input);
}
function ModuleDeclarationMapping(input) {
  return input[1];
}
function ModuleMapping(input) {
  const [moduleDeclaration, moduleDeclarationList] = [input[0], input[1]];
  return ModuleDeferred(memory_exports.Assign(moduleDeclaration, PropertiesReduce(moduleDeclarationList)[0]));
}
function ScriptMapping(input) {
  return input;
}

// node_modules/typebox/build/type/script/token/internal/match.mjs
function IsMatch(value) {
  return IsEqual(value.length, 2);
}
function Match2(input, ok, fail) {
  return IsMatch(input) ? ok(input[0], input[1]) : fail();
}

// node_modules/typebox/build/type/script/token/internal/take.mjs
function TakeVariant(variant, input) {
  return IsEqual(input.indexOf(variant), 0) ? [variant, input.slice(variant.length)] : [];
}
function Take(variants, input) {
  for (let i = 0; i < variants.length; i++) {
    const result = TakeVariant(variants[i], input);
    if (IsMatch(result))
      return result;
  }
  return [];
}

// node_modules/typebox/build/type/script/token/internal/char.mjs
function Range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => String.fromCharCode(start + i));
}
var Alpha = [
  ...Range(97, 122),
  // Lowercase
  ...Range(65, 90)
  // Uppercase
];
var Zero = "0";
var NonZero = Range(49, 57);
var Digit = [Zero, ...NonZero];
var WhiteSpace = " ";
var NewLine = "\n";
var UnderScore = "_";
var Dot = ".";
var DollarSign = "$";
var Hyphen = "-";

// node_modules/typebox/build/type/script/token/internal/trim.mjs
var LineComment = "//";
var OpenComment = "/*";
var CloseComment = "*/";
function DiscardMultilineComment(input) {
  const index = input.indexOf(CloseComment);
  const result = IsEqual(index, -1) ? "" : input.slice(index + 2);
  return result;
}
function DiscardLineComment(input) {
  const index = input.indexOf(NewLine);
  const result = IsEqual(index, -1) ? "" : input.slice(index);
  return result;
}
function TrimStartUntilNewline(input) {
  return input.replace(/^[ \t\r\f\v]+/, "");
}
function TrimWhitespace(input) {
  const trimmed = TrimStartUntilNewline(input);
  return trimmed.startsWith(OpenComment) ? TrimWhitespace(DiscardMultilineComment(trimmed.slice(2))) : trimmed.startsWith(LineComment) ? TrimWhitespace(DiscardLineComment(trimmed.slice(2))) : trimmed;
}
function Trim(input) {
  const trimmed = input.trimStart();
  return trimmed.startsWith(OpenComment) ? Trim(DiscardMultilineComment(trimmed.slice(2))) : trimmed.startsWith(LineComment) ? Trim(DiscardLineComment(trimmed.slice(2))) : trimmed;
}

// node_modules/typebox/build/type/script/token/internal/optional.mjs
function Optional2(value, input) {
  return Match2(Take([value], input), (Optional4, Rest2) => [Optional4, Rest2], () => ["", input]);
}

// node_modules/typebox/build/type/script/token/internal/many.mjs
function IsDiscard(discard, input) {
  return discard.includes(input);
}
function Many(allowed, discard, input, result = "") {
  return Match2(Take(allowed, input), (Char, Rest2) => IsDiscard(discard, Char) ? Many(allowed, discard, Rest2, result) : Many(allowed, discard, Rest2, `${result}${Char}`), () => [result, input]);
}

// node_modules/typebox/build/type/script/token/unsigned_integer.mjs
function TakeNonZero(input) {
  return Take(NonZero, input);
}
var AllowedDigits = [...Digit, UnderScore];
function TakeDigits(input) {
  return Many(AllowedDigits, [UnderScore], input);
}
function TakeUnsignedInteger(input) {
  return Match2(Take([Zero], input), (Zero2, ZeroRest) => [Zero2, ZeroRest], () => Match2(
    TakeNonZero(input),
    (NonZero2, NonZeroRest) => Match2(TakeDigits(NonZeroRest), (Digits, DigitsRest) => [`${NonZero2}${Digits}`, DigitsRest], () => []),
    // fail: did not match Digits
    () => []
  ));
}
function UnsignedInteger(input) {
  return TakeUnsignedInteger(Trim(input));
}

// node_modules/typebox/build/type/script/token/integer.mjs
function TakeSign(input) {
  return Optional2(Hyphen, input);
}
function TakeSignedInteger(input) {
  return Match2(
    TakeSign(input),
    (Sign, SignRest) => Match2(UnsignedInteger(SignRest), (UnsignedInteger2, UnsignedIntegerRest) => [`${Sign}${UnsignedInteger2}`, UnsignedIntegerRest], () => []),
    // fail: did not match unsigned integer
    () => []
  );
}
function Integer2(input) {
  return TakeSignedInteger(Trim(input));
}

// node_modules/typebox/build/type/script/token/bigint.mjs
function TakeBigInt(input) {
  return Match2(
    Integer2(input),
    (Integer3, IntegerRest) => Match2(Take(["n"], IntegerRest), (_N, NRest) => [`${Integer3}`, NRest], () => []),
    // fail: did not match 'n'
    () => []
  );
}
function BigInt3(input) {
  return TakeBigInt(input);
}

// node_modules/typebox/build/type/script/token/const.mjs
function TakeConst(const_, input) {
  return Take([const_], input);
}
function Const(const_, input) {
  return IsEqual(const_, "") ? ["", input] : const_.startsWith(NewLine) ? TakeConst(const_, TrimWhitespace(input)) : const_.startsWith(WhiteSpace) ? TakeConst(const_, input) : TakeConst(const_, Trim(input));
}

// node_modules/typebox/build/type/script/token/ident.mjs
var Initial = [...Alpha, UnderScore, DollarSign];
function TakeInitial(input) {
  return Take(Initial, input);
}
var Remaining = [...Initial, ...Digit];
function TakeRemaining(input, result = "") {
  return Match2(Take(Remaining, input), (Remaining2, RemainingRest) => TakeRemaining(RemainingRest, `${result}${Remaining2}`), () => [result, input]);
}
function TakeIdent(input) {
  return Match2(
    TakeInitial(input),
    (Initial2, InitialRest) => Match2(TakeRemaining(InitialRest), (Remaining2, RemainingRest) => [`${Initial2}${Remaining2}`, RemainingRest], () => []),
    // fail: did not match Remaining
    () => []
  );
}
function Ident(input) {
  return TakeIdent(Trim(input));
}

// node_modules/typebox/build/type/script/token/unsigned_number.mjs
var AllowedDigits2 = [...Digit, UnderScore];
function IsLeadingDot(input) {
  return IsMatch(Take([Dot], input));
}
function TakeFractional(input) {
  return Match2(Many(AllowedDigits2, [UnderScore], input), (Digits, DigitsRest) => IsEqual(Digits, "") ? [] : [Digits, DigitsRest], () => []);
}
function LeadingDot(input) {
  return Match2(
    Take([Dot], input),
    (Dot2, DotRest) => Match2(TakeFractional(DotRest), (Fractional, FractionalRest) => [`0${Dot2}${Fractional}`, FractionalRest], () => []),
    // fail: did not match Fractional
    () => []
  );
}
function LeadingInteger(input) {
  return Match2(
    UnsignedInteger(input),
    (Integer3, IntegerRest) => Match2(
      Take([Dot], IntegerRest),
      (Dot2, DotRest) => Match2(TakeFractional(DotRest), (Fractional, FractionalRest) => [`${Integer3}${Dot2}${Fractional}`, FractionalRest], () => [`${Integer3}`, DotRest]),
      // fail: did not match Fractional, use Integer
      () => [`${Integer3}`, IntegerRest]
    ),
    // fail: did not match Dot, use Integer
    () => []
  );
}
function TakeUnsignedNumber(input) {
  return IsLeadingDot(input) ? LeadingDot(input) : LeadingInteger(input);
}
function UnsignedNumber(input) {
  return TakeUnsignedNumber(Trim(input));
}

// node_modules/typebox/build/type/script/token/number.mjs
function TakeSign2(input) {
  return Optional2(Hyphen, input);
}
function TakeSignedNumber(input) {
  return Match2(
    TakeSign2(input),
    (Sign, SignRest) => Match2(UnsignedNumber(SignRest), (UnsignedInteger2, UnsignedIntegerRest) => [`${Sign}${UnsignedInteger2}`, UnsignedIntegerRest], () => []),
    // fail: did not match unsigned integer
    () => []
  );
}
function Number3(input) {
  return TakeSignedNumber(Trim(input));
}

// node_modules/typebox/build/type/script/token/until.mjs
function TakeOne(input) {
  const result = IsEqual(input, "") ? [] : [input.slice(0, 1), input.slice(1)];
  return result;
}
function IsInputMatchSentinal(end, input) {
  return ShiftLeft(end, (left, right) => input.startsWith(left) ? true : IsInputMatchSentinal(right, input), () => false);
}
function Until(end, input, result = "") {
  return Match2(
    TakeOne(input),
    (One, Rest2) => IsInputMatchSentinal(end, input) ? [result, input] : Until(end, Rest2, `${result}${One}`),
    () => []
  );
}

// node_modules/typebox/build/type/script/token/span.mjs
function MultiLine(start, end, input) {
  return Match2(
    Take([start], input),
    (_, Rest2) => Match2(
      Until([end], Rest2),
      (Until2, UntilRest) => Match2(Take([end], UntilRest), (_2, Rest3) => [`${Until2}`, Rest3], () => []),
      // fail: did not match End
      () => []
    ),
    // fail: did not match Until
    () => []
  );
}
function SingleLine(start, end, input) {
  return Match2(
    Take([start], input),
    (_, Rest2) => Match2(
      Until([NewLine, end], Rest2),
      (Until2, UntilRest) => Match2(Take([end], UntilRest), (_2, EndRest) => [`${Until2}`, EndRest], () => []),
      // fail: did not match End
      () => []
    ),
    // fail: did not match Until
    () => []
  );
}
function Span(start, end, multiLine, input) {
  return multiLine ? MultiLine(start, end, Trim(input)) : SingleLine(start, end, Trim(input));
}

// node_modules/typebox/build/type/script/token/string.mjs
function TakeInitial2(quotes, input) {
  return Take(quotes, input);
}
function TakeSpan(quote, input) {
  return Span(quote, quote, false, input);
}
function TakeString(quotes, input) {
  return Match2(TakeInitial2(quotes, input), (Initial2, InitialRest) => TakeSpan(Initial2, `${Initial2}${InitialRest}`), () => []);
}
function String3(quotes, input) {
  return TakeString(quotes, Trim(input));
}

// node_modules/typebox/build/type/script/token/until_1.mjs
function Until_1(end, input) {
  return Match2(Until(end, input), (Until2, UntilRest) => IsEqual(Until2, "") ? [] : [Until2, UntilRest], () => []);
}

// node_modules/typebox/build/type/script/parser.mjs
var If = (result, left, right = () => []) => result.length === 2 ? left(result) : right();
var GenericParameterExtendsEquals = (input) => If(If(Ident(input), ([_0, input2]) => If(Const("extends", input2), ([_1, input3]) => If(Type(input3), ([_2, input4]) => If(Const("=", input4), ([_3, input5]) => If(Type(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [GenericParameterExtendsEqualsMapping(_0), input2]);
var GenericParameterExtends = (input) => If(If(Ident(input), ([_0, input2]) => If(Const("extends", input2), ([_1, input3]) => If(Type(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [GenericParameterExtendsMapping(_0), input2]);
var GenericParameterEquals = (input) => If(If(Ident(input), ([_0, input2]) => If(Const("=", input2), ([_1, input3]) => If(Type(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [GenericParameterEqualsMapping(_0), input2]);
var GenericParameterIdentifier = (input) => If(Ident(input), ([_0, input2]) => [GenericParameterIdentifierMapping(_0), input2]);
var GenericParameter = (input) => If(If(GenericParameterExtendsEquals(input), ([_0, input2]) => [_0, input2], () => If(GenericParameterExtends(input), ([_0, input2]) => [_0, input2], () => If(GenericParameterEquals(input), ([_0, input2]) => [_0, input2], () => If(GenericParameterIdentifier(input), ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [GenericParameterMapping(_0), input2]);
var GenericParameterList_0 = (input, result = []) => If(If(Const(",", input), ([_0, input2]) => If(GenericParameter(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => GenericParameterList_0(input2, [...result, _0]), () => [result, input]);
var GenericParameterList = (input) => If(If(If(GenericParameter(input), ([_0, input2]) => If(GenericParameterList_0(input2), ([_1, input3]) => If(If(Const(",", input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [GenericParameterListMapping(_0), input2]);
var GenericParameters = (input) => If(If(Const("<", input), ([_0, input2]) => If(GenericParameterList(input2), ([_1, input3]) => If(Const(">", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [GenericParametersMapping(_0), input2]);
var GenericCallArgumentList_0 = (input, result = []) => If(If(Const(",", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => GenericCallArgumentList_0(input2, [...result, _0]), () => [result, input]);
var GenericCallArgumentList = (input) => If(If(If(Type(input), ([_0, input2]) => If(GenericCallArgumentList_0(input2), ([_1, input3]) => If(If(Const(",", input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [GenericCallArgumentListMapping(_0), input2]);
var GenericCallArguments = (input) => If(If(Const("<", input), ([_0, input2]) => If(GenericCallArgumentList(input2), ([_1, input3]) => If(Const(">", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [GenericCallArgumentsMapping(_0), input2]);
var GenericCall = (input) => If(If(Ident(input), ([_0, input2]) => If(GenericCallArguments(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [GenericCallMapping(_0), input2]);
var OptionalSemiColon = (input) => If(If(If(Const(";", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [OptionalSemiColonMapping(_0), input2]);
var KeywordString = (input) => If(Const("string", input), ([_0, input2]) => [KeywordStringMapping(_0), input2]);
var KeywordNumber = (input) => If(Const("number", input), ([_0, input2]) => [KeywordNumberMapping(_0), input2]);
var KeywordBoolean = (input) => If(Const("boolean", input), ([_0, input2]) => [KeywordBooleanMapping(_0), input2]);
var KeywordUndefined = (input) => If(Const("undefined", input), ([_0, input2]) => [KeywordUndefinedMapping(_0), input2]);
var KeywordNull = (input) => If(Const("null", input), ([_0, input2]) => [KeywordNullMapping(_0), input2]);
var KeywordInteger = (input) => If(Const("integer", input), ([_0, input2]) => [KeywordIntegerMapping(_0), input2]);
var KeywordBigInt = (input) => If(Const("bigint", input), ([_0, input2]) => [KeywordBigIntMapping(_0), input2]);
var KeywordUnknown = (input) => If(Const("unknown", input), ([_0, input2]) => [KeywordUnknownMapping(_0), input2]);
var KeywordAny = (input) => If(Const("any", input), ([_0, input2]) => [KeywordAnyMapping(_0), input2]);
var KeywordObject = (input) => If(Const("object", input), ([_0, input2]) => [KeywordObjectMapping(_0), input2]);
var KeywordNever = (input) => If(Const("never", input), ([_0, input2]) => [KeywordNeverMapping(_0), input2]);
var KeywordSymbol = (input) => If(Const("symbol", input), ([_0, input2]) => [KeywordSymbolMapping(_0), input2]);
var KeywordVoid = (input) => If(Const("void", input), ([_0, input2]) => [KeywordVoidMapping(_0), input2]);
var KeywordThis = (input) => If(Const("this", input), ([_0, input2]) => [KeywordThisMapping(_0), input2]);
var TemplateInterpolate = (input) => If(If(Const("${", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Const("}", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [TemplateInterpolateMapping(_0), input2]);
var TemplateSpan = (input) => If(Until(["${", "`"], input), ([_0, input2]) => [TemplateSpanMapping(_0), input2]);
var TemplateBody = (input) => If(If(If(TemplateSpan(input), ([_0, input2]) => If(TemplateInterpolate(input2), ([_1, input3]) => If(TemplateBody(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If(If(TemplateSpan(input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If(If(TemplateSpan(input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => []))), ([_0, input2]) => [TemplateBodyMapping(_0), input2]);
var TemplateLiteralTypes = (input) => If(If(Const("`", input), ([_0, input2]) => If(TemplateBody(input2), ([_1, input3]) => If(Const("`", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [TemplateLiteralTypesMapping(_0), input2]);
var TemplateLiteral = (input) => If(TemplateLiteralTypes(input), ([_0, input2]) => [TemplateLiteralMapping(_0), input2]);
var Dependent2 = (input) => If(If(If(Const("if", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Const("then", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => If(Const("else", input5), ([_4, input6]) => If(Type(input6), ([_5, input7]) => [[_0, _1, _2, _3, _4, _5], input7])))))), ([_0, input2]) => [_0, input2], () => If(If(Const("if", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Const("then", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [DependentMapping(_0), input2]);
var LiteralBigInt = (input) => If(BigInt3(input), ([_0, input2]) => [LiteralBigIntMapping(_0), input2]);
var LiteralBoolean = (input) => If(If(Const("true", input), ([_0, input2]) => [_0, input2], () => If(Const("false", input), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [LiteralBooleanMapping(_0), input2]);
var LiteralNumber = (input) => If(Number3(input), ([_0, input2]) => [LiteralNumberMapping(_0), input2]);
var LiteralString = (input) => If(String3(["'", '"'], input), ([_0, input2]) => [LiteralStringMapping(_0), input2]);
var KeyOf = (input) => If(If(If(Const("keyof", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [KeyOfMapping(_0), input2]);
var IndexArray_0 = (input, result = []) => If(If(If(Const("[", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Const("]", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If(If(Const("[", input), ([_0, input2]) => If(Const("]", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => IndexArray_0(input2, [...result, _0]), () => [result, input]);
var IndexArray = (input) => If(IndexArray_0(input), ([_0, input2]) => [IndexArrayMapping(_0), input2]);
var Extends2 = (input) => If(If(If(Const("extends", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Const("?", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => If(Const(":", input5), ([_4, input6]) => If(Type(input6), ([_5, input7]) => [[_0, _1, _2, _3, _4, _5], input7])))))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ExtendsMapping(_0), input2]);
var Base = (input) => If(If(If(Const("(", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Const(")", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If(KeywordString(input), ([_0, input2]) => [_0, input2], () => If(KeywordNumber(input), ([_0, input2]) => [_0, input2], () => If(KeywordBoolean(input), ([_0, input2]) => [_0, input2], () => If(KeywordUndefined(input), ([_0, input2]) => [_0, input2], () => If(KeywordNull(input), ([_0, input2]) => [_0, input2], () => If(KeywordInteger(input), ([_0, input2]) => [_0, input2], () => If(KeywordBigInt(input), ([_0, input2]) => [_0, input2], () => If(KeywordUnknown(input), ([_0, input2]) => [_0, input2], () => If(KeywordAny(input), ([_0, input2]) => [_0, input2], () => If(KeywordObject(input), ([_0, input2]) => [_0, input2], () => If(KeywordNever(input), ([_0, input2]) => [_0, input2], () => If(KeywordSymbol(input), ([_0, input2]) => [_0, input2], () => If(KeywordVoid(input), ([_0, input2]) => [_0, input2], () => If(KeywordThis(input), ([_0, input2]) => [_0, input2], () => If(LiteralBigInt(input), ([_0, input2]) => [_0, input2], () => If(LiteralBoolean(input), ([_0, input2]) => [_0, input2], () => If(LiteralNumber(input), ([_0, input2]) => [_0, input2], () => If(LiteralString(input), ([_0, input2]) => [_0, input2], () => If(TemplateLiteral(input), ([_0, input2]) => [_0, input2], () => If(Dependent2(input), ([_0, input2]) => [_0, input2], () => If(_Object_2(input), ([_0, input2]) => [_0, input2], () => If(_Tuple_(input), ([_0, input2]) => [_0, input2], () => If(_Constructor_(input), ([_0, input2]) => [_0, input2], () => If(_Function_2(input), ([_0, input2]) => [_0, input2], () => If(_Mapped_(input), ([_0, input2]) => [_0, input2], () => If(GenericCall(input), ([_0, input2]) => [_0, input2], () => If(Reference(input), ([_0, input2]) => [_0, input2], () => [])))))))))))))))))))))))))))), ([_0, input2]) => [BaseMapping(_0), input2]);
var With = (input) => If(If(If(Const("with", input), ([_0, input2]) => If(WithObject(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [WithMapping(_0), input2]);
var Factor = (input) => If(If(KeyOf(input), ([_0, input2]) => If(Base(input2), ([_1, input3]) => If(IndexArray(input3), ([_2, input4]) => If(Extends2(input4), ([_3, input5]) => If(With(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [FactorMapping(_0), input2]);
var ExprTermTail = (input) => If(If(If(Const("&", input), ([_0, input2]) => If(Factor(input2), ([_1, input3]) => If(ExprTermTail(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ExprTermTailMapping(_0), input2]);
var ExprTerm = (input) => If(If(Factor(input), ([_0, input2]) => If(ExprTermTail(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [ExprTermMapping(_0), input2]);
var ExprTail = (input) => If(If(If(Const("|", input), ([_0, input2]) => If(ExprTerm(input2), ([_1, input3]) => If(ExprTail(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ExprTailMapping(_0), input2]);
var Expr = (input) => If(If(ExprTerm(input), ([_0, input2]) => If(ExprTail(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [ExprMapping(_0), input2]);
var ExprReadonly = (input) => If(If(Const("readonly", input), ([_0, input2]) => If(Expr(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [ExprReadonlyMapping(_0), input2]);
var ExprPipe = (input) => If(If(Const("|", input), ([_0, input2]) => If(Expr(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [ExprPipeMapping(_0), input2]);
var GenericType = (input) => If(If(GenericParameters(input), ([_0, input2]) => If(Const("=", input2), ([_1, input3]) => If(Type(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [GenericTypeMapping(_0), input2]);
var InferType = (input) => If(If(If(Const("infer", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => If(Const("extends", input3), ([_2, input4]) => If(Expr(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [_0, input2], () => If(If(Const("infer", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [InferTypeMapping(_0), input2]);
var Type = (input) => If(If(InferType(input), ([_0, input2]) => [_0, input2], () => If(ExprPipe(input), ([_0, input2]) => [_0, input2], () => If(ExprReadonly(input), ([_0, input2]) => [_0, input2], () => If(Expr(input), ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [TypeMapping(_0), input2]);
var PropertyKeyNumber = (input) => If(Number3(input), ([_0, input2]) => [PropertyKeyNumberMapping(_0), input2]);
var PropertyKeyIdent = (input) => If(Ident(input), ([_0, input2]) => [PropertyKeyIdentMapping(_0), input2]);
var PropertyKeyQuoted = (input) => If(String3(["'", '"'], input), ([_0, input2]) => [PropertyKeyQuotedMapping(_0), input2]);
var PropertyKeyIndex = (input) => If(If(Const("[", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => If(Const(":", input3), ([_2, input4]) => If(If(KeywordInteger(input4), ([_02, input5]) => [_02, input5], () => If(KeywordNumber(input4), ([_02, input5]) => [_02, input5], () => If(KeywordString(input4), ([_02, input5]) => [_02, input5], () => If(KeywordSymbol(input4), ([_02, input5]) => [_02, input5], () => [])))), ([_3, input5]) => If(Const("]", input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [PropertyKeyIndexMapping(_0), input2]);
var PropertyKey = (input) => If(If(PropertyKeyNumber(input), ([_0, input2]) => [_0, input2], () => If(PropertyKeyIdent(input), ([_0, input2]) => [_0, input2], () => If(PropertyKeyQuoted(input), ([_0, input2]) => [_0, input2], () => If(PropertyKeyIndex(input), ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [PropertyKeyMapping(_0), input2]);
var Readonly2 = (input) => If(If(If(Const("readonly", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ReadonlyMapping(_0), input2]);
var Optional3 = (input) => If(If(If(Const("?", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [OptionalMapping(_0), input2]);
var Property = (input) => If(If(Readonly2(input), ([_0, input2]) => If(PropertyKey(input2), ([_1, input3]) => If(Optional3(input3), ([_2, input4]) => If(Const(":", input4), ([_3, input5]) => If(Type(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [PropertyMapping(_0), input2]);
var PropertyDelimiter = (input) => If(If(If(Const(",", input), ([_0, input2]) => If(Const("\n", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const(";", input), ([_0, input2]) => If(Const("\n", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const(",", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If(If(Const(";", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If(If(Const("\n", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => []))))), ([_0, input2]) => [PropertyDelimiterMapping(_0), input2]);
var PropertyList_0 = (input, result = []) => If(If(PropertyDelimiter(input), ([_0, input2]) => If(Property(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => PropertyList_0(input2, [...result, _0]), () => [result, input]);
var PropertyList = (input) => If(If(If(Property(input), ([_0, input2]) => If(PropertyList_0(input2), ([_1, input3]) => If(If(PropertyDelimiter(input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [PropertyListMapping(_0), input2]);
var Properties = (input) => If(If(Const("{", input), ([_0, input2]) => If(PropertyList(input2), ([_1, input3]) => If(Const("}", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [PropertiesMapping(_0), input2]);
var _Object_2 = (input) => If(Properties(input), ([_0, input2]) => [_Object_Mapping(_0), input2]);
var ElementNamed = (input) => If(If(If(Ident(input), ([_0, input2]) => If(Const("?", input2), ([_1, input3]) => If(Const(":", input3), ([_2, input4]) => If(Const("readonly", input4), ([_3, input5]) => If(Type(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [_0, input2], () => If(If(Ident(input), ([_0, input2]) => If(Const(":", input2), ([_1, input3]) => If(Const("readonly", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [_0, input2], () => If(If(Ident(input), ([_0, input2]) => If(Const("?", input2), ([_1, input3]) => If(Const(":", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [_0, input2], () => If(If(Ident(input), ([_0, input2]) => If(Const(":", input2), ([_1, input3]) => If(Type(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [ElementNamedMapping(_0), input2]);
var ElementBase = (input) => If(If(ElementNamed(input), ([_0, input2]) => [_0, input2], () => If(If(Readonly2(input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => If(Optional3(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ElementBaseMapping(_0), input2]);
var Element = (input) => If(If(If(Const("...", input), ([_0, input2]) => If(ElementBase(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(ElementBase(input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ElementMapping(_0), input2]);
var ElementList_0 = (input, result = []) => If(If(Const(",", input), ([_0, input2]) => If(Element(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => ElementList_0(input2, [...result, _0]), () => [result, input]);
var ElementList = (input) => If(If(If(Element(input), ([_0, input2]) => If(ElementList_0(input2), ([_1, input3]) => If(If(Const(",", input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ElementListMapping(_0), input2]);
var _Tuple_ = (input) => If(If(Const("[", input), ([_0, input2]) => If(ElementList(input2), ([_1, input3]) => If(Const("]", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_Tuple_Mapping(_0), input2]);
var ParameterReadonlyOptional = (input) => If(If(Ident(input), ([_0, input2]) => If(Const("?", input2), ([_1, input3]) => If(Const(":", input3), ([_2, input4]) => If(Const("readonly", input4), ([_3, input5]) => If(Type(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [ParameterReadonlyOptionalMapping(_0), input2]);
var ParameterReadonly = (input) => If(If(Ident(input), ([_0, input2]) => If(Const(":", input2), ([_1, input3]) => If(Const("readonly", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [ParameterReadonlyMapping(_0), input2]);
var ParameterOptional = (input) => If(If(Ident(input), ([_0, input2]) => If(Const("?", input2), ([_1, input3]) => If(Const(":", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [ParameterOptionalMapping(_0), input2]);
var ParameterType = (input) => If(If(Ident(input), ([_0, input2]) => If(Const(":", input2), ([_1, input3]) => If(Type(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [ParameterTypeMapping(_0), input2]);
var ParameterBase = (input) => If(If(ParameterReadonlyOptional(input), ([_0, input2]) => [_0, input2], () => If(ParameterReadonly(input), ([_0, input2]) => [_0, input2], () => If(ParameterOptional(input), ([_0, input2]) => [_0, input2], () => If(ParameterType(input), ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [ParameterBaseMapping(_0), input2]);
var Parameter2 = (input) => If(If(If(Const("...", input), ([_0, input2]) => If(ParameterBase(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(ParameterBase(input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ParameterMapping(_0), input2]);
var ParameterList_0 = (input, result = []) => If(If(Const(",", input), ([_0, input2]) => If(Parameter2(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => ParameterList_0(input2, [...result, _0]), () => [result, input]);
var ParameterList = (input) => If(If(If(Parameter2(input), ([_0, input2]) => If(ParameterList_0(input2), ([_1, input3]) => If(If(Const(",", input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ParameterListMapping(_0), input2]);
var _Function_2 = (input) => If(If(Const("(", input), ([_0, input2]) => If(ParameterList(input2), ([_1, input3]) => If(Const(")", input3), ([_2, input4]) => If(Const("=>", input4), ([_3, input5]) => If(Type(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [_Function_Mapping(_0), input2]);
var _Constructor_ = (input) => If(If(Const("new", input), ([_0, input2]) => If(Const("(", input2), ([_1, input3]) => If(ParameterList(input3), ([_2, input4]) => If(Const(")", input4), ([_3, input5]) => If(Const("=>", input5), ([_4, input6]) => If(Type(input6), ([_5, input7]) => [[_0, _1, _2, _3, _4, _5], input7])))))), ([_0, input2]) => [_Constructor_Mapping(_0), input2]);
var MappedReadonly = (input) => If(If(If(Const("+", input), ([_0, input2]) => If(Const("readonly", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const("-", input), ([_0, input2]) => If(Const("readonly", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const("readonly", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [MappedReadonlyMapping(_0), input2]);
var MappedOptional = (input) => If(If(If(Const("+", input), ([_0, input2]) => If(Const("?", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const("-", input), ([_0, input2]) => If(Const("?", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const("?", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])))), ([_0, input2]) => [MappedOptionalMapping(_0), input2]);
var MappedAs = (input) => If(If(If(Const("as", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [MappedAsMapping(_0), input2]);
var _Mapped_ = (input) => If(If(Const("{", input), ([_0, input2]) => If(MappedReadonly(input2), ([_1, input3]) => If(Const("[", input3), ([_2, input4]) => If(Ident(input4), ([_3, input5]) => If(Const("in", input5), ([_4, input6]) => If(Type(input6), ([_5, input7]) => If(MappedAs(input7), ([_6, input8]) => If(Const("]", input8), ([_7, input9]) => If(MappedOptional(input9), ([_8, input10]) => If(Const(":", input10), ([_9, input11]) => If(Type(input11), ([_10, input12]) => If(OptionalSemiColon(input12), ([_11, input13]) => If(Const("}", input13), ([_12, input14]) => [[_0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12], input14]))))))))))))), ([_0, input2]) => [_Mapped_Mapping(_0), input2]);
var Reference = (input) => If(Ident(input), ([_0, input2]) => [ReferenceMapping(_0), input2]);
var WithBigInt = (input) => If(BigInt3(input), ([_0, input2]) => [WithBigIntMapping(_0), input2]);
var WithNumber = (input) => If(Number3(input), ([_0, input2]) => [WithNumberMapping(_0), input2]);
var WithBoolean = (input) => If(If(Const("true", input), ([_0, input2]) => [_0, input2], () => If(Const("false", input), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [WithBooleanMapping(_0), input2]);
var WithString = (input) => If(String3(['"', "'"], input), ([_0, input2]) => [WithStringMapping(_0), input2]);
var WithNull = (input) => If(Const("null", input), ([_0, input2]) => [WithNullMapping(_0), input2]);
var WithUndefined = (input) => If(Const("undefined", input), ([_0, input2]) => [WithUndefinedMapping(_0), input2]);
var WithProperty = (input) => If(If(PropertyKey(input), ([_0, input2]) => If(Const(":", input2), ([_1, input3]) => If(WithValue(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [WithPropertyMapping(_0), input2]);
var WithPropertyList_0 = (input, result = []) => If(If(PropertyDelimiter(input), ([_0, input2]) => If(WithProperty(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => WithPropertyList_0(input2, [...result, _0]), () => [result, input]);
var WithPropertyList = (input) => If(If(If(WithProperty(input), ([_0, input2]) => If(WithPropertyList_0(input2), ([_1, input3]) => If(If(PropertyDelimiter(input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [WithPropertyListMapping(_0), input2]);
var WithObject = (input) => If(If(Const("{", input), ([_0, input2]) => If(WithPropertyList(input2), ([_1, input3]) => If(Const("}", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [WithObjectMapping(_0), input2]);
var WithElementList_0 = (input, result = []) => If(If(Const(",", input), ([_0, input2]) => If(WithValue(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => WithElementList_0(input2, [...result, _0]), () => [result, input]);
var WithElementList = (input) => If(If(If(WithValue(input), ([_0, input2]) => If(WithElementList_0(input2), ([_1, input3]) => If(If(Const(",", input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [WithElementListMapping(_0), input2]);
var WithArray = (input) => If(If(Const("[", input), ([_0, input2]) => If(WithElementList(input2), ([_1, input3]) => If(Const("]", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [WithArrayMapping(_0), input2]);
var WithValue = (input) => If(If(WithBigInt(input), ([_0, input2]) => [_0, input2], () => If(WithNumber(input), ([_0, input2]) => [_0, input2], () => If(WithBoolean(input), ([_0, input2]) => [_0, input2], () => If(WithString(input), ([_0, input2]) => [_0, input2], () => If(WithNull(input), ([_0, input2]) => [_0, input2], () => If(WithUndefined(input), ([_0, input2]) => [_0, input2], () => If(WithObject(input), ([_0, input2]) => [_0, input2], () => If(WithArray(input), ([_0, input2]) => [_0, input2], () => [])))))))), ([_0, input2]) => [WithValueMapping(_0), input2]);
var PatternBigInt = (input) => If(Const("-?(?:0|[1-9][0-9]*)n", input), ([_0, input2]) => [PatternBigIntMapping(_0), input2]);
var PatternString = (input) => If(Const(".*", input), ([_0, input2]) => [PatternStringMapping(_0), input2]);
var PatternNumber = (input) => If(Const("-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?", input), ([_0, input2]) => [PatternNumberMapping(_0), input2]);
var PatternInteger = (input) => If(Const("-?(?:0|[1-9][0-9]*)", input), ([_0, input2]) => [PatternIntegerMapping(_0), input2]);
var PatternNever = (input) => If(Const("(?!)", input), ([_0, input2]) => [PatternNeverMapping(_0), input2]);
var PatternText = (input) => If(Until_1(["-?(?:0|[1-9][0-9]*)n", ".*", "-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?", "-?(?:0|[1-9][0-9]*)", "(?!)", "(", ")", "$", "|"], input), ([_0, input2]) => [PatternTextMapping(_0), input2]);
var PatternBase = (input) => If(If(PatternBigInt(input), ([_0, input2]) => [_0, input2], () => If(PatternString(input), ([_0, input2]) => [_0, input2], () => If(PatternNumber(input), ([_0, input2]) => [_0, input2], () => If(PatternInteger(input), ([_0, input2]) => [_0, input2], () => If(PatternNever(input), ([_0, input2]) => [_0, input2], () => If(PatternGroup(input), ([_0, input2]) => [_0, input2], () => If(PatternText(input), ([_0, input2]) => [_0, input2], () => []))))))), ([_0, input2]) => [PatternBaseMapping(_0), input2]);
var PatternGroup = (input) => If(If(Const("(", input), ([_0, input2]) => If(PatternBody(input2), ([_1, input3]) => If(Const(")", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [PatternGroupMapping(_0), input2]);
var PatternUnion = (input) => If(If(If(PatternTerm(input), ([_0, input2]) => If(Const("|", input2), ([_1, input3]) => If(PatternUnion(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If(If(PatternTerm(input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => []))), ([_0, input2]) => [PatternUnionMapping(_0), input2]);
var PatternTerm = (input) => If(If(PatternBase(input), ([_0, input2]) => If(PatternBody(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [PatternTermMapping(_0), input2]);
var PatternBody = (input) => If(If(PatternUnion(input), ([_0, input2]) => [_0, input2], () => If(PatternTerm(input), ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [PatternBodyMapping(_0), input2]);
var Pattern = (input) => If(If(Const("^", input), ([_0, input2]) => If(PatternBody(input2), ([_1, input3]) => If(Const("$", input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [PatternMapping(_0), input2]);
var InterfaceDeclarationHeritageList_0 = (input, result = []) => If(If(Const(",", input), ([_0, input2]) => If(Type(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => InterfaceDeclarationHeritageList_0(input2, [...result, _0]), () => [result, input]);
var InterfaceDeclarationHeritageList = (input) => If(If(If(Type(input), ([_0, input2]) => If(InterfaceDeclarationHeritageList_0(input2), ([_1, input3]) => If(If(Const(",", input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [InterfaceDeclarationHeritageListMapping(_0), input2]);
var InterfaceDeclarationHeritage = (input) => If(If(If(Const("extends", input), ([_0, input2]) => If(InterfaceDeclarationHeritageList(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [InterfaceDeclarationHeritageMapping(_0), input2]);
var InterfaceDeclarationGeneric = (input) => If(If(Const("interface", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => If(GenericParameters(input3), ([_2, input4]) => If(InterfaceDeclarationHeritage(input4), ([_3, input5]) => If(Properties(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [InterfaceDeclarationGenericMapping(_0), input2]);
var InterfaceDeclaration = (input) => If(If(Const("interface", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => If(InterfaceDeclarationHeritage(input3), ([_2, input4]) => If(Properties(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [InterfaceDeclarationMapping(_0), input2]);
var TypeAliasDeclarationGeneric = (input) => If(If(Const("type", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => If(GenericParameters(input3), ([_2, input4]) => If(Const("=", input4), ([_3, input5]) => If(Type(input5), ([_4, input6]) => [[_0, _1, _2, _3, _4], input6]))))), ([_0, input2]) => [TypeAliasDeclarationGenericMapping(_0), input2]);
var TypeAliasDeclaration = (input) => If(If(Const("type", input), ([_0, input2]) => If(Ident(input2), ([_1, input3]) => If(Const("=", input3), ([_2, input4]) => If(Type(input4), ([_3, input5]) => [[_0, _1, _2, _3], input5])))), ([_0, input2]) => [TypeAliasDeclarationMapping(_0), input2]);
var ExportKeyword = (input) => If(If(If(Const("export", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ExportKeywordMapping(_0), input2]);
var ModuleDeclarationDelimiter = (input) => If(If(If(Const(";", input), ([_0, input2]) => If(Const("\n", input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [_0, input2], () => If(If(Const(";", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => If(If(Const("\n", input), ([_0, input2]) => [[_0], input2]), ([_0, input2]) => [_0, input2], () => []))), ([_0, input2]) => [ModuleDeclarationDelimiterMapping(_0), input2]);
var ModuleDeclarationList_0 = (input, result = []) => If(If(ModuleDeclarationDelimiter(input), ([_0, input2]) => If(ModuleDeclaration(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => ModuleDeclarationList_0(input2, [...result, _0]), () => [result, input]);
var ModuleDeclarationList = (input) => If(If(If(ModuleDeclaration(input), ([_0, input2]) => If(ModuleDeclarationList_0(input2), ([_1, input3]) => If(If(ModuleDeclarationDelimiter(input3), ([_02, input4]) => [[_02], input4], () => [[], input3]), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [_0, input2], () => If([[], input], ([_0, input2]) => [_0, input2], () => [])), ([_0, input2]) => [ModuleDeclarationListMapping(_0), input2]);
var ModuleDeclaration = (input) => If(If(ExportKeyword(input), ([_0, input2]) => If(If(InterfaceDeclarationGeneric(input2), ([_02, input3]) => [_02, input3], () => If(InterfaceDeclaration(input2), ([_02, input3]) => [_02, input3], () => If(TypeAliasDeclarationGeneric(input2), ([_02, input3]) => [_02, input3], () => If(TypeAliasDeclaration(input2), ([_02, input3]) => [_02, input3], () => [])))), ([_1, input3]) => If(OptionalSemiColon(input3), ([_2, input4]) => [[_0, _1, _2], input4]))), ([_0, input2]) => [ModuleDeclarationMapping(_0), input2]);
var Module = (input) => If(If(ModuleDeclaration(input), ([_0, input2]) => If(ModuleDeclarationList(input2), ([_1, input3]) => [[_0, _1], input3])), ([_0, input2]) => [ModuleMapping(_0), input2]);
var Script = (input) => If(If(Module(input), ([_0, input2]) => [_0, input2], () => If(GenericType(input), ([_0, input2]) => [_0, input2], () => If(Type(input), ([_0, input2]) => [_0, input2], () => []))), ([_0, input2]) => [ScriptMapping(_0), input2]);

// node_modules/typebox/build/type/engine/patterns/template.mjs
function ParseTemplateIntoTypes(template) {
  const parsed = TemplateLiteralTypes(`\`${template}\``);
  const result = guard_exports.IsEqual(parsed.length, 2) ? parsed[0] : Unreachable();
  return result;
}

// node_modules/typebox/build/type/engine/template_literal/encode.mjs
function JoinString(input) {
  return input.join("|");
}
function UnwrapTemplateLiteralPattern(pattern) {
  return pattern.slice(1, pattern.length - 1);
}
function EncodeLiteral(value, right, pattern) {
  return EncodeTypes(right, `${pattern}${value}`);
}
function EncodeBigInt(right, pattern) {
  return EncodeTypes(right, `${pattern}${BigIntPattern}`);
}
function EncodeInteger(right, pattern) {
  return EncodeTypes(right, `${pattern}${IntegerPattern}`);
}
function EncodeNumber(right, pattern) {
  return EncodeTypes(right, `${pattern}${NumberPattern}`);
}
function EncodeBoolean(right, pattern) {
  return EncodeType(Union([Literal("false"), Literal("true")]), right, pattern);
}
function EncodeString(right, pattern) {
  return EncodeTypes(right, `${pattern}${StringPattern}`);
}
function EncodeTemplateLiteral(templatePattern, right, pattern) {
  return EncodeTypes(right, `${pattern}${UnwrapTemplateLiteralPattern(templatePattern)}`);
}
function EncodeTemplateLiteralDeferred(types, right, pattern) {
  const templateLiteral = TemplateLiteralAction(types, {});
  const result = EncodeType(templateLiteral, right, pattern);
  return result;
}
function EncodeEnum(values, right, pattern) {
  const evaluated = EvaluateEnum(values);
  return EncodeType(evaluated, right, pattern);
}
function EncodeUnion(types, right, pattern, result = []) {
  return guard_exports.ShiftLeft(types, (head, tail) => EncodeUnion(tail, right, pattern, [...result, EncodeType(head, [], "")]), () => EncodeTypes(right, `${pattern}(${JoinString(result)})`));
}
function EncodeType(type, right, pattern) {
  return IsEnum(type) ? EncodeEnum(type.enum, right, pattern) : IsInteger2(type) ? EncodeInteger(right, pattern) : IsLiteral(type) ? EncodeLiteral(type.const, right, pattern) : IsBigInt2(type) ? EncodeBigInt(right, pattern) : IsBoolean3(type) ? EncodeBoolean(right, pattern) : IsNumber3(type) ? EncodeNumber(right, pattern) : IsString3(type) ? EncodeString(right, pattern) : IsTemplateLiteral(type) ? EncodeTemplateLiteral(type.pattern, right, pattern) : IsTemplateLiteralDeferred(type) ? EncodeTemplateLiteralDeferred(type.parameters[0], right, pattern) : IsUnion(type) ? EncodeUnion(type.anyOf, right, pattern) : NeverPattern;
}
function EncodeTypes(types, pattern) {
  return guard_exports.ShiftLeft(types, (left, right) => EncodeType(left, right, pattern), () => pattern);
}
function EncodePattern(types) {
  const encoded = EncodeTypes(types, "");
  const result = `^${encoded}$`;
  return result;
}
function TemplateLiteralEncode(types) {
  const pattern = EncodePattern(types);
  const result = TemplateLiteralCreate(pattern);
  return result;
}

// node_modules/typebox/build/type/engine/template_literal/instantiate.mjs
function TemplateLiteralAction(types, options) {
  const result = CanInstantiate(types) ? memory_exports.Update(TemplateLiteralEncode(types), {}, options) : TemplateLiteralDeferred(types, options);
  return result;
}
function TemplateLiteralInstantiate(context, state, types, options) {
  const instantiatedTypes = InstantiateTypes(context, state, types);
  return TemplateLiteralAction(instantiatedTypes, options);
}

// node_modules/typebox/build/type/types/template_literal.mjs
function TemplateLiteralDeferred(types, options = {}) {
  return Deferred("TemplateLiteral", [types], options);
}
function IsTemplateLiteralDeferred(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "action") && guard_exports.IsEqual(value.action, "TemplateLiteral");
}
function TemplateLiteralFromTypes(types) {
  return TemplateLiteralAction(types, {});
}
function TemplateLiteralFromString(template) {
  const types = ParseTemplateIntoTypes(template);
  return TemplateLiteralFromTypes(types);
}
function TemplateLiteral2(input, options = {}) {
  const type = guard_exports.IsString(input) ? TemplateLiteralFromString(input) : TemplateLiteralFromTypes(input);
  return memory_exports.Update(type, {}, options);
}
function IsTemplateLiteral(value) {
  return IsKind(value, "TemplateLiteral");
}

// node_modules/typebox/build/type/extends/result.mjs
var result_exports = {};
__export(result_exports, {
  ExtendsFalse: () => ExtendsFalse,
  ExtendsTrue: () => ExtendsTrue,
  ExtendsUnion: () => ExtendsUnion,
  IsExtendsFalse: () => IsExtendsFalse,
  IsExtendsTrue: () => IsExtendsTrue,
  IsExtendsTrueLike: () => IsExtendsTrueLike,
  IsExtendsUnion: () => IsExtendsUnion,
  Match: () => Match3
});
function ExtendsUnion(inferred) {
  return memory_exports.Create({ ["~kind"]: "ExtendsUnion" }, { inferred });
}
function IsExtendsUnion(value) {
  return guard_exports.IsObject(value) && guard_exports.HasPropertyKey(value, "~kind") && guard_exports.HasPropertyKey(value, "inferred") && guard_exports.IsEqual(value["~kind"], "ExtendsUnion") && guard_exports.IsObject(value.inferred);
}
function ExtendsTrue(inferred) {
  return memory_exports.Create({ ["~kind"]: "ExtendsTrue" }, { inferred });
}
function IsExtendsTrue(value) {
  return guard_exports.IsObject(value) && guard_exports.HasPropertyKey(value, "~kind") && guard_exports.HasPropertyKey(value, "inferred") && guard_exports.IsEqual(value["~kind"], "ExtendsTrue") && guard_exports.IsObject(value.inferred);
}
function ExtendsFalse() {
  return memory_exports.Create({ ["~kind"]: "ExtendsFalse" }, {});
}
function IsExtendsFalse(value) {
  return guard_exports.IsObject(value) && guard_exports.HasPropertyKey(value, "~kind") && guard_exports.IsEqual(value["~kind"], "ExtendsFalse");
}
function IsExtendsTrueLike(value) {
  return IsExtendsUnion(value) || IsExtendsTrue(value);
}
function Match3(result, true_, false_) {
  return IsExtendsTrueLike(result) ? true_(result.inferred) : false_();
}

// node_modules/typebox/build/type/extends/extends_right.mjs
function ExtendsRightInfer(inferred, name, left, right) {
  return Match3(ExtendsLeft(inferred, left, right), (checkInferred) => ExtendsTrue(memory_exports.Assign(memory_exports.Assign(inferred, checkInferred), { [name]: left })), () => ExtendsFalse());
}
function ExtendsRightAny(inferred, _left) {
  return ExtendsTrue(inferred);
}
function ExtendsRightDependent(inferred, left, if_, then_, else_) {
  return Match3(ExtendsLeft(inferred, left, if_), (inferred2) => Match3(ExtendsLeft(inferred2, left, then_), (inferred3) => ExtendsTrue(inferred3), () => ExtendsFalse()), () => Match3(ExtendsLeft(inferred, left, else_), (inferred2) => ExtendsTrue(inferred2), () => ExtendsFalse()));
}
function ExtendsRightEnum(inferred, left, right) {
  const evaluated = EvaluateEnum(right);
  return ExtendsLeft(inferred, left, evaluated);
}
function ExtendsRightIntersect(inferred, left, right) {
  return guard_exports.ShiftLeft(right, (head, tail) => Match3(ExtendsLeft(inferred, left, head), (inferred2) => ExtendsRightIntersect(inferred2, left, tail), () => ExtendsFalse()), () => ExtendsTrue(inferred));
}
function ExtendsRightTemplateLiteral(inferred, left, right) {
  const evaluated = EvaluateTemplateLiteral(right);
  return ExtendsLeft(inferred, left, evaluated);
}
function ExtendsRightUnion(inferred, left, right) {
  return guard_exports.ShiftLeft(right, (head, tail) => Match3(ExtendsLeft(inferred, left, head), (inferred2) => ExtendsTrue(inferred2), () => ExtendsRightUnion(inferred, left, tail)), () => ExtendsFalse());
}
function ExtendsRight(inferred, left, right) {
  return IsAny(right) ? ExtendsRightAny(inferred, left) : IsDependent(right) ? ExtendsRightDependent(inferred, left, right.if, right.then, right.else) : IsEnum(right) ? ExtendsRightEnum(inferred, left, right.enum) : IsInfer(right) ? ExtendsRightInfer(inferred, right.name, left, right.extends) : IsIntersect(right) ? ExtendsRightIntersect(inferred, left, right.allOf) : IsTemplateLiteral(right) ? ExtendsRightTemplateLiteral(inferred, left, right.pattern) : IsUnion(right) ? ExtendsRightUnion(inferred, left, right.anyOf) : IsUnknown(right) ? ExtendsTrue(inferred) : ExtendsFalse();
}

// node_modules/typebox/build/type/extends/any.mjs
function ExtendsAny(inferred, left, right) {
  return IsInfer(right) ? ExtendsRight(inferred, left, right) : IsAny(right) ? ExtendsTrue(inferred) : IsUnknown(right) ? ExtendsTrue(inferred) : ExtendsUnion(inferred);
}

// node_modules/typebox/build/type/extends/array.mjs
function ExtendsImmutable(left, right) {
  const isImmutableLeft = IsImmutable(left);
  const isImmutableRight = IsImmutable(right);
  return isImmutableLeft && isImmutableRight ? true : !isImmutableLeft && isImmutableRight ? true : isImmutableLeft && !isImmutableRight ? false : true;
}
function ExtendsArray(inferred, arrayLeft, left, right) {
  return IsArray2(right) ? ExtendsImmutable(arrayLeft, right) ? ExtendsLeft(inferred, left, right.items) : ExtendsFalse() : ExtendsRight(inferred, arrayLeft, right);
}

// node_modules/typebox/build/type/extends/bigint.mjs
function ExtendsBigInt(inferred, left, right) {
  return IsBigInt2(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/boolean.mjs
function ExtendsBoolean(inferred, left, right) {
  return IsBoolean3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/parameters.mjs
function ParameterCompare(inferred, left, leftRest, right, rightRest) {
  const checkLeft = IsInfer(right) ? left : right;
  const checkRight = IsInfer(right) ? right : left;
  const isLeftOptional = IsOptional(left);
  const isRightOptional = IsOptional(right);
  return !isLeftOptional && isRightOptional ? ExtendsFalse() : Match3(ExtendsLeft(inferred, checkLeft, checkRight), (inferred2) => ExtendsParameters(inferred2, leftRest, rightRest), () => ExtendsFalse());
}
function ParameterRight(inferred, left, leftRest, rightRest) {
  return guard_exports.ShiftLeft(rightRest, (head, tail) => ParameterCompare(inferred, left, leftRest, head, tail), () => IsOptional(left) ? ExtendsTrue(inferred) : ExtendsFalse());
}
function ParametersLeft(inferred, left, rightRest) {
  return guard_exports.ShiftLeft(left, (head, tail) => ParameterRight(inferred, head, tail, rightRest), () => ExtendsTrue(inferred));
}
function ExtendsParameters(inferred, left, right) {
  return ParametersLeft(inferred, left, right);
}

// node_modules/typebox/build/type/extends/return_type.mjs
function ExtendsReturnType(inferred, left, right) {
  return IsVoid(right) ? ExtendsTrue(inferred) : ExtendsLeft(inferred, left, right);
}

// node_modules/typebox/build/type/extends/constructor.mjs
function ExtendsConstructor(inferred, parameters, returnType, right) {
  return IsAny(right) ? ExtendsTrue(inferred) : IsUnknown(right) ? ExtendsTrue(inferred) : IsConstructor2(right) ? Match3(ExtendsParameters(inferred, parameters, right["parameters"]), (inferred2) => ExtendsReturnType(inferred2, returnType, right["instanceType"]), () => ExtendsFalse()) : ExtendsFalse();
}

// node_modules/typebox/build/type/extends/dependent.mjs
function ExtendsDependent(inferred, if_, then_, else_, right) {
  return Match3(ExtendsLeft(inferred, if_, right), () => ExtendsLeft(inferred, then_, right), () => ExtendsLeft(inferred, else_, right));
}

// node_modules/typebox/build/type/extends/enum.mjs
function ExtendsEnum(inferred, left, right) {
  const evaluated = EvaluateEnum(left);
  return ExtendsLeft(inferred, evaluated, right);
}

// node_modules/typebox/build/type/extends/function.mjs
function ExtendsFunction(inferred, parameters, returnType, right) {
  return IsAny(right) ? ExtendsTrue(inferred) : IsUnknown(right) ? ExtendsTrue(inferred) : IsFunction2(right) ? Match3(ExtendsParameters(inferred, parameters, right["parameters"]), (inferred2) => ExtendsReturnType(inferred2, returnType, right["returnType"]), () => ExtendsFalse()) : ExtendsFalse();
}

// node_modules/typebox/build/type/extends/integer.mjs
function ExtendsInteger(inferred, left, right) {
  return IsInteger2(right) ? ExtendsTrue(inferred) : IsNumber3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/intersect.mjs
function ExtendsIntersect(inferred, left, right) {
  const evaluated = EvaluateIntersect(left);
  return ExtendsLeft(inferred, evaluated, right);
}

// node_modules/typebox/build/type/extends/literal.mjs
function ExtendsLiteralValue(inferred, left, right) {
  return left === right ? ExtendsTrue(inferred) : ExtendsFalse();
}
function ExtendsLiteralBigInt(inferred, left, right) {
  return IsLiteral(right) ? ExtendsLiteralValue(inferred, left, right.const) : IsBigInt2(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, Literal(left), right);
}
function ExtendsLiteralBoolean(inferred, left, right) {
  return IsLiteral(right) ? ExtendsLiteralValue(inferred, left, right.const) : IsBoolean3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, Literal(left), right);
}
function ExtendsLiteralNumber(inferred, left, right) {
  return IsLiteral(right) ? ExtendsLiteralValue(inferred, left, right.const) : IsNumber3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, Literal(left), right);
}
function ExtendsLiteralString(inferred, left, right) {
  return IsLiteral(right) ? ExtendsLiteralValue(inferred, left, right.const) : IsString3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, Literal(left), right);
}
function ExtendsLiteral(inferred, left, right) {
  return guard_exports.IsBigInt(left.const) ? ExtendsLiteralBigInt(inferred, left.const, right) : guard_exports.IsBoolean(left.const) ? ExtendsLiteralBoolean(inferred, left.const, right) : guard_exports.IsNumber(left.const) ? ExtendsLiteralNumber(inferred, left.const, right) : guard_exports.IsString(left.const) ? ExtendsLiteralString(inferred, left.const, right) : Unreachable();
}

// node_modules/typebox/build/type/extends/never.mjs
function ExtendsNever(inferred, left, right) {
  return IsInfer(right) ? ExtendsRight(inferred, left, right) : ExtendsTrue(inferred);
}

// node_modules/typebox/build/type/extends/null.mjs
function ExtendsNull(inferred, left, right) {
  return IsNull2(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/number.mjs
function ExtendsNumber(inferred, left, right) {
  return IsNumber3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/object.mjs
function ExtendsPropertyOptional(inferred, left, right) {
  return IsOptional(left) ? IsOptional(right) ? ExtendsTrue(inferred) : ExtendsFalse() : ExtendsTrue(inferred);
}
function ExtendsProperty(inferred, left, right) {
  return (
    // Right TInfer<TNever> is TExtendsFalse
    IsInfer(right) && IsNever(right.extends) ? ExtendsFalse() : Match3(ExtendsLeft(inferred, left, right), (inferred2) => ExtendsPropertyOptional(inferred2, left, right), () => ExtendsFalse())
  );
}
function ExtractInferredProperties(keys, properties) {
  return keys.reduce((result, key) => {
    return key in properties ? IsExtendsTrueLike(properties[key]) ? { ...result, ...properties[key].inferred } : Unreachable() : Unreachable();
  }, {});
}
function ExtendsPropertiesComparer(inferred, left, right) {
  const properties = {};
  for (const rightKey of guard_exports.Keys(right)) {
    properties[rightKey] = rightKey in left ? ExtendsProperty({}, left[rightKey], right[rightKey]) : IsOptional(right[rightKey]) ? IsInfer(right[rightKey]) ? ExtendsTrue(memory_exports.Assign(inferred, { [right[rightKey].name]: right[rightKey].extends })) : ExtendsTrue(inferred) : ExtendsFalse();
  }
  const checked = guard_exports.Values(properties).every((result) => IsExtendsTrueLike(result));
  const extracted = checked ? ExtractInferredProperties(guard_exports.Keys(properties), properties) : {};
  return checked ? ExtendsTrue(extracted) : ExtendsFalse();
}
function ExtendsProperties(inferred, left, right) {
  const compared = ExtendsPropertiesComparer(inferred, left, right);
  return IsExtendsTrueLike(compared) ? ExtendsTrue(memory_exports.Assign(inferred, compared.inferred)) : ExtendsFalse();
}
function ExtendsObjectToObject(inferred, left, right) {
  return ExtendsProperties(inferred, left, right);
}
function RecordMergeInferred(left, right) {
  return guard_exports.Keys(right).reduce((result, key) => {
    return {
      ...result,
      [key]: guard_exports.HasPropertyKey(left, key) ? IsUnion(result[key]) ? Union([...result[key].anyOf, right[key]]) : Union([left[key], right[key]]) : right[key]
    };
  }, left);
}
function ExtendsRecordComparer(properties, keys, type, result) {
  return guard_exports.ShiftLeft(keys, (left, right) => Match3(ExtendsLeft({}, properties[left], type), (inferred) => ExtendsRecordComparer(properties, right, type, RecordMergeInferred(result, inferred)), () => ExtendsFalse()), () => ExtendsTrue(result));
}
function ExtendsObjectToRecord(inferred, properties, _pattern, value) {
  const keys = guard_exports.Keys(properties);
  const result = ExtendsRecordComparer(properties, keys, value, inferred);
  return result;
}
function ExtendsObject(inferred, left, right) {
  return IsRecord(right) ? ExtendsObjectToRecord(inferred, left, RecordPattern(right), RecordValue(right)) : IsObject2(right) ? ExtendsObjectToObject(inferred, left, right.properties) : ExtendsRight(inferred, _Object_(left), right);
}

// node_modules/typebox/build/type/extends/record.mjs
function FromObject2(inferred, properties) {
  return guard_exports.IsEqual(guard_exports.Keys(properties).length, 0) ? ExtendsTrue(inferred) : ExtendsFalse();
}
function FromRecord(inferred, _leftKey, leftValue, _rightKey, rightValue) {
  return ExtendsLeft(inferred, leftValue, rightValue);
}
function ExtendsRecord(inferred, leftPattern, leftValue, right) {
  return IsRecord(right) ? FromRecord(inferred, RecordPatternToType(leftPattern), leftValue, RecordPatternToType(RecordPattern(right)), RecordValue(right)) : IsObject2(right) ? FromObject2(inferred, right.properties) : IsAny(right) ? ExtendsTrue(inferred) : IsUnknown(right) ? ExtendsTrue(inferred) : ExtendsFalse();
}

// node_modules/typebox/build/type/extends/string.mjs
function ExtendsString(inferred, left, right) {
  return IsString3(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/symbol.mjs
function ExtendsSymbol(inferred, left, right) {
  return IsSymbol2(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/template_literal.mjs
function ExtendsTemplateLiteral(inferred, left, right) {
  const evaluated = EvaluateTemplateLiteral(left);
  return ExtendsLeft(inferred, evaluated, right);
}

// node_modules/typebox/build/type/extends/inference.mjs
function Inferrable(name, type) {
  return memory_exports.Create({ "~kind": "Inferrable" }, { name, type }, {});
}
function IsInferable(value) {
  return guard_exports.IsObject(value) && guard_exports.HasPropertyKey(value, "~kind") && guard_exports.HasPropertyKey(value, "name") && guard_exports.HasPropertyKey(value, "type") && guard_exports.IsEqual(value["~kind"], "Inferrable") && guard_exports.IsString(value.name) && guard_exports.IsObject(value.type);
}
function TryRestInferable(type) {
  return IsRest(type) ? IsInfer(type.items) ? IsArray2(type.items.extends) ? Inferrable(type.items.name, type.items.extends.items) : IsUnknown(type.items.extends) ? Inferrable(type.items.name, type.items.extends) : void 0 : Unreachable() : void 0;
}
function TryInferable(type) {
  return IsInfer(type) ? Inferrable(type.name, type.extends) : void 0;
}
function TryInferResults(rest, right) {
  const result = [];
  for (const head of rest) {
    if (!IsExtendsTrueLike(ExtendsLeft({}, head, right)))
      return void 0;
    result.push(head);
  }
  return result;
}
function InferTupleResult(inferred, name, left, right) {
  const results = TryInferResults(left, right);
  return guard_exports.IsArray(results) ? ExtendsTrue(memory_exports.Assign(inferred, { [name]: Tuple(results) })) : ExtendsFalse();
}
function InferUnionResult(inferred, name, left, right) {
  const results = TryInferResults(left, right);
  return guard_exports.IsArray(results) ? ExtendsTrue(memory_exports.Assign(inferred, { [name]: Union(results) })) : ExtendsFalse();
}

// node_modules/typebox/build/type/extends/tuple.mjs
function Reverse(types) {
  return [...types].reverse();
}
function ApplyReverse(types, reversed) {
  return reversed ? Reverse(types) : types;
}
function Reversed(types) {
  const first = types.length > 0 ? types[0] : void 0;
  const inferrable = IsSchema(first) ? TryRestInferable(first) : void 0;
  return IsSchema(inferrable);
}
function ElementsCompare(inferred, reversed, left, leftRest, right, rightRest) {
  return Match3(ExtendsLeft(inferred, left, right), (checkInferred) => Elements(checkInferred, reversed, leftRest, rightRest), () => ExtendsFalse());
}
function ElementsLeft(inferred, reversed, leftRest, right, rightRest) {
  const inferable = TryRestInferable(right);
  return (
    // Rest Inferrable Right Means we delegate to TInferTupleResult to Generate a Result
    IsInferable(inferable) ? InferTupleResult(inferred, inferable["name"], ApplyReverse(leftRest, reversed), inferable["type"]) : guard_exports.ShiftLeft(leftRest, (head, tail) => ElementsCompare(inferred, reversed, head, tail, right, rightRest), () => ExtendsFalse())
  );
}
function ElementsRight(inferred, reversed, leftRest, rightRest) {
  return guard_exports.ShiftLeft(rightRest, (head, tail) => ElementsLeft(inferred, reversed, leftRest, head, tail), () => guard_exports.IsEqual(leftRest.length, 0) ? ExtendsTrue(inferred) : ExtendsFalse());
}
function Elements(inferred, reversed, leftRest, rightRest) {
  return ElementsRight(inferred, reversed, leftRest, rightRest);
}
function ExtendsTupleToTuple(inferred, left, right) {
  const instantiatedRight = InstantiateElements(inferred, State([], []), right);
  const reversed = Reversed(instantiatedRight);
  return Elements(inferred, reversed, ApplyReverse(left, reversed), ApplyReverse(instantiatedRight, reversed));
}
function ExtendsTupleToArrayReduce(inferred, left, right) {
  for (const head of left) {
    const result = ExtendsLeft(inferred, head, right);
    if (!IsExtendsTrueLike(result))
      return result;
    inferred = result.inferred;
  }
  return ExtendsTrue(inferred);
}
function ExtendsTupleToArray(inferred, left, right) {
  const inferrable = TryInferable(right);
  return IsInferable(inferrable) ? InferUnionResult(inferred, inferrable["name"], left, inferrable["type"]) : ExtendsTupleToArrayReduce(inferred, left, right);
}
function ExtendsTuple(inferred, left, right) {
  const instantiatedLeft = InstantiateElements(inferred, State([], []), left);
  return IsTuple(right) ? ExtendsTupleToTuple(inferred, instantiatedLeft, right.items) : IsArray2(right) ? ExtendsTupleToArray(inferred, instantiatedLeft, right.items) : ExtendsRight(inferred, Tuple(instantiatedLeft), right);
}

// node_modules/typebox/build/type/extends/undefined.mjs
function ExtendsUndefined(inferred, left, right) {
  return IsVoid(right) ? ExtendsTrue(inferred) : IsUndefined2(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/union.mjs
function ExtendsUnionSome(inferred, type, unionTypes) {
  return guard_exports.ShiftLeft(unionTypes, (head, tail) => Match3(ExtendsLeft(inferred, type, head), (inferred2) => ExtendsTrue(inferred2), () => ExtendsUnionSome(inferred, type, tail)), () => ExtendsFalse());
}
function ExtendsUnionLeft(inferred, left, right) {
  return guard_exports.ShiftLeft(left, (head, tail) => Match3(ExtendsUnionSome(inferred, head, right), (inferred2) => ExtendsUnionLeft(inferred2, tail, right), () => ExtendsFalse()), () => ExtendsTrue(inferred));
}
function ExtendsUnion2(inferred, left, right) {
  const inferrable = TryInferable(right);
  return IsInferable(inferrable) ? InferUnionResult(inferred, inferrable.name, left, inferrable.type) : IsUnion(right) ? ExtendsUnionLeft(inferred, left, right.anyOf) : ExtendsUnionLeft(inferred, left, [right]);
}

// node_modules/typebox/build/type/extends/unknown.mjs
function ExtendsUnknown(inferred, left, right) {
  return IsInfer(right) ? ExtendsRight(inferred, left, right) : IsAny(right) ? ExtendsTrue(inferred) : IsUnknown(right) ? ExtendsTrue(inferred) : ExtendsFalse();
}

// node_modules/typebox/build/type/extends/void.mjs
function ExtendsVoid(inferred, left, right) {
  return IsVoid(right) ? ExtendsTrue(inferred) : ExtendsRight(inferred, left, right);
}

// node_modules/typebox/build/type/extends/extends_left.mjs
function ExtendsLeft(inferred, left, right) {
  return IsAny(left) ? ExtendsAny(inferred, left, right) : IsArray2(left) ? ExtendsArray(inferred, left, left.items, right) : IsBigInt2(left) ? ExtendsBigInt(inferred, left, right) : IsBoolean3(left) ? ExtendsBoolean(inferred, left, right) : IsConstructor2(left) ? ExtendsConstructor(inferred, left.parameters, left.instanceType, right) : IsDependent(left) ? ExtendsDependent(inferred, left.if, left.then, left.else, right) : IsEnum(left) ? ExtendsEnum(inferred, left.enum, right) : IsFunction2(left) ? ExtendsFunction(inferred, left.parameters, left.returnType, right) : IsInteger2(left) ? ExtendsInteger(inferred, left, right) : IsIntersect(left) ? ExtendsIntersect(inferred, left.allOf, right) : IsLiteral(left) ? ExtendsLiteral(inferred, left, right) : IsNever(left) ? ExtendsNever(inferred, left, right) : IsNull2(left) ? ExtendsNull(inferred, left, right) : IsNumber3(left) ? ExtendsNumber(inferred, left, right) : IsObject2(left) ? ExtendsObject(inferred, left.properties, right) : IsRecord(left) ? ExtendsRecord(inferred, RecordPattern(left), RecordValue(left), right) : IsString3(left) ? ExtendsString(inferred, left, right) : IsSymbol2(left) ? ExtendsSymbol(inferred, left, right) : IsTemplateLiteral(left) ? ExtendsTemplateLiteral(inferred, left.pattern, right) : IsTuple(left) ? ExtendsTuple(inferred, left.items, right) : IsUndefined2(left) ? ExtendsUndefined(inferred, left, right) : IsUnion(left) ? ExtendsUnion2(inferred, left.anyOf, right) : IsUnknown(left) ? ExtendsUnknown(inferred, left, right) : IsVoid(left) ? ExtendsVoid(inferred, left, right) : ExtendsFalse();
}

// node_modules/typebox/build/type/engine/interface/instantiate.mjs
function InterfaceOperation(heritage, properties) {
  const result = EvaluateIntersect([...heritage, _Object_(properties)]);
  return result;
}
function InterfaceAction(heritage, properties, options) {
  const result = CanInstantiate(heritage) ? memory_exports.Update(InterfaceOperation(heritage, properties), {}, options) : InterfaceDeferred(heritage, properties, options);
  return result;
}
function InterfaceInstantiate(context, state, heritage, properties, options) {
  const instantiatedHeritage = InstantiateTypes(context, state, heritage);
  const instantiatedProperties = InstantiateProperties(context, state, properties);
  return InterfaceAction(instantiatedHeritage, instantiatedProperties, options);
}

// node_modules/typebox/build/type/action/interface.mjs
function InterfaceDeferred(heritage, properties, options = {}) {
  return Deferred("Interface", [heritage, properties], options);
}
function IsInterfaceDeferred(value) {
  return IsSchema(value) && guard_exports.HasPropertyKey(value, "action") && guard_exports.IsEqual(value.action, "Interface");
}
function Interface(heritage, properties, options = {}) {
  return InterfaceAction(heritage, properties, options);
}

// node_modules/typebox/build/type/engine/cyclic/check.mjs
function FromRef(stack, context, ref) {
  return stack.includes(ref) ? true : FromType3([...stack, ref], context, context[ref]);
}
function FromProperties(stack, context, properties) {
  const types = PropertyValues(properties);
  return FromTypes2(stack, context, types);
}
function FromTypes2(stack, context, types) {
  return guard_exports.ShiftLeft(types, (left, right) => FromType3(stack, context, left) ? true : FromTypes2(stack, context, right), () => false);
}
function FromType3(stack, context, type) {
  return IsRef(type) ? FromRef(stack, context, type.$ref) : IsArray2(type) ? FromType3(stack, context, type.items) : IsConstructor2(type) ? FromTypes2(stack, context, [...type.parameters, type.instanceType]) : IsFunction2(type) ? FromTypes2(stack, context, [...type.parameters, type.returnType]) : IsInterfaceDeferred(type) ? FromProperties(stack, context, type.parameters[1]) : IsIntersect(type) ? FromTypes2(stack, context, type.allOf) : IsObject2(type) ? FromProperties(stack, context, type.properties) : IsUnion(type) ? FromTypes2(stack, context, type.anyOf) : IsTuple(type) ? FromTypes2(stack, context, type.items) : IsRecord(type) ? FromType3(stack, context, RecordValue(type)) : false;
}
function CyclicCheck(stack, context, type) {
  const result = FromType3(stack, context, type);
  return result;
}

// node_modules/typebox/build/type/engine/cyclic/candidates.mjs
function ResolveCandidateKeys(context, keys) {
  return keys.reduce((result, left) => {
    return CyclicCheck([left], context, context[left]) ? [...result, left] : result;
  }, []);
}
function CyclicCandidates(context) {
  const keys = PropertyKeys(context);
  const result = ResolveCandidateKeys(context, keys);
  return result;
}

// node_modules/typebox/build/type/engine/cyclic/dependencies.mjs
function FromRef2(context, ref, result) {
  return result.includes(ref) ? result : ref in context ? FromType4(context, context[ref], [...result, ref]) : Unreachable();
}
function FromProperties2(context, properties, result) {
  const types = PropertyValues(properties);
  return FromTypes3(context, types, result);
}
function FromTypes3(context, types, result) {
  return types.reduce((result2, left) => {
    return FromType4(context, left, result2);
  }, result);
}
function FromType4(context, type, result) {
  return IsRef(type) ? FromRef2(context, type.$ref, result) : IsArray2(type) ? FromType4(context, type.items, result) : IsConstructor2(type) ? FromTypes3(context, [...type.parameters, type.instanceType], result) : IsFunction2(type) ? FromTypes3(context, [...type.parameters, type.returnType], result) : IsInterfaceDeferred(type) ? FromProperties2(context, type.parameters[1], result) : IsIntersect(type) ? FromTypes3(context, type.allOf, result) : IsObject2(type) ? FromProperties2(context, type.properties, result) : IsUnion(type) ? FromTypes3(context, type.anyOf, result) : IsTuple(type) ? FromTypes3(context, type.items, result) : IsRecord(type) ? FromType4(context, RecordValue(type), result) : result;
}
function CyclicDependencies(context, key, type) {
  const result = FromType4(context, type, [key]);
  return result;
}

// node_modules/typebox/build/type/engine/cyclic/extends.mjs
function FromRef3(_ref) {
  return Any();
}
function FromProperties3(properties) {
  return guard_exports.Keys(properties).reduce((result, key) => {
    return { ...result, [key]: FromType5(properties[key]) };
  }, {});
}
function FromTypes4(types) {
  return types.reduce((result, left) => {
    return [...result, FromType5(left)];
  }, []);
}
function FromType5(type) {
  return IsRef(type) ? FromRef3(type.$ref) : IsArray2(type) ? _Array_(FromType5(type.items), ArrayOptions(type)) : IsConstructor2(type) ? Constructor(FromTypes4(type.parameters), FromType5(type.instanceType)) : IsFunction2(type) ? _Function_(FromTypes4(type.parameters), FromType5(type.returnType)) : IsIntersect(type) ? Intersect(FromTypes4(type.allOf)) : IsObject2(type) ? _Object_(FromProperties3(type.properties)) : IsRecord(type) ? Record(RecordKey(type), FromType5(RecordValue(type))) : IsUnion(type) ? Union(FromTypes4(type.anyOf)) : IsTuple(type) ? Tuple(FromTypes4(type.items)) : type;
}
function CyclicAnyFromParameters(defs, ref) {
  return ref in defs ? FromType5(defs[ref]) : Unknown();
}
function CyclicExtends(type) {
  return CyclicAnyFromParameters(type.$defs, type.$ref);
}

// node_modules/typebox/build/type/engine/cyclic/instantiate.mjs
function CyclicInterface(context, heritage, properties) {
  const instantiatedHeritage = InstantiateTypes(context, State([], []), heritage);
  const instantiatedProperties = InstantiateProperties({}, State([], []), properties);
  const evaluatedInterface = EvaluateIntersect([...instantiatedHeritage, _Object_(instantiatedProperties)]);
  return evaluatedInterface;
}
function CyclicDefinitions(context, dependencies) {
  const keys = guard_exports.Keys(context).filter((key) => dependencies.includes(key));
  return keys.reduce((result, key) => {
    const type = context[key];
    const instantiatedType = IsInterfaceDeferred(type) ? CyclicInterface(context, type.parameters[0], type.parameters[1]) : type;
    return { ...result, [key]: instantiatedType };
  }, {});
}
function InstantiateCyclic(context, ref, type) {
  const dependencies = CyclicDependencies(context, ref, type);
  const definitions = CyclicDefinitions(context, dependencies);
  const result = Cyclic(definitions, ref);
  return result;
}

// node_modules/typebox/build/type/engine/cyclic/target.mjs
function Resolve(defs, ref) {
  return ref in defs ? IsRef(defs[ref]) ? Resolve(defs, defs[ref].$ref) : defs[ref] : Never();
}
function CyclicTarget(defs, ref) {
  const result = Resolve(defs, ref);
  return result;
}

// node_modules/typebox/build/type/extends/extends.mjs
function Canonical(type) {
  return IsCyclic(type) ? CyclicExtends(type) : IsUnsafe(type) ? Unknown() : type;
}
function Extends(inferred, left, right) {
  const canonicalLeft = Canonical(left);
  const canonicalRight = Canonical(right);
  return ExtendsLeft(inferred, canonicalLeft, canonicalRight);
}

// node_modules/typebox/build/type/engine/evaluate/compare.mjs
var CompareResultEqual = 0;
var CompareResultDisjoint = 1;
var CompareResultLeftInside = 2;
var CompareResultRightInside = 3;
function Compare(left, right) {
  const extendsCheck = [Extends({}, left, right), Extends({}, right, left)];
  return result_exports.IsExtendsTrueLike(extendsCheck[0]) && result_exports.IsExtendsTrueLike(extendsCheck[1]) ? CompareResultEqual : result_exports.IsExtendsTrueLike(extendsCheck[0]) && result_exports.IsExtendsFalse(extendsCheck[1]) ? CompareResultLeftInside : result_exports.IsExtendsFalse(extendsCheck[0]) && result_exports.IsExtendsTrueLike(extendsCheck[1]) ? CompareResultRightInside : CompareResultDisjoint;
}

// node_modules/typebox/build/type/engine/evaluate/broaden.mjs
function BroadenFilter(type, types, result = [], all = types) {
  return guard_exports.ShiftLeft(types, (left, right) => {
    const compare = Compare(type, left);
    return guard_exports.IsEqual(compare, CompareResultLeftInside) || guard_exports.IsEqual(compare, CompareResultEqual) ? all : guard_exports.IsEqual(compare, CompareResultDisjoint) ? BroadenFilter(type, right, [...result, left], all) : BroadenFilter(type, right, result, all);
  }, () => [...result, type]);
}
function BroadenType(type, types, result) {
  const evaluated = EvaluateType(type);
  return IsAny(evaluated) ? [evaluated] : (
    // terminate (always the most broad)
    IsUnknown(evaluated) ? [evaluated] : (
      // terminate (always the most broad)
      IsNever(evaluated) ? BroadenTypes(types, result) : (
        // ignored: never is dropped
        IsObject2(evaluated) ? BroadenTypes(types, [...result, evaluated]) : (
          // objects are always considered (too expensive to compare)
          BroadenTypes(types, BroadenFilter(evaluated, result))
        )
      )
    )
  );
}
function BroadenTypes(types, result = []) {
  return guard_exports.ShiftLeft(types, (left, right) => BroadenType(left, right, result), () => result);
}
function Broaden(types) {
  const broadened = BroadenTypes(types);
  const flattened = Flatten(broadened);
  return flattened;
}

// node_modules/typebox/build/type/engine/evaluate/instantiate.mjs
function EvaluateAction(type, options) {
  const result = memory_exports.Update(EvaluateType(type), {}, options);
  return result;
}
function EvaluateInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return EvaluateAction(instantiatedType, options);
}

// node_modules/typebox/build/type/engine/call/distribute_arguments.mjs
function CollectDistributionNames(expression, result = []) {
  return (
    // Conditional
    IsDeferred(expression) && guard_exports.IsEqual(expression.action, "Conditional") ? IsRef(expression.parameters[0]) ? CollectDistributionNames(expression.parameters[2], CollectDistributionNames(expression.parameters[3], [...result, expression.parameters[0]["$ref"]])) : CollectDistributionNames(expression.parameters[2], CollectDistributionNames(expression.parameters[3], result)) : IsDeferred(expression) && guard_exports.IsEqual(expression.action, "Mapped") ? IsDeferred(expression.parameters[1]) && guard_exports.IsEqual(expression.parameters[1].action, "KeyOf") && IsRef(expression.parameters[1].parameters[0]) ? [...result, expression.parameters[1].parameters[0]["$ref"]] : result : result
  );
}
function BuildDistributionArray(parameters, names) {
  return parameters.reduce((result, left) => [...result, names.includes(left.name)], []);
}
function ZipDistributionArray(arguments_, distributionArray, result = []) {
  return guard_exports.ShiftLeft(arguments_, (argumentLeft, argumentRight) => guard_exports.ShiftLeft(distributionArray, (booleanLeft, booleanRight) => ZipDistributionArray(argumentRight, booleanRight, [...result, [booleanLeft, argumentLeft]]), () => result), () => result);
}
function CanonicalArgument(type) {
  return IsTemplateLiteral(type) ? EvaluateTemplateLiteral(type.pattern) : IsEnum(type) ? EvaluateEnum(type.enum) : type;
}
function Expand(type) {
  const canonicalArgument = CanonicalArgument(type);
  return IsUnion(canonicalArgument) ? [...canonicalArgument.anyOf] : [canonicalArgument];
}
function Append(current, type) {
  return current.reduce((result, left) => [...result, [...left, type]], []);
}
function Cross(current, variants) {
  return variants.reduce((result, left) => {
    return [...result, ...Append(current, left)];
  }, []);
}
function Distribute2(zipped) {
  return zipped.reduce((result, left) => {
    return guard_exports.IsEqual(left[0], true) ? Cross(result, Expand(left[1])) : Cross(result, [left[1]]);
  }, [[]]);
}
function DistributeArguments(parameters, arguments_, expression) {
  const distributionNames = CollectDistributionNames(expression);
  const distributionArray = BuildDistributionArray(parameters, distributionNames);
  const zippedArguments = ZipDistributionArray(arguments_, distributionArray);
  return IsDeferred(expression) && guard_exports.IsEqual(expression.action, "Conditional") ? Distribute2(zippedArguments) : IsDeferred(expression) && guard_exports.IsEqual(expression.action, "Mapped") ? Distribute2(zippedArguments) : [arguments_];
}

// node_modules/typebox/build/type/engine/call/resolve_target.mjs
function FromNotResolvable() {
  return ["(not-resolvable)", Never()];
}
function FromNotGeneric() {
  return ["(not-generic)", Never()];
}
function FromGeneric(name, parameters, expression) {
  return [name, Generic(parameters, expression)];
}
function FromRef4(context, ref, arguments_) {
  return ref in context ? FromType6(context, ref, context[ref], arguments_) : FromNotResolvable();
}
function FromType6(context, name, target, arguments_) {
  return IsGeneric(target) ? FromGeneric(name, target.parameters, target.expression) : IsRef(target) ? FromRef4(context, target.$ref, arguments_) : FromNotGeneric();
}
function ResolveTarget(context, target, arguments_) {
  return FromType6(context, "(anonymous)", target, arguments_);
}

// node_modules/typebox/build/type/engine/call/resolve_arguments.mjs
function AssertArgumentExtends(name, type, extends_) {
  if (IsInfer(type) || IsCall(type) || result_exports.IsExtendsTrueLike(Extends({}, type, extends_)))
    return;
  const cause = { parameter: name, expect: extends_, actual: type };
  throw new Error(`Argument for parameter ${name} does not satisfy constraint`, { cause });
}
function BindArgument(context, state, name, extends_, type) {
  const instantiatedArgument = InstantiateType(context, state, type);
  AssertArgumentExtends(name, instantiatedArgument, extends_);
  return memory_exports.Assign(context, { [name]: instantiatedArgument });
}
function BindArguments(context, state, parameterLeft, parameterRight, arguments_) {
  const instantiatedExtends = InstantiateType(context, state, parameterLeft.extends);
  const instantiatedEquals = InstantiateType(context, state, parameterLeft.equals);
  return guard_exports.ShiftLeft(arguments_, (left, right) => BindParameters(BindArgument(context, state, parameterLeft["name"], instantiatedExtends, left), state, parameterRight, right), () => BindParameters(BindArgument(context, state, parameterLeft["name"], instantiatedExtends, instantiatedEquals), state, parameterRight, []));
}
function BindParameters(context, state, parameters, arguments_) {
  return guard_exports.ShiftLeft(parameters, (left, right) => BindArguments(context, state, left, right, arguments_), () => context);
}
function ResolveArgumentsContext(context, state, parameters, arguments_) {
  return BindParameters(context, state, parameters, arguments_);
}

// node_modules/typebox/build/type/engine/call/instantiate.mjs
var instantiationDepth = 0;
var instantiationCount = 0;
function InstantiationAssert() {
  if (guard_exports.IsLessThan(instantiationCount, settings_exports.Get().maxInstantiationCount))
    return;
  throw Error("Type instantiation is excessively deep and possibly infinite");
}
function InstantiationIncrement() {
  InstantiationAssert();
  instantiationCount++;
  instantiationDepth++;
}
function InstantiationDecrement() {
  instantiationDepth--;
  if (guard_exports.IsEqual(instantiationDepth, 0))
    instantiationCount = 0;
}
function Peek(state) {
  const result = guard_exports.IsGreaterThan(state.callstack.length, 0) ? state.callstack[state.callstack.length - 1] : "";
  return result;
}
function IsTailCall(state, name) {
  const result = guard_exports.IsEqual(Peek(state), name);
  return result;
}
function CallDispatch(context, state, target, parameters, expression, arguments_) {
  InstantiationIncrement();
  try {
    const argumentsContext = ResolveArgumentsContext(context, state, parameters, arguments_);
    const returnType = InstantiateType(argumentsContext, State([...state["callstack"], target["$ref"]], state["visited"]), expression);
    return InstantiateType(argumentsContext, State([], []), returnType);
  } finally {
    InstantiationDecrement();
  }
}
function CallDistributed(context, state, target, parameters, expression, distributedArguments) {
  return distributedArguments.reduce((result, arguments_) => {
    const returnType = CallDispatch(context, state, target, parameters, expression, arguments_);
    return [...result, returnType];
  }, []);
}
function CallImmediate(context, state, target, parameters, expression, arguments_) {
  const distributedArguments = DistributeArguments(parameters, arguments_, expression);
  const returnTypes = CallDistributed(context, state, target, parameters, expression, distributedArguments);
  const result = guard_exports.IsEqual(returnTypes.length, 1) ? returnTypes[0] : EvaluateUnion(returnTypes);
  return result;
}
function CallInstantiate(context, state, target, arguments_) {
  const instantiatedArguments = InstantiateTypes(context, state, arguments_);
  const resolved = ResolveTarget(context, target, arguments_);
  const name = resolved[0];
  const type = resolved[1];
  const result = IsGeneric(type) ? IsTailCall(state, name) ? CallConstruct(Ref(name), instantiatedArguments) : CallImmediate(context, state, Ref(name), type.parameters, type.expression, instantiatedArguments) : CallConstruct(target, instantiatedArguments);
  return result;
}

// node_modules/typebox/build/type/types/call.mjs
function CallConstruct(target, arguments_) {
  return memory_exports.Create({ ["~kind"]: "Call" }, { type: "call", target, arguments: arguments_ }, {});
}
function Call(target, arguments_) {
  return CallInstantiate({}, State([], []), target, arguments_);
}
function IsCall(value) {
  return IsKind(value, "Call");
}

// node_modules/typebox/build/type/engine/immutable/instantiate_remove.mjs
function RemoveImmutableOperation(type) {
  return memory_exports.Discard(type, ["~immutable"]);
}
function RemoveImmutableAction(type, options) {
  const result = memory_exports.Update(RemoveImmutableOperation(type), {}, options);
  return result;
}
function RemoveImmutableInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return RemoveImmutableAction(instantiatedType, options);
}

// node_modules/typebox/build/type/engine/intrinsics/mapping.mjs
function ApplyMapping(mapping, value) {
  return mapping(value);
}

// node_modules/typebox/build/type/engine/intrinsics/from_literal.mjs
function FromLiteral3(mapping, value) {
  return guard_exports.IsString(value) ? Literal(ApplyMapping(mapping, value)) : Literal(value);
}

// node_modules/typebox/build/type/engine/intrinsics/from_template_literal.mjs
function FromTemplateLiteral(mapping, pattern) {
  const evaluated = EvaluateTemplateLiteral(pattern);
  const result = FromType7(mapping, evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/intrinsics/from_union.mjs
function FromUnion2(mapping, types) {
  const result = types.map((type) => FromType7(mapping, type));
  return Union(result);
}

// node_modules/typebox/build/type/engine/intrinsics/from_type.mjs
function FromType7(mapping, type) {
  return IsLiteral(type) ? FromLiteral3(mapping, type.const) : IsTemplateLiteral(type) ? FromTemplateLiteral(mapping, type.pattern) : IsUnion(type) ? FromUnion2(mapping, type.anyOf) : type;
}

// node_modules/typebox/build/type/action/capitalize.mjs
function CapitalizeDeferred(type, options = {}) {
  return Deferred("Capitalize", [type], options);
}
function Capitalize(type, options = {}) {
  return CapitalizeAction(type, options);
}

// node_modules/typebox/build/type/action/lowercase.mjs
function LowercaseDeferred(type, options = {}) {
  return Deferred("Lowercase", [type], options);
}
function Lowercase(type, options = {}) {
  return LowercaseAction(type, options);
}

// node_modules/typebox/build/type/action/uncapitalize.mjs
function UncapitalizeDeferred(type, options = {}) {
  return Deferred("Uncapitalize", [type], options);
}
function Uncapitalize(type, options = {}) {
  return UncapitalizeAction(type, options);
}

// node_modules/typebox/build/type/action/uppercase.mjs
function UppercaseDeferred(type, options = {}) {
  return Deferred("Uppercase", [type], options);
}
function Uppercase(type, options = {}) {
  return UppercaseAction(type, options);
}

// node_modules/typebox/build/type/engine/intrinsics/instantiate.mjs
var CapitalizeMapping = (input) => input[0].toUpperCase() + input.slice(1);
var LowercaseMapping = (input) => input.toLowerCase();
var UncapitalizeMapping = (input) => input[0].toLowerCase() + input.slice(1);
var UppercaseMapping = (input) => input.toUpperCase();
function CapitalizeAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType7(CapitalizeMapping, type), {}, options) : CapitalizeDeferred(type, options);
  return result;
}
function LowercaseAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType7(LowercaseMapping, type), {}, options) : LowercaseDeferred(type, options);
  return result;
}
function UncapitalizeAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType7(UncapitalizeMapping, type), {}, options) : UncapitalizeDeferred(type, options);
  return result;
}
function UppercaseAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType7(UppercaseMapping, type), {}, options) : UppercaseDeferred(type, options);
  return result;
}
function CapitalizeInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return CapitalizeAction(instantiatedType, options);
}
function LowercaseInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return LowercaseAction(instantiatedType, options);
}
function UncapitalizeInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return UncapitalizeAction(instantiatedType, options);
}
function UppercaseInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return UppercaseAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/conditional.mjs
function ConditionalDeferred(left, right, true_, false_, options = {}) {
  return Deferred("Conditional", [left, right, true_, false_], options);
}
function Conditional(left, right, true_, false_, options = {}) {
  return ConditionalAction({}, State([], []), left, right, true_, false_, options);
}

// node_modules/typebox/build/type/engine/conditional/instantiate.mjs
function ConditionalOperation(context, state, left, right, true_, false_) {
  const extendsResult = Extends(context, left, right);
  return result_exports.IsExtendsUnion(extendsResult) ? Union([InstantiateType(extendsResult.inferred, state, true_), InstantiateType(context, state, false_)]) : result_exports.IsExtendsTrue(extendsResult) ? InstantiateType(extendsResult.inferred, state, true_) : InstantiateType(context, state, false_);
}
function ConditionalAction(context, state, left, right, true_, false_, options) {
  const result = CanInstantiate([left, right]) ? memory_exports.Update(ConditionalOperation(context, state, left, right, true_, false_), {}, options) : ConditionalDeferred(left, right, true_, false_, options);
  return result;
}
function ConditionalInstantiate(context, state, left, right, true_, false_, options) {
  const instantiatedLeft = InstantiateType(context, state, left);
  const instantiatedRight = InstantiateType(context, state, right);
  return ConditionalAction(context, state, instantiatedLeft, instantiatedRight, true_, false_, options);
}

// node_modules/typebox/build/type/action/constructor_parameters.mjs
function ConstructorParametersDeferred(type, options = {}) {
  return Deferred("ConstructorParameters", [type], options);
}
function ConstructorParameters(type, options = {}) {
  return ConstructorParametersAction(type, options);
}

// node_modules/typebox/build/type/engine/constructor_parameters/instantiate.mjs
function ConstructorParametersOperation(type) {
  const parameters = IsConstructor2(type) ? type["parameters"] : [];
  const instantiatedParameters = InstantiateElements({}, State([], []), parameters);
  const result = Tuple(instantiatedParameters);
  return result;
}
function ConstructorParametersAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(ConstructorParametersOperation(type), {}, options) : ConstructorParametersDeferred(type, options);
  return result;
}
function ConstructorParametersInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return ConstructorParametersAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/exclude.mjs
function ExcludeDeferred(left, right, options = {}) {
  return Deferred("Exclude", [left, right], options);
}
function Exclude(left, right, options = {}) {
  return ExcludeAction(left, right, options);
}

// node_modules/typebox/build/type/engine/exclude/instantiate.mjs
function ExcludeAction(left, right, options) {
  const result = CanInstantiate([left, right]) ? memory_exports.Update(ExcludeOperation(left, right), {}, options) : ExcludeDeferred(left, right, options);
  return result;
}
function ExcludeInstantiate(context, state, left, right, options) {
  const instantiatedLeft = InstantiateType(context, state, left);
  const instantiatedRight = InstantiateType(context, state, right);
  return ExcludeAction(instantiatedLeft, instantiatedRight, options);
}

// node_modules/typebox/build/type/action/extract.mjs
function ExtractDeferred(left, right, options = {}) {
  return Deferred("Extract", [left, right], options);
}
function Extract(left, right, options = {}) {
  return ExtractAction(left, right, options);
}

// node_modules/typebox/build/type/engine/extract/operation.mjs
function ExtractType(left, right) {
  const check = Extends({}, left, right);
  const result = result_exports.IsExtendsTrueLike(check) ? [left] : [];
  return result;
}
function ExtractUnion(left, right, result = []) {
  return guard_exports.ShiftLeft(left, (head, tail) => ExtractUnion(tail, right, [...result, ...ExtractType(head, right)]), () => result);
}
function ExtractOperation(left, right) {
  const evaluated = EvaluateType(left);
  const canonical = IsUnion(evaluated) ? evaluated.anyOf : [evaluated];
  const remaining = ExtractUnion(canonical, right);
  const result = EvaluateUnion(remaining);
  return result;
}

// node_modules/typebox/build/type/engine/extract/instantiate.mjs
function ExtractAction(left, right, options) {
  const result = CanInstantiate([left, right]) ? memory_exports.Update(ExtractOperation(left, right), {}, options) : ExtractDeferred(left, right, options);
  return result;
}
function ExtractInstantiate(context, state, left, right, options) {
  const instantiatedLeft = InstantiateType(context, state, left);
  const instantiatedRight = InstantiateType(context, state, right);
  return ExtractAction(instantiatedLeft, instantiatedRight, options);
}

// node_modules/typebox/build/type/engine/helpers/keys_to_indexer.mjs
function KeysToLiterals(keys) {
  return keys.reduce((result, left) => {
    return IsLiteralValue(left) ? [...result, Literal(left)] : result;
  }, []);
}
function KeysToIndexer(keys) {
  const literals = KeysToLiterals(keys);
  const result = Union(literals);
  return result;
}

// node_modules/typebox/build/type/action/indexed.mjs
function IndexDeferred(type, indexer, options = {}) {
  return Deferred("Index", [type, indexer], options);
}
function Index(type, indexer_or_keys, options = {}) {
  const indexer = guard_exports.IsArray(indexer_or_keys) ? KeysToIndexer(indexer_or_keys) : indexer_or_keys;
  return IndexAction(type, indexer, options);
}

// node_modules/typebox/build/type/engine/object/from_cyclic.mjs
function FromCyclic(defs, ref) {
  const target = CyclicTarget(defs, ref);
  const result = FromType8(target);
  return result;
}

// node_modules/typebox/build/type/engine/object/from_dependent.mjs
function FromDependent(if_, then_, else_) {
  const evaluated = EvaluateDependent(if_, then_, else_);
  const result = FromType8(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/object/from_intersect.mjs
function CollapseIntersectProperties(left, right) {
  const leftKeys = guard_exports.Keys(left).filter((key) => !guard_exports.HasPropertyKey(right, key));
  const rightKeys = guard_exports.Keys(right).filter((key) => !guard_exports.HasPropertyKey(left, key));
  const sharedKeys = guard_exports.Keys(left).filter((key) => guard_exports.HasPropertyKey(right, key));
  const leftProperties = leftKeys.reduce((result, key) => ({ ...result, [key]: left[key] }), {});
  const rightProperties = rightKeys.reduce((result, key) => ({ ...result, [key]: right[key] }), {});
  const sharedProperties = sharedKeys.reduce((result, key) => ({ ...result, [key]: EvaluateIntersect([left[key], right[key]]) }), {});
  const unique = memory_exports.Assign(leftProperties, rightProperties);
  const shared = memory_exports.Assign(unique, sharedProperties);
  return shared;
}
function FromIntersect(types) {
  return types.reduce((result, left) => {
    return CollapseIntersectProperties(result, FromType8(left));
  }, {});
}

// node_modules/typebox/build/type/engine/object/from_object.mjs
function FromObject3(properties) {
  return properties;
}

// node_modules/typebox/build/type/engine/object/from_tuple.mjs
function FromTuple(types) {
  const object = TupleToObject(Tuple(types));
  const result = FromType8(object);
  return result;
}

// node_modules/typebox/build/type/engine/object/from_union.mjs
function CollapseUnionProperties(left, right) {
  const sharedKeys = guard_exports.Keys(left).filter((key) => key in right);
  const result = sharedKeys.reduce((result2, key) => {
    return { ...result2, [key]: EvaluateUnion([left[key], right[key]]) };
  }, {});
  return result;
}
function ReduceVariants(types, result) {
  return guard_exports.ShiftLeft(types, (left, right) => ReduceVariants(right, CollapseUnionProperties(result, FromType8(left))), () => result);
}
function FromUnion3(types) {
  return guard_exports.ShiftLeft(types, (left, right) => ReduceVariants(right, FromType8(left)), () => Unreachable());
}

// node_modules/typebox/build/type/engine/object/from_type.mjs
function FromType8(type) {
  return IsCyclic(type) ? FromCyclic(type.$defs, type.$ref) : IsDependent(type) ? FromDependent(type.if, type.then, type.else) : IsIntersect(type) ? FromIntersect(type.allOf) : IsUnion(type) ? FromUnion3(type.anyOf) : IsTuple(type) ? FromTuple(type.items) : IsObject2(type) ? FromObject3(type.properties) : {};
}

// node_modules/typebox/build/type/engine/object/collapse.mjs
function CollapseToObject(type) {
  const properties = FromType8(type);
  const result = _Object_(properties);
  return result;
}

// node_modules/typebox/build/type/engine/helpers/keys.mjs
var integerKeyPattern = new RegExp("^(?:0|[1-9][0-9]*)$");
function ConvertToIntegerKey(value) {
  const normal = `${value}`;
  return integerKeyPattern.test(normal) ? parseInt(normal) : value;
}

// node_modules/typebox/build/type/engine/indexed/from_array.mjs
function NormalizeLiteral(value) {
  return Literal(ConvertToIntegerKey(value));
}
function NormalizeIndexerTypes(types) {
  return types.map((type) => NormalizeIndexer(type));
}
function NormalizeIndexer(type) {
  return IsIntersect(type) ? Intersect(NormalizeIndexerTypes(type.allOf)) : IsUnion(type) ? Union(NormalizeIndexerTypes(type.anyOf)) : IsLiteral(type) ? NormalizeLiteral(type.const) : type;
}
function FromArray2(type, indexer) {
  const normalizedIndexer = NormalizeIndexer(indexer);
  const check = Extends({}, normalizedIndexer, Number2());
  const result = (
    // indexer
    result_exports.IsExtendsTrueLike(check) ? type : IsLiteral(indexer) && guard_exports.IsEqual(indexer.const, "length") ? Number2() : Never()
  );
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_cyclic.mjs
function FromCyclic2(defs, ref) {
  const target = CyclicTarget(defs, ref);
  const result = FromType9(target);
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_dependent.mjs
function FromDependent2(if_, then_, else_) {
  const evaluated = EvaluateDependent(if_, then_, else_);
  const result = FromType9(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_enum.mjs
function FromEnum(values) {
  const evaluated = EvaluateEnum(values);
  const result = FromType9(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_intersect.mjs
function FromIntersect2(types) {
  const evaluated = EvaluateIntersect(types);
  const result = FromType9(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_literal.mjs
function FromLiteral4(value) {
  const result = [`${value}`];
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_template_literal.mjs
function FromTemplateLiteral2(pattern) {
  const evaluated = EvaluateTemplateLiteral(pattern);
  const result = FromType9(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/indexable/from_union.mjs
function FromUnion4(types) {
  return types.reduce((result, left) => {
    return [...result, ...FromType9(left)];
  }, []);
}

// node_modules/typebox/build/type/engine/indexable/from_type.mjs
function FromType9(type) {
  return IsCyclic(type) ? FromCyclic2(type.$defs, type.$ref) : IsDependent(type) ? FromDependent2(type.if, type.then, type.else) : IsEnum(type) ? FromEnum(type.enum) : IsIntersect(type) ? FromIntersect2(type.allOf) : IsLiteral(type) ? FromLiteral4(type.const) : IsTemplateLiteral(type) ? FromTemplateLiteral2(type.pattern) : IsUnion(type) ? FromUnion4(type.anyOf) : [];
}

// node_modules/typebox/build/type/engine/indexable/to_indexable_keys.mjs
function ToIndexableKeys(type) {
  const result = FromType9(type);
  return result;
}

// node_modules/typebox/build/type/engine/this/expand_this.mjs
function FromTypes5(properties, types) {
  return types.map((type) => FromType10(properties, type));
}
function FromType10(properties, type) {
  return IsArray2(type) ? _Array_(FromType10(properties, type.items)) : IsConstructor2(type) ? Constructor(FromTypes5(properties, type.parameters), FromType10(properties, type.instanceType)) : IsFunction2(type) ? _Function_(FromTypes5(properties, type.parameters), FromType10(properties, type.returnType)) : IsTuple(type) ? Tuple(FromTypes5(properties, type.items)) : IsUnion(type) ? Union(FromTypes5(properties, type.anyOf)) : IsIntersect(type) ? Intersect(FromTypes5(properties, type.allOf)) : IsThis(type) ? _Object_(properties) : type;
}
function ExpandThis(properties, type) {
  const result = FromType10(properties, type);
  return result;
}

// node_modules/typebox/build/type/engine/indexed/from_object.mjs
function IndexProperty(properties, key) {
  const selectedType = key in properties ? properties[key] : Never();
  const result = ExpandThis(properties, selectedType);
  return result;
}
function IndexProperties(properties, keys) {
  return keys.reduce((result, left) => {
    return [...result, IndexProperty(properties, left)];
  }, []);
}
function FromIndexer(properties, indexer) {
  const keys = ToIndexableKeys(indexer);
  const variants = IndexProperties(properties, keys);
  const result = EvaluateUnion(variants);
  return result;
}
var NumericKeyPattern = new RegExp(IntegerKey);
function NumericKeys(keys) {
  const result = keys.filter((key) => NumericKeyPattern.test(key));
  return result;
}
function FromIndexerNumber(properties) {
  const keys = PropertyKeys(properties);
  const numericKeys = NumericKeys(keys);
  const variants = IndexProperties(properties, numericKeys);
  const result = EvaluateUnion(variants);
  return result;
}
function FromObject4(properties, indexer) {
  const result = IsNumber3(indexer) ? FromIndexerNumber(properties) : FromIndexer(properties, indexer);
  return result;
}

// node_modules/typebox/build/type/engine/indexed/array_indexer.mjs
function ConvertLiteral(value) {
  return Literal(ConvertToIntegerKey(value));
}
function ArrayIndexerTypes(types) {
  return types.map((type) => FormatArrayIndexer(type));
}
function FormatArrayIndexer(type) {
  return IsIntersect(type) ? Intersect(ArrayIndexerTypes(type.allOf)) : IsUnion(type) ? Union(ArrayIndexerTypes(type.anyOf)) : IsLiteral(type) ? ConvertLiteral(type.const) : type;
}

// node_modules/typebox/build/type/engine/indexed/from_tuple.mjs
function IndexElementsWithIndexer(types, indexer) {
  return types.reduceRight((result, right, index) => {
    const check = Extends({}, Literal(index), indexer);
    return result_exports.IsExtendsTrueLike(check) ? [right, ...result] : result;
  }, []);
}
function FromTupleWithIndexer(types, indexer) {
  const formattedArrayIndexer = FormatArrayIndexer(indexer);
  const elements = IndexElementsWithIndexer(types, formattedArrayIndexer);
  return EvaluateUnionFast(elements);
}
function FromTupleWithoutIndexer(types) {
  return EvaluateUnionFast(types);
}
function FromTuple2(types, indexer) {
  return (
    // length (intrinsic)
    IsLiteral(indexer) && guard_exports.IsEqual(indexer.const, "length") ? Literal(types.length) : IsNumber3(indexer) || IsInteger2(indexer) ? FromTupleWithoutIndexer(types) : FromTupleWithIndexer(types, indexer)
  );
}

// node_modules/typebox/build/type/engine/indexed/from_type.mjs
function FromType11(type, indexer) {
  return IsArray2(type) ? FromArray2(type.items, indexer) : IsObject2(type) ? FromObject4(type.properties, indexer) : IsTuple(type) ? FromTuple2(type.items, indexer) : Never();
}

// node_modules/typebox/build/type/engine/indexed/instantiate.mjs
function NormalizeType(type) {
  const result = IsCyclic(type) || IsDependent(type) || IsIntersect(type) || IsUnion(type) ? CollapseToObject(type) : type;
  return result;
}
function IndexAction(type, indexer, options) {
  const result = CanInstantiate([type, indexer]) ? memory_exports.Update(FromType11(NormalizeType(type), indexer), {}, options) : IndexDeferred(type, indexer, options);
  return result;
}
function IndexInstantiate(context, state, type, indexer, options) {
  const instantiatedType = InstantiateType(context, state, type);
  const instantiatedIndexer = InstantiateType(context, state, indexer);
  return IndexAction(instantiatedType, instantiatedIndexer, options);
}

// node_modules/typebox/build/type/action/instance_type.mjs
function InstanceTypeDeferred(type, options = {}) {
  return Deferred("InstanceType", [type], options);
}
function InstanceType(type, options = {}) {
  return InstanceTypeAction(type, options);
}

// node_modules/typebox/build/type/engine/instance_type/instantiate.mjs
function InstanceTypeOperation(type) {
  return IsConstructor2(type) ? type["instanceType"] : Never();
}
function InstanceTypeAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(InstanceTypeOperation(type), {}, options) : InstanceTypeDeferred(type, options);
  return result;
}
function InstanceTypeInstantiate(context, state, type, options = {}) {
  const instantiatedType = InstantiateType(context, state, type);
  return InstanceTypeAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/keyof.mjs
function KeyOfDeferred(type, options = {}) {
  return Deferred("KeyOf", [type], options);
}
function KeyOf2(type, options = {}) {
  return KeyOfAction(type, options);
}

// node_modules/typebox/build/type/engine/keyof/from_any.mjs
function FromAny() {
  return Union([Number2(), String2(), Symbol2()]);
}

// node_modules/typebox/build/type/engine/keyof/from_array.mjs
function FromArray3(_type) {
  return Number2();
}

// node_modules/typebox/build/type/engine/keyof/from_object.mjs
function FromPropertyKeys(keys) {
  const result = keys.reduce((result2, left) => {
    return IsLiteralValue(left) ? [...result2, Literal(ConvertToIntegerKey(left))] : Unreachable();
  }, []);
  return result;
}
function FromObject5(properties) {
  const propertyKeys = guard_exports.Keys(properties);
  const variants = FromPropertyKeys(propertyKeys);
  const result = EvaluateUnionFast(variants);
  return result;
}

// node_modules/typebox/build/type/engine/keyof/from_record.mjs
function FromRecord2(type) {
  return RecordKey(type);
}

// node_modules/typebox/build/type/engine/keyof/from_tuple.mjs
function FromTuple3(types) {
  const result = types.map((_, index) => Literal(index));
  return EvaluateUnionFast(result);
}

// node_modules/typebox/build/type/engine/keyof/from_type.mjs
function FromType12(type) {
  return IsAny(type) ? FromAny() : IsArray2(type) ? FromArray3(type.items) : IsObject2(type) ? FromObject5(type.properties) : IsRecord(type) ? FromRecord2(type) : IsTuple(type) ? FromTuple3(type.items) : Never();
}

// node_modules/typebox/build/type/engine/keyof/instantiate.mjs
function NormalizeType2(type) {
  const result = IsCyclic(type) || IsDependent(type) || IsIntersect(type) || IsUnion(type) ? CollapseToObject(type) : type;
  return result;
}
function KeyOfAction(type, options) {
  return CanInstantiate([type]) ? memory_exports.Update(FromType12(NormalizeType2(type)), {}, options) : KeyOfDeferred(type, options);
}
function KeyOfInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return KeyOfAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/mapped.mjs
function MappedDeferred(identifier, type, as, property, options = {}) {
  return Deferred("Mapped", [identifier, type, as, property], options);
}
function Mapped(identifier, type, as, property, options = {}) {
  return MappedAction({}, State([], []), identifier, type, as, property, options);
}

// node_modules/typebox/build/type/engine/mapped/mapped_variants.mjs
function FromTemplateLiteral3(pattern) {
  const evaluated = EvaluateTemplateLiteral(pattern);
  const result = FromType13(evaluated);
  return result;
}
function FromUnion5(types) {
  return types.reduce((result, left) => {
    return [...result, ...FromType13(left)];
  }, []);
}
function FromEnum2(values) {
  const evaluated = EvaluateEnum(values);
  const result = FromType13(evaluated);
  return result;
}
function FromLiteral5(value) {
  const result = guard_exports.IsNumber(value) ? [Literal(`${value}`)] : [Literal(value)];
  return result;
}
function FromType13(type) {
  const result = IsEnum(type) ? FromEnum2(type.enum) : IsLiteral(type) ? FromLiteral5(type.const) : IsTemplateLiteral(type) ? FromTemplateLiteral3(type.pattern) : IsUnion(type) ? FromUnion5(type.anyOf) : [type];
  return result;
}
function MappedVariants(type) {
  const result = FromType13(type);
  return result;
}

// node_modules/typebox/build/type/engine/mapped/mapped_operation.mjs
function CanonicalAs(instantiatedAs) {
  const result = IsTemplateLiteral(instantiatedAs) ? EvaluateTemplateLiteral(instantiatedAs.pattern) : instantiatedAs;
  return result;
}
function MappedVariant(context, state, identifier, variant, as, property) {
  const variantContext = memory_exports.Assign(context, { [identifier["name"]]: variant });
  const instantiatedAs = InstantiateType(variantContext, state, as);
  const canonicalAs = CanonicalAs(instantiatedAs);
  const instantiatedProperty = InstantiateType(variantContext, state, property);
  return IsLiteralNumber(canonicalAs) || IsLiteralString(canonicalAs) ? { [canonicalAs.const]: instantiatedProperty } : {};
}
function MappedProperties(context, state, identifier, variants, as, property) {
  return variants.reduce((result, left) => {
    return [...result, MappedVariant(context, state, identifier, left, as, property)];
  }, []);
}
function MappedObjects(properties) {
  return properties.reduce((result, left) => {
    return [...result, _Object_(left)];
  }, []);
}
function MappedOperation(context, state, identifier, type, as, property) {
  const variants = MappedVariants(type);
  const mappedProperties = MappedProperties(context, state, identifier, variants, as, property);
  const mappedObjects = MappedObjects(mappedProperties);
  const result = EvaluateIntersect(mappedObjects);
  return result;
}

// node_modules/typebox/build/type/engine/mapped/instantiate.mjs
function MappedAction(context, state, identifier, type, as, property, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(MappedOperation(context, state, identifier, type, as, property), {}, options) : MappedDeferred(identifier, type, as, property, options);
  return result;
}
function MappedInstantiate(context, state, identifier, type, as, property, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return MappedAction(context, state, identifier, instantiatedType, as, property, options);
}

// node_modules/typebox/build/type/engine/module/instantiate.mjs
function InstantiateCyclics(context, declarations, cyclicKeys) {
  const declarationContext = memory_exports.Assign(context, declarations);
  const declarationKeys = guard_exports.Keys(declarations).filter((key) => cyclicKeys.includes(key));
  return declarationKeys.reduce((result, key) => {
    return { ...result, [key]: InstantiateCyclic(declarationContext, key, declarations[key]) };
  }, {});
}
function InstantiateNonCyclics(context, declarations, cyclicKeys) {
  const declarationContext = memory_exports.Assign(context, declarations);
  const declarationKeys = guard_exports.Keys(declarations).filter((key) => !cyclicKeys.includes(key));
  return declarationKeys.reduce((result, key) => {
    return { ...result, [key]: InstantiateType(declarationContext, State([], []), declarations[key]) };
  }, {});
}
function InstantiateModule(context, declarations, options) {
  const cyclicCandidates = CyclicCandidates(declarations);
  const instantiatedCyclics = InstantiateCyclics(context, declarations, cyclicCandidates);
  const instantiatedNonCyclics = InstantiateNonCyclics(context, declarations, cyclicCandidates);
  const instantiatedModule = { ...instantiatedCyclics, ...instantiatedNonCyclics };
  return memory_exports.Update(instantiatedModule, {}, options);
}
function ModuleInstantiate(context, _state, declarations, options) {
  const instantiatedModule = InstantiateModule(context, declarations, options);
  return instantiatedModule;
}

// node_modules/typebox/build/type/action/non_nullable.mjs
function NonNullableDeferred(type, options = {}) {
  return Deferred("NonNullable", [type], options);
}
function NonNullable(type, options = {}) {
  return NonNullableAction(type, options);
}

// node_modules/typebox/build/type/engine/non_nullable/instantiate.mjs
function NonNullableOperation(type) {
  const excluded = Union([Null(), Undefined()]);
  return ExcludeAction(type, excluded, {});
}
function NonNullableAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(NonNullableOperation(type), {}, options) : NonNullableDeferred(type, options);
  return result;
}
function NonNullableInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return NonNullableAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/omit.mjs
function OmitDeferred(type, indexer, options = {}) {
  return Deferred("Omit", [type, indexer], options);
}
function Omit(type, indexer_or_keys, options = {}) {
  const indexer = guard_exports.IsArray(indexer_or_keys) ? KeysToIndexer(indexer_or_keys) : indexer_or_keys;
  return OmitAction(type, indexer, options);
}

// node_modules/typebox/build/type/engine/indexable/to_indexable.mjs
function ToIndexable(type) {
  const collapsed = CollapseToObject(type);
  const result = IsObject2(collapsed) ? collapsed.properties : Unreachable();
  return result;
}

// node_modules/typebox/build/type/engine/omit/from_type.mjs
function FromKeys(properties, keys) {
  const result = guard_exports.Keys(properties).reduce((result2, key) => {
    return keys.includes(key) ? result2 : { ...result2, [key]: properties[key] };
  }, {});
  return result;
}
function FromType14(type, indexer) {
  const indexable = ToIndexable(type);
  const indexableKeys = ToIndexableKeys(indexer);
  const omitted = FromKeys(indexable, indexableKeys);
  const result = _Object_(omitted);
  return result;
}

// node_modules/typebox/build/type/engine/omit/instantiate.mjs
function OmitAction(type, indexer, options) {
  const result = CanInstantiate([type, indexer]) ? memory_exports.Update(FromType14(type, indexer), {}, options) : OmitDeferred(type, indexer, options);
  return result;
}
function OmitInstantiate(context, state, type, indexer, options) {
  const instantiatedType = InstantiateType(context, state, type);
  const instantiatedIndexer = InstantiateType(context, state, indexer);
  return OmitAction(instantiatedType, instantiatedIndexer, options);
}

// node_modules/typebox/build/type/action/parameters.mjs
function ParametersDeferred(type, options = {}) {
  return Deferred("Parameters", [type], options);
}
function Parameters(type, options = {}) {
  return ParametersAction(type, options);
}

// node_modules/typebox/build/type/engine/parameters/instantiate.mjs
function ParametersOperation(type) {
  const parameters = IsFunction2(type) ? type["parameters"] : [];
  const instantiatedParameters = InstantiateElements({}, State([], []), parameters);
  const result = Tuple(instantiatedParameters);
  return result;
}
function ParametersAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(ParametersOperation(type), {}, options) : ParametersDeferred(type, options);
  return result;
}
function ParametersInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return ParametersAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/partial.mjs
function PartialDeferred(type, options = {}) {
  return Deferred("Partial", [type], options);
}
function Partial(type, options = {}) {
  return PartialAction(type, options);
}

// node_modules/typebox/build/type/engine/partial/from_cyclic.mjs
function FromCyclic3(defs, ref) {
  const target = CyclicTarget(defs, ref);
  const partial = FromType15(target);
  const result = Cyclic(memory_exports.Assign(defs, { [ref]: partial }), ref);
  return result;
}

// node_modules/typebox/build/type/engine/partial/from_dependent.mjs
function FromDependent3(if_, then_, else_) {
  const evaluated = EvaluateDependent(if_, then_, else_);
  const result = FromType15(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/partial/from_intersect.mjs
function FromIntersect3(types) {
  const evaluated = EvaluateIntersect(types);
  const result = FromType15(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/partial/from_union.mjs
function FromUnion6(types) {
  const result = types.map((type) => FromType15(type));
  return Union(result);
}

// node_modules/typebox/build/type/engine/partial/from_object.mjs
function FromObject6(properties) {
  const mapped = guard_exports.Keys(properties).reduce((result2, left) => {
    return { ...result2, [left]: AddOptional(properties[left]) };
  }, {});
  const result = _Object_(mapped);
  return result;
}

// node_modules/typebox/build/type/engine/partial/from_type.mjs
function FromType15(type) {
  return IsCyclic(type) ? FromCyclic3(type.$defs, type.$ref) : IsDependent(type) ? FromDependent3(type.if, type.then, type.else) : IsIntersect(type) ? FromIntersect3(type.allOf) : IsUnion(type) ? FromUnion6(type.anyOf) : IsObject2(type) ? FromObject6(type.properties) : _Object_({});
}

// node_modules/typebox/build/type/engine/partial/instantiate.mjs
function PartialAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType15(type), {}, options) : PartialDeferred(type, options);
  return result;
}
function PartialInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return PartialAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/pick.mjs
function PickDeferred(type, indexer, options = {}) {
  return Deferred("Pick", [type, indexer], options);
}
function Pick(type, indexer_or_keys, options = {}) {
  const indexer = guard_exports.IsArray(indexer_or_keys) ? KeysToIndexer(indexer_or_keys) : indexer_or_keys;
  return PickAction(type, indexer, options);
}

// node_modules/typebox/build/type/engine/pick/from_type.mjs
function FromKeys2(properties, keys) {
  const result = guard_exports.Keys(properties).reduce((result2, key) => {
    return keys.includes(key) ? memory_exports.Assign(result2, { [key]: properties[key] }) : result2;
  }, {});
  return result;
}
function FromType16(type, indexer) {
  const indexable = ToIndexable(type);
  const keys = ToIndexableKeys(indexer);
  const applied = FromKeys2(indexable, keys);
  const result = _Object_(applied);
  return result;
}

// node_modules/typebox/build/type/engine/pick/instantiate.mjs
function PickAction(type, indexer, options) {
  const result = CanInstantiate([type, indexer]) ? memory_exports.Update(FromType16(type, indexer), {}, options) : PickDeferred(type, indexer, options);
  return result;
}
function PickInstantiate(context, state, type, indexer, options) {
  const instantiatedType = InstantiateType(context, state, type);
  const instantiatedIndexer = InstantiateType(context, state, indexer);
  return PickAction(instantiatedType, instantiatedIndexer, options);
}

// node_modules/typebox/build/type/action/readonly_object.mjs
function ReadonlyObjectDeferred(type, options = {}) {
  return Deferred("ReadonlyObject", [type], options);
}
function ReadonlyObject(type, options = {}) {
  return ReadonlyObjectAction(type, options);
}
var ReadonlyType = ReadonlyObject;

// node_modules/typebox/build/type/engine/readonly_object/from_array.mjs
function FromArray4(type) {
  const result = AddImmutable(_Array_(type));
  return result;
}

// node_modules/typebox/build/type/engine/readonly_object/from_cyclic.mjs
function FromCyclic4(defs, ref) {
  const target = CyclicTarget(defs, ref);
  const partial = FromType17(target);
  const result = Cyclic(memory_exports.Assign(defs, { [ref]: partial }), ref);
  return result;
}

// node_modules/typebox/build/type/engine/readonly_object/from_dependent.mjs
function FromDependent4(if_, then_, else_) {
  const evaluated = EvaluateDependent(if_, then_, else_);
  const result = FromType17(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/readonly_object/from_intersect.mjs
function FromIntersect4(types) {
  const evaluated = EvaluateIntersect(types);
  const result = FromType17(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/readonly_object/from_object.mjs
function FromObject7(properties) {
  const mapped = guard_exports.Keys(properties).reduce((result2, left) => {
    return { ...result2, [left]: AddReadonly(properties[left]) };
  }, {});
  const result = _Object_(mapped);
  return result;
}

// node_modules/typebox/build/type/engine/readonly_object/from_tuple.mjs
function FromTuple4(types) {
  const result = AddImmutable(Tuple(types));
  return result;
}

// node_modules/typebox/build/type/engine/readonly_object/from_union.mjs
function FromUnion7(types) {
  const result = types.map((type) => FromType17(type));
  return Union(result);
}

// node_modules/typebox/build/type/engine/readonly_object/from_type.mjs
function FromType17(type) {
  return IsArray2(type) ? FromArray4(type.items) : IsCyclic(type) ? FromCyclic4(type.$defs, type.$ref) : IsDependent(type) ? FromDependent4(type.if, type.then, type.else) : IsIntersect(type) ? FromIntersect4(type.allOf) : IsObject2(type) ? FromObject7(type.properties) : IsTuple(type) ? FromTuple4(type.items) : IsUnion(type) ? FromUnion7(type.anyOf) : type;
}

// node_modules/typebox/build/type/engine/readonly_object/instantiate.mjs
function ReadonlyObjectAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType17(type), {}, options) : ReadonlyObjectDeferred(type);
  return result;
}
function ReadonlyObjectInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return ReadonlyObjectAction(instantiatedType, options);
}

// node_modules/typebox/build/type/engine/ref/instantiate.mjs
function RefInstantiate(context, state, type, ref) {
  return state.visited.includes(ref) ? type : ref in context ? InstantiateType(context, State(state["callstack"], [...state["visited"], ref]), context[ref]) : type;
}

// node_modules/typebox/build/type/engine/required/from_cyclic.mjs
function FromCyclic5(defs, ref) {
  const target = CyclicTarget(defs, ref);
  const partial = FromType18(target);
  const result = Cyclic(memory_exports.Assign(defs, { [ref]: partial }), ref);
  return result;
}

// node_modules/typebox/build/type/engine/required/from_dependent.mjs
function FromDependent5(if_, then_, else_) {
  const evaluated = EvaluateDependent(if_, then_, else_);
  const result = FromType18(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/required/from_intersect.mjs
function FromIntersect5(types) {
  const evaluated = EvaluateIntersect(types);
  const result = FromType18(evaluated);
  return result;
}

// node_modules/typebox/build/type/engine/required/from_union.mjs
function FromUnion8(types) {
  const result = types.map((type) => FromType18(type));
  return Union(result);
}

// node_modules/typebox/build/type/engine/required/from_object.mjs
function FromObject8(properties) {
  const mapped = guard_exports.Keys(properties).reduce((result2, left) => {
    return { ...result2, [left]: RemoveOptional(properties[left]) };
  }, {});
  const result = _Object_(mapped);
  return result;
}

// node_modules/typebox/build/type/engine/required/from_type.mjs
function FromType18(type) {
  return IsCyclic(type) ? FromCyclic5(type.$defs, type.$ref) : IsDependent(type) ? FromDependent5(type.if, type.then, type.else) : IsIntersect(type) ? FromIntersect5(type.allOf) : IsUnion(type) ? FromUnion8(type.anyOf) : IsObject2(type) ? FromObject8(type.properties) : _Object_({});
}

// node_modules/typebox/build/type/action/required.mjs
function RequiredDeferred(type, options = {}) {
  return Deferred("Required", [type], options);
}
function Required(type, options = {}) {
  return RequiredAction(type, options);
}

// node_modules/typebox/build/type/engine/required/instantiate.mjs
function RequiredAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(FromType18(type), {}, options) : RequiredDeferred(type, options);
  return result;
}
function RequiredInstantiate(context, state, type, options) {
  const instaniatedType = InstantiateType(context, state, type);
  return RequiredAction(instaniatedType, options);
}

// node_modules/typebox/build/type/action/return_type.mjs
function ReturnTypeDeferred(type, options = {}) {
  return Deferred("ReturnType", [type], options);
}
function ReturnType(type, options = {}) {
  return ReturnTypeAction(type, options);
}

// node_modules/typebox/build/type/engine/return_type/instantiate.mjs
function ReturnTypeOperation(type) {
  return IsFunction2(type) ? type["returnType"] : Never();
}
function ReturnTypeAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(ReturnTypeOperation(type), {}, options) : ReturnTypeDeferred(type, options);
  return result;
}
function ReturnTypeInstantiate(context, state, type, options = {}) {
  const instantiatedType = InstantiateType(context, state, type);
  return ReturnTypeAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/with.mjs
function WithDeferred(type, options) {
  return Deferred("With", [type, options], {});
}
function With2(type, options) {
  return WithAction(type, options);
}

// node_modules/typebox/build/type/engine/with/instantiate.mjs
function WithAction(type, options) {
  const result = CanInstantiate([type]) ? memory_exports.Update(type, {}, options) : WithDeferred(type, options);
  return result;
}
function WithInstantiate(context, state, type, options) {
  const instaniatedType = InstantiateType(context, state, type);
  return WithAction(instaniatedType, options);
}

// node_modules/typebox/build/type/engine/rest/spread.mjs
function SpreadElement(type) {
  const result = IsRest(type) ? IsTuple(type.items) ? RestSpread(type.items.items) : IsInfer(type.items) ? [type] : IsRef(type.items) ? [type] : [Never()] : [type];
  return result;
}
function RestSpread(types) {
  const result = types.reduce((result2, left) => {
    return [...result2, ...SpreadElement(left)];
  }, []);
  return result;
}

// node_modules/typebox/build/type/engine/instantiate.mjs
function State(callstack, visited) {
  return { callstack, visited };
}
function CanInstantiate(types) {
  return guard_exports.ShiftLeft(types, (left, right) => IsRef(left) ? false : CanInstantiate(right), () => true);
}
function InstantiateProperties(context, state, properties) {
  return guard_exports.Keys(properties).reduce((result, key) => {
    return { ...result, [key]: InstantiateType(context, state, properties[key]) };
  }, {});
}
function InstantiateElements(context, state, types) {
  const elements = InstantiateTypes(context, state, types);
  const result = RestSpread(elements);
  return result;
}
function InstantiateTypes(context, state, types) {
  return types.map((type) => InstantiateType(context, state, type));
}
function WithModifiers(type, instantiatedType) {
  const withOptional = IsOptional(type) ? AddOptionalAction(instantiatedType, {}) : instantiatedType;
  const withReadonly = IsReadonly(type) ? AddReadonlyAction(withOptional, {}) : withOptional;
  const withImmutable = IsImmutable(type) ? AddImmutableAction(withReadonly, {}) : withReadonly;
  return withImmutable;
}
function InstantiateDeferred(context, state, action, parameters, options) {
  return (
    // Modifiers
    guard_exports.IsEqual(action, "AddImmutable") ? AddImmutableInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "RemoveImmutable") ? RemoveImmutableInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "AddReadonly") ? AddReadonlyInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "RemoveReadonly") ? RemoveReadonlyInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "AddOptional") ? AddOptionalInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "RemoveOptional") ? RemoveOptionalInstantiate(context, state, parameters[0], options) : (
      // Actions
      guard_exports.IsEqual(action, "Capitalize") ? CapitalizeInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Conditional") ? ConditionalInstantiate(context, state, parameters[0], parameters[1], parameters[2], parameters[3], options) : guard_exports.IsEqual(action, "ConstructorParameters") ? ConstructorParametersInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Evaluate") ? EvaluateInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Exclude") ? ExcludeInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "Extract") ? ExtractInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "Index") ? IndexInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "InstanceType") ? InstanceTypeInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Interface") ? InterfaceInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "KeyOf") ? KeyOfInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Lowercase") ? LowercaseInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Mapped") ? MappedInstantiate(context, state, parameters[0], parameters[1], parameters[2], parameters[3], options) : guard_exports.IsEqual(action, "Module") ? ModuleInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "NonNullable") ? NonNullableInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Pick") ? PickInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "Parameters") ? ParametersInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Partial") ? PartialInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Omit") ? OmitInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "ReadonlyObject") ? ReadonlyObjectInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Record") ? RecordInstantiate(context, state, parameters[0], parameters[1], options) : guard_exports.IsEqual(action, "Required") ? RequiredInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "ReturnType") ? ReturnTypeInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "TemplateLiteral") ? TemplateLiteralInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Uncapitalize") ? UncapitalizeInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "Uppercase") ? UppercaseInstantiate(context, state, parameters[0], options) : guard_exports.IsEqual(action, "With") ? WithInstantiate(context, state, parameters[0], parameters[1]) : Deferred(action, parameters, options)
    )
  );
}
function InstantiateImmediate(context, state, type) {
  const instantiatedType = IsRef(type) ? RefInstantiate(context, state, type, type.$ref) : IsArray2(type) ? _Array_(InstantiateType(context, state, type.items), ArrayOptions(type)) : IsCall(type) ? CallInstantiate(context, state, type.target, type.arguments) : IsConstructor2(type) ? Constructor(InstantiateTypes(context, state, type.parameters), InstantiateType(context, state, type.instanceType), ConstructorOptions(type)) : IsFunction2(type) ? _Function_(InstantiateTypes(context, state, type.parameters), InstantiateType(context, state, type.returnType), FunctionOptions(type)) : IsDependent(type) ? Dependent(InstantiateType(context, state, type.if), InstantiateType(context, state, type.then), InstantiateType(context, state, type.else), DependentOptions(type)) : IsIntersect(type) ? Intersect(InstantiateTypes(context, state, type.allOf), IntersectOptions(type)) : IsObject2(type) ? _Object_(InstantiateProperties(context, state, type.properties), ObjectOptions(type)) : IsRecord(type) ? RecordFromPattern(RecordPattern(type), InstantiateType(context, state, RecordValue(type))) : IsRest(type) ? Rest(InstantiateType(context, state, type.items)) : IsTuple(type) ? Tuple(InstantiateElements(context, state, type.items), TupleOptions(type)) : IsUnion(type) ? Union(InstantiateTypes(context, state, type.anyOf), UnionOptions(type)) : type;
  const withModifiers = WithModifiers(type, instantiatedType);
  return withModifiers;
}
function InstantiateType(context, state, type) {
  const result = IsDeferred(type) ? InstantiateDeferred(context, state, type.action, type.parameters, type.options) : InstantiateImmediate(context, state, type);
  return result;
}
function Instantiate(context, type) {
  return InstantiateType(context, State([], []), type);
}

// node_modules/typebox/build/type/engine/immutable/instantiate_add.mjs
function AddImmutableOperation(type) {
  return memory_exports.Update(type, { "~immutable": true }, {});
}
function AddImmutableAction(type, options) {
  const result = memory_exports.Update(AddImmutableOperation(type), {}, options);
  return result;
}
function AddImmutableInstantiate(context, state, type, options) {
  const instantiatedType = InstantiateType(context, state, type);
  return AddImmutableAction(instantiatedType, options);
}

// node_modules/typebox/build/type/action/_add_immutable.mjs
function AddImmutableDeferred(type, options = {}) {
  return Deferred("AddImmutable", [type], options);
}
function AddImmutable(type, options = {}) {
  return AddImmutableAction(type, options);
}

// node_modules/typebox/build/type/action/evaluate.mjs
function EvaluateDeferred(type, options = {}) {
  return Deferred("Evaluate", [type], options);
}
function Evaluate(type, options = {}) {
  return EvaluateAction(type, options);
}

// node_modules/typebox/build/type/action/module.mjs
function ModuleDeferred(declarations, options = {}) {
  return Deferred("Module", [declarations], options);
}
function Module2(declarations, options = {}) {
  return ModuleInstantiate({}, State([], []), declarations, options);
}

// node_modules/typebox/build/type/script/script.mjs
function Script2(...args) {
  const [context, input, options] = arguments_exports.Match(args, {
    2: (script, options2) => guard_exports.IsString(script) ? [{}, script, options2] : [script, options2, {}],
    3: (context2, script, options2) => [context2, script, options2],
    1: (script) => [{}, script, {}]
  });
  const result = Script(input);
  const parsed = guard_exports.IsArray(result) && guard_exports.IsEqual(result.length, 2) ? InstantiateType(context, State([], []), result[0]) : Never();
  return memory_exports.Update(parsed, {}, options);
}

// node_modules/typebox/build/typebox.mjs
var typebox_exports = {};
__export(typebox_exports, {
  Any: () => Any,
  Array: () => _Array_,
  BigInt: () => BigInt2,
  Boolean: () => Boolean2,
  Call: () => Call,
  Capitalize: () => Capitalize,
  Codec: () => Codec,
  Conditional: () => Conditional,
  Constructor: () => Constructor,
  ConstructorParameters: () => ConstructorParameters,
  Cyclic: () => Cyclic,
  Decode: () => Decode,
  DecodeBuilder: () => DecodeBuilder,
  Dependent: () => Dependent,
  Encode: () => Encode,
  EncodeBuilder: () => EncodeBuilder,
  Enum: () => Enum,
  Evaluate: () => Evaluate,
  Exclude: () => Exclude,
  Extends: () => Extends,
  ExtendsResult: () => result_exports,
  Extract: () => Extract,
  Function: () => _Function_,
  Generic: () => Generic,
  Identifier: () => Identifier,
  Immutable: () => Immutable,
  Index: () => Index,
  Infer: () => Infer,
  InstanceType: () => InstanceType,
  Instantiate: () => Instantiate,
  Integer: () => Integer,
  Interface: () => Interface,
  Intersect: () => Intersect,
  IsAny: () => IsAny,
  IsArray: () => IsArray2,
  IsBigInt: () => IsBigInt2,
  IsBoolean: () => IsBoolean3,
  IsCall: () => IsCall,
  IsCodec: () => IsCodec,
  IsConstructor: () => IsConstructor2,
  IsCyclic: () => IsCyclic,
  IsDependent: () => IsDependent,
  IsEnum: () => IsEnum,
  IsEnumValue: () => IsEnumValue,
  IsFunction: () => IsFunction2,
  IsGeneric: () => IsGeneric,
  IsIdentifier: () => IsIdentifier,
  IsImmutable: () => IsImmutable,
  IsInfer: () => IsInfer,
  IsInteger: () => IsInteger2,
  IsIntersect: () => IsIntersect,
  IsKind: () => IsKind,
  IsLiteral: () => IsLiteral,
  IsNever: () => IsNever,
  IsNull: () => IsNull2,
  IsNumber: () => IsNumber3,
  IsObject: () => IsObject2,
  IsOptional: () => IsOptional,
  IsParameter: () => IsParameter,
  IsReadonly: () => IsReadonly,
  IsRecord: () => IsRecord,
  IsRef: () => IsRef,
  IsRefine: () => IsRefine,
  IsRest: () => IsRest,
  IsSchema: () => IsSchema,
  IsString: () => IsString3,
  IsSymbol: () => IsSymbol2,
  IsTemplateLiteral: () => IsTemplateLiteral,
  IsThis: () => IsThis,
  IsTuple: () => IsTuple,
  IsUndefined: () => IsUndefined2,
  IsUnion: () => IsUnion,
  IsUnknown: () => IsUnknown,
  IsUnsafe: () => IsUnsafe,
  IsVoid: () => IsVoid,
  KeyOf: () => KeyOf2,
  Literal: () => Literal,
  Lowercase: () => Lowercase,
  Mapped: () => Mapped,
  Module: () => Module2,
  Never: () => Never,
  NonNullable: () => NonNullable,
  Null: () => Null,
  Number: () => Number2,
  Object: () => _Object_,
  Omit: () => Omit,
  Optional: () => Optional,
  Parameter: () => Parameter,
  Parameters: () => Parameters,
  Partial: () => Partial,
  Pick: () => Pick,
  Readonly: () => Readonly,
  ReadonlyObject: () => ReadonlyObject,
  ReadonlyType: () => ReadonlyType,
  Record: () => Record,
  RecordKey: () => RecordKey,
  RecordPattern: () => RecordPattern,
  RecordValue: () => RecordValue,
  Ref: () => Ref,
  Refine: () => Refine,
  Required: () => Required,
  Rest: () => Rest,
  ReturnType: () => ReturnType,
  Script: () => Script2,
  String: () => String2,
  Symbol: () => Symbol2,
  TemplateLiteral: () => TemplateLiteral2,
  This: () => This,
  Tuple: () => Tuple,
  Uncapitalize: () => Uncapitalize,
  Undefined: () => Undefined,
  Union: () => Union,
  Unknown: () => Unknown,
  Unsafe: () => Unsafe,
  Uppercase: () => Uppercase,
  Void: () => Void,
  With: () => With2
});

// src/lib.ts
import { spawn as spawn2 } from "node:child_process";
import { createHash } from "node:crypto";
import { globSync, readFileSync as readFileSync5 } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join as join5, resolve as resolvePath } from "node:path";
var MAX_OUTPUT_BYTES = 50 * 1024;
var MAX_OUTPUT_LINES = 2e3;
var SESSION_APPROVAL_TTL_MS = Number.POSITIVE_INFINITY;
var SUDO_APPROVAL_TTL_MS = 30 * 6e4;
function hostApproved(map, key, now = Date.now(), ttlMs = SESSION_APPROVAL_TTL_MS) {
  const expiry = map.get(key);
  if (expiry === void 0) return false;
  if (now >= expiry) {
    map.delete(key);
    return false;
  }
  return true;
}
function markHostApproved(map, key, now = Date.now(), ttlMs = SESSION_APPROVAL_TTL_MS) {
  map.set(key, ttlMs === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : now + ttlMs);
}
function commandEscalatesPrivilege(command) {
  return /(^|[\s;&|(])(sudo|su|doas|pkexec)\b/.test(command);
}
var DEFAULT_SSH_RUN_CONFIG = {
  confirm: true
};
var DEFAULT_SSH_RUN_CONFIG_PATH = join5(homedir(), ".pi", "agent", "ssh.json");
function loadSshConfig(path = DEFAULT_SSH_RUN_CONFIG_PATH) {
  let text;
  try {
    text = readFileSync5(path, "utf8");
  } catch {
    return DEFAULT_SSH_RUN_CONFIG;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`ssh_run: ignoring malformed ${path}: ${msg}
`);
    return DEFAULT_SSH_RUN_CONFIG;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    process.stderr.write(`ssh_run: ignoring ${path} \u2014 expected JSON object
`);
    return DEFAULT_SSH_RUN_CONFIG;
  }
  const obj = parsed;
  if (!("confirm" in obj)) return DEFAULT_SSH_RUN_CONFIG;
  if (typeof obj.confirm !== "boolean") {
    process.stderr.write(`ssh_run: ignoring ${path} \u2014 "confirm" must be boolean
`);
    return DEFAULT_SSH_RUN_CONFIG;
  }
  let defaultIdentityFile;
  if ("defaultIdentityFile" in obj) {
    if (typeof obj.defaultIdentityFile !== "string" || obj.defaultIdentityFile.length === 0) {
      process.stderr.write(`ssh_run: ignoring ${path} \u2014 "defaultIdentityFile" must be non-empty string
`);
    } else {
      defaultIdentityFile = obj.defaultIdentityFile;
    }
  }
  let sudoConfirm;
  if ("sudoConfirm" in obj) {
    if (typeof obj.sudoConfirm !== "boolean") {
      process.stderr.write(`ssh_run: ignoring ${path} \u2014 "sudoConfirm" must be boolean
`);
    } else {
      sudoConfirm = obj.sudoConfirm;
    }
  }
  return { confirm: obj.confirm, defaultIdentityFile, sudoConfirm };
}
var CONTROL_PERSIST_SECONDS = 120;
var CONNECT_TIMEOUT_SECONDS = 10;
function transferApprovalDecision(mode, loginPasswordMissing) {
  if (mode === "off") return "ask";
  return loginPasswordMissing ? "deny" : "allow";
}
function parseHost(spec) {
  const trimmed = spec.trim();
  if (!trimmed) throw new Error("Empty host");
  let user;
  let rest = trimmed;
  const at = rest.lastIndexOf("@");
  if (at !== -1) {
    user = rest.slice(0, at) || void 0;
    rest = rest.slice(at + 1);
  }
  let port;
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
  }
  if (!rest) throw new Error(`Invalid host: ${spec}`);
  return { user, host: rest, ...port !== void 0 ? { port } : {} };
}
function parsePort(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return n;
}
function parseSshConfig(output) {
  const values = new Map(
    output.split("\n").map((line) => line.trim().split(/\s+/, 2)).filter((parts) => parts.length === 2)
  );
  const user = values.get("user");
  const host = values.get("hostname");
  const port = values.get("port");
  if (!user || !host || !port) return void 0;
  return { user, host, port: parsePort(port) };
}
function resolveSshHost(spec, signal2) {
  const args = ["-G"];
  if (spec.port !== void 0) args.push("-p", String(spec.port));
  args.push(hostTarget(spec));
  return new Promise((resolve) => {
    let stdout = "";
    const proc = spawn2("ssh", args, { stdio: ["ignore", "pipe", "ignore"] });
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.on("error", () => resolve(spec));
    proc.on("close", (code) => resolve(code === 0 ? parseSshConfig(stdout) ?? spec : spec));
    signal2?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
var INFO_KEYS = {
  hostname: "hostname",
  user: "user",
  port: "port",
  proxyjump: "proxyJump",
  identityfile: "identityFile"
};
function parseHostAliases(text) {
  const out = [];
  let current = [];
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
          if (entry[field] === void 0) entry[field] = value;
        }
      }
    }
  }
  return out;
}
function expandConfigPath(pattern, baseDir) {
  let p = pattern;
  if (p.startsWith("~/")) p = join5(homedir(), p.slice(2));
  else if (p === "~") p = homedir();
  return isAbsolute(p) ? p : resolvePath(baseDir, p);
}
function readSshConfigAliases(path = join5(homedir(), ".ssh", "config"), seen = /* @__PURE__ */ new Set()) {
  if (seen.has(path)) return [];
  seen.add(path);
  let text;
  try {
    text = readFileSync5(path, "utf8");
  } catch {
    return [];
  }
  const baseDir = join5(homedir(), ".ssh");
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    const [keyRaw, ...rest] = line.split(/\s+/);
    if ((keyRaw ?? "").toLowerCase() === "include") {
      for (const pattern of rest) {
        const expanded = expandConfigPath(pattern, baseDir);
        let matches = [];
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
function parseHostInfo(output) {
  const info = {};
  for (const line of output.split("\n")) {
    const [keyRaw, ...rest] = line.trim().split(/\s+/);
    const field = INFO_KEYS[(keyRaw ?? "").toLowerCase()];
    const value = rest.join(" ");
    if (field && value && info[field] === void 0) info[field] = value;
  }
  return info;
}
function resolveHostInfo(spec, signal2) {
  const args = ["-G"];
  if (spec.port !== void 0) args.push("-p", String(spec.port));
  args.push(hostTarget(spec));
  return new Promise((resolve) => {
    let stdout = "";
    const proc = spawn2("ssh", args, { stdio: ["ignore", "pipe", "ignore"] });
    proc.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    proc.on("error", () => resolve({}));
    proc.on("close", (code) => resolve(code === 0 ? parseHostInfo(stdout) : {}));
    signal2?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
function hostTarget(spec) {
  return spec.user ? `${spec.user}@${spec.host}` : spec.host;
}
function controlPathFor(spec) {
  const key = `${spec.user ?? ""}@${spec.host}:${spec.port ?? 22}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  return join5(tmpdir(), `pix-ssh-${hash}.sock`);
}
var identityFileOverride;
function setIdentityFileOverride(path) {
  identityFileOverride = path;
}
function connectionArgs(spec, controlPath, portFlag) {
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
    "StrictHostKeyChecking=accept-new"
  ];
  if (identityFileOverride) {
    args.push("-i", identityFileOverride, "-o", "IdentitiesOnly=yes");
  }
  if (spec.port !== void 0) args.push(portFlag, String(spec.port));
  return args;
}
function baseSshArgs(spec, controlPath) {
  return connectionArgs(spec, controlPath, "-p");
}
function baseScpArgs(spec, controlPath, recursive) {
  return [...connectionArgs(spec, controlPath, "-P"), ...recursive ? ["-r"] : []];
}
function remoteTransferPath(spec, path) {
  const host = spec.host.includes(":") ? `[${spec.host}]` : spec.host;
  return `${spec.user ? `${spec.user}@` : ""}${host}:${path}`;
}
function transferArgs(spec, direction, source, destination) {
  return direction === "upload" ? [source, remoteTransferPath(spec, destination)] : [remoteTransferPath(spec, source), destination];
}
function remoteCommand(command, sudo) {
  if (!sudo) return command;
  return `sudo -S -p '' -- sh -c ${shellQuote(command)}`;
}
function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
function detectSshFailure(code, stderr) {
  if (code === 0) return false;
  const lower = stderr.toLowerCase();
  return lower.includes("permission denied") || lower.includes("connection refused") || lower.includes("connection timed out") || lower.includes("could not resolve hostname") || lower.includes("no route to host") || lower.includes("host key verification failed");
}
function detectSudoFailure(stderr) {
  const lower = stderr.toLowerCase();
  return lower.includes("incorrect password") || lower.includes("sudo: a password is required") || lower.includes("authentication failure") || lower.includes("sorry, try again");
}
function filterSudoPrompt(raw) {
  return raw.split("\n").filter((l) => !/^\s*(\[sudo\] )?password( for .*)?:?\s*$/i.test(l)).join("\n");
}
function truncate(text, maxLines = MAX_OUTPUT_LINES, maxBytes = MAX_OUTPUT_BYTES) {
  const lines = text.split("\n");
  const byteLen = Buffer.byteLength(text, "utf8");
  if (lines.length <= maxLines && byteLen <= maxBytes) {
    return { text, truncated: false };
  }
  const kept = lines.slice(0, maxLines);
  let result = kept.join("\n");
  if (Buffer.byteLength(result, "utf8") > maxBytes) {
    result = Buffer.from(result, "utf8").subarray(0, maxBytes).toString("utf8");
  }
  return { text: result, truncated: true };
}
function probeKeyAuth(spec, controlPath, signal2) {
  const args = [...baseSshArgs(spec, controlPath), "-o", "BatchMode=yes", hostTarget(spec), "true"];
  return new Promise((resolve) => {
    let stderr = "";
    const proc = spawn2("ssh", args, { stdio: ["ignore", "ignore", "pipe"] });
    proc.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("error", () => resolve("unreachable"));
    proc.on("close", (code) => {
      if (code === 0) return resolve("ok");
      if (isUnreachable(stderr)) return resolve("unreachable");
      resolve("auth");
    });
    signal2?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
function probePasswordAuth(spec, controlPath, password, signal2) {
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
    "true"
  ];
  return new Promise((resolve) => {
    let stderr = "";
    const proc = spawn2("sshpass", args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, SSHPASS: password }
    });
    proc.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("error", () => resolve(true));
    proc.on("close", (code) => {
      if (code === 0) return resolve(true);
      if (isUnreachable(stderr)) return resolve(true);
      resolve(false);
    });
    signal2?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
function probeSudoNoPassword(spec, controlPath, signal2) {
  const args = [
    ...baseSshArgs(spec, controlPath),
    "-o",
    "BatchMode=yes",
    hostTarget(spec),
    "sudo -n true"
  ];
  return new Promise((resolve) => {
    const proc = spawn2("ssh", args, { stdio: ["ignore", "ignore", "ignore"] });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
    signal2?.addEventListener("abort", () => proc.kill("SIGTERM"), { once: true });
  });
}
function isUnreachable(stderr) {
  const lower = stderr.toLowerCase();
  return lower.includes("connection timed out") || lower.includes("connection refused") || lower.includes("could not resolve hostname") || lower.includes("no route to host") || lower.includes("network is unreachable") || lower.includes("operation timed out");
}
function runTransfer(spec, direction, source, destination, recursive, opts) {
  const endpoint = ["--", ...transferArgs(spec, direction, source, destination)];
  const bin = opts.loginPassword ? "sshpass" : "scp";
  const args = opts.loginPassword ? ["-e", "scp", ...baseScpArgs(spec, opts.controlPath, recursive), ...endpoint] : [...baseScpArgs(spec, opts.controlPath, recursive), "-o", "BatchMode=yes", ...endpoint];
  const env = opts.loginPassword ? { ...process.env, SSHPASS: opts.loginPassword } : process.env;
  return spawnResult(bin, args, env, opts.signal);
}
function buildRunSshArgs(spec, command, opts) {
  const remote = remoteCommand(command, opts.sudo === true);
  const base = baseSshArgs(spec, opts.controlPath);
  if (opts.loginPassword) {
    return { bin: "sshpass", args: ["-e", "ssh", ...base, hostTarget(spec), remote] };
  }
  return { bin: "ssh", args: [...base, "-o", "BatchMode=yes", hostTarget(spec), remote] };
}
function runSsh(spec, command, opts) {
  const { bin, args } = buildRunSshArgs(spec, command, opts);
  const env = opts.loginPassword ? { ...process.env, SSHPASS: opts.loginPassword } : process.env;
  const stdin = opts.sudo && opts.sudoPassword !== void 0 ? `${opts.sudoPassword}
` : void 0;
  return spawnResult(bin, args, env, opts.signal, opts.sudo ? filterSudoPrompt : void 0, stdin);
}
function spawnResult(bin, args, env, sig, filterStderr, stdin) {
  return new Promise((resolve, reject) => {
    const proc = spawn2(bin, args, { stdio: ["pipe", "pipe", "pipe"], env });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (c) => {
      stdout += c.toString();
    });
    proc.stderr.on("data", (c) => {
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
function signal(sig, proc, reject) {
  sig?.addEventListener(
    "abort",
    () => {
      proc.kill("SIGTERM");
      reject(new Error("Cancelled"));
    },
    { once: true }
  );
}

// src/index.ts
var PROMPT_TIMEOUT_MS = 6e4;
var MAX_PASSWORD_ATTEMPTS = 3;
var SPINNER_INTERVAL_MS = 120;
var credCache = /* @__PURE__ */ new Map();
var sshRunConfig = loadSshConfig();
setIdentityFileOverride(sshRunConfig.defaultIdentityFile);
var approvedHosts = /* @__PURE__ */ new Map();
var approvedSudoHosts = /* @__PURE__ */ new Map();
function cacheKey(spec) {
  return `${spec.user ?? ""}@${spec.host}:${spec.port ?? 22}`;
}
function validatorFor(stage, spec, controlPath, sig) {
  if (stage !== "login") return (pw) => Promise.resolve(pw.trim().length > 0);
  return (pw) => pw.trim().length === 0 ? Promise.resolve(false) : probePasswordAuth(spec, controlPath, pw, sig);
}
function normalizeOperation(params) {
  if (params.action === "file") {
    const source = (params.source ?? "").trim();
    const destination = (params.destination ?? "").trim();
    return {
      action: "file",
      command: `${params.direction ?? ""} ${source || "(empty source)"} \u2192 ${destination || "(empty destination)"}`,
      sudo: false,
      reason: params.reason,
      direction: params.direction,
      source,
      destination,
      recursive: params.recursive === true
    };
  }
  return {
    action: "command",
    command: params.command ?? "",
    sudo: params.sudo === true,
    reason: params.reason,
    source: "",
    destination: "",
    recursive: false
  };
}
function approvalBody(operation, host, port) {
  const { action, command, destination, direction, reason, recursive, source, sudo } = operation;
  return [
    reason?.trim() ? `Intent: ${reason.trim()}` : "No reason provided by AI",
    `Host: ${host}${port ? ` (port ${port})` : ""}`,
    ...action === "command" ? [`Command: ${sudo ? "sudo " : ""}${command}`] : [
      `Direction: ${direction === "download" ? "Download" : "Upload"}`,
      `From: ${source}`,
      `To: ${destination}`,
      `Mode: ${recursive ? "Recursive copy" : "Single item"}`,
      "Warning: existing destination may be overwritten"
    ]
  ];
}
function safeOneLine(value) {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ").replace(/\s+/g, " ").trim();
}
function makeDetails(command, host, sudo, reason, fields) {
  return {
    _type: "sshResult",
    command,
    host,
    sudo,
    ...reason?.trim() ? { reason: reason.trim() } : {},
    ...fields
  };
}
function outputLineCount(output) {
  const normalized = normalizeLineEndings(output).replace(/^\n+|\n+$/g, "");
  return normalized ? normalized.split("\n").length : 0;
}
function updatePresentation(onUpdate, command, host, sudo, reason, outcome, message) {
  onUpdate?.({
    content: [
      {
        type: "text",
        text: message ?? (outcome === "awaiting-approval" ? "Awaiting approval\u2026" : `Running on ${host}\u2026`)
      }
    ],
    details: makeDetails(command, host, sudo, reason, { outcome })
  });
}
function terminalMeta(details) {
  if (details.outcome === "denied") return "denied";
  if (details.outcome === "timed-out") return "timed out";
  if (details.outcome === "cancelled") return "cancelled";
  if (details.errorKind === "no-ui") return "interactive session required";
  if (details.errorKind === "auth-ssh") return "ssh auth failed";
  if (details.errorKind === "auth-sudo") return "sudo auth failed";
  if (details.errorKind === "execution" || details.errorKind === "no-result") return "failed";
  const hasLines = typeof details.lineCount === "number" && details.lineCount > 0;
  return dotJoin([
    typeof details.exitCode === "number" && `exit ${details.exitCode}`,
    hasLines && `${details.lineCount} ${details.lineCount === 1 ? "line" : "lines"}`,
    details.truncated && "truncated"
  ]);
}
function isTerminal(details) {
  return details.outcome !== "awaiting-approval" && details.outcome !== "running";
}
function cancelResult(command, host, sudo, reason, action) {
  const cancellationKind = action === "timeout" ? "timeout" : action === "denied" ? "denied" : "missing-password";
  const outcome = cancellationKind === "timeout" ? "timed-out" : cancellationKind === "denied" ? "denied" : "cancelled";
  const msg = outcome === "timed-out" ? "Timed out \u2014 auto-denied." : outcome === "denied" ? "Denied by user." : "Cancelled \u2014 no password entered.";
  return {
    content: [{ type: "text", text: `Cancelled \u2014 ${msg}` }],
    details: makeDetails(command, host, sudo, reason, { outcome, cancellationKind })
  };
}
function formatHostInfo(host, info) {
  const rows = [
    ["HostName", info.hostname],
    ["User", info.user],
    ["Port", info.port],
    ["ProxyJump", info.proxyJump && info.proxyJump !== "none" ? info.proxyJump : void 0],
    ["IdentityFile", info.identityFile]
  ].filter((r) => Boolean(r[1]));
  if (rows.length === 0) return `No SSH config found for ${host}.`;
  return [`Effective SSH config for ${host}:`, ...rows.map(([k, v]) => `  ${k} ${v}`)].join("\n");
}
function formatAliasList(aliases) {
  if (aliases.length === 0) {
    return "No SSH host aliases found in ~/.ssh/config.";
  }
  const seen = /* @__PURE__ */ new Set();
  const lines = [];
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
    lines.push(`  ${a.alias}${target ? ` \u2192 ${target}` : ""}${via}`);
  }
  return [`SSH host aliases (${lines.length}):`, ...lines].join("\n");
}
async function infoResult(host, sig) {
  const details = { _type: "sshInfo" };
  if (host?.trim()) {
    let spec;
    try {
      spec = parseHost(host);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `ssh_run failed: ${msg}` }],
        details,
        isError: true
      };
    }
    const text = formatHostInfo(hostTarget(spec), await resolveHostInfo(spec, sig));
    return { content: [{ type: "text", text }], details };
  }
  return {
    content: [{ type: "text", text: formatAliasList(readSshConfigAliases()) }],
    details
  };
}
function index_default(pi) {
  pi.registerTool({
    name: "ssh_run",
    label: "Run over SSH",
    description: 'Run a command or transfer files/directories on a REMOTE host over SSH. For the LOCAL machine use `bash` (or `sudo_run` for local root) instead \u2014 do not use ssh_run for local work. Requires a `host`. Windows/PowerShell shells are best-effort (elevation and PowerShell stream/encoding semantics unsupported). Set `sudo: true` to run the command as root on the remote machine. For transfer, set `action: "file"`, `direction`, `source`, `destination`, and optional `recursive` \u2014 transfers may overwrite the destination. To discover hosts without reading `~/.ssh/config`, use `action: "info"` \u2014 omit `host` to list configured aliases, or pass a `host` to get its effective config (no connection). Always provide a clear `reason`.',
    promptSnippet: "Run a remote command, transfer files, or read SSH config over SSH",
    promptGuidelines: [
      'ssh_run: REMOTE host only \u2014 use `bash`/`sudo_run` for the local machine. `host` as `[user@]host[:port]`; `sudo` covers remote POSIX sudo only. For transfer use `action: "file"` with `direction: "upload"|"download"`, `source`, `destination`, optional `recursive` (may overwrite). Use `action: "info"` (no `host` = list aliases, with `host` = its effective config) instead of reading `~/.ssh/config` yourself. Always set `reason`.'
    ],
    renderShell: "self",
    // Single Type.Object (root `type: "object"`) rather than Type.Union — a union
    // serializes to `anyOf` with no root type, which strict OpenAI-compatible
    // providers (e.g. DeepSeek) reject with `type: null`. Conditional fields are
    // optional and normalized/validated at runtime via normalizeOperation.
    parameters: typebox_exports.Object({
      action: typebox_exports.Optional(
        typebox_exports.Union([typebox_exports.Literal("command"), typebox_exports.Literal("file"), typebox_exports.Literal("info")], {
          description: '"command" (default) runs a remote command; "file" transfers a file/directory; "info" reports SSH config (no connection) \u2014 list configured host aliases, or resolve one host\'s effective config when `host` is given.'
        })
      ),
      host: typebox_exports.Optional(
        typebox_exports.String({
          description: "Remote target as `[user@]host[:port]` (e.g. `deploy@10.0.0.5:2222`). Required for command/file; for info, omit to list all aliases or set it to resolve one host."
        })
      ),
      command: typebox_exports.Optional(
        typebox_exports.String({
          description: `Command sent to the remote host's configured SSH shell. Required when action is "command".`
        })
      ),
      sudo: typebox_exports.Optional(
        typebox_exports.Boolean({
          description: "Run the command as root on the remote host via sudo. Default false. Command action only."
        })
      ),
      direction: typebox_exports.Optional(
        typebox_exports.Union([typebox_exports.Literal("upload"), typebox_exports.Literal("download")], {
          description: 'Transfer direction. Required when action is "file".'
        })
      ),
      source: typebox_exports.Optional(
        typebox_exports.String({
          description: 'Source path (local for upload, remote for download). Required when action is "file".'
        })
      ),
      destination: typebox_exports.Optional(
        typebox_exports.String({
          description: 'Destination path (remote for upload, local for download). Required when action is "file".'
        })
      ),
      recursive: typebox_exports.Optional(
        typebox_exports.Boolean({
          description: "Copy a directory recursively. Default false. File action only."
        })
      ),
      reason: typebox_exports.Optional(
        typebox_exports.String({
          description: "Short plain-English explanation of intent, shown to the user."
        })
      )
    }),
    async execute(_toolCallId, params, sig, onUpdate, ctx) {
      if (params.action === "info") {
        return infoResult(params.host, sig);
      }
      if (!params.host?.trim()) {
        return {
          content: [{ type: "text", text: "ssh_run failed: host is required" }],
          details: makeDetails("", "", false, params.reason, {
            outcome: "error",
            errorKind: "execution"
          }),
          isError: true
        };
      }
      const operation = normalizeOperation(params);
      const { action, command, destination, direction, reason, recursive, source, sudo } = operation;
      if (action === "file" && (!source || !destination)) {
        return {
          content: [{ type: "text", text: "ssh_run failed: source and destination are required" }],
          details: makeDetails(command, params.host, false, reason, {
            outcome: "error",
            errorKind: "execution"
          }),
          isError: true
        };
      }
      if (action === "command" && !command.trim()) {
        return {
          content: [{ type: "text", text: "ssh_run failed: command is required" }],
          details: makeDetails(command, params.host, sudo, reason, {
            outcome: "error",
            errorKind: "execution"
          }),
          isError: true
        };
      }
      let spec;
      try {
        spec = parseHost(params.host);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `ssh_run failed: ${msg}` }],
          details: makeDetails(command, params.host, sudo, reason, {
            outcome: "error",
            errorKind: "execution"
          }),
          isError: true
        };
      }
      const effectiveSpec = await resolveSshHost(spec, sig);
      const host = hostTarget(effectiveSpec);
      const controlPath = controlPathFor(effectiveSpec);
      const key = cacheKey(effectiveSpec);
      const creds = credCache.get(key) ?? {};
      const mode = getUnattendedMode(pi.events);
      const yolo = mode === "yolo";
      if (action === "command" && mode === "afk") {
        return {
          content: [{ type: "text", text: "ssh_run denied immediately \u2014 AFK mode is active." }],
          details: makeDetails(command, host, sudo, reason, {
            outcome: "denied",
            cancellationKind: "denied"
          })
        };
      }
      if (!ctx.hasUI) {
        return {
          content: [
            { type: "text", text: "ssh_run requires an interactive session (no UI available)." }
          ],
          details: makeDetails(command, host, sudo, reason, {
            outcome: "error",
            errorKind: "no-ui"
          }),
          isError: true
        };
      }
      updatePresentation(onUpdate, command, host, sudo, reason, "awaiting-approval");
      const probe = creds.loginPassword ? "ok" : await probeKeyAuth(spec, controlPath, sig);
      const keyOk = probe === "ok";
      const needLogin = probe === "auth" && !creds.loginPassword;
      const sudoNoPassword = sudo && !creds.sudoPassword && !needLogin && (keyOk || Boolean(creds.loginPassword)) ? await probeSudoNoPassword(spec, controlPath, sig) : false;
      const needSudo = sudo && !creds.sudoPassword && !sudoNoPassword;
      const promptFor = [
        ...needLogin ? ["login"] : [],
        ...needSudo ? ["sudo"] : []
      ];
      const transferDecision = action === "file" ? transferApprovalDecision(mode, needLogin) : "ask";
      if (transferDecision === "deny") {
        return {
          content: [
            {
              type: "text",
              text: "ssh_run file transfer denied \u2014 unattended mode cannot enter a missing SSH login password."
            }
          ],
          details: makeDetails(command, host, false, reason, {
            outcome: "denied",
            cancellationKind: "denied"
          })
        };
      }
      const body = [
        ...approvalBody(operation, host, spec.port),
        ...keyOk && !creds.loginPassword ? ["Auth: SSH key (no password)"] : []
      ];
      const collected = {};
      const privileged = action === "command" && (sudo || commandEscalatesPrivilege(command));
      const sessionAlive = hostApproved(approvedHosts, key, Date.now(), SESSION_APPROVAL_TTL_MS);
      const sudoAlive = hostApproved(approvedSudoHosts, key, Date.now(), SUDO_APPROVAL_TTL_MS);
      const sudoOnlyNoPrompt = promptFor.length === 1 && promptFor[0] === "sudo" && sshRunConfig.sudoConfirm === false;
      const configFullAutoAllow = sshRunConfig.confirm === false && sshRunConfig.sudoConfirm === false;
      const alreadyApproved = action === "command" && (configFullAutoAllow || promptFor.length === 0 || sudoOnlyNoPrompt) && (configFullAutoAllow || !sshRunConfig.confirm || (privileged ? sudoAlive : sessionAlive));
      if (alreadyApproved) {
        let kind;
        if (!sshRunConfig.confirm) {
          kind = sudoOnlyNoPrompt ? "config (confirm:false + sudoConfirm:false)" : "config (confirm:false)";
        } else if (sudoOnlyNoPrompt) {
          kind = "config (sudoConfirm:false)";
        } else if (privileged) {
          kind = "sudo (30-min)";
        } else {
          kind = "session";
        }
        ctx.ui.notify(`ssh_run: auto allow turned on via ${kind} \u2014 ${host}`, "info");
        if (!sshRunConfig.confirm) {
          updatePresentation(
            onUpdate,
            command,
            host,
            sudo,
            reason,
            "running",
            `Auto allow via ${kind} \u2014 running on ${host}\u2026`
          );
        }
      } else if (transferDecision === "allow") {
        ctx.ui.notify(
          `\u26A0 ssh_run file transfer auto-approved \u2014 ${mode.toUpperCase()} warning policy`,
          "warning"
        );
      }
      const runOverlay = () => withAgentBlock(pi.events, "ssh_run", "SSH approval required", async () => {
        if ((transferDecision === "allow" || yolo || alreadyApproved) && (promptFor.length === 0 || sudoOnlyNoPrompt)) {
          return { action: "approved", password: "" };
        }
        if (promptFor.length === 0) {
          return showOverlay(ctx.ui, {
            mode: "confirm",
            icon: action === "file" ? icon("warn") : icon("lock"),
            title: action === "file" ? `SSH ${direction === "download" ? "Download" : "Upload"}` : "SSH Command Request",
            body,
            accent: sudo ? "error" : action === "file" ? "warning" : "accent",
            timeoutMs: PROMPT_TIMEOUT_MS,
            choices: [
              {
                value: "yes",
                label: "Allow",
                description: action === "file" ? "Copy to destination (may overwrite)" : "Run the command"
              },
              {
                value: "no",
                label: "Deny",
                description: action === "file" ? "Cancel transfer" : "Block the command"
              }
            ]
          });
        }
        let last = { action: "approved", password: "" };
        for (const stage of promptFor) {
          const label = stage === "login" ? "SSH login password" : "Remote sudo password";
          last = await showOverlay(ctx.ui, {
            mode: "sudo",
            icon: action === "file" ? icon("warn") : icon("lock"),
            title: action === "file" ? `SSH ${direction === "download" ? "Download" : "Upload"}` : "SSH Command Request",
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
                description: `Enter ${label.toLowerCase()}`
              },
              { value: "no", label: "Deny", description: "Block the command" }
            ]
          });
          if (last.action !== "approved" || !last.password?.trim()) return last;
          if (stage === "login") collected.login = last.password;
          else collected.sudo = last.password;
        }
        return last;
      });
      const overlayResult = alreadyApproved ? { action: "approved", password: "" } : await runOverlay();
      const missing = overlayResult.action === "approved" && (needLogin && !collected.login || needSudo && !collected.sudo);
      if (overlayResult.action !== "approved" || missing) {
        const r = cancelResult(command, host, sudo, reason, overlayResult.action);
        ctx.ui.notify(`\u{1F510} ${r.content[0]?.text}`, "warning");
        return r;
      }
      if (action === "command") {
        if (privileged) {
          markHostApproved(approvedSudoHosts, key, Date.now(), SUDO_APPROVAL_TTL_MS);
        } else {
          markHostApproved(approvedHosts, key, Date.now(), SESSION_APPROVAL_TTL_MS);
        }
      }
      const loginPassword = creds.loginPassword ?? collected.login;
      const sudoPassword = creds.sudoPassword ?? collected.sudo;
      credCache.set(key, {
        ...loginPassword ? { loginPassword } : {},
        ...sudoPassword ? { sudoPassword } : {}
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
          `${SPINNER[spinnerFrame] ?? ""} ${verb} ${host}\u2026`
        );
      };
      if (action === "file") updateTransferPresentation();
      else updatePresentation(onUpdate, command, host, sudo, reason, "running");
      const spinnerTimer = action === "file" && onUpdate ? setInterval(() => {
        spinnerFrame = (spinnerFrame + 1) % SPINNER.length;
        updateTransferPresentation();
      }, SPINNER_INTERVAL_MS) : void 0;
      let result;
      try {
        result = action === "file" ? await runTransfer(spec, direction ?? "upload", source, destination, recursive, {
          controlPath,
          ...loginPassword ? { loginPassword } : {},
          ...sig ? { signal: sig } : {}
        }) : await runSsh(spec, command, {
          controlPath,
          ...loginPassword ? { loginPassword } : {},
          sudo,
          ...sudo ? { sudoPassword: sudoPassword ?? "" } : {},
          ...sig ? { signal: sig } : {}
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `ssh_run failed: ${msg}` }],
          details: makeDetails(
            command,
            host,
            sudo,
            reason,
            sig?.aborted ? { outcome: "cancelled", cancellationKind: "aborted" } : { outcome: "error", errorKind: "execution" }
          ),
          isError: sig?.aborted !== true
        };
      } finally {
        if (spinnerTimer) clearInterval(spinnerTimer);
      }
      if (!result) {
        return {
          content: [{ type: "text", text: "ssh_run failed: command produced no result" }],
          details: makeDetails(command, host, sudo, reason, {
            outcome: "error",
            errorKind: "no-result"
          }),
          isError: true
        };
      }
      if (detectSshFailure(result.code, result.stderr)) {
        credCache.delete(key);
        ctx.ui.notify("\u{1F510} SSH authentication failed", "error");
        return {
          content: [{ type: "text", text: `SSH authentication failed:
${result.stderr}` }],
          details: makeDetails(command, host, sudo, reason, {
            outcome: "error",
            exitCode: result.code,
            lineCount: outputLineCount(result.stderr),
            errorKind: "auth-ssh",
            _render: normalizeLineEndings(result.stderr)
          }),
          isError: true
        };
      }
      if (sudo && detectSudoFailure(result.stderr)) {
        credCache.set(key, loginPassword ? { loginPassword } : {});
        ctx.ui.notify("\u{1F510} Remote sudo authentication failed", "error");
        return {
          content: [{ type: "text", text: `Remote sudo authentication failed:
${result.stderr}` }],
          details: makeDetails(command, host, sudo, reason, {
            outcome: "error",
            exitCode: result.code,
            lineCount: outputLineCount(result.stderr),
            errorKind: "auth-sudo",
            _render: normalizeLineEndings(result.stderr)
          }),
          isError: true
        };
      }
      const combined = [result.stdout, result.stderr].filter(Boolean).join("\n") || "(no output)";
      const { text: truncatedText, truncated } = truncate(combined);
      const suffix = truncated ? `

[Output truncated to ${MAX_OUTPUT_LINES} lines / ${MAX_OUTPUT_BYTES / 1024}KB]` : "";
      const rendered = normalizeLineEndings(combined).replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
      return {
        content: [{ type: "text", text: `Exit code: ${result.code}

${truncatedText}${suffix}` }],
        details: makeDetails(command, host, sudo, reason, {
          outcome: result.code === 0 ? "success" : "error",
          exitCode: result.code,
          lineCount: outputLineCount(rendered),
          truncated,
          ...result.code === 0 ? {} : { errorKind: "exit-code" },
          _render: rendered
        }),
        isError: result.code !== 0
      };
    },
    renderCall: ((args, theme, renderCtx) => {
      resolveBaseBackground(theme);
      const text = renderCtx.lastComponent ?? new Text("", 0, 0);
      if (hideCollapsedToolCall(
        renderCtx.state,
        renderCtx.expanded,
        (value) => text.setText(value)
      ))
        return text;
      const host = safeOneLine(args.host ?? "");
      if (args.action === "info") {
        text.setText(
          fillToolBackground(
            `${theme.fg("toolTitle", theme.bold("ssh info"))} ${theme.fg("dim", host || "list aliases")}`
          )
        );
        return text;
      }
      const operation = normalizeOperation(args);
      const command = safeOneLine(operation.command) || "(empty command)";
      const prefix = operation.sudo ? "sudo " : "";
      text.setText(
        fillToolBackground(
          `${theme.fg("toolTitle", theme.bold(operation.action === "file" ? "ssh file" : "ssh"))} ${theme.fg("dim", host)} ${theme.fg("muted", prefix + command)}`
        )
      );
      return text;
    }),
    renderResult: ((result, _opt, theme, renderCtx) => {
      resolveBaseBackground(theme);
      const text = unframeToolResult(renderCtx.lastComponent ?? new Text("", 0, 0));
      const details = result.details;
      const isPartial = _opt?.isPartial === true;
      const completed = (isError) => frameToolResult(text, theme, isError);
      if (details?._type !== "sshResult") {
        if (renderCtx.isError) {
          text.setText(renderToolError(getTextContent(result) || "Error", theme));
        } else {
          text.setText(
            fillToolBackground(`  ${theme.fg("muted", getTextContent(result) || "done")}`)
          );
        }
        return isPartial ? text : completed(renderCtx.isError);
      }
      if (!isPartial && isTerminal(details) && tickCollapse(
        "ssh",
        renderCtx.state,
        renderCtx.invalidate,
        renderCtx.expanded
      )) {
        const status = details.outcome === "success" ? "success" : "error";
        text.setText(
          renderCollapsedToolRow(
            theme,
            "ssh",
            `${details.host}  ${safeOneLine(details.command)}`,
            terminalMeta(details),
            status
          )
        );
        return text;
      }
      if (details.outcome === "awaiting-approval" || details.outcome === "running") {
        text.setText(
          fillToolBackground(`  ${theme.fg("muted", getTextContent(result) || "working")}`)
        );
        return text;
      }
      if (details.outcome !== "success" && details.errorKind !== "exit-code") {
        const diagnostic = getTextContent(result) || "Error";
        text.setText(
          details.outcome === "error" ? renderToolError(diagnostic, theme) : fillToolBackground(`  ${theme.fg("warning", diagnostic)}`)
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
      const footer = lineCount > maxShow ? [`${FG_DIM}  \u2026 ${lineCount - maxShow} more lines${RST}`] : [];
      const statusKey = details.outcome === "success" ? "success" : "error";
      const paint = (s) => theme.fg(statusKey, s);
      const sw = Math.max(8, termW() - 4);
      const body = show.map((line) => `  ${sectionRule(line, theme, sw) ?? line}`);
      const out = isPartial ? [...body, ...footer] : ruleFrame(body, footer, termW(), paint);
      text.setText(fillToolBackground(out.join("\n")));
      return text;
    })
  });
}
export {
  index_default as default,
  validatorFor
};
