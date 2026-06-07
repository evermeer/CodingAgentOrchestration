import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const DEFAULT_TIMEOUT_MS = 30000
const SESSION_WARNINGS = new Set()

function dirnameFromMeta(metaUrl) {
  return path.dirname(fileURLToPath(metaUrl))
}

export function formatSizeSummary(initialSize, finalSize) {
  if (!Number.isFinite(initialSize) || !Number.isFinite(finalSize)) return ""

  const saved = initialSize - finalSize
  const percent = initialSize > 0 ? Math.round((saved / initialSize) * 100) : 0
  return `Initial size: ${initialSize} chars, final size: ${finalSize} chars, saved: ${saved} chars (${percent}%)`
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
    options: {
      compression_rate: 0.5,
      max_chunks: 6,
      dedupe_threshold: 0.9,
    },
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
    }
  }

  return {
    ok: false,
    errorCode: parsed.error_code || "runtime_error",
    message: parsed.message || "Unknown error",
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

function warnOnce(sessionID, message) {
  const key = `${sessionID}:${message}`
  if (SESSION_WARNINGS.has(key)) return
  SESSION_WARNINGS.add(key)
  console.warn(`[context-optimizer] ${message}`)
}

export function createCliPath(metaUrl) {
  const pluginDir = dirnameFromMeta(metaUrl)
  const preferred = path.resolve(pluginDir, "..", "context-optimizer", "context_optimizer_cli.py")
  if (existsSync(preferred)) return preferred

  const legacy = path.resolve(pluginDir, "context_optimizer_cli.py")
  if (existsSync(legacy)) return legacy

  return preferred
}

export function applyOptimizedContext(output, result) {
  if (!output || !result?.optimizedContext) return

  const nextContext = []
  const summary = formatSizeSummary(result.initialSize, result.finalSize)
  if (summary) nextContext.push(summary)
  nextContext.push(`## Optimized Context\n\n${result.optimizedContext}`)

  output.context = nextContext
}

export function runOptimizer({ payload, sessionID, cliPath, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const python = resolvePythonCommand()

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

    child.stdin.write(JSON.stringify(payload))
    child.stdin.end()
  }).then((result) => {
    if (!result.ok) {
      warnOnce(sessionID || "global", `${result.errorCode}: ${result.message}`)
    }
    return result
  })
}

export const ContextOptimizerPlugin = async () => {
  const cliPath = createCliPath(import.meta.url)

  return {
    "experimental.session.compacting": async (input, output) => {
      const payload = buildPayload(input, output)
      if (!payload.docs.length) return

      const result = await runOptimizer({
        payload,
        sessionID: input?.sessionID,
        cliPath,
      })

      if (!result.ok || !result.optimizedContext) return

      applyOptimizedContext(output, result)
    },
  }
}

export default ContextOptimizerPlugin
