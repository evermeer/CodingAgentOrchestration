import { spawn } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const DEFAULT_TIMEOUT_MS = 30000
const SESSION_WARNINGS = new Set()

function dirnameFromMeta(metaUrl) {
  return path.dirname(fileURLToPath(metaUrl))
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
    return { ok: true, optimizedContext: parsed.optimized_context || "" }
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
  return path.resolve(pluginDir, "context_optimizer_cli.py")
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

      output.context = [
        ...(Array.isArray(output.context) ? output.context : []),
        `## Optimized Context\n\n${result.optimizedContext}`,
      ]
    },
  }
}

export default ContextOptimizerPlugin
