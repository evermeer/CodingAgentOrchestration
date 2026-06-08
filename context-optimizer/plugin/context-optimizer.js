import childProcess from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const DEFAULT_TIMEOUT_MS = 120000
const DEFAULT_MIN_COMPACTION_CHARS = 5000

export function resolveTimeoutMs() {
  const raw = process.env.CONTEXT_OPTIMIZER_TIMEOUT_MS
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS
}

export function resolveMinCompactionChars() {
  const raw = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_COMPACTION_CHARS
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
  const context = Array.isArray(output.context)
    ? output.context.filter((value) => typeof value === "string" && value.trim())
    : []
  const size = context.reduce((total, value) => total + value.length, 0)

  return {
    query:
      output.prompt ||
      input.prompt ||
      "Optimize the most relevant context for compaction.",
    docs: context,
    size,
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
          options: { min_input_size: minChars },
        },
        sessionID: input?.sessionID,
        cliPath,
        metaUrl: import.meta.url,
        tracker,
      })

      writeLog(import.meta.url, formatOutcomeMessage(result))
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

    return {
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
