# Part 2: A Default Setup

> [!NOTE]
> This part turns the concepts from [Part 1: Why Use an AI Coding Agent CLI?](part-1-why-use-an-ai-coding-agent-cli.md) into a practical setup. After finishing this default setup, use [Part 3: Advanced Use](part-3-advanced-use.md) for optional skills, custom workflows, and integrations, and then use [Part 4: Self optimisation](part-4-optimisation.md) to let OpenCode optimize itself and remove any remaining orchestration overlap.

This section gets you up and running with a working [OpenCode](https://github.com/anomalyco/opencode) environment. Before running each prompt, evaluate whether you actually need it. If you do not use Jira, for example, you do not need to install the Atlassian MCP.

Instead you could also do a similar setup using this [Claude Code Installation](claude-code-install.md) guide.


To make the install prompts below more reproducible across machines, keep the same discipline every time: prefer user-scope installs over repo-local ones, print exact versions and install paths, list every config file changed, and verify the result with one concrete command or action before moving on.

> [!NOTE]
> Be aware that some prompts below can take 10 minutes. Prompts that create custom skills can take half an hour or longer to complete.

## Prerequisites

| Requirement | Notes |
|---|---|
| **Windows** | macOS should work too |
| **Git** | Installed and on PATH |
| **Node.js** | For npm/npx |
| **Python** | Some plugins run Python scripts |
| **GitHub Copilot account** | For model access — but almost any LLM provider will do |

> [!WARNING]
> I have had some issues where the agent would get stuck in a loop and not recognize a "done" or "continue" signal. If that happens, restart OpenCode, use `/session` to reconnect to the aborted session, and type `continue`. This can happen when the loop flow is not deterministic. If it happens more often, then see [Part 4: Optimisation](part-4-optimisation.md) for instructions that would make it more deterministic.

## Step 1: Install the OpenCode CLI

Install the [OpenCode](https://github.com/anomalyco/opencode) CLI globally via npm:

```bash
npm i -g opencode-ai@latest
```

**Verify**: Run `opencode` in your terminal. You should see the OpenCode interface launch.

On first launch, follow the on-screen instructions to configure it for your LLM provider (e.g. GitHub Copilot).

If this does not work, stop here and fix the base install first. Most later setup issues become much harder to diagnose when the CLI itself is only partially working.

## Step 2: Install [OpenCode](https://github.com/anomalyco/opencode) Desktop

[OpenCode](https://github.com/anomalyco/opencode) Desktop gives you a GUI with advanced repository and session management on top of the CLI.

Download and install the Windows application (or macOS version) from: https://opencode.ai/download

**Verify**: Launch OpenCode Desktop. It should detect your CLI installation and show available repositories.

If Desktop cannot see the CLI, close both tools, open a fresh terminal, run `opencode --help`, and then restart Desktop. That usually confirms whether the problem is the install itself or Desktop's detection.

> [!TIP]
> Turn off the panel that shows git diffs and file changes — you already have that in Visual Studio / VS Code, and it can cause performance issues on large repositories or changes.

> [!NOTE]
> OpenCode Desktop is still in beta. The loop issue seems to happen more often on Desktop. If you experience repeated loop issues, consider using the CLI version until the issue is resolved in Desktop.

> [!WARNING]
> The install prompts below often create and execute scripts. Your antivirus might block these, especially when using the Desktop app. You can add an exception for `opencode-cli.exe` if needed. If this happens, restart OpenCode, use `/session` to reconnect to the aborted session, and type `continue`.


## Step 3: Enable the [Safety net](https://github.com/kenryu42/claude-code-safety-net) plugin

The [Safety net](https://github.com/kenryu42/claude-code-safety-net) plugin helps prevent critical mistakes like deleting files or pushing directly to main.

**Prompt for OpenCode:**

```
Goal: Install a safety net plugin for OpenCode to prevent critical mistakes like deleting files or pushing directly to main.

Instructions:
1. Fetch and follow the latest official installation guide for the cc-safety-net plugin at: https://github.com/kenryu42/claude-code-safety-net
2. Make sure to follow the instructions for OpenCode.
3. Install the cc-safety-net plugin globally (user-scope) in `~/.config/opencode/opencode.json` (or `.jsonc`) according to the schema at: https://opencode.ai/config.json
4. Print the final plugin version, the config file path that was modified, and the exact config snippet that was added.
5. Verify that the plugin is loaded by restarting OpenCode and showing that the plugin is registered.
```


## Step 4: Extra Agent Power

### 4.1 Install and Configure [Oh-My-OpenAgent](https://github.com/code-yeongyu/oh-my-openagent)

[Oh-My-OpenAgent](https://github.com/code-yeongyu/oh-my-openagent) is the most impactful plugin for OpenCode. It gives you: intent parsing, classification / reranking, priority rules, fallback & recovery logic (an improved agent loop) and model routing.

**Prompt for OpenCode:**

```
Goal: Install and configure oh-my-openagent globally for OpenCode.

Instructions:
1. Fetch and follow the latest official installation guide:
   https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/refs/heads/dev/docs/guide/installation.md
2. Install globally (user-scope), not per-repository, so it is available in every OpenCode session.
3. Detect my OS (Windows / macOS / Linux) and use the matching commands. Do not assume a shell.
4. If a step fails, print the exact error and proposed fix before retrying. Do not silently skip.
5. Print the installed version, install location, and every config file changed.
6. Verify by listing the available agents in OpenCode and confirming Sisyphus is selectable.
```

**After installation:**
1. Close OpenCode Desktop and start OpenCode CLI.
2. Activate the Sisyphus Agent (oh-my-opencode) with GPT 5.4 or later or Claude Opus 4.6 or later if reasoning is your major task.
3. Close OpenCode CLI and start OpenCode Desktop.

**Verify**: After restart, you should see the Sisyphus agent available in the agent selector dropdown.

## Step 5: Give Your Agent Context

### Step 5.1 Standard Method
The standard way to add context is to create an `Agents.md` file in the root of your repository. This file will be used as a knowledge base for your agent when running skills. You can add any relevant information about your project, architecture, coding guidelines, etc. The more relevant context you provide, the better the agent's performance will be. Don't make the file too big. Something between 100 and 200 lines should be enough.

Run `/init` inside OpenCode in your repository folder. This will create an `Agents.md` file. Customize it with information specific to your repository. It would be nice to commit this so that everyone on your team uses the same knowledge base.

**Verify**: Check that an `Agents.md` file was created in your repo root.

You can also make the `Agents.md` file the default knowledge base for GitHub Copilot in Visual Studio so that it will also be used inside Visual Studio.

**Prompt for OpenCode:**

```
Goal: Reuse the repository's Agents.md as the GitHub Copilot knowledge base inside Visual Studio and VS Code, without duplicating content.

Instructions:
1. Locate the Agents.md at the repository root. If it does not exist, stop and tell me.
2. Configure GitHub Copilot to use this file as a custom-instructions / knowledge source (in Visual Studio and VS Code)
3. Make sure it will be used no matter which solution is opened
4. Do not duplicate the content; reference it.
5. Print the list of files created or modified, and verify by opening one solution folder and confirming Copilot picks up the instructions.
6. If the Visual Studio and VS Code setups differ, explain the difference explicitly instead of hiding it behind one generic instruction.
```

### Step 5.2 Advanced Knowledge Tool for Your Repository or Documents
[Graphify](https://github.com/safishamsi/graphify) is a tool that can create a knowledge graph of your repository and/or documentation. This can give your agent a much richer context to work with. You can install it and use it to generate a graph of your repo, then point your agent to that graph for enhanced understanding.

> [!WARNING]
> First close all applications because this step could easily use 6GB+ of memory during processing if you execute it on a folder with a lot of data.

**Prompt for OpenCode:**

```
Goal: Install Graphify globally and initialize a knowledge graph for this repository, available in OpenCode and Visual Studio / VS Code Copilot.

Instructions:
1. If this is a git repository, append `**/graphify-out/` and `.graphify*` to `.gitignore` (create the file if missing). Skip lines that already exist.
2. Install Graphify globally (user-scope, not per-repo) following the latest instructions at:
   https://github.com/safishamsi/graphify
   Detect my OS and use the matching commands. If a step fails, surface the exact error and proposed fix before retrying.
3. Register Graphify as an MCP / tool in:
   - OpenCode (global config)
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
   so it is always active when any of them is opened in this folder.
4. Initialize Graphify for the current repository and rebuild `graphify-out` from scratch.
5. Exclude vendor/build/minified noise (e.g. node_modules, bin, obj, dist, build, .next, .nuxt, *.min.*, packages, vendor). Add or update the Graphify ignore config accordingly.
6. Graphify has no hard size cap. If it prompts for a sub-folder to limit scope, process the entire filtered tree recursively without asking for confirmation. Only stop when the full filtered tree is processed and verified.
7. After completion, print:
   - the number of indexed files / nodes / edges
   - the Graphify version and install path
   - every config file or ignore file that was changed
   - how to query the graph from OpenCode and from Copilot.

pip install --upgrade graphifyy
pip install graphifyy[sql]
/graphify .
```

You can use `Agents.md` and the Graphify graph together. `Agents.md` is better for higher-level project guidance, while the graph is better for detailed structural context about the codebase.

### Step 5.3 AI Agent Session Memory
Adding [MemPalace](https://github.com/MemPalace/mempalace) as a session memory tool to your agent can give it an intent context that persists across interactions. This can help the agent remember previous conversations, decisions, and actions, allowing for more coherent and context-aware responses.

**Prompt for OpenCode:**

```
Goal: Install MemPalace globally and make it available as a tool/MCP in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Instructions:
1. Install MemPalace globally (user-scope) following the latest instructions at:
   https://github.com/MemPalace/mempalace
   Detect my OS and use the matching commands. On failure, print the exact error and a proposed fix before retrying.
2. Register it in the global MCP config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
   so it is loaded in every session, in every repository.
3. From this repository folder, run the `init` command to create a memory palace for it, then run the `mine` command to seed memory from the existing code and history.
4. Link the resulting memory palace to the active agent so it is queried automatically.
5. After completion, print:
   - the installed MemPalace version
   - the install location and global config paths that were updated
   - the location of the memory palace for this repo
   - a one-line verification query showing recall works.
```

Here is a short overview of the differences between MemPalace and Graphify:

| Dimension        | MemPalace                              | Graphify                                      |
|------------------|----------------------------------------|-----------------------------------------------|
| Primary target   | Conversations & decisions              | Files & artifacts                             |
| Time dimension   | Cross-session, historical              | Snapshot of a folder                          |
| Storage          | Verbatim memory + compressed summaries | Graph of entities & relationships             |
| Query style      | Semantic recall                        | Topological traversal                         |
| Best for         | *Why we decided something*             | *How the system is structured*                |

### Step 5.3: Context optimization plugin

Install the [OpenCode DCP plugin](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) to let your agent automatically manage its conversation context and reduce token usage. The plugin prunes irrelevant or low-value parts of the conversation history while keeping the essential information, allowing the agent to focus on the most relevant context for each interaction.

**Run from your shell:**

```
opencode plugin @tarquinen/opencode-dcp@latest --global
```

This installs the package and adds it to your global OpenCode config.

Restart OpenCode and verify that the plugin is loaded by executing the `/DCP` command.

## Step 6: Give Your Agent Tools

Before adding more tools, do one quick sanity check on the base environment:

- `git --version` should succeed without first-run prompts
- `node --version` and `npm --version` should both work from the same shell you use for OpenCode
- `opencode --help` should render cleanly and exit normally
- if a global install succeeds but the command is missing, your PATH is usually the first thing to inspect

Common quick fixes:

- Command not found: restart the terminal so PATH changes are picked up
- Wrong Node version: switch to the expected version before installing packages globally
- Antivirus blocked a script: add the needed exception, restart the session, and continue from there
- Corporate laptop restrictions: prefer the package manager and shell already approved in your environment instead of mixing installers

### Step 6.1 Reading Various Document Formats
Install [markitdown](https://github.com/microsoft/markitdown) from Microsoft to give your agent the ability to understand common document formats such as Office files and PDFs.

**Prompt for OpenCode:**

```
Goal: Install Microsoft markitdown globally and expose it as a tool/MCP in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Instructions:
1. Install markitdown globally (user-scope) following the latest instructions at:
   https://github.com/microsoft/markitdown
   Detect my OS and use the matching commands. Prefer `pipx` if available so the install is isolated and global.
2. Register markitdown (or its MCP server variant if provided upstream) in the global config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
3. On any step failure, print the exact error plus proposed fix before retrying.
4. Print the installed version, install path, and config files changed.
5. Verify by converting one sample file of each: PDF, DOCX, XLSX, PPTX (skip the ones I do not have), and report the result.
```

### Step 6.2 Up-to-Date Library Documentation
Install [Context7](https://github.com/upstash/context7) from Upstash to give your agent on-demand access to current, version-specific documentation and code examples for any library or framework.

**Prompt for OpenCode:**

```
Goal: Install Upstash Context7 globally and expose it as a tool/MCP in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Instructions:
1. Install the Context7 MCP server globally (user-scope) following the latest instructions at:
   https://github.com/upstash/context7
   Detect my OS and use the matching commands. Requires Node.js >= v18.
   If an API key is needed, get one from https://context7.com/dashboard and store it in my global config (never hardcode it in a committed file).
2. Register the Context7 MCP server in the global config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
3. Print the installed version, install path, and config files changed.
4. On any step failure, print the exact error plus proposed fix before retrying.
5. Verify by resolving one library and fetching its docs (e.g. "Next.js routing"), and report the result.
```

### Step 6.3 Web Search
Install the [Exa MCP server](https://github.com/exa-labs/exa-mcp-server) to give your agent fast, clean web search that returns ready-to-use content instead of raw result pages.

**Prompt for OpenCode:**

```
Goal: Install the Exa web-search MCP server globally and expose it as a tool/MCP in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Instructions:
1. Configure the Exa MCP server (user-scope, global) following the latest instructions at:
   https://github.com/exa-labs/exa-mcp-server
   Prefer the hosted remote endpoint https://mcp.exa.ai/mcp. Detect my OS and use the matching commands.
   An Exa API key is required: get one from https://dashboard.exa.ai and store it in my global config (never hardcode it in a committed file).
2. Register the Exa MCP server in the global config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
3. Print the configured endpoint, install or registration path, and every config file changed.
4. On any step failure, print the exact error plus proposed fix before retrying.
5. Verify by running one web search and report the result.
```

### Step 6.4 Search Real-World Code on GitHub
Install the [grep.app MCP server](https://mcp.grep.app) to let your agent search literal code patterns across a million-plus public GitHub repositories for real-world usage examples.

**Prompt for OpenCode:**

```
Goal: Install the grep.app code-search MCP server globally and expose it as a tool/MCP in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Instructions:
1. Configure the grep.app MCP server (user-scope, global) using the hosted HTTP endpoint:
   https://mcp.grep.app
   No API key is required. Detect my OS and use the matching commands (e.g. an HTTP/remote transport entry).
2. Register the grep.app MCP server in the global config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
3. Print the configured endpoint and every config file changed.
4. On any step failure, print the exact error plus proposed fix before retrying.
5. Verify by searching for one code pattern (e.g. `useState(`) and report the result.
```

## Step 7: Give Your Agent Skills

These skills give OpenCode broad capabilities: superpowers, planning, agency roles, and more.

You can use the complete prompt below to install all in one go, or copy and paste each step separately to have a better view over what is happening.

---

### [Superpowers](https://github.com/obra/superpowers) skills pack
Superpowers is a complete software development methodology for your coding agents, built on top of a set of composable skills and some initial instructions that make sure your agent uses them.

**Prompt for OpenCode:**

```
Goal: Install the "superpowers" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/obra/superpowers.git
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
```

### [Agency Agents](https://github.com/msitarzewski/agency-agents) skills pack
A complete AI agency at your fingertips - From frontend wizards to Reddit community ninjas, from whimsy injectors to reality checkers. Each agent is a specialized expert with personality, processes, and proven deliverables.
**Prompt for OpenCode:**

```
Goal: Install the "agency" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/msitarzewski/agency-agents
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
- Re-map skill paths so each file `<category>/<category>-<name>.md` becomes the skill `/agency/<category>/<name>`.
  Example: `engineering/engineering-devops-automator.md` -> `/agency/engineering/devops-automator`.
- Apply the mapping consistently for every category, not only engineering.
```

### [Knowledge Work](https://github.com/anthropics/knowledge-work-plugins) skills pack
A collection of skills for knowledge workers for your role, team, and company.

**Prompt for OpenCode:**

```
Goal: Install the "knowledge-work" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/anthropics/knowledge-work-plugins
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
```

### [Product Manager](https://github.com/phuryn/pm-skills) skills pack
The AI Operating System for Better Product Decisions. 65 PM skills and 36 chained workflows across 8 plugins. From discovery to strategy, execution, launch, and growth.

**Prompt for OpenCode:**

```
Goal: Install the "PM" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/phuryn/pm-skills
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
```

### [The Minimalist Entrepreneur](https://github.com/slavingia/skills) Skills pack
A collection of skills based on the book "The Minimalist Entrepreneur" by Sahil Laving

**Prompt for OpenCode:**

```
Goal: Install "The Minimalist Entrepreneur" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/slavingia/skills
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
```

### [Gary Tang gstack](https://github.com/garrytan/gstack) Skills pack
A collection of skills based on Gary Tang's gstack framework. A virtual engineering team — a CEO who rethinks the product, an eng manager who locks architecture, a designer who catches AI slop, a reviewer who finds production bugs, a QA lead who opens a real browser, a security officer who runs OWASP + STRIDE audits, and a release engineer who ships the PR.

**Prompt for OpenCode:**

```
Goal: Install the "Gary Tang gstack" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/garrytan/gstack
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
```

**Verify**: After installation, run `/help` or check `~/.config/opencode/skills/` to confirm the skills directories were created.


## Tips

### For Daily Use

- **Refine before executing** — Before instructing your agent to implement something, first ask it to *restate* the task and list its assumptions. Correct it, then let it run. This single habit drastically reduces wasted runs.
- **One topic per session** — Start a fresh session per task. Long sessions accumulate irrelevant context and increase cost while reducing accuracy.
- **Pin the model to the task** — Use a strong reasoning model for planning/refactors and a faster, cheaper model for mechanical edits. OpenCode lets you switch mid-session.
- **Read the diff** — Always review what the agent changed before committing. Treat it like a junior developer's PR.
- **Write down recurring corrections** — When you keep correcting the same thing, move it into `Agents.md` (or a skill) so the agent learns it permanently.

### More Tips (After Installing the Advanced Use Add-ons)
- **Automatic code reviews** — Use `/code-review-expert` to review your current branch against `develop`. No manual input needed; it will ask which improvements to apply.
- **Planning** — Create one or more markdown files with functional specs and ask OpenCode to build a plan from them using `planning-with-files`, then ask it to execute the plan step-by-step.
- **Worktrees for parallel agents** — Use `git worktree` (see the `branch-review` skill) so multiple agents can work on different branches simultaneously without stepping on each other.

---

> [!NOTE]
> Continue with [Part 3: Advanced Use](part-3-advanced-use.md) for optional skills, custom workflows, and integrations.
