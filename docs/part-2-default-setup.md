# Part 2: A default setup

> [!NOTE]
> This part turns the concepts from [Part 1: Why Use an AI Coding Agent CLI?](part-1-why-use-an-ai-coding-agent-cli.md) into a practical setup. After finishing this default setup, use [Part 3: Advanced Use](part-3-advanced-use.md) for optional skills, custom workflows, and integrations.

This section gets you up and running with a working OpenCode environment.

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

## Step 1: Install the OpenCode CLI

Install the OpenCode CLI globally via npm:

```bash
npm i -g opencode-ai@latest
```

**Verify**: Run `opencode` in your terminal. You should see the OpenCode interface launch.

On first launch, follow the on-screen instructions to configure it for your LLM provider (e.g. GitHub Copilot).

## Step 2: Install OpenCode Desktop

OpenCode Desktop gives you a GUI with advanced repository and session management on top of the CLI.

Download and install the Windows application (or macOS version) from: https://opencode.ai/download

**Verify**: Launch OpenCode Desktop. It should detect your CLI installation and show available repositories.

> [!TIP]
> Turn off the panel that shows git diffs and file changes — you already have that in Visual Studio / VS Code, and it can cause performance issues on large repositories or changes.

> [!NOTE]
> OpenCode Desktop is still in beta. I have had issues with it that it would not continue a session and appeared to got stuck in a loop and also it did not recognized a done making it repeat the last step over and over again.

> [!WARNING]
> The install prompts below often create and execute scripts. Your antivirus might block these, especially when using the Desktop app. You can add an exception for `opencode-cli.exe` if needed. If this happens, restart OpenCode, use `/session` to reconnect to the aborted session, and type `continue`.


## Step 3: Extra power: Install and Configure Oh-My-OpenAgent

Oh-My-OpenAgent is the most impactful plugin for OpenCode. It gives you: intent parsing, classification / reranking, priority rules, fallback & recovery logic (an improved agent loop). The default agent in the CLI is getting better but Oh-My-OpenAgent still gives better results.

**Prompt for OpenCode:**

```
Goal: Install and configure oh-my-openagent globally for OpenCode.

Instructions:
1. Fetch and follow the latest official installation guide:
   https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/refs/heads/dev/docs/guide/installation.md
2. Install globally (user-scope), not per-repository, so it is available in every OpenCode session.
3. Detect my OS (Windows / macOS / Linux) and use the matching commands. Do not assume a shell.
4. If a step fails, print the exact error and proposed fix before retrying. Do not silently skip.
5. Verify by listing the available agents in OpenCode and confirming Sisyphus is selectable.
```

**After installation:**
1. Close OpenCode Desktop, and start Opencode CLI 
2. Activate the Sisyphus Agent (oh-my-opencode) with GPT 5.4 or later or Claude Opus 4.6 or later if reasoning is your major task.
3. Close OpenCode CLI and start OpenCode Desktop. 

**Verify**: After restart, you should see the Sisyphus agent available in the agent selector dropdown.

## Step 4: Give your agent context.

### Step 4.1 Standard Method
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
```

### Step 4.2 Advanced knowledge tool for your repository or documents (partially alternative for Agents.md):
Graphify is a tool that can create a knowledge graph of your repository and/or documentation. This can give your agent a much richer context to work with. You can install it and use it to generate a graph of your repo, then point your agent to that graph for enhanced understanding.

**Warning**: First close all applications because this step could easily use 6GB+ of memory during processing.

**Warning 2**: If you run this on a OneDrive folder then a lot of generated cache files will be synced to the cloud.

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
   - how to query the graph from OpenCode and from Copilot.

pip install --upgrade graphifyy
pip install graphifyy[sql]
/graphify .
```

You could use the agents.md and Graphify graph together. The agents.md can be used for more high level information about the project and the graph can be used for more detailed information about the codebase.


### Step 4.3 AI Agent Session Memory 
Adding a session memory tool to your agent can give it an intent context that persists across interactions. This can help the agent remember previous conversations, decisions, and actions, allowing for more coherent and context-aware responses.

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
   - the install location and global config paths that were updated
   - the location of the memory palace for this repo
   - a one-line verification query showing recall works.
```

Here a short overview of the differences between mempalace and graphify:

| Dimension        | MemPalace                              | Graphify                                      |
|------------------|----------------------------------------|-----------------------------------------------|
| Primary target   | Conversations & decisions              | Files & artifacts                             |
| Time dimension   | Cross-session, historical              | Snapshot of a folder                          |
| Storage          | Verbatim memory + compressed summaries | Graph of entities & relationships             |
| Query style      | Semantic recall                        | Topological traversal                         |
| Best for         | *Why we decided something*             | *How the system is structured*                |


## Step 5: Give your agent tools.

### Step 5.1 Reading various document formats.
Install markitdown from Microsoft to give your agent the power to understand all kinds of document formats (office, pdf, etc.). 

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
4. Verify by converting one sample file of each: PDF, DOCX, XLSX, PPTX (skip the ones I do not have), and report the result.
```

