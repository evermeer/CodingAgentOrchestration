# AI Coding Agent Orchestration

A reference architecture for agentic software development.

![AI Agent Orchestration](./banner.svg)

This configuration guide is an opinionated but practical handbook that argues for treating AI coding tools as a composable, multi-agent system rather than a single assistant,
and then walks through how to implement that mindset using [OpenCode](https://github.com/anomalyco/opencode)'s CLI, configuration system, and ecosystem (agents, tools, skills, and plugins).
It emphasizes that productivity gains come from structured context, explicit orchestration, and layered configuration (global -> project -> runtime),
enabling developers to build a repeatable “AI team” that plans, codes, reviews, and integrates work with minimal manual prompting.

If you want the shortest path through the material: read Part 1 for the mental model, follow Part 2 for the baseline setup, use Part 3 only for the integrations you actually need, and use Part 4 only after your setup has grown enough to justify orchestration cleanup.

> [!TIP]
> Even if you already know the composition of an AI coding agent, Part 1 is still a good place to refresh that knowledge.

> [!NOTE]
> This is an opinionated selection of tools and instructions based on personal experience. The AI tooling ecosystem changes quickly, so treat this as a starting point and adapt it to your own workflow.

[MIT License](LICENSE)

---

## Who This Is For

- Developers who already use AI coding assistance in an IDE and want to understand when a CLI agent adds value.
- Engineers who want a repeatable [OpenCode](https://github.com/anomalyco/opencode) setup for local development, documentation, context, and external tools.
- Advanced users who want to extend coding agents with skills, MCP servers, LSPs, Jira, Azure DevOps, and Azure integrations.

Parts 1 and 2 are accessible to anyone interested in AI-assisted development. Part 3 is more advanced and focuses on optional tooling, custom skills, and integrations.

## How To Read This Guide

Start with Part 1 if you are new to AI coding agents or if you want to refresh the concepts. Go directly to Part 2 if you already understand the basics and want the default setup. Use Part 3 as a reference when you are ready to extend the environment.

Suggested reading paths:

- New to coding-agent CLIs: Part 1 → Part 2
- Already using OpenCode and want a stronger setup: Part 2 → selected sections from Part 3
- Already installed several plugins, skills, and MCP servers: Part 4 after finishing Part 2 or Part 3

## Guide Parts

1. [Part 1: Why Use an AI Coding Agent CLI?](docs/part-1-why-use-an-ai-coding-agent-cli.md)  
   Explains the evolution from chat and IDE completion to agentic CLI workflows, the agent loop, context management, and the tool landscape.

2. [Part 2: A default setup](docs/part-2-default-setup.md)  
   Provides the practical setup path: installing OpenCode, adding context, configuring tools, installing skill packs, and adopting daily-use habits.

3. [Part 3: Advanced Use](docs/part-3-advanced-use.md)  
   Covers optional advanced additions such as engineering skills, custom review workflows, SQL LSP support, Jira workflows, Azure DevOps, and Azure MCP integration.

4. [Part 4: Optimisation](docs/part-4-optimisation.md)  
   This part describes a couple of post install optimisations that you could do for eliminating overlap in skill packs and MCP servers, orchestration layers. There is also a section about optimising your model routing strategy and budget management.

## [The context-optimizer plugin](context-optimizer/README.md)

There is software for content reranking, deduplication, and compression but i could not find a good existing plugin for [OpenCode](https://github.com/anomalyco/opencode). I created the [context-optimizer plugin](context-optimizer/README.md) to fill this gap but you do have to be aware that it's optimised for this default setup. The plugin uses [Huggingface SentenceTransformers](https://github.com/huggingface/sentence-transformers/) (for reranking and deduplication) and [Microsoft LLMLingua](https://github.com/microsoft/LLMLingua) (for compression). On CPU-only Windows installs, follow the CPU PyTorch instructions in the plugin README; the optimizer automatically selects a smaller, CPU-friendly LLMLingua-2 model instead of the larger CUDA-oriented one. The installation is part of [Part 2: A default setup](docs/part-2-default-setup.md).

## Contribution

Questions, corrections, and suggestions are welcome. Open an issue at [CodingAgentOrchestration issues](https://github.com/evermeer/CodingAgentOrchestration/issues/) or contribute with a [pull request](https://github.com/evermeer/CodingAgentOrchestration/pulls).

Useful contributions include:

- correcting stale install prompts or links
- adding verification steps for existing integrations
- documenting tradeoffs for tools that looked promising but did not hold up in practice
- improving cross-platform instructions where Windows, macOS, and Linux differ
 
