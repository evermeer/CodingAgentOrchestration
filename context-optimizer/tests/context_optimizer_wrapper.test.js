import assert from "node:assert/strict"
import childProcess from "node:child_process"
import fs from "node:fs"
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

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


test("buildPayload includes the summed context size", () => {
  const payload = buildPayload({}, { context: ["alpha", "beta"] })

  assert.equal(payload.size, 9)
})

test("buildPayload purges error docs and preserves protected docs", () => {
  const payload = buildPayload(
    { model: "gpt-4o-mini" },
    {
      context: [
        "[error] failed tool output",
        "keep this",
        "protected: secret",
        "another keep",
      ],
    },
  )

  assert.deepEqual(payload.docs, ["keep this", "another keep"])
  assert.deepEqual(payload.errorDocs, ["[error] failed tool output"])
  assert.deepEqual(payload.protectedDocs, ["protected: secret"])
})

test("buildPayload applies model limits and auto compression for large payloads", () => {
  const previousModelLimits = process.env.CONTEXT_OPTIMIZER_MODEL_LIMITS
  process.env.CONTEXT_OPTIMIZER_MODEL_LIMITS = JSON.stringify({
    "gpt-4o-mini": {
      compression_rate: 0.2,
      max_chunks: 3,
    },
  })

  try {
    const payload = buildPayload(
      { model: "gpt-4o-mini" },
      {
        context: ["x".repeat(3000), "y".repeat(3000)],
      },
    )

    assert.equal(payload.options.compression_rate, 0.2)
    assert.equal(payload.options.max_chunks, 3)
  } finally {
    if (previousModelLimits === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MODEL_LIMITS
    } else {
      process.env.CONTEXT_OPTIMIZER_MODEL_LIMITS = previousModelLimits
    }
  }
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

test("createSessionWarningTracker falls back to stderr when log writing fails", () => {
  const originalAppendFileSync = fs.appendFileSync
  const originalStderrWrite = process.stderr.write
  const stderr = []

  fs.appendFileSync = () => {
    throw new Error("disk full")
  }
  process.stderr.write = (chunk) => {
    stderr.push(String(chunk))
    return true
  }

  try {
    const tracker = createSessionWarningTracker()
    assert.equal(tracker.warnOnce("session-a", "filesystem failure"), true)
    assert.match(stderr.join(""), /logging failed/i)
  } finally {
    fs.appendFileSync = originalAppendFileSync
    process.stderr.write = originalStderrWrite
  }
})

test("runOptimizer reports stdin write failures to stderr", async () => {
  const originalSpawn = childProcess.spawn
  const originalAppendFileSync = fs.appendFileSync
  const originalMkdirSync = fs.mkdirSync
  const originalStderrWrite = process.stderr.write
  const stderr = []

  fs.appendFileSync = () => {}
  fs.mkdirSync = () => {}
  process.stderr.write = (chunk) => {
    stderr.push(String(chunk))
    return true
  }

  childProcess.spawn = () => {
    const child = {
      stdout: {
        on(event, handler) {
          if (event === "data") {
            handler(Buffer.from('{"ok":true,"optimized_context":"ok","initial_size":1,"final_size":1}'))
          }
          return child.stdout
        },
      },
      stderr: {
        on() {
          return child.stderr
        },
      },
      stdin: {
        write() {
          throw new Error("broken pipe")
        },
        end() {},
        on() {
          return child.stdin
        },
      },
      on(event, handler) {
        if (event === "close") {
          setImmediate(() => handler(0, null))
        }
        return child
      },
      kill() {},
    }

    return child
  }

  try {
    const result = await runOptimizer({
      payload: { query: "x", docs: ["a"] },
      sessionID: "test-session",
      cliPath: path.join(process.cwd(), "missing_cli.py"),
      timeoutMs: 1000,
    })

    assert.equal(result.ok, true)
    assert.match(stderr.join(""), /stdin write failed/i)
  } finally {
    childProcess.spawn = originalSpawn
    fs.appendFileSync = originalAppendFileSync
    fs.mkdirSync = originalMkdirSync
    process.stderr.write = originalStderrWrite
  }
})

test("runOptimizer returns no-op friendly result for missing cli", async () => {
  const result = await runOptimizer({
    payload: { query: "x", docs: ["a"] },
    sessionID: "test-session",
    cliPath: path.join(process.cwd(), "missing_cli.py"),
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

test("ContextOptimizerPlugin skips optimization below the minimum threshold", async () => {
  const calls = []
  const toasts = []
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1000"

  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }

  try {
    const pluginInstance = await ContextOptimizerPlugin({
      runOptimizer: async (payload) => {
        calls.push(payload)
        throw new Error("runOptimizer should not be called below threshold")
      },
      client: {
        tui: {
          showToast: (payload) => toasts.push(payload),
        },
      },
    })
    const compacting = pluginInstance["experimental.session.compacting"]
    const output = { context: ["tiny"] }

    await compacting({ sessionID: "session-a", prompt: "hello" }, output)

    assert.deepEqual(output.context, ["tiny"])
    assert.deepEqual(calls, [])
    assert.deepEqual(toasts, [])
    assert.match(
      logLines.join("\n"),
      /optimization skipped: context size 4 chars is below the threshold of 1000 chars \(docs=1\)\./,
    )
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin logs skipped optimization when no compaction docs are provided", async () => {
  const calls = []
  const toasts = []
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1000"

  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }

  try {
    const pluginInstance = await ContextOptimizerPlugin({
      runOptimizer: async (payload) => {
        calls.push(payload)
        throw new Error("runOptimizer should not be called when there are no docs")
      },
      client: {
        tui: {
          showToast: (payload) => toasts.push(payload),
        },
      },
    })
    const compacting = pluginInstance["experimental.session.compacting"]
    const output = { context: [] }

    await compacting({ sessionID: "session-a", prompt: "hello" }, output)

    assert.deepEqual(output.context, [])
    assert.deepEqual(calls, [])
    assert.deepEqual(toasts, [])
    assert.match(
      logLines.join("\n"),
      /optimization skipped: no compaction documents were provided \(size=0 chars, docs=0\)\./,
    )
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin rewrites output context when runOptimizer is stubbed", async () => {
  const stubRunOptimizer = async () => ({
    ok: true,
    optimizedContext: "stubbed optimized context",
    initialSize: 42,
    finalSize: 11,
  })
  const toasts = []
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1"

  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }

  try {
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
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin logs skipped optimization when no compaction docs are provided", async () => {
  const calls = []
  const toasts = []
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1000"

  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }

  try {
    const pluginInstance = await ContextOptimizerPlugin({
      runOptimizer: async (payload) => {
        calls.push(payload)
        throw new Error("runOptimizer should not be called when there are no docs")
      },
      client: {
        tui: {
          showToast: (payload) => toasts.push(payload),
        },
      },
    })
    const compacting = pluginInstance["experimental.session.compacting"]
    const output = { context: [] }

    await compacting({ sessionID: "session-a", prompt: "hello" }, output)

    assert.deepEqual(output.context, [])
    assert.deepEqual(calls, [])
    assert.deepEqual(toasts, [])
    assert.match(
      logLines.join("\n"),
      /optimization skipped: no compaction documents were provided \(size=0 chars, docs=0\)\./,
    )
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin rewrites output context when runOptimizer is stubbed", async () => {
  const stubRunOptimizer = async () => ({
    ok: true,
    optimizedContext: "stubbed optimized context",
    initialSize: 42,
    finalSize: 11,
  })
  const toasts = []
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1"

  try {
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
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin exposes experimental.response.cleanup hook", async () => {
  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: async () => ({
      ok: true,
      optimizedContext: "stubbed optimized context",
      initialSize: 42,
      finalSize: 11,
    }),
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  assert.equal(typeof pluginInstance["experimental.session.compacting"], "function")
  assert.equal(typeof pluginInstance["experimental.response.cleanup"], "function")
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
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1"

  try {
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
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin reports toast failures to stderr", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-optimizer-toast-"))
  const installRoot = path.join(tempDir, "context-optimizer")
  const pluginDir = path.join(installRoot, "plugin")
  const supportDir = path.join(installRoot, "support-files")
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS

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
  const originalAppendFileSync = fs.appendFileSync
  const originalStderrWrite = process.stderr.write
  const stderr = []

  fs.appendFileSync = () => {}
  process.stderr.write = (chunk) => {
    stderr.push(String(chunk))
    return true
  }

  try {
    process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1"
    const pluginInstance = await tempPlugin.ContextOptimizerPlugin({
      runOptimizer: async () => ({
        ok: true,
        optimizedContext: "stubbed optimized context",
        initialSize: 42,
        finalSize: 11,
      }),
      client: {
        tui: {
          showToast: () => {
            throw new Error("toast failed")
          },
        },
      },
    })

    await pluginInstance["experimental.session.compacting"]({ sessionID: "session-a", prompt: "hello" }, { context: ["original source"] })

    assert.match(stderr.join(""), /toast failed/i)
  } finally {
    fs.appendFileSync = originalAppendFileSync
    process.stderr.write = originalStderrWrite
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin logs one savings summary during compaction", async () => {
  const originalAppendFileSync = fs.appendFileSync
  const logLines = []
  const previousMinChars = process.env.CONTEXT_OPTIMIZER_MIN_CHARS
  process.env.CONTEXT_OPTIMIZER_MIN_CHARS = "1"

  fs.appendFileSync = (_path, content) => {
    logLines.push(String(content))
  }

  try {
    const pluginInstance = await ContextOptimizerPlugin({
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

    const logContent = logLines.join("\n")
    const lines = logContent.trim().split(/\r?\n/)

    assert.equal(lines.filter((line) => line.includes("outbound docs:")).length, 1)
    assert.equal(lines.filter((line) => line.includes("optimized context emitted. Initial size:")).length, 1)
    assert.equal(lines.filter((line) => line.includes("success: optimized context emitted")).length, 0)
    assert.match(logContent, /outbound docs: 2/)
    assert.doesNotMatch(logContent, /first chunk|second chunk/)
  } finally {
    fs.appendFileSync = originalAppendFileSync
    if (previousMinChars === undefined) {
      delete process.env.CONTEXT_OPTIMIZER_MIN_CHARS
    } else {
      process.env.CONTEXT_OPTIMIZER_MIN_CHARS = previousMinChars
    }
  }
})

test("ContextOptimizerPlugin exposes slash commands and help output", async () => {
  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: async () => ({
      ok: true,
      optimizedContext: "stubbed optimized context",
      initialSize: 42,
      finalSize: 11,
    }),
    stats: {
      totalSessions: 7,
      totalPrunedChars: 1234,
      totalOptimizations: 9,
    },
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  assert.equal(typeof pluginInstance.command, "object")
  assert.equal(typeof pluginInstance.command["context-optimizer"], "object")
  assert.equal(typeof pluginInstance.command["context-optimizer context"], "object")
  assert.equal(typeof pluginInstance.command["context-optimizer stats"], "object")
  assert.equal(typeof pluginInstance.command["context-optimizer compress"], "object")
  assert.equal(typeof pluginInstance.command["context-optimizer config"], "object")

  const output = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer", sessionID: "session-a" }, output)

  assert.equal(output.noReply, true)
  assert.match(output.parts[0].text, /available commands/i)
  assert.match(output.parts[0].text, /\/context-optimizer context/i)
  assert.match(output.parts[0].text, /\/context-optimizer config/i)
})

test("ContextOptimizerPlugin ignores unrelated slash commands", async () => {
  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: async () => ({
      ok: true,
      optimizedContext: "stubbed optimized context",
      initialSize: 42,
      finalSize: 11,
    }),
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  const output = {}
  await pluginInstance["command.execute.before"]({ command: "/help", sessionID: "session-a" }, output)

  assert.deepEqual(output, {})
})

test("ContextOptimizerPlugin config commands show, get, set, and reset safe settings", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-optimizer-config-"))
  const installRoot = path.join(tempDir, "context-optimizer")
  const pluginDir = path.join(installRoot, "plugin")
  const supportDir = path.join(installRoot, "support-files")
  const originalCwd = process.cwd()

  await mkdir(pluginDir, { recursive: true })
  await mkdir(supportDir, { recursive: true })

  await copyFile(
    path.join(originalCwd, "context-optimizer", "plugin", "context-optimizer.js"),
    path.join(pluginDir, "context-optimizer.js"),
  )
  await copyFile(
    path.join(originalCwd, "context-optimizer", "support-files", "context_optimizer.py"),
    path.join(supportDir, "context_optimizer.py"),
  )
  await copyFile(
    path.join(originalCwd, "context-optimizer", "support-files", "context_optimizer_cli.py"),
    path.join(supportDir, "context_optimizer_cli.py"),
  )
  await copyFile(
    path.join(originalCwd, "context-optimizer", "support-files", "context_optimizer_hook.py"),
    path.join(supportDir, "context_optimizer_hook.py"),
  )

  const tempPlugin = await import(pathToFileURL(path.join(pluginDir, "context-optimizer.js")).href)
  const pluginInstance = await tempPlugin.ContextOptimizerPlugin({
    runOptimizer: async () => ({ ok: true, optimizedContext: "x", initialSize: 1, finalSize: 1 }),
    client: { tui: { showToast: () => {} } },
  })

  const configFile = path.join(installRoot, "config.json")

  const showOutput = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer config", sessionID: "session-a" }, showOutput)
  assert.equal(showOutput.noReply, true)
  assert.match(showOutput.parts[0].text, /current settings/i)

  const getOutput = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer config get min_chars", sessionID: "session-a" }, getOutput)
  assert.match(getOutput.parts[0].text, /"min_chars"/)

  const setOutput = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer config set min_chars 2500", sessionID: "session-a" }, setOutput)
  assert.match(setOutput.parts[0].text, /config updated/i)
  assert.equal(JSON.parse(await readFile(configFile, "utf8")).min_chars, 2500)

  const resetOutput = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer config reset", sessionID: "session-a" }, resetOutput)
  assert.match(resetOutput.parts[0].text, /saved settings cleared/i)
  assert.equal(fs.existsSync(configFile), false)

  const invalidOutput = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer config set python custom", sessionID: "session-a" }, invalidOutput)
  assert.match(invalidOutput.parts[0].text, /config commands/i)
})

test("ContextOptimizerPlugin command context reports the current breakdown", async () => {
  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: async () => ({
      ok: true,
      optimizedContext: "stubbed optimized context",
      initialSize: 42,
      finalSize: 11,
    }),
    stats: {
      totalSessions: 7,
      totalPrunedChars: 1234,
      totalOptimizations: 9,
    },
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  const output = { context: ["alpha", "beta", "protected: gamma", "[error] skip"] }
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer context", sessionID: "session-a" }, output)

  assert.equal(output.noReply, true)
  assert.match(output.parts[0].text, /current session context/i)
  assert.match(output.parts[0].text, /"docs": 2/)
  assert.match(output.parts[0].text, /"errorDocs": 1/)
  assert.match(output.parts[0].text, /"protectedDocs": 1/)
})

test("ContextOptimizerPlugin command stats reports cumulative pruning numbers", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-optimizer-stats-legacy-"))
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

  await writeFile(
    path.join(installRoot, "stats.json"),
    JSON.stringify({ totalPrunedChars: 1234, totalOptimizations: 9, sessions: { "session-a": true, "session-b": true, "session-c": true, "session-d": true, "session-e": true, "session-f": true, "session-g": true } }, null, 2),
    "utf8",
  )

  const tempPlugin = await import(pathToFileURL(path.join(pluginDir, "context-optimizer.js")).href)
  const pluginInstance = await tempPlugin.ContextOptimizerPlugin({
    runOptimizer: async () => ({
      ok: true,
      optimizedContext: "stubbed optimized context",
      initialSize: 42,
      finalSize: 11,
    }),
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  const output = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer stats", sessionID: "session-a" }, output)

  assert.equal(output.noReply, true)
  assert.match(output.parts[0].text, /cumulative pruning statistics/i)
  assert.match(output.parts[0].text, /"totalSessions": 7/)
  assert.match(output.parts[0].text, /"totalPrunedChars": 1234/)
  assert.match(output.parts[0].text, /"totalOptimizations": 9/)
})

test("ContextOptimizerPlugin command stats reads persisted stats", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "context-optimizer-stats-"))
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

  const statsFile = path.join(installRoot, "stats.json")
  await writeFile(
    statsFile,
    JSON.stringify({ totalPrunedChars: 42, totalOptimizations: 3, sessions: { "session-a": true } }, null, 2),
    "utf8",
  )

  const tempPlugin = await import(pathToFileURL(path.join(pluginDir, "context-optimizer.js")).href)
  const pluginInstance = await tempPlugin.ContextOptimizerPlugin({
    runOptimizer: async () => ({ ok: true, optimizedContext: "x", initialSize: 10, finalSize: 4 }),
    stats: {
      totalSessions: 99,
      totalPrunedChars: 999,
      totalOptimizations: 999,
    },
    client: { tui: { showToast: () => {} } },
  })

  const output = {}
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer stats", sessionID: "session-b" }, output)

  assert.equal(output.noReply, true)
  assert.match(output.parts[0].text, /"totalSessions": 1/)
  assert.match(output.parts[0].text, /"totalPrunedChars": 42/)
  assert.match(output.parts[0].text, /"totalOptimizations": 3/)
})

test("ContextOptimizerPlugin command compress runs one compression pass", async () => {
  const calls = []
  const pluginInstance = await ContextOptimizerPlugin({
    runOptimizer: async (call) => {
      calls.push(call)
      return {
        ok: true,
        optimizedContext: "compressed body",
        initialSize: 42,
        finalSize: 11,
      }
    },
    stats: {
      totalSessions: 7,
      totalPrunedChars: 1234,
      totalOptimizations: 9,
    },
    client: {
      tui: {
        showToast: () => {},
      },
    },
  })

  const output = { context: ["alpha", "beta"] }
  await pluginInstance["command.execute.before"]({ command: "/context-optimizer compress", arguments: "compress now", sessionID: "session-a" }, output)

  assert.equal(output.noReply, true)
  assert.match(output.parts[0].text, /compression run/i)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].payload.query, "compress now")
  assert.deepEqual(calls[0].payload.docs, ["alpha", "beta"])
})
