import { spawn } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const DEFAULT_TIMEOUT_MS = 120000

export function resolveTimeoutMs() {
  const raw = process.env.CONTEXT_OPTIMIZER_TIMEOUT_MS
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS
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

function writeLog(metaUrl, message) {
  try {
    const logPath = resolveLogPath(metaUrl)
    mkdirSync(path.dirname(logPath), { recursive: true })
    appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8")
  } catch {
    // Intentionally swallow logging failures; plugin behavior should not depend on file logging.
  }
}

export function formatSizeSummary(initialSize, finalSize) {
  if (!Number.isFinite(initialSize) || !Number.isFinite(finalSize)) return ""

  const saved = initialSize - finalSize
  const percent = initialSize > 0 ? Math.round((saved / initialSize) * 100) : 0
  return `Initial size: ${initialSize} chars, final size: ${finalSize} chars, saved: ${saved} chars (${percent}%)`
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
    return `[context-optimizer] optimization skipped: ${result.reason || result.message || "the optimizer could not complete."}`
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

  return {
    query:
      output.prompt ||
      input.prompt ||
      "Optimize the most relevant context for compaction.",
    docs: context,
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

  if (process.platform === "win32") {
    return ["python"]
  }

  return ["python3"]
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
  if (existsSync(preferred)) return preferred

  const installed = path.resolve(pluginDir, "..", "context-optimizer", "context_optimizer_cli.py")
  if (existsSync(installed)) return installed

  const legacy = path.resolve(pluginDir, "context_optimizer_cli.py")
  if (existsSync(legacy)) return legacy

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
  } catch {
    // Toasts are best-effort UI affordances; they must not affect compaction.
  }
}

export function runOptimizer({ payload, sessionID, cliPath, timeoutMs = resolveTimeoutMs(), metaUrl = import.meta.url, tracker }) {
  const python = resolvePythonCommand()
  // Reuse the caller-provided tracker so "warn once per session" survives across
  // compactions. Fall back to a local tracker only for standalone/test calls.
  const warnTracker = tracker || createSessionWarningTracker()

  return new Promise((resolve) => {
    const child = spawn(python[0], [cliPath], { stdio: ["pipe", "pipe", "pipe"] })
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
    } catch {
      // The "error"/"close" handlers above resolve the promise; nothing to do here.
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

    return {
      "experimental.session.compacting": async (input, output) => {
        const toast = resolveToastClient(dependencies, input, output)
        const payload = buildPayload(input, output)
        if (!payload.docs.length) {
          writeLog(import.meta.url, "[context-optimizer] no optimization applied: no compaction documents were provided.")
          return
        }

        writeLog(import.meta.url, `[context-optimizer] outbound docs: ${payload.docs.length}`)

        const result = await run({
          payload,
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
      },
    }
  } catch (error) {
    writeLog(import.meta.url, `[context-optimizer] disabled during startup: ${error}`)
    return {}
  }
}

export const server = ContextOptimizerPlugin

export default { id, server }
