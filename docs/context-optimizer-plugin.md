
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
- 🧠 [SentenceTransformers](https://github.com/huggingface/sentence-transformers/) (for reranking)
- 🗜️ [LLMLingua](https://github.com/your-repo/llmlingua) (for compression)

---

## Installation (CLI executable)

### 1. Install dependencies

Run:

```
pip install sentence-transformers llmlingua
```

---

### 2. Add to OpenCode project

Place files in your project:

```
copy the file plugins/context_optimizer.py and plugins/context_optimizer_hook.py to your opencode global plugins folder
```

---

### 3. Register in oh-my-openagent

Update your agent config:

```yaml
agent:
  pipeline:
    - graphify.expand
    - mempalace.retrieve

    - context_optimizer_hook.run

    - prompt_builder.build
    - llm.call
```

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

Edit in `context_optimizer.py`:

```python
compression_rate = 0.5
max_chunks = 6
```

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

## Done ✅

Your agent now uses efficient token-aware context.
