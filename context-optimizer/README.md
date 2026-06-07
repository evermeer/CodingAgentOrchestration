
# OpenCode Context Optimizer Plugin

## Overview
This plugin adds token reduction to your OpenCode setup.

#### 🔧 Designed for:
- ✅ OpenCode CLI
- ✅ oh-my-openagent pipelines
- ✅ Graphify + MemPalace

#### ✨ Features:
- 🔃 Reranking (removes irrelevant context)
- 🧹 Deduplication (removes repeated info)
- 🗜️Compression (LLMLingua)
- 📝 Rolling summary
- 🔌Works with Oh-My-Openagent + Graphify + MemPalace

#### 🚀 What You’ll Notice Immediately:

- 🔥 70–90% token reduction
- ⚡ Faster responses
- 🧠 Cleaner, higher-quality context
- 🔁 Scales with long conversations
- 🎶Less context noise from Graphify + MemPalace

#### 📂 in this repo:
- 📁 `context-optimizer/plugin/context-optimizer.js` → JS OpenCode plugin source file to install globally
- 📁 `context-optimizer/support-files/context_optimizer.py` → core Python logic (rerank + dedupe + compress)
- 📁 `context-optimizer/support-files/context_optimizer_cli.py` → Python stdin/stdout bridge for the JS wrapper
- 📁 `context-optimizer/support-files/context_optimizer_hook.py` → optional Python helper hook
- 📁 `context-optimizer/tests/` → tests for the Python bridge and JS wrapper

