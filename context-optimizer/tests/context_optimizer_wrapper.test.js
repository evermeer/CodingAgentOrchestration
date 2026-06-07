import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import * as plugin from "../plugin/context-optimizer.js"

import {
  buildPayload,
  createCliPath,
  applyOptimizedContext,
  formatSizeSummary,
  logSizeSummary,
  normalizePythonResult,
  resolvePythonCommand,
  runOptimizer,
} from "../plugin/context-optimizer.js"

test("plugin exports OpenCode loader shape", () => {
  assert.equal(plugin.id, "context-optimizer")
  assert.equal(typeof plugin.server, "function")
  assert.deepEqual(plugin.default, { id: "context-optimizer", server: plugin.server })
})

test("buildPayload flattens context strings", () => {
  const payload = buildPayload(
    { prompt: "ignored" },
    { context: ["a", "", "b"], prompt: "summarize" },
  )

  assert.deepEqual(payload.docs, ["a", "b"])
  assert.equal(payload.query, "summarize")
})

test("normalizePythonResult accepts success payload", () => {
  const result = normalizePythonResult('{"ok":true,"optimized_context":"hello","initial_size":10,"final_size":4}')
  assert.equal(result.ok, true)
  assert.equal(result.optimizedContext, "hello")
  assert.equal(result.initialSize, 10)
  assert.equal(result.finalSize, 4)
})

test("formatSizeSummary renders savings line", () => {
  assert.equal(
    formatSizeSummary(10, 4),
    "Initial size: 10 chars, final size: 4 chars, saved: 6 chars (60%)",
  )
})

test("applyOptimizedContext replaces source context", () => {
  const output = { context: ["source one", "source two"] }

  applyOptimizedContext(output, {
    optimizedContext: "optimized body",
    initialSize: 20,
    finalSize: 5,
  })

  assert.deepEqual(output.context, [
    "[context-optimizer] optimized context emitted. Initial size: 20 chars, final size: 5 chars, saved: 15 chars (75%)",
    "Initial size: 20 chars, final size: 5 chars, saved: 15 chars (75%)",
    "## Optimized Context\n\noptimized body",
  ])
})

test("logSizeSummary returns a size summary", () => {
  const messages = []
  const originalLog = console.log
  console.log = (message) => {
    messages.push(message)
  }

  try {
    const summary = logSizeSummary({ initialSize: 20, finalSize: 5 })
    assert.equal(summary, "Initial size: 20 chars, final size: 5 chars, saved: 15 chars (75%)")
    assert.deepEqual(messages, [])
  } finally {
    console.log = originalLog
  }
})

test("resolvePythonCommand respects override", () => {
  process.env.CONTEXT_OPTIMIZER_PYTHON = "custom-python"
  assert.deepEqual(resolvePythonCommand(), ["custom-python"])
  delete process.env.CONTEXT_OPTIMIZER_PYTHON
})

test("createCliPath points at python bridge", () => {
  const cliPath = createCliPath(import.meta.url)
  assert.equal(path.basename(cliPath), "context_optimizer_cli.py")
  assert.equal(path.dirname(cliPath).endsWith(path.join("support-files")), true)
})

test("runOptimizer returns no-op friendly result for missing cli", async () => {
  const result = await runOptimizer({
    payload: { query: "x", docs: ["a"] },
    sessionID: "test-session",
    cliPath: path.join(process.cwd(), "context-optimizer", "missing_cli.py"),
    timeoutMs: 1000,
  })

  assert.equal(result.ok, false)
})

test("runOptimizer parses size summary from a python bridge", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-optimizer-"))
  const cliPath = path.join(tempDir, "bridge.py")

  await writeFile(
    cliPath,
    [
      "import json",
      "import sys",
      "payload = json.loads(sys.stdin.read() or '{}')",
      "initial_size = len(payload['docs'][0]) if payload.get('docs') else 0",
      "sys.stdout.write(json.dumps({",
      '    "ok": True,',
      '    "optimized_context": "bridge output",',
      '    "initial_size": initial_size,',
      '    "final_size": 13,',
      '}))',
    ].join("\n"),
  )

  const result = await runOptimizer({
    payload: { query: "x", docs: ["source text"] },
    sessionID: "test-session",
    cliPath,
    timeoutMs: 1000,
  })

  assert.equal(result.ok, true)
  assert.equal(result.optimizedContext, "bridge output")
  assert.equal(result.initialSize, 11)
  assert.equal(result.finalSize, 13)
})
