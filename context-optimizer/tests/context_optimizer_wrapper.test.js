import assert from "node:assert/strict"
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import test from "node:test"

import plugin, {
  applyOptimizedContext,
  buildPayload,
  ContextOptimizerPlugin,
  createCliPath,
  createSessionWarningTracker,
  formatOutcomeMessage,
  formatSizeSummary,
  normalizePythonResult,
  resolvePythonCommand,
  runOptimizer,
} from "../plugin/context-optimizer.js"

test("plugin exports OpenCode loader shape", () => {
  assert.equal(plugin.id, "context-optimizer")
  assert.equal(typeof plugin.server, "function")
  assert.deepEqual(plugin, { id: "context-optimizer", server: plugin.server })
})

test("buildPayload flattens context strings", () => {
  const payload = buildPayload(
    { prompt: "ignored" },
    { context: ["a", "", "b"], prompt: "summarize" },
  )

  assert.deepEqual(payload.docs, ["a", "b"])
  assert.equal(payload.query, "summarize")
})

test("buildPayload falls back to input prompt when output prompt is absent", () => {
  const payload = buildPayload(
    { prompt: "use input prompt" },
    { context: ["alpha", null, "  ", 42] },
  )

  assert.equal(payload.query, "use input prompt")
  assert.deepEqual(payload.docs, ["alpha"])
})

test("normalizePythonResult accepts success payload", () => {
  const result = normalizePythonResult('{"ok":true,"optimized_context":"hello","initial_size":10,"final_size":4}')
  assert.equal(result.ok, true)
  assert.equal(result.optimizedContext, "hello")
  assert.equal(result.initialSize, 10)
  assert.equal(result.finalSize, 4)
})

test("normalizePythonResult accepts failure payload", () => {
  const result = normalizePythonResult('{"ok":false,"error_code":"dependency_missing","message":"missing dep"}')

  assert.equal(result.ok, false)
  assert.equal(result.errorCode, "dependency_missing")
  assert.equal(result.message, "missing dep")
  assert.equal(result.status, "failed")
})

test("formatSizeSummary renders savings line", () => {
  assert.equal(
    formatSizeSummary(10, 4),
    "Initial size: 10 chars, final size: 4 chars, saved: 6 chars (60%)",
  )
})

test("formatOutcomeMessage handles no optimization and failure states", () => {
  assert.equal(
    formatOutcomeMessage({ status: "no_optimization", reason: "nothing safer" }),
    "[context-optimizer] no optimization applied: nothing safer",
  )

  assert.equal(
    formatOutcomeMessage({ status: "failed", message: "boom" }),
    "[context-optimizer] optimization skipped: boom",
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
    "## Optimized Context\n\noptimized body",
  ])
})

test("applyOptimizedContext leaves output untouched when there is no optimized context", () => {
  const output = { context: ["source one"] }

  applyOptimizedContext(output, {
    ok: true,
    optimizedContext: "",
    initialSize: 10,
    finalSize: 10,
  })

  assert.deepEqual(output.context, ["source one"])
})

test("applyOptimizedContext leaves context untouched for status-only no-optimization results", () => {
  const output = { context: ["source one"] }

  applyOptimizedContext(output, {
    ok: true,
    optimizedContext: "",
    status: "no_optimization",
    reason: "nothing safer",
    initialSize: 20,
    finalSize: 20,
  })

  assert.deepEqual(output.context, ["source one"])
})

test("applyOptimizedContext leaves context untouched for failed results", () => {
  const output = { context: ["source one"] }

  applyOptimizedContext(output, {
    ok: false,
    optimizedContext: "",
    status: "failed",
    message: "boom",
    initialSize: 20,
    finalSize: 20,
  })

  assert.deepEqual(output.context, ["source one"])
})

test("formatOutcomeMessage reports missing size metadata details", () => {
  assert.equal(
    formatOutcomeMessage({ ok: true, optimizedContext: "x", initialSize: undefined, finalSize: 5 }),
    "[context-optimizer] optimization completed, but savings summary was unavailable because size metadata was missing or non-numeric. (initial_size=undefined)",
  )
})