### Step 5.2: Connect to Jira with the Jira MCP

Install the Jira MCP server to give your agent the power to read and write Jira tickets. 
This can be very useful for generating tickets from code reviews, linking code changes to existing tickets, 
or asking your agent to update a ticket based on code changes or even ask to refine or implement a ticket. 

> Be aware that the prompt below may still need improvement. Authentication required manual tweaking during the first attempt, so validate the result before reusing it on another machine.

**Prompt for OpenCode:**

```
Goal: Install the Atlassian Jira MCP server globally for OpenCode, Visual Studio Copilot, and VS Code Copilot, authenticated via a personal API token (not interactive OAuth), and bind a board to this repository.

Instructions:
1. Follow the latest instructions at:
   https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/
2. Register the MCP in the GLOBAL config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
   so it is available in every session and every repository. Do not write secrets into a per-repo file that could be committed.
3. Open this URL in my default browser so I can create a token:
   https://id.atlassian.com/manage-profile/security/api-tokens
4. Then ask me for:
   - my Atlassian account email
   - my Atlassian base URL (e.g. https://<workspace>.atlassian.net)
   - the API token I just created
   and use that for the configuration of the MCP.
6. After auth works, query Jira for the boards I have access to, present a numbered list, let me pick one, and persist that board id PER REPOSITORY (e.g. in a local, git-ignored config file) so opening this folder auto-selects it. Do not store the token in this per-repo file.
7. On any failure, print the exact API response and the proposed fix before retrying.
8. Verify by listing the most recent 5 issues from the selected board.
9. If the above did not work without manual steps, then show me what prompt I should have used to get it right so that it could be reproduced on another machine.
```

## Step 6: Give your agent skills

These skills give OpenCode broad capabilities: superpowers, planning, agency roles, and more.

You can use the complete prompt below to install all in one go, or copy and paste each step separately to have a better view over what is happening.

---

### Superpowers 
Superpowers is a complete software development methodology for your coding agents, built on top of a set of composable skills and some initial instructions that make sure your agent uses them.

**Prompt for OpenCode:**

```
Goal: Install the "superpowers" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/obra/superpowers.git
- Install GLOBALLY for the current user (e.g. `~/.config/opencode/skills/<pack-name>/` or the OS-equivalent), NOT inside this repository.
- Clone the repo with `git clone --depth 1` so it can later be updated with `git pull`. If the destination already exists, run `git pull --ff-only` instead of re-cloning.
- Also register the skills for Visual Studio Copilot and VS Code Copilot using their supported skill / prompt-file mechanism (symlink or copy when symlinks are not supported on the OS).
- Preserve the upstream folder structure unless told otherwise. Do not rename files.
- After install, list the install path and the number of skills registered, and verify by running `/help` (or the equivalent skill list command) in OpenCode.
- On any failure, print the exact error and proposed fix before retrying.
```

### Agency Agents
A complete AI agency at your fingertips - From frontend wizards to Reddit community ninjas, from whimsy injectors to reality checkers. Each agent is a specialized expert with personality, processes, and proven deliverables.
**Prompt for OpenCode:**

```
Goal: Install the "agency" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/msitarzewski/agency-agents
- Install GLOBALLY for the current user (e.g. `~/.config/opencode/skills/<pack-name>/` or the OS-equivalent), NOT inside this repository.
- Clone the repo with `git clone --depth 1` so it can later be updated with `git pull`. If the destination already exists, run `git pull --ff-only` instead of re-cloning.
- Also register the skills for Visual Studio Copilot and VS Code Copilot using their supported skill / prompt-file mechanism (symlink or copy when symlinks are not supported on the OS).
- Preserve the upstream folder structure unless told otherwise. Do not rename files.
- After install, list the install path and the number of skills registered, and verify by running `/help` (or the equivalent skill list command) in OpenCode.
- On any failure, print the exact error and proposed fix before retrying.
- Re-map skill paths so each file `<category>/<category>-<name>.md` becomes the skill `/agency/<category>/<name>`.
  Example: `engineering/engineering-devops-automator.md` -> `/agency/engineering/devops-automator`.
- Apply the mapping consistently for every category, not only engineering.
```

