
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
- 📁 context_optimizer.py → core logic (rerank + dedupe + compress)
- 📁 context_optimizer_hook.py → OpenCode/agent integration hook

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
> On Windows, `python` and `pip` may be `py` and `py -m pip`. On macOS/Linux they may be `python3` and `pip3`. Use whichever resolves on your machine.

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

### 1. Install dependencies

Install the two Python packages (PyTorch is pulled in automatically):

```bash
pip install sentence-transformers llmlingua
```

> [!NOTE]
> This is a sizeable download (PyTorch alone is several hundred MB). On a slow connection this step can take a few minutes.

**Verify the install:**

```bash
python -c "import sentence_transformers, llmlingua; print('ok')"
```

If this prints `ok`, the dependencies are ready. If you see `ModuleNotFoundError`, the packages were installed into a different Python than the one on your PATH — re-run the install with `python -m pip install sentence-transformers llmlingua` so the package and interpreter match.

---

### 2. Add the plugin files

Both files must live **in the same folder** — `context_optimizer_hook.py` imports `context_optimizer.py` directly (`from context_optimizer import ContextOptimizer`). Copy both into your OpenCode global plugins folder:

- 📁 `plugins/context_optimizer.py` → core logic (rerank + dedupe + compress)
- 📁 `plugins/context_optimizer_hook.py` → the pipeline hook that oh-my-openagent calls

**Where is the global plugins folder?**

| OS | Path |
| --- | --- |
| macOS / Linux | `~/.config/opencode/plugins/` |
| Windows | `%USERPROFILE%\.config\opencode\plugins\` |

Create the folder if it does not exist, then copy the files:

```bash
# macOS / Linux
mkdir -p ~/.config/opencode/plugins
cp plugins/context_optimizer.py plugins/context_optimizer_hook.py ~/.config/opencode/plugins/
```

```powershell
# Windows (PowerShell)
New-Item -ItemType Directory -Force "$env:USERPROFILE\.config\opencode\plugins" | Out-Null
Copy-Item plugins\context_optimizer.py, plugins\context_optimizer_hook.py "$env:USERPROFILE\.config\opencode\plugins\"
```

> [!TIP]
> Installing into the **global** `~/.config/opencode/` folder makes the plugin available in every OpenCode session. If you only want it for one repository, place the files in that project's local `opencode/plugins/` folder instead.

---

### 3. Register in oh-my-openagent

Add the hook to your agent pipeline so it runs **after** context is gathered (graph + memory) but **before** the prompt is built. Open your oh-my-openagent config (typically under `~/.config/opencode/`, e.g. `agent.yaml` / `agent.yml`, or the agent block in `opencode.json`) and add the `context_optimizer_hook.run` line:

```yaml
agent:
  pipeline:
    - graphify.expand        # expands the knowledge graph
    - mempalace.retrieve     # pulls relevant memories

    - context_optimizer_hook.run   # ← rerank + dedupe + compress

    - prompt_builder.build   # builds the final prompt
    - llm.call               # sends it to the model
```

**Why this order matters:** the optimizer only helps if it sees the *combined* graph + memory context, so it must come after `graphify.expand` and `mempalace.retrieve`. It must come before `prompt_builder.build` so the trimmed-down context is what actually reaches the model.

> [!NOTE]
> The exact step names (`graphify.expand`, `mempalace.retrieve`, `prompt_builder.build`) depend on your setup. Keep the steps you already have and simply insert `context_optimizer_hook.run` between the retrieval steps and the prompt-building step.

**Verify the plugin loads:** restart OpenCode and start a new session. On the first message you should see the models download (see below); on later messages the context handed to the model should be noticeably shorter.

---

## Usage

The optimizer automatically:

1. Combines graph + memory
2. Keeps only relevant chunks
3. Removes duplicates
4. Compresses context

Output is stored in:

```python
context["optimized_context"]
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
| `ImportError: cannot import name 'ContextOptimizer'` | The two files are in different folders | Make sure `context_optimizer.py` and `context_optimizer_hook.py` sit side by side in the plugins folder |
| `pip: command not found` | pip not installed / not on PATH | See [Install pip (one-liner)](#install-pip-one-liner) |
| First message hangs for a long time | Models are downloading from Hugging Face | Wait for the one-time download to finish; see [What gets downloaded on first run](#what-gets-downloaded-on-first-run) |
| Hook never runs / context unchanged | Pipeline line missing or misplaced | Confirm `context_optimizer_hook.run` is in the `agent.pipeline` between retrieval and `prompt_builder.build`, then restart OpenCode |
| Out-of-memory or very slow CPU | Reranker model is large | Switch `reranker_model` to `BAAI/bge-reranker-base` in `context_optimizer.py` |

---

## Done ✅

Your agent now uses efficient token-aware context.