test("applyOptimizedContext reports missing size metadata details", () => {
  const output = { context: ["source one"] }

  applyOptimizedContext(output, {
    ok: true,
    optimizedContext: "optimized body",
    initialSize: 20,
    finalSize: undefined,
  })

  assert.deepEqual(output.context, [
    "[context-optimizer] optimization completed, but savings summary was unavailable because size metadata was missing or non-numeric. (final_size=undefined)",
    "## Optimized Context\n\noptimized body",
  ])
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

test("createSessionWarningTracker scopes warnings to the active session", () => {
  const tracker = createSessionWarningTracker()

  assert.equal(tracker.warnOnce("session-a", "python_missing: missing python"), true)
  assert.equal(tracker.warnOnce("session-a", "python_missing: missing python"), false)
  assert.equal(tracker.warnOnce("session-b", "python_missing: missing python"), true)
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

test("ContextOptimizerPlugin rewrites output context when runOptimizer is stubbed", async () => {
  const stubRunOptimizer = async () => ({
    ok: true,
    optimizedContext: "stubbed optimized context",
    initialSize: 42,
    finalSize: 11,
  })
  const toasts = []

  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: stubRunOptimizer,
    client: {
      tui: {
        showToast: (payload) => toasts.push(payload),
      },
    },
  })
  const compacting = pluginInstance["experimental.session.compacting"]
  const output = { context: ["original source"] }

  await compacting({ sessionID: "session-a", prompt: "hello" }, output)

  assert.deepEqual(output.context, [
    "[context-optimizer] optimized context emitted. Initial size: 42 chars, final size: 11 chars, saved: 31 chars (74%)",
    "## Optimized Context\n\nstubbed optimized context",
  ])

  assert.deepEqual(toasts, [
    {
      body: {
        message: "[context-optimizer] optimized 1 docs.",
        variant: "default",
      },
    },
  ])
})

test("ContextOptimizerPlugin leaves context untouched when the optimizer fails (fail open)", async () => {
  const stubRunOptimizer = async () => ({
    ok: false,
    errorCode: "dependency_missing",
    message: "missing dep",
    status: "failed",
    reason: "missing dep",
  })
  const toasts = []

  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: stubRunOptimizer,
    client: {
      tui: {
        showToast: (payload) => toasts.push(payload),
      },
    },
  })
  const compacting = pluginInstance["experimental.session.compacting"]
  const output = { context: ["original source"] }

  await compacting({ sessionID: "session-a", prompt: "hello" }, output)

  assert.deepEqual(output.context, ["original source"])
  assert.deepEqual(toasts, [
    {
      body: {
        message: "missing dep",
        variant: "error",
      },
    },
  ])
})

test("ContextOptimizerPlugin logs outbound doc count during compaction", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-optimizer-plugin-"))
  const installRoot = path.join(tempDir, "context-optimizer")
  const pluginDir = path.join(installRoot, "plugin")
  const supportDir = path.join(installRoot, "support-files")

  await mkdir(pluginDir, { recursive: true })
  await mkdir(supportDir, { recursive: true })

  await copyFile(
    path.join(process.cwd(), "context-optimizer", "plugin", "context-optimizer.js"),
    path.join(pluginDir, "context-optimizer.js"),
  )
  await copyFile(
    path.join(process.cwd(), "context-optimizer", "support-files", "context_optimizer.py"),
    path.join(supportDir, "context_optimizer.py"),
  )
  await copyFile(
    path.join(process.cwd(), "context-optimizer", "support-files", "context_optimizer_cli.py"),
    path.join(supportDir, "context_optimizer_cli.py"),
  )
  await copyFile(
    path.join(process.cwd(), "context-optimizer", "support-files", "context_optimizer_hook.py"),
    path.join(supportDir, "context_optimizer_hook.py"),
  )

  const tempPlugin = await import(pathToFileURL(path.join(pluginDir, "context-optimizer.js")).href)
  const pluginInstance = await tempPlugin.ContextOptimizerPlugin({
    runOptimizer: async () => ({
      ok: true,
      optimizedContext: "optimized body",
      initialSize: 20,
      finalSize: 5,
    }),
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  await pluginInstance["experimental.session.compacting"](
    { sessionID: "session-a", prompt: "hello" },
    { context: ["first chunk", "second chunk"] },
  )

  const logPath = path.join(installRoot, "context-optimizer.log")
  const logContent = await readFile(logPath, "utf8")
  const lines = logContent.trim().split(/\r?\n/)

  assert.equal(lines.filter((line) => line.includes("outbound docs:")).length, 1)
  assert.match(logContent, /outbound docs: 2/)
  assert.doesNotMatch(logContent, /first chunk|second chunk/)
})