### Knowledge Work Plugins
A collection of skills for knowledge workers for your role, team, and company.

**Prompt for OpenCode:**

```
Goal: Install the "knowledge-work" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/anthropics/knowledge-work-plugins
- Install GLOBALLY for the current user (e.g. `~/.config/opencode/skills/<pack-name>/` or the OS-equivalent), NOT inside this repository.
- Clone the repo with `git clone --depth 1` so it can later be updated with `git pull`. If the destination already exists, run `git pull --ff-only` instead of re-cloning.
- Also register the skills for Visual Studio Copilot and VS Code Copilot using their supported skill / prompt-file mechanism (symlink or copy when symlinks are not supported on the OS).
- Preserve the upstream folder structure unless told otherwise. Do not rename files.
- After install, list the install path and the number of skills registered, and verify by running `/help` (or the equivalent skill list command) in OpenCode.
- On any failure, print the exact error and proposed fix before retrying.
```

### PM Skills
The AI Operating System for Better Product Decisions. 65 PM skills and 36 chained workflows across 8 plugins. From discovery to strategy, execution, launch, and growth.

**Prompt for OpenCode:**

```
Goal: Install the "PM" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/phuryn/pm-skills
- Install GLOBALLY for the current user (e.g. `~/.config/opencode/skills/<pack-name>/` or the OS-equivalent), NOT inside this repository.
- Clone the repo with `git clone --depth 1` so it can later be updated with `git pull`. If the destination already exists, run `git pull --ff-only` instead of re-cloning.
- Also register the skills for Visual Studio Copilot and VS Code Copilot using their supported skill / prompt-file mechanism (symlink or copy when symlinks are not supported on the OS).
- Preserve the upstream folder structure unless told otherwise. Do not rename files.
- After install, list the install path and the number of skills registered, and verify by running `/help` (or the equivalent skill list command) in OpenCode.
- On any failure, print the exact error and proposed fix before retrying.
```

### The Minimalist Entrepreneur Skills
A collection of skills based on the book "The Minimalist Entrepreneur" by Sahil Laving

**Prompt for OpenCode:**

```
Goal: Install "The Minimalist Entrepreneur" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/slavingia/skills
- Install GLOBALLY for the current user (e.g. `~/.config/opencode/skills/<pack-name>/` or the OS-equivalent), NOT inside this repository.
- Clone the repo with `git clone --depth 1` so it can later be updated with `git pull`. If the destination already exists, run `git pull --ff-only` instead of re-cloning.
- Also register the skills for Visual Studio Copilot and VS Code Copilot using their supported skill / prompt-file mechanism (symlink or copy when symlinks are not supported on the OS).
- Preserve the upstream folder structure unless told otherwise. Do not rename files.
- After install, list the install path and the number of skills registered, and verify by running `/help` (or the equivalent skill list command) in OpenCode.
- On any failure, print the exact error and proposed fix before retrying.
```

### Gary Tang gstack Skills
A collection of skills based on Gary Tang's gstack framework. A virtual engineering team — a CEO who rethinks the product, an eng manager who locks architecture, a designer who catches AI slop, a reviewer who finds production bugs, a QA lead who opens a real browser, a security officer who runs OWASP + STRIDE audits, and a release engineer who ships the PR.

**Prompt for OpenCode:**

```
Goal: Install the "Gary Tang gstack" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/garrytan/gstack
- Install GLOBALLY for the current user (e.g. `~/.config/opencode/skills/<pack-name>/` or the OS-equivalent), NOT inside this repository.
- Clone the repo with `git clone --depth 1` so it can later be updated with `git pull`. If the destination already exists, run `git pull --ff-only` instead of re-cloning.
- Also register the skills for Visual Studio Copilot and VS Code Copilot using their supported skill / prompt-file mechanism (symlink or copy when symlinks are not supported on the OS).
- Preserve the upstream folder structure unless told otherwise. Do not rename files.
- After install, list the install path and the number of skills registered, and verify by running `/help` (or the equivalent skill list command) in OpenCode.
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

### More Tips (after installing the Advanced Use add-ons)
- **Automatic code reviews** — Use `/code-review-expert` to review your current branch against `develop`. No manual input needed; it will ask which improvements to apply.
- **Planning** — Create one or more markdown files with functional specs and ask OpenCode to build a plan from them using `planning-with-files`, then ask it to execute the plan step-by-step.
- **Worktrees for parallel agents** — Use `git worktree` (see the `branch-review` skill) so multiple agents can work on different branches simultaneously without stepping on each other.

---

> [!NOTE]
> Continue with [Part 3: Advanced Use](part-3-advanced-use.md) for optional skills, custom workflows, and integrations.
