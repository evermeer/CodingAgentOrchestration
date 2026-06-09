import childProcess from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_MIN_COMPACTION_CHARS = 2000
const DEFAULT_ERROR_PREFIXES = ["[error]", "[context-optimizer] error"]
const DEFAULT_PROTECTED_PREFIXES = ["protected:"]
const DEFAULT_MODEL_LIMITS = Object.freeze({})
const AUTO_COMPRESSION_THRESHOLD_CHARS = 4000
const SAFE_CONFIG_KEYS = Object.freeze(["timeout_ms", "min_chars", "model_limits"])

function parseJsonEnv(raw, fallback = {}) {
  if (!raw) return fallback

  if (typeof raw === "object") return raw

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : fallback
  } catch {
    return fallback
  }
}

function matchesPrefix(value, prefixes) {
  return prefixes.some((prefix) => value.toLowerCase().startsWith(prefix.toLowerCase()))
}

export function resolveTimeoutMs() {
  return resolveEffectiveConfig().timeout_ms
}

export function resolveMinCompactionChars() {
  return resolveEffectiveConfig().min_chars
}

function dirnameFromMeta(metaUrl) {
  return path.dirname(fileURLToPath(metaUrl))
}

function resolveLogPath(metaUrl) {
  const pluginDir = dirnameFromMeta(metaUrl)
  // Repo layout: <root>/context-optimizer/plugin/context-optimizer.js
  // Write the log next to the support files instead of a doubled directory.
  if (
    path.basename(pluginDir) === "plugin" &&
    path.basename(path.dirname(pluginDir)) === "context-optimizer"
  ) {
    return path.resolve(pluginDir, "..", "context-optimizer.log")
  }

  // Installed layout: <config>/plugins/context-optimizer.js
  return path.resolve(pluginDir, "..", "context-optimizer", "context-optimizer.log")
}

function resolveConfigPath(metaUrl) {
  return path.join(path.dirname(resolveLogPath(metaUrl)), "config.json")
}

function resolveStatsPath(metaUrl) {
  return path.join(path.dirname(resolveLogPath(metaUrl)), "stats.json")
}

function readStoredConfig(metaUrl) {
  try {
    return parseJsonEnv(fs.readFileSync(resolveConfigPath(metaUrl), "utf8"), {})
  } catch {
    return {}
  }
}

function resolveEffectiveConfig(metaUrl = import.meta.url) {
  const stored = readStoredConfig(metaUrl)
  return {
    timeout_ms: parseNumeric(process.env.CONTEXT_OPTIMIZER_TIMEOUT_MS, parseNumeric(stored.timeout_ms, DEFAULT_TIMEOUT_MS)),
    min_chars: parseNumeric(process.env.CONTEXT_OPTIMIZER_MIN_CHARS, parseNumeric(stored.min_chars, DEFAULT_MIN_COMPACTION_CHARS)),
    model_limits: parseJsonEnv(process.env.CONTEXT_OPTIMIZER_MODEL_LIMITS, parseJsonEnv(stored.model_limits, DEFAULT_MODEL_LIMITS)),
  }
}

