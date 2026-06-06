import assert from "node:assert/strict"
import test from "node:test"
import path from "node:path"

import {
  buildPayload,
  createCliPath,
  normalizePythonResult,
  resolvePythonCommand,
  runOptimizer,
} from "../context-optimizer.js"

test("buildPayload flattens context strings", () => {
  const payload = buildPayload(
    { prompt: "ignored" },
    { context: ["a", "", "b"], prompt: "summarize" },
  )

  assert.deepEqual(payload.docs, ["a", "b"])
  assert.equal(payload.query, "summarize")
})

test("normalizePythonResult accepts success payload", () => {
  const result = normalizePythonResult('{"ok":true,"optimized_context":"hello"}')
  assert.equal(result.ok, true)
  assert.equal(result.optimizedContext, "hello")
})

test("resolvePythonCommand respects override", () => {
  process.env.CONTEXT_OPTIMIZER_PYTHON = "custom-python"
  assert.deepEqual(resolvePythonCommand(), ["custom-python"])
  delete process.env.CONTEXT_OPTIMIZER_PYTHON
})

test("createCliPath points at python bridge", () => {
  const cliPath = createCliPath(import.meta.url)
  assert.equal(path.basename(cliPath), "context_optimizer_cli.py")
})

test("runOptimizer returns no-op friendly result for missing cli", async () => {
  const result = await runOptimizer({
    payload: { query: "x", docs: ["a"] },
    sessionID: "test-session",
    cliPath: path.join(process.cwd(), "plugins", "missing_cli.py"),
    timeoutMs: 1000,
  })

  assert.equal(result.ok, false)
})