#### 📦 External dependencies:
- 🧠 [Huggingface SentenceTransformers](https://github.com/huggingface/sentence-transformers/) (reranking + deduplication)
- 🗜️ [Microsoft LLMLingua](https://github.com/microsoft/LLMLingua) (compression)
- 🔥 [PyTorch](https://pytorch.org/) (installed automatically as a dependency of the two packages above)

> [!NOTE]
> On first run the plugin downloads three models from [Hugging Face](https://huggingface.co/). See [What gets downloaded on first run](#what-gets-downloaded-on-first-run) below so you know what to expect.

---

## Requirements

Before you start, make sure the following are in place. If you already run OpenCode with oh-my-openagent, you only need to check **Python** and **pip**.

| Requirement | Minimum | How to check |
| --- | --- | --- |
| Python | 3.9+ (3.10 / 3.11 recommended) | `python --version` |
| pip | any recent version | `pip --version` |
| OpenCode CLI + oh-my-openagent | installed globally | `opencode --help` |
| Disk space | ~3–5 GB free (for the models) | — |

> [!TIP]
> On Windows, `pip` may need to be invoked through the same Python interpreter you used for installation. On macOS/Linux it may be `pip3`. Use whichever resolves on your machine.

### Install Python

If `python --version` fails, install Python first:

- **Windows / macOS:** download from [python.org/downloads](https://www.python.org/downloads/) (on Windows, tick *“Add python.exe to PATH”* during setup).
- **macOS (Homebrew):** `brew install python`
- **Debian / Ubuntu:** `sudo apt update && sudo apt install -y python3`

### Install pip (one-liner)

`pip` ships with modern Python. If `pip --version` fails, bootstrap it with the bundled module:

```bash
python -m ensurepip --upgrade && python -m pip install --upgrade pip
```

If `ensurepip` is unavailable, use the official bootstrap script instead:

```bash
curl -sS https://bootstrap.pypa.io/get-pip.py | python
```

On Debian/Ubuntu you can also install it from the system package manager: `sudo apt install -y python3-pip`.

**Verify:** `pip --version` should now print a version and a path.

### Don't have OpenCode + oh-my-openagent yet?

This plugin plugs into the oh-my-openagent pipeline. If you haven't set those up, follow the baseline setup first: [Part 2: A default setup](./part-2-default-setup.md) (see *Install OpenCode* and *Install and Configure Oh-My-OpenAgent*). Come back here once `opencode --help` works.

---

## Installation (CLI executable)

> [!IMPORTANT]
> **Current compatibility status (OpenCode JSON/JSONC configuration):**
>
> The supported activation path for current OpenCode is a **JavaScript OpenCode local plugin** that wraps the existing Python optimizer.
>
> In practice this means:
>
> - ✅ Install the Python packages.
> - ✅ Keep the plugin as one self-contained folder.
> - ✅ Keep the JS wrapper implementation in `context-optimizer/plugin/context-optimizer.js`.
> - ✅ Install that folder into your global OpenCode plugin directory.
> - ✅ Let that JS plugin call the Python bridge from the sibling `support-files/` directory.

### 1. Install dependencies

Install the two Python packages (PyTorch is pulled in automatically):

```bash
pip install sentence-transformers llmlingua
```

If you're on **Windows CPU-only** (or any machine without CUDA), install the CPU wheel for PyTorch first so the optimizer doesn't try to load a CUDA build:

```powershell
python -m pip install --upgrade --index-url https://download.pytorch.org/whl/cpu torch torchvision torchaudio
python -m pip install sentence-transformers llmlingua
```

If you do have an NVIDIA GPU, use the official PyTorch installer selector to pick the matching CUDA wheel for your machine instead.

> [!NOTE]
> On CPU-only Windows installs, the optimizer automatically falls back to a CPU-safe compression model so it does not try to load the LLMLingua-2 CUDA path.

> [!NOTE]
> This is a sizeable download (PyTorch alone is several hundred MB). On a slow connection this step can take a few minutes.

**Verify the install:**

```bash
python -c "import sentence_transformers, llmlingua; print('ok')"
```

If this prints `ok`, the dependencies are ready. If you see `ModuleNotFoundError`, the packages were installed into a different Python than the one on your PATH — re-run the install with `python -m pip install sentence-transformers llmlingua` so the package and interpreter match.

---

### 2. Add the plugin files

#### Tiny install checklist

**All platforms:** do **not** copy `tests/` or any `__pycache__/` folder into the OpenCode plugins directory.

Copy the JS plugin file into your OpenCode global plugins folder:

- `context-optimizer/plugin/context-optimizer.js`

Copy the Python support files into a sibling support directory under the OpenCode config root:

- `context-optimizer/support-files/context_optimizer.py`
- `context-optimizer/support-files/context_optimizer_cli.py`
- `context-optimizer/support-files/context_optimizer_hook.py`

The JS wrapper calls the Python bridge over stdin/stdout JSON and fails open if Python or its dependencies are unavailable.

The plugin writes to `context-optimizer/context-optimizer.log` under the OpenCode config root (for example `~/.config/opencode/context-optimizer/context-optimizer.log` on macOS/Linux or `%USERPROFILE%\.config\opencode\context-optimizer\context-optimizer.log` on Windows).

**Where is the global plugins folder?**

| OS | Path |
| --- | --- |
| macOS / Linux | `~/.config/opencode/plugins/` |
| Windows | `%USERPROFILE%\.config\opencode\plugins\` |

Create the folders if they do not exist, then copy the files:

```bash
# macOS / Linux
mkdir -p ~/.config/opencode/plugins
cp context-optimizer/plugin/context-optimizer.js ~/.config/opencode/plugins/context-optimizer.js
mkdir -p ~/.config/opencode/context-optimizer
cp context-optimizer/support-files/context_optimizer.py ~/.config/opencode/context-optimizer/context_optimizer.py
cp context-optimizer/support-files/context_optimizer_cli.py ~/.config/opencode/context-optimizer/context_optimizer_cli.py
cp context-optimizer/support-files/context_optimizer_hook.py ~/.config/opencode/context-optimizer/context_optimizer_hook.py
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\opencode\plugins" | Out-Null
Copy-Item context-optimizer\plugin\context-optimizer.js "$env:USERPROFILE\.config\opencode\plugins\context-optimizer.js"
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\opencode\context-optimizer" | Out-Null
Copy-Item context-optimizer\support-files\context_optimizer.py "$env:USERPROFILE\.config\opencode\context-optimizer\context_optimizer.py"
Copy-Item context-optimizer\support-files\context_optimizer_cli.py "$env:USERPROFILE\.config\opencode\context-optimizer\context_optimizer_cli.py"
Copy-Item context-optimizer\support-files\context_optimizer_hook.py "$env:USERPROFILE\.config\opencode\context-optimizer\context_optimizer_hook.py"
```

### 2a. JSON / JSONC-based configuration notes

If your OpenCode setup is configured through JSON or JSONC files, the files you will typically inspect are:

- `~/.config/opencode/opencode.json` — main OpenCode config (plugin list, MCP servers, providers, agents, etc.)
- `~/.config/opencode/oh-my-openagent.jsonc` or `~/.config/opencode/oh-my-openagent.json` — oh-my-openagent user config
- legacy compatibility files may still exist as `oh-my-opencode.jsonc` / `oh-my-opencode.json`

For the current JSON/JSONC-based setup, you do **not** need a custom JSON config key to activate the wrapper once the files are copied into the global OpenCode plugin directory. OpenCode automatically loads JS/TS files from `~/.config/opencode/plugins/`.

Use the JSON/JSONC files to:

- confirm that OpenCode and oh-my-openagent are installed,
- confirm your provider/plugin environment is healthy, and
- optionally register a global npm plugin later if you decide to publish the wrapper as a package.

---

### 3. Supported activation path

For the current setup, activation is handled by the global OpenCode plugin loader after you copy the source files out of this repository.

1. Ensure these files exist in your install location:

```text
%USERPROFILE%\.config\opencode\plugins\context-optimizer.js
%USERPROFILE%\.config\opencode\context-optimizer\context_optimizer.py
%USERPROFILE%\.config\opencode\context-optimizer\context_optimizer_cli.py
%USERPROFILE%\.config\opencode\context-optimizer\context_optimizer_hook.py
```

2. Start OpenCode normally.

3. OpenCode will automatically load `~/.config/opencode/plugins/context-optimizer.js`.

4. During `experimental.session.compacting`, the wrapper will:

- collect compaction context,
- call the Python bridge,
- append an `## Optimized Context` block when optimization succeeds,
- and fall back to a no-op when Python or Python dependencies are missing.

5. Verify behavior by triggering a compaction flow and watching for the optimized context block or for a single warning message if the wrapper falls back.

**Verify the plugin loads:** confirm that `~/.config/opencode/plugins/context-optimizer.js` is present and that the compaction hook can call the Python bridge successfully.

> [!CAUTION]
> Do not copy `tests/` or any `__pycache__/` folder into `~/.config/opencode/plugins/`. Keep the JS plugin separate from the Python support directory.

---

## Usage

In the supported wrapper path, the optimizer automatically:

1. Combines graph + memory
2. Keeps only relevant chunks
3. Removes duplicates
4. Compresses context
5. Appends the optimized result back into the compaction context from the JS wrapper

The Python core returns:

```python
context["optimized_context"]
```

The JS wrapper also adds a size summary line with the initial size, final size, and percentage saved.

The JS wrapper then appends that result to the OpenCode compaction context as:

```markdown
## Optimized Context

...
```

---

## Recommended Settings

All tuning lives in the `ContextOptimizer.__init__` constructor in `context_optimizer.py`. The most useful knobs:

```python
compression_rate = 0.5    # fraction of tokens to keep (0.5 = ~50%); lower = more aggressive
max_chunks       = 6      # how many top-ranked chunks to keep after reranking
dedupe_threshold = 0.9    # cosine similarity above which two chunks count as duplicates
```

You can also swap the models if you need a different speed/quality trade-off:

```python
reranker_model = "BAAI/bge-reranker-large"   # smaller alternative: BAAI/bge-reranker-base
embed_model    = "all-MiniLM-L6-v2"          # used for deduplication embeddings
```

> [!TIP]
> Start with the defaults. If responses lose important detail, raise `compression_rate` (keep more) or `max_chunks`. If prompts are still too large, lower them.

---

## What gets downloaded on first run

The first time the plugin runs, the underlying libraries download three models from [Hugging Face](https://huggingface.co/) and cache them locally (under `~/.cache/huggingface/` on macOS/Linux, `%USERPROFILE%\.cache\huggingface\` on Windows):

| Model | Purpose | Configured via |
| --- | --- | --- |
| `BAAI/bge-reranker-large` | Reranks chunks by relevance | `reranker_model` |
| `all-MiniLM-L6-v2` | Embeddings used for deduplication | `embed_model` |
| `microsoft/llmlingua-2-xlm-roberta-large-meetingbank` | Prompt compression | LLMLingua |

This download happens **once** and only needs network access the first time. Expect the first session to be slower while the models are fetched. Subsequent sessions load from cache.

---

## Expected Results

- 70–90% token reduction
- Faster Copilot responses
- Cleaner prompts

---

## Memory Compression

Compress before storing memory:

```python
compressed = optimizer.compress([text])
mempalace.store(compressed)
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: sentence_transformers` or `llmlingua` | Packages installed into a different Python than OpenCode uses | Re-install with `python -m pip install sentence-transformers llmlingua`, or activate the same virtual environment before launching OpenCode |
| `ImportError: cannot import name 'ContextOptimizer'` | The Python bridge cannot import the core optimizer | Make sure `context-optimizer/support-files/context_optimizer.py` and `context-optimizer/support-files/context_optimizer_cli.py` stay together in the repo, and that the installed copies stay together inside `~/.config/opencode/context-optimizer/` |
| `pip: command not found` | pip not installed / not on PATH | See [Install pip (one-liner)](#install-pip-one-liner) |
| First message hangs for a long time | Models are downloading from Hugging Face | Wait for the one-time download to finish; see [What gets downloaded on first run](#what-gets-downloaded-on-first-run) |
| Hook never runs / context unchanged | The JS wrapper was not loaded or compaction did not fire | Confirm `~/.config/opencode/plugins/context-optimizer.js` exists and trigger a session compaction |
| You expect console output but see none | Logging was moved to `context-optimizer/context-optimizer.log` under the OpenCode config root | Check the `.log` file instead of the terminal |
| You see a warning and no optimized context block | The wrapper fell back to no-op mode because Python, dependencies, or the bridge failed | Read the warning text, fix the Python issue, and retry |
| Out-of-memory or very slow CPU | Reranker model is large | Switch `reranker_model` to `BAAI/bge-reranker-base` in `context_optimizer.py` |

---

## Done ✅

Your agent now uses efficient token-aware context.