function writeStoredConfig(metaUrl, config) {
  const configPath = resolveConfigPath(metaUrl)
  fs.mkdirSync(path.dirname(configPath), { recursive: true })
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

function removeStoredConfig(metaUrl) {
  try {
    fs.rmSync(resolveConfigPath(metaUrl), { force: true })
  } catch {
    // Best effort reset.
  }
}

function readStoredStats(metaUrl) {
  try {
    const parsed = parseJsonEnv(fs.readFileSync(resolveStatsPath(metaUrl), "utf8"), {})
    const sessions = parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {}

    return {
      totalPrunedChars: parseNumeric(parsed.totalPrunedChars, 0),
      totalOptimizations: parseNumeric(parsed.totalOptimizations, 0),
      sessions,
    }
  } catch {
    return { totalPrunedChars: 0, totalOptimizations: 0, sessions: {} }
  }
}

function writeStoredStats(metaUrl, stats) {
  const statsPath = resolveStatsPath(metaUrl)
  fs.mkdirSync(path.dirname(statsPath), { recursive: true })
  fs.writeFileSync(statsPath, `${JSON.stringify(stats, null, 2)}\n`, "utf8")
}

function recordOptimizationStats(metaUrl, sessionID, result) {
  const stats = readStoredStats(metaUrl)
  const prunedChars = Math.max(0, parseNumeric(result?.initialSize, 0) - parseNumeric(result?.finalSize, 0))

  stats.totalPrunedChars += prunedChars
  stats.totalOptimizations += 1
  stats.sessions[sessionID || "global"] = true

  writeStoredStats(metaUrl, stats)
}

function writeDiagnostic(message) {
  try {
    process.stderr.write(`${message}\n`)
  } catch {
    // If stderr is unavailable, keep failing open.
  }
}

function writeLog(metaUrl, message) {
  try {
    const logPath = resolveLogPath(metaUrl)
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8")
  } catch (error) {
    writeDiagnostic(`[context-optimizer] logging failed: ${error}`)
  }
}

function formatJsonBlock(data) {
  return `\n\n${JSON.stringify(data, null, 2)}\n`
}

function buildCommandOutput(title, body) {
  return [
    `[context-optimizer] ${title}`,
    body,
  ].filter(Boolean).join("\n\n")
}

function parseNumeric(value, fallback = 0) {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function summarizeContext(payload = {}) {
  const docs = Array.isArray(payload.docs) ? payload.docs : []
  const errorDocs = Array.isArray(payload.errorDocs) ? payload.errorDocs : []
  const protectedDocs = Array.isArray(payload.protectedDocs) ? payload.protectedDocs : []
  const size = Number.isFinite(payload.size) ? payload.size : docs.reduce((total, value) => total + String(value).length, 0)

  return {
    docs: docs.length,
    errorDocs: errorDocs.length,
    protectedDocs: protectedDocs.length,
    size,
    query: payload.query || "Optimize the most relevant context for compaction.",
    model: payload.model || "",
  }
}

function buildCommandHelp() {
  return buildCommandOutput(
    "available commands",
    [
      "/context-optimizer — show this help",
      "/context-optimizer context — show the current session token/context breakdown",
      "/context-optimizer stats — show cumulative pruning statistics",
      "/context-optimizer compress — run one compression pass",
      "/context-optimizer config — show or update safe plugin settings",
    ].join("\n"),
  )
}

function buildConfigHelp() {
  return buildCommandOutput(
    "config commands",
    [
      "/context-optimizer config — show current settings",
      "/context-optimizer config get <key> — show one setting",
      "/context-optimizer config set <key> <value> — update a safe setting",
      "/context-optimizer config reset — clear saved settings",
      `safe keys: ${SAFE_CONFIG_KEYS.join(", ")}`,
    ].join("\n"),
  )
}

function normalizeCommandName(commandName) {
  return String(commandName || "").trim().replace(/^\//, "")
}

function normalizeConfigKey(key) {
  const normalized = String(key || "").trim().toLowerCase()
  return SAFE_CONFIG_KEYS.includes(normalized) ? normalized : null
}

async function readBridgeResult({ run, cliPath, payload, sessionID, tracker, metaUrl }) {
  return run({
    payload,
    sessionID,
    cliPath,
    metaUrl,
    tracker,
  })
}

export function formatSizeSummary(initialSize, finalSize) {
  if (!Number.isFinite(initialSize) || !Number.isFinite(finalSize)) return ""

  const saved = initialSize - finalSize
  const percent = initialSize > 0 ? Math.round((saved / initialSize) * 100) : 0
  return `Initial size: ${initialSize} chars, final size: ${finalSize} chars, saved: ${saved} chars (${percent}%)`
}

function formatSkippedOptimizationMessage({ reason, size, threshold, docsCount }) {
  const details = []
  if (Number.isFinite(size)) details.push(`size=${size} chars`)
  if (Number.isFinite(threshold)) details.push(`threshold=${threshold} chars`)
  if (Number.isFinite(docsCount)) details.push(`docs=${docsCount}`)
  const detailText = details.length ? ` (${details.join(", ")})` : ""
  return `[context-optimizer] optimization skipped: ${reason}${detailText}`
}

export function formatOutcomeMessage(result = {}) {
  const summary = formatSizeSummary(result.initialSize, result.finalSize)

  if (summary) {
    return `[context-optimizer] optimized context emitted. ${summary}`
  }

  if (result?.status === "no_optimization") {
    return `[context-optimizer] no optimization applied: ${result.reason || "the optimizer found no safer or smaller replacement for the current context."}`
  }

  if (result?.status === "failed") {
    return formatSkippedOptimizationMessage({
      reason: result.reason || result.message || "the optimizer could not complete.",
      size: result.initialSize,
      threshold: result.finalSize,
    })
  }

  if (result?.ok === true) {
    const parts = []
    if (!Number.isFinite(result.initialSize)) parts.push(`initial_size=${String(result.initialSize)}`)
    if (!Number.isFinite(result.finalSize)) parts.push(`final_size=${String(result.finalSize)}`)
    const detail = parts.length ? ` (${parts.join(", ")})` : ""
    return `[context-optimizer] optimization completed, but savings summary was unavailable because size metadata was missing or non-numeric.${detail}`
  }

  return `[context-optimizer] optimization completed without a measurable savings summary.`
}


export function buildPayload(input = {}, output = {}) {
  const model = input.model || output.model || ""
  const options = {
    ...(input.options && typeof input.options === "object" ? input.options : {}),
    ...(output.options && typeof output.options === "object" ? output.options : {}),
  }
  const context = Array.isArray(output.context)
    ? output.context.filter((value) => typeof value === "string" && value.trim())
    : []
  const size = context.reduce((total, value) => total + value.length, 0)
  const errorDocs = context.filter((value) => matchesPrefix(value.trim(), DEFAULT_ERROR_PREFIXES))
  const protectedDocs = context.filter((value) => matchesPrefix(value.trim(), DEFAULT_PROTECTED_PREFIXES))
  const docs = context.filter((value) => !matchesPrefix(value.trim(), DEFAULT_ERROR_PREFIXES) && !matchesPrefix(value.trim(), DEFAULT_PROTECTED_PREFIXES))
  const modelLimits = resolveEffectiveConfig().model_limits
  const modelLimit = model && modelLimits && typeof modelLimits === "object" ? modelLimits[model] : null

  if (size >= AUTO_COMPRESSION_THRESHOLD_CHARS && modelLimit && typeof modelLimit === "object") {
    for (const [key, value] of Object.entries(modelLimit)) {
      options[key] = value
    }
  }

  return {
    model,
    query:
      output.prompt ||
      input.prompt ||
      "Optimize the most relevant context for compaction.",
    docs,
    errorDocs,
    protectedDocs,
    size,
    options,
  }
}

export function normalizePythonResult(stdout) {
  const parsed = JSON.parse(stdout)
  if (parsed.ok) {
    return {
      ok: true,
      optimizedContext: parsed.optimized_context || "",
      initialSize: parsed.initial_size,
      finalSize: parsed.final_size,
      status: parsed.status || (parsed.optimized_context ? "optimized" : "no_optimization"),
      reason: parsed.reason || "",
    }
  }

  return {
    ok: false,
    errorCode: parsed.error_code || "runtime_error",
    message: parsed.message || "Unknown error",
    status: "failed",
    reason: parsed.reason || parsed.message || "Unknown error",
  }
}

export function resolvePythonCommand() {
  if (process.env.CONTEXT_OPTIMIZER_PYTHON) {
    return [process.env.CONTEXT_OPTIMIZER_PYTHON]
  }

  return process.platform === "win32" ? ["py", "-3"] : ["python3"]
}

export function createSessionWarningTracker() {
  let currentSessionID = null
  let currentWarnings = new Set()

  return {
    warnOnce(sessionID, message, metaUrl = import.meta.url) {
      const activeSessionID = sessionID || "global"
      if (activeSessionID !== currentSessionID) {
        currentSessionID = activeSessionID
        currentWarnings = new Set()
      }

      if (currentWarnings.has(message)) return false

      currentWarnings.add(message)
      writeLog(metaUrl, `[context-optimizer] ${message}`)
      return true
    },
  }
}

export function createCliPath(metaUrl) {
  const pluginDir = dirnameFromMeta(metaUrl)
  const preferred = path.resolve(pluginDir, "..", "support-files", "context_optimizer_cli.py")
  if (fs.existsSync(preferred)) return preferred

  const installed = path.resolve(pluginDir, "..", "context-optimizer", "context_optimizer_cli.py")
  if (fs.existsSync(installed)) return installed

  const legacy = path.resolve(pluginDir, "context_optimizer_cli.py")
  if (fs.existsSync(legacy)) return legacy

  return preferred
}

export function applyOptimizedContext(output, result) {
  // Fail open: only replace the original context when the optimizer produced a
  // real optimized replacement. Failures and no-op results leave context intact.
  if (!output || !result?.optimizedContext) return

  const summary = formatSizeSummary(result.initialSize, result.finalSize)
  const statusLine = summary
    ? `[context-optimizer] optimized context emitted. ${summary}`
    : (() => {
        const parts = []
        if (!Number.isFinite(result.initialSize)) parts.push(`initial_size=${String(result.initialSize)}`)
        if (!Number.isFinite(result.finalSize)) parts.push(`final_size=${String(result.finalSize)}`)
        const detail = parts.length ? ` (${parts.join(", ")})` : ""
        return `[context-optimizer] optimization completed, but savings summary was unavailable because size metadata was missing or non-numeric.${detail}`
      })()

  const nextContext = [statusLine]
  nextContext.push(`## Optimized Context\n\n${result.optimizedContext}`)

  output.context = nextContext
}

function resolveToastClient(dependencies = {}, input = {}, output = {}) {
    const client = dependencies.client || dependencies.ui || input?.client || output?.client || null
  if (!client) return null

  const candidates = [
    client.tui?.showToast,
    client.showToast,
    client.toast?.show,
    client.toast,
    client.tui?.toast,
  ]

  const toastFn = candidates.find((candidate) => typeof candidate === "function")
  return toastFn ? toastFn.bind(client.tui || client) : null
}

async function showToast(toastFn, message, variant = "default") {
  if (!toastFn) return

  try {
    await toastFn({
      body: {
        message,
        variant,
      },
    })
  } catch (error) {
    writeDiagnostic(`[context-optimizer] toast failed: ${error}`)
  }
}

export function runOptimizer({ payload, sessionID, cliPath, timeoutMs = resolveTimeoutMs(), metaUrl = import.meta.url, tracker }) {
  const python = resolvePythonCommand()
  // Reuse the caller-provided tracker so "warn once per session" survives across
  // compactions. Fall back to a local tracker only for standalone/test calls.
  const warnTracker = tracker || createSessionWarningTracker()

  return new Promise((resolve) => {
    const child = childProcess.spawn(python[0], [cliPath], { stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const timer = setTimeout(() => {
      child.kill()
      finish({ ok: false, errorCode: "timeout", message: "Python optimizer timed out" })
    }, timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      clearTimeout(timer)
      finish({ ok: false, errorCode: "python_missing", message: String(error) })
    })

    child.stdin.on("error", () => {
      // Ignore stdin pipe errors (e.g. EPIPE when the child exits before we
      // finish writing). The "error"/"close" handlers settle the promise.
    })

    child.on("close", () => {
      clearTimeout(timer)
      try {
        finish(normalizePythonResult(stdout))
      } catch (error) {
        finish({
          ok: false,
          errorCode: "runtime_error",
          message: `${error}${stderr ? `\n${stderr}` : ""}`.trim(),
        })
      }
    })

    try {
      child.stdin.write(JSON.stringify(payload))
      child.stdin.end()
    } catch (error) {
      writeDiagnostic(`[context-optimizer] stdin write failed: ${error}`)
    }
  }).then((result) => {
    if (!result.ok) {
      warnTracker.warnOnce(sessionID || "global", `${result.errorCode}: ${result.message}`, metaUrl)
    }
    return result
  })
}

export const id = "context-optimizer"

export const ContextOptimizerPlugin = async (dependencies = {}) => {
  try {
    const cliPath = createCliPath(import.meta.url)
    const run = dependencies.runOptimizer || runOptimizer
    const tracker = createSessionWarningTracker()
    writeLog(
      import.meta.url,
      `[context-optimizer] plugin loaded (path=${resolveLogPath(import.meta.url)})`,
    )
    const optimizeContext = async (input, output) => {
      const toast = resolveToastClient(dependencies, input, output)
      const payload = buildPayload(input, output)
      const minChars = resolveMinCompactionChars()
      if (!payload.docs.length) {
              writeLog(
                import.meta.url,
                `[context-optimizer] optimization skipped: no compaction documents were provided (size=${payload.size} chars, docs=${payload.docs.length}).`,
              )
              return
            }

      if (payload.size < minChars) {
        writeLog(
          import.meta.url,
        `[context-optimizer] optimization skipped: context size ${payload.size} chars is below the threshold of ${minChars} chars (docs=${payload.docs.length}).`,
        )
        return
      }

      writeLog(import.meta.url, `[context-optimizer] outbound docs: ${payload.docs.length} (size=${payload.size} chars, threshold=${minChars} chars)`)

      const result = await run({
        payload: {
          ...payload,
          options: { min_input_size: minChars, ...payload.options },
        },
        sessionID: input?.sessionID,
        cliPath,
        metaUrl: import.meta.url,
        tracker,
      })

      writeLog(import.meta.url, formatOutcomeMessage(result))
      if (result?.ok && result?.optimizedContext) {
        recordOptimizationStats(import.meta.url, input?.sessionID, result)
      }
      // applyOptimizedContext is fail-open: it only rewrites output.context
      // when the optimizer returned real optimized content.
      applyOptimizedContext(output, result)

      if (result?.ok && result?.optimizedContext) {
        await showToast(toast, `[context-optimizer] optimized ${payload.docs.length} docs.`, "default")
      } else if (!result?.ok) {
        await showToast(
          toast,
          result?.reason || result?.message || result?.errorCode || "Context optimization failed.",
          "error",
        )
      }
    }

    const command = async (input = {}, output = {}) => {
      const commandName = normalizeCommandName(input.command)
      const args = String(input.arguments || "").trim()
      const sessionID = input.sessionID
      if (!commandName.startsWith("context-optimizer")) {
        return
      }
      const commandArgs = commandName.startsWith("context-optimizer") ? commandName.slice("context-optimizer".length).trim() : ""
      const configInput = commandArgs.startsWith("config") ? commandArgs.slice("config".length).trim() : ""
      const configArgs = configInput || args

      if (!commandName || commandName === "context-optimizer") {
        output.parts = [{ type: "text", text: buildCommandHelp() }]
        output.noReply = true
        return
      }

      if (commandArgs === "context") {
        const payload = buildPayload(input, output)
        const summary = summarizeContext(payload)
        output.parts = [
          {
            type: "text",
            text: buildCommandOutput(
              "current session context",
              formatJsonBlock(summary),
            ),
          },
        ]
        output.noReply = true
        return
      }

      if (commandArgs === "stats") {
        const storedStats = readStoredStats(import.meta.url)
        const stats = {
          totalSessions: Object.keys(storedStats.sessions).length,
          totalPrunedChars: storedStats.totalPrunedChars,
          totalOptimizations: storedStats.totalOptimizations,
        }
        output.parts = [
          {
            type: "text",
            text: buildCommandOutput(
              "cumulative pruning statistics",
              formatJsonBlock(stats),
            ),
          },
        ]
        output.noReply = true
        return
      }

      if (commandArgs === "compress") {
        const payload = buildPayload(input, output)
        const result = await readBridgeResult({
          run,
          cliPath,
          payload: {
            ...payload,
            query: args || payload.query,
            options: { min_input_size: resolveMinCompactionChars(), ...payload.options },
          },
          sessionID,
          tracker,
          metaUrl: import.meta.url,
        })

        output.parts = [
          {
            type: "text",
            text: buildCommandOutput("compression run", formatJsonBlock(result)),
          },
        ]
        output.noReply = true
        return
      }

      if (commandArgs.startsWith("config")) {
        const [action = "show", key = "", ...rest] = configArgs ? configArgs.split(/\s+/) : []
        const effective = resolveEffectiveConfig(import.meta.url)

        if (action === "reset") {
          removeStoredConfig(import.meta.url)
          output.parts = [{ type: "text", text: buildCommandOutput("config reset", "Saved settings cleared.") }]
          output.noReply = true
          return
        }

        if (action === "get") {
          const normalizedKey = normalizeConfigKey(key)
          if (!normalizedKey) {
            output.parts = [{ type: "text", text: buildConfigHelp() }]
            output.noReply = true
            return
          }

          output.parts = [{ type: "text", text: buildCommandOutput(`config get ${normalizedKey}`, formatJsonBlock({ [normalizedKey]: effective[normalizedKey] })) }]
          output.noReply = true
          return
        }

        if (action === "set") {
          const normalizedKey = normalizeConfigKey(key)
          if (!normalizedKey) {
            output.parts = [{ type: "text", text: buildConfigHelp() }]
            output.noReply = true
            return
          }

          const stored = readStoredConfig(import.meta.url)
          let value = rest.join(" ")
          if (normalizedKey === "model_limits") {
            value = parseJsonEnv(value, null)
            if (!value || typeof value !== "object") {
              output.parts = [{ type: "text", text: buildCommandOutput("config set failed", "model_limits must be valid JSON.") }]
              output.noReply = true
              return
            }
          } else {
            value = parseNumeric(value, Number.NaN)
            if (!Number.isFinite(value) || value <= 0) {
              output.parts = [{ type: "text", text: buildCommandOutput("config set failed", `${normalizedKey} must be a positive number.`) }]
              output.noReply = true
              return
            }
          }

          writeStoredConfig(import.meta.url, { ...stored, [normalizedKey]: value })
          output.parts = [{ type: "text", text: buildCommandOutput("config updated", formatJsonBlock(resolveEffectiveConfig(import.meta.url))) }]
          output.noReply = true
          return
        }

        output.parts = [{ type: "text", text: buildCommandOutput("current settings", formatJsonBlock(effective)) }]
        output.noReply = true
        return
      }

      output.parts = [{ type: "text", text: buildCommandHelp() }]
      output.noReply = true
    }

    return {
      command: {
        "context-optimizer": {
          description: "Show context optimizer commands",
          template: buildCommandHelp(),
        },
        "context-optimizer context": {
          description: "Show the current session token/context breakdown",
          template: "Show the current session token/context breakdown for the active OpenCode session.",
        },
        "context-optimizer stats": {
          description: "Show cumulative pruning statistics across sessions",
          template: "Show cumulative pruning statistics for the context optimizer.",
        },
        "context-optimizer compress": {
          description: "Run a single compression pass",
          template: "Run one compression pass for the current session context.",
        },
        "context-optimizer config": {
          description: "Show or update safe plugin settings",
          template: buildConfigHelp(),
        },
      },
      "command.execute.before": command,
      "experimental.session.compacting": optimizeContext,
      "experimental.response.cleanup": optimizeContext,
    }
  } catch (error) {
    writeLog(import.meta.url, `[context-optimizer] disabled during startup: ${error}`)
    return {}
  }
}

export const server = ContextOptimizerPlugin

export default { id, server }
