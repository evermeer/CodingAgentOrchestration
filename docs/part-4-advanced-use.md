# Part 4: Advanced Use

> [!NOTE]
> Previous: [Part 3: A default setup](part-3-default-setup.md)  
> This part assumes you have completed, or at least reviewed, [Part 3: A default setup](part-3-default-setup.md). Use these sections selectively; not every developer needs every advanced integration. After that, continue with [Part 5: Optimisation](part-5-optimisation.md) if you want OpenCode to simplify overlapping orchestration layers.

This part covers three categories of extensions you can add to OpenCode:

- **Skills** (3.1–3.2): Installable capabilities for planning, code review, design, and role-specific workflows (PO, architect, designer, and more). When you prompt OpenCode, it automatically selects the right skill for the job.
- **Language Server Protocols** (3.3): Give OpenCode real-time access to compiler diagnostics, type information, and code navigation.
- **MCP integrations** (3.4–3.5): Connect OpenCode to external services like Jira, Azure DevOps, and Azure cloud resources.

Each block below is an independent prompt you can paste into OpenCode. Pick the ones that match your workflow — you do not need all of them.

For better reproducibility, expect every installation prompt in this part to produce four things: the exact version installed, the install location, the config files changed, and one concrete verification result. If a prompt does not naturally force those outputs, add them when you run it.

## 3.1 Install Software Engineering (and DevOps) Extensions

First evaluate each of these extensions and decide which ones are useful for your workflow. Then run the corresponding prompts to install them.

### [Planning with Files](https://github.com/OthmanAdi/planning-with-files) plugin
The Oh-my-OpenAgent (installed in [Part 3](part-3-default-setup.md)) also has a planning skill

**Expected outcome:** After installation, when you ask OpenCode to plan a multi-step task it will create and maintain `task_plan.md`, `findings.md`, and `progress.md` in your repo root.

**Prompt for OpenCode:**

```
Goal: Install the "planning-with-files" skill pack globally for OpenCode, Visual Studio Copilot, and VS Code Copilot.
Source: https://github.com/OthmanAdi/planning-with-files.git
- Install GLOBALLY for the current user, NOT inside this repository.
- Follow the instructions for each coding agent.
- On any failure, print the exact error and proposed fix before retrying.
```

### Microsoft [.NET Skills](https://github.com/dotnet/skills) pack
Official Microsoft .NET skills for code generation, refactoring, testing, and documentation.

**Prompt for OpenCode:**

```
Goal: Install the official Microsoft .NET skill pack globally.

Documentation and installation instructions can be found at https://github.com/dotnet/skills 
Install GLOBALLY (user-scope), available in OpenCode, Visual Studio Copilot, and VS Code Copilot.
Print the installed version, install location, and config files changed.
```

### [Atlassian (Jira) MCP server](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/)

Install the [Atlassian (Jira) MCP server](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/) to give your agent the ability to read and write Jira tickets.
This is useful for generating tickets from code reviews, linking code changes to existing tickets, and asking the agent to refine, implement, or update tickets based on code changes.

> Be aware that the prompt below may still need improvement. Authentication required manual tweaking during the first attempt, so validate the result.

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
5. Print the final MCP registration details, the config files changed, and the install or endpoint information used.
6. After auth works, query Jira for the boards I have access to, present a numbered list, let me pick one, and persist that board id PER REPOSITORY (e.g. in a local, git-ignored config file) so opening this folder auto-selects it. Do not store the token in this per-repo file.
7. On any failure, print the exact API response and the proposed fix before retrying.
8. Verify by listing the most recent 5 issues from the selected board.
9. If the above did not work without manual steps, then show me what prompt I should have used to get it right so that it could be reproduced on another machine.
```

### [Open Design](https://github.com/nexu-io/open-design) skills pack

The open-source alternative to Claude Design. Local-first, web-deployable, BYOK at every layer — 16 coding-agent CLIs auto-detected on your PATH. Become the design engine, driven by 31 composable skills and 72 brand-grade design systems. No CLI? An OpenAI-compatible BYOK proxy is the same loop minus the spawn.

**Prompt for OpenCode:**

```
Goal: Install the Open Design skill pack GLOBALLY for the current user.

TARGET DIRECTORY: ~/.config/opencode/skills/open-design/
(On Windows: %USERPROFILE%\.config\opencode\skills\open-design\)

CLONE:
- If the directory does NOT exist: git clone --depth 1 https://github.com/nexu-io/open-design.git <target>
- If it DOES exist: cd <target> && git pull --ff-only

PRE-FLIGHT (Windows only):
- Run: Get-ExecutionPolicy -Scope CurrentUser
- If "Restricted", fix with: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
  (required for corepack/pnpm scripts to execute)

BUILD:
1. corepack enable
2. pnpm install
3. pnpm -r run build
   - If build fails with "tsc not found": add typescript as a root devDependency
     (pnpm add -Dw typescript) then retry.
   - If better-sqlite3 fails to compile:
     • Ensure Python 3.x and MSVC build tools are installed
     • Run: npx node-gyp rebuild --verbose  (inside node_modules/better-sqlite3)
     • Then retry: pnpm -r run build

VERIFY:
- Confirm daemon entry point exists: apps/daemon/dist/cli.js
- Start daemon: node <target>/apps/daemon/dist/cli.js --port 4400 --no-open
  (Do NOT use require() — the daemon is ESM-only)
- Confirm output includes "listening on port 4400" or similar

UPDATE (later):
  cd <target> && git pull --ff-only && pnpm install && pnpm -r run build

CONSTRAINTS:
- Preserve upstream folder structure. Do not rename files.
- Do NOT install inside a project repo — install globally for the user.
- Print the final install path, resolved version or commit, and every config file changed.
- On any failure, print the exact error and proposed fix before retrying.
```

### SQL Server T-SQL LSP
Install and configure the official Microsoft SQL Server T-SQL language service globally for OpenCode.

**Prompt for OpenCode:**

```
Goal: Install and configure the official Microsoft SQL Server T-SQL language service GLOBALLY for OpenCode, so any `.sql` file in any repository gets hover, completion, and diagnostics.

Instructions:
1. Determine whether Microsoft SQL Tools Service (`sqltoolsservice`) exposes an LSP-over-stdio entry point. Cite the official source (link + quote).
2. If yes:
   - Download the latest `sqltoolsservice` release for my OS/architecture.
   - Install it to a stable user-scope location and add it to PATH if needed.
   - Show the exact install commands.
3. If Microsoft's tooling does NOT expose LSP, say so explicitly with cited evidence, then propose:
   - the best Microsoft-backed workaround (e.g. extracting the LSP server binary that ships with the VS Code MSSQL extension), and/or
   - the closest viable third-party LSP, with explicit tradeoffs.
   Pick one, justify it, and proceed.
4. Add the LSP entry to the OpenCode GLOBAL config (not per-repo) so every project benefits. Show the final config snippet verbatim.
5. Print the installed version, install path, and config files changed.
6. Verification:
   - Open a `.sql` file with a deliberately invalid statement.
   - Confirm hover info appears on a known keyword.
   - Confirm at least one diagnostic is reported.
   - Print the expected vs actual result.
7. On any step failure, print the exact error and proposed fix before retrying.
```

### Bicep LSP

Install and configure the official Microsoft Bicep language service globally for OpenCode.

**Prompt for OpenCode:**
```
Goal: Install and configure the official Microsoft Bicep language service GLOBALLY for OpenCode so any `.bicep` file in any repository gets hover, completion, and diagnostics.

Instructions:
1. Check availability of the bicep lsp. If not available, install the latest Bicep CLI per https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/install.
2. Add the LSP entry to the OpenCode GLOBAL config (not per-repo) so every project benefits. Show the final config snippet verbatim.
3. Print the installed version, install path, and config files changed.
4. On any step failure, print the exact error and proposed fix before retrying.
5. Verification:
    - Open a `.bicep` file with a deliberately invalid statement.
    - Confirm hover info appears on a known keyword.
    - Confirm at least one diagnostic is reported.
    - Print the expected vs actual result.
```


## Python LSP

Install and configure the Static Type Checker [basepyright](https://github.com/DetachHead/basedpyright) for Python.

**Prompt for OpenCode:**
```
Goal: Install and configure basedpyright for OpenCode, so any `.py` file in any repository gets hover, completion, and diagnostics.

I would like to global install LSP tool basedpyright so that i can use it here
Also wire lsp_diagnostics to use it for Python files
```

## Web Tooling LSP

Install and configure [Biome](https://github.com/biomejs/biome), the performant toolchain for web projects. Biome includes an LSP server that provides diagnostics, hover info, and code actions for JavaScript, TypeScript, JSON, CSS, and more.

**Prompt for OpenCode:**
```
Goal: Install and configure Biome for OpenCode, so any web project file in any repository gets hover, completion, and diagnostics.

I would like to global install LSP tool biome so that i can use it here
Also wire lsp_diagnostics to use it for web project files
```

### [Azure DevOps MCP server](https://github.com/microsoft/azure-devops-mcp)

The [Azure DevOps MCP server](https://github.com/microsoft/azure-devops-mcp) brings the power of Azure DevOps directly to your agents.

**Prompt for OpenCode:**
```
Goal: Install the Azure DevOps MCP server GLOBALLY and create a companion skill for diagnosing pipeline / build failures.

Instructions:
1. Follow the latest installation guide at:
   https://github.com/microsoft/azure-devops-mcp/blob/main/docs/GETTINGSTARTED.md
2. Register the MCP in the GLOBAL config of:
   - OpenCode
   - Visual Studio GitHub Copilot
   - VS Code GitHub Copilot
   so it is available in every session and every repository.
3. Use a secure auth method (PAT stored in environment variable or OS keychain). Do not commit secrets. Ask me for the Azure DevOps organization URL and the PAT, and the default project name.
4. Create a global, user-invocable skill named `azure-devops-build-doctor` that:
    - finds the latest failing build/pipeline run for the current repo + branch (or asks me to pick if ambiguous),
    - downloads the failing log,
    - summarizes the root cause with file:line references where possible,
    - proposes a concrete fix and (optionally) applies it.
5. Print the installed version, registration details, and config files changed.
6. Verify by listing my pipelines and fetching the most recent build status for one of them.
7. On failure, print the exact API error and proposed fix before retrying.
```

### [Azure MCP server](https://github.com/microsoft/github-copilot-for-azure)

Install the [Azure MCP server](https://github.com/microsoft/github-copilot-for-azure) GLOBALLY and create a companion skill for querying Azure resources.

**Prompt for OpenCode:**

```
Goal: Install the Azure MCP server GLOBALLY plus the related skills so I can query and act on my Azure resources from OpenCode, Visual Studio Copilot, and VS Code Copilot.

Instructions:
1. Follow the latest official guidance at:
   https://github.com/microsoft/github-copilot-for-azure
2. Register the Azure MCP in the GLOBAL config of all three agents (OpenCode, Visual Studio Copilot, VS Code Copilot).
3. Use Azure CLI (`az login`) credentials by default. Do not hard-code secrets. If an alternative auth (service principal, managed identity) is more appropriate for my environment, ask me before switching.
4. After install, list:
   - the installed version or endpoint details
   - the install location and config paths updated
   - the active subscription(s) the MCP can see
5. Verify with a read-only query: "List all Azure App Services in my default subscription" and print the count.
6. On any failure, print the exact error and proposed fix before retrying.
```

**Verify**:
- **SQL LSP**: Open a `.sql` file in OpenCode — you should get hover info and diagnostics.
- **Azure DevOps MCP**: Create a build error in a PR and ask OpenCode: Fix the azure devops build error in my current pull request for this branch.
- **Azure MCP**: Ask OpenCode: List all Azure App services.

## 3.2 Create (Custom) Software Engineering Skills

These skills add code review, planning, branching workflows, and development guidelines tailored for software engineers.

The practical test for each skill in this section is straightforward: after installing it, you should be able to point to one clear workflow improvement it creates. If you cannot describe that outcome, the skill is probably not worth keeping enabled.

### [Karpathy Guidelines](https://github.com/forrestchang/andrej-karpathy-skills) skill
A distilled set of coding principles inspired by Andrej Karpathy's approach to software development. This skill encapsulates his emphasis on minimal assumptions, clear requirements, avoiding scope creep, and making evidence-based decisions. It serves as a guiding framework for writing clean, efficient, and maintainable code.

**Expected outcome:** smaller diffs, fewer unnecessary abstractions, and more explicit assumptions before implementation starts.

**Prompt for OpenCode:**

```
Goal: Create a global skill named `karpathy-guidelines` derived from https://github.com/forrestchang/andrej-karpathy-skills.

Instructions:
1. Install the skill GLOBALLY (user-scope), available in OpenCode, Visual Studio Copilot, and VS Code Copilot.
2. Extract the core principles from Andrej Karpathy's approach to coding from the source repo.
3. Focus the skill on: minimal assumptions, clear requirements, avoiding scope creep, evidence-based decisions.
4. Use the standard skill format (YAML frontmatter with `name`, `description`, and a clear body). Mark `user-invocable: true`.
5. After creation, print the file path and verify it appears in the skill list of all three agents.
```

### Evidence Validator
A custom skill that audits code reviews to eliminate AI slop by verifying that every claim is backed by concrete evidence.

**Expected outcome:** review comments become easier to trust because they cite commands, test output, file paths, and observed behavior instead of generic opinions.

**Prompt for OpenCode:**    

```
Goal: Create a global skill named `evidence-validator`, available in OpenCode, Visual Studio Copilot, and VS Code Copilot.
Behavior:
- Audits code reviews to ensure they don't contain AI slop.
- Requires concrete evidence, not opinions.
- Validates that every claim has supporting evidence (file:line references, test outputs, command results, diff hunks).
- Rejects vague feedback like "looks good", "should work", "probably correct", "could be cleaner".
- Marks each unsupported claim and asks the upstream reviewer to add evidence or drop the claim.

Implementation:
- Install GLOBALLY (user-scope), not per-repo.
- Use the standard skill format with YAML frontmatter. Mark `user-invocable: true`.
- Description (verbatim): "Audits code reviews to eliminate AI slop by verifying every claim has concrete evidence (test outputs, file references, command results) - use after requesting-code-review to enforce fact-based feedback".
- Print the file path on completion and verify it shows up in the skill list of all three agents.
```

> **Tip for mobile developers**: You can also add iOS/Android-specific skills in the prompt below. See [Awesome iOS AI](https://github.com/Techopolis/awesome-ios-ai) and [Awesome Android agent skills](https://github.com/new-silvermoon/awesome-android-agent-skills) for inspiration.

### Code Review Expert
A custom skill that performs comprehensive code reviews by orchestrating multiple specialized sub-skills, with a strict evidence requirement to ensure actionable feedback.

**Expected outcome:** more consistent pre-merge reviews with concrete findings around correctness, architecture, security, and maintainability.

**Prompt for OpenCode:**

```
Goal: Create a global skill named `code-review-expert`, available in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Behavior:
- Performs a comprehensive code review by orchestrating these skills:
    - agency/engineering/senior-developer
    - agency/engineering/frontend-developer
    - agency/engineering/backend-architect
    - superpowers/requesting-code-review
    - karpathy-guidelines (validation)
    - evidence-validator (audit)
- DEFAULT BEHAVIOR: automatically compares the current branch against `develop`. Falls back to `main` if `develop` does not exist. Falls back to `master` if neither exists.
- NO USER PROMPTS during normal runs: gather git context automatically (current branch, base branch, merge-base, changed files). Only ask the user when none of develop/main/master exist.
- Write ONLY actionable improvements to a markdown file at the repo root named `codereview-<sanitized-branch-name>.md` (replace `/` and other unsafe path characters with `-`).
- Each finding must include a file:line reference and concrete evidence. Reject vague feedback.
- Focus areas: bugs, security issues, performance problems, architecture concerns, SOLID violations.

Implementation:
- Install GLOBALLY (user-scope), not per-repo.
- YAML frontmatter must include `user-invocable: true`, a `name`, and the description below.
- Include a top-of-file block titled "⚠️ IMPORTANT FOR AGENTS" explaining the no-prompt default and the evidence rule.
- Include an "Execution Checklist" section with explicit, ordered, copy-pasteable steps (detect base branch, compute diff, run sub-skills, run evidence-validator, write the markdown file, print the path).
- Description (verbatim): "Expert code review comparing current branch to develop by default. Detects SOLID violations, security risks, and proposes actionable improvements."
```

### Interactive Code Review Follow-up

An extension to the `code-review-expert` skill that adds an interactive follow-up step,

**Prompt for OpenCode:**

```
Goal: Extend the global `code-review-expert` skill with an interactive follow-up step.

Instructions:
1. Locate the existing global `code-review-expert` skill (do not create a new one). If it is not installed, stop and tell me.
2. After the review markdown file is written and verified, append a new final step that:
   - parses the file into a numbered checklist of proposed improvements,
   - presents the checklist to me,
   - lets me select any subset (numbers, ranges, or `all` / `none`),
   - then implements only the selected items, one by one, with a short status line per item.
3. Keep all existing behavior intact (default base branch, evidence rules, output filename).
4. Print the diff of the skill file on completion.
```

### Functional validation added to the code review workflow.

An extension to the `code-review-expert` skill that adds a functional validation step where it checks the Jira user story for functional requirements.

**Prompt for OpenCode:**

```
Goal: Extend the global `code-review-expert` skill with a functional validation step against the linked Jira user story.

Instructions:
1. Locate the existing global `code-review-expert` skill (do not create a new one). If it is not installed, stop and tell me.
2. When the review is done, append a new step that:
   - checks if the current branch or commit message contains a Jira issue key (e.g. PROJ-123),
   - if found, fetches the user story details via the Jira MCP,
   - extracts functional requirements and acceptance criteria,
   - validates that the code changes in the current branch address those functional requirements (e.g. by checking for relevant test cases, code paths, or comments in the review file),
   - adds a "Functional Validation" section to the review markdown with findings and evidence.
```


**Verify**: Run `/code-review-expert` in a repository with a feature branch. It should automatically detect the `develop` base branch and produce a review markdown file.

### Branch Review
A skill that lets you pick any recent branch, creates a worktree for it, and runs the `code-review-expert` skill against it, so you can review multiple branches in parallel without affecting your main working directory.

**Expected outcome:** you can inspect another branch in isolation without stashing, switching branches, or disrupting your current worktree.

**Prompt for OpenCode:**

```
Goal: Create a global skill named `branch-review` available in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Behavior:
1. List the 8 most recently updated remote branches, excluding `develop`, `main`, `master`, and any `release/*` branch. Use this command (or an OS-equivalent that does not depend on `grep`):
   `git branch -r --sort=-committerdate | grep -v HEAD | grep -v '^  origin/develop$' | grep -v '^  origin/main$' | grep -v '^  origin/master$' | grep -v '^  origin/release/' | head -8`
   On Windows where `grep` is unavailable, use the PowerShell equivalent.
2. Present the list as a numbered menu and let me pick one.
3. Create a git worktree for the selected branch at a configurable root directory (default: `<repo-root>/../w/<sanitized-branch>` so it stays out of the working repo). Use `git worktree add <path> <branch>`. If the worktree already exists, reuse it after `git fetch` + `git pull --ff-only`.
4. Run the global `code-review-expert` skill against THAT worktree only (cwd = worktree path).
5. Skip the interactive "which items to fix" question. Instead, open the resulting `codereview-<branch>.md` in VS Code (`code <file>`). If `code` is not on PATH, fall back to the OS default opener and print the file path.

Implementation:
- Install GLOBALLY (user-scope).
- YAML frontmatter `user-invocable: true`.
- Print the worktree path and the review file path on completion.
```

### Release Review
A skill that automatically finds the latest release branch, creates a worktree for it, and runs the `code-review-expert` skill against it, so you can review release branches without affecting your main working directory.

**Expected outcome:** release checks become repeatable because each review is compared against the previous shipped release instead of an arbitrary base branch.

**Prompt for OpenCode:**

```
Goal: Create a global skill named `release-review` available in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Behavior:
1. From the remote, find the two latest `release/*` branches sorted by committer date (latest = current, previous = base).
2. Create a git worktree for the latest release branch at a configurable root directory (default: `<repo-root>/../w/<sanitized-branch>`). Use `git worktree add <path> <branch>`. Reuse + fast-forward update if it already exists.
3. Run the global `code-review-expert` skill against THAT worktree only (cwd = worktree path), with the previous release branch passed as the base for the diff (override the default `develop` base).
4. Skip the interactive "which items to fix" question. Instead, open the resulting `codereview-<branch>.md` in VS Code (`code <file>`). Fall back to the OS default opener if `code` is not on PATH.
5. If only one release branch exists, stop and tell me; do not invent a base.

Implementation:
- Install GLOBALLY (user-scope).
- YAML frontmatter `user-invocable: true`.
- Print the two release branch names, the worktree path, and the review file path.
```

### Jira Refine
A skill that helps you refine Jira user stories by fetching them, restating them in the agent and adding it back into the Jira user story.

**Prompt for OpenCode:**
```
Goal: Create a global, user-invocable skill named `jira-refine` available in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Behavior:
1. Input selection:
   - If the user supplies a story key or story text in the prompt, use that.
   - Otherwise, use the Jira MCP to fetch up to 8 user stories from the NEXT sprint or any future sprint (NOT the active sprint) that have NO story point estimate.
   - Present them as a numbered menu and let me pick one.
2. Fetch full details of the selected story via the Jira MCP.
3. Refine the story:
   - Restate the user story in the agent's own words in the language of the story.
   - List all assumptions.
   - Ask me to confirm or correct before continuing.
4. Use the `wwas` skill for the user-story format ("As a ... I want ... so that ..." / "who, what, and so that").
5. Use the current repository context (see Agents.md) to add technical details and constraints to the story.
6. Use the `test-scenarios` skill to turn acceptance criteria into concrete validation scenarios (Given / When / Then).
7. Whenever something is ambiguous, add questions to the description.
8. Think through how to implement this issue and show the architecture, files we'll need, and implementation steps.
9. Update the Jira issue: APPEND (do not overwrite) the refined version under a bold header `**refined by AI:**` so the original text is preserved.

Implementation:
- Install GLOBALLY (user-scope). YAML frontmatter `user-invocable: true`.
- On any Jira API failure, print the exact response and proposed fix before retrying.
```

### Jira Implement
A skill that helps you implement a Jira user story end-to-end by creating a branch, worktree, and draft pull request.

**Prompt for OpenCode:**
```
Goal: Create a global, user-invocable skill named `jira-implement` available in OpenCode, Visual Studio Copilot, and VS Code Copilot.

Behavior:
1. Input selection:
   - If the user supplies a story key or text in the prompt, use that.
   - Otherwise, use the Jira MCP to fetch up to 8 user stories from the CURRENT ACTIVE sprint with status "To Do" that are either unassigned or assigned to me.
   - Present them as a numbered menu and let me pick one.
2. Fetch full details via the Jira MCP.
3. Branch + worktree:
   - Derive a branch name from the issue key + slugified summary (e.g. `feature/PROJ-123-short-summary`).
   - Create a git worktree for that new branch at a configurable root directory (default: `<repo-root>/../w/<branch>`). Do NOT hard-code an OS-specific absolute path. Use forward-slash joins and let the OS resolve.
4. Implement the story inside the worktree.
5. Use these skills for guidance and best practices:
   - agency/engineering/senior-developer
   - agency/engineering/frontend-developer
   - agency/engineering/backend-architect
   - test-driven-development
   - karpathy-guidelines
   - evidence-validator
6. Quality focus: SOLID, bugs, security, performance, architectural fit.
7. When done:
   - Run the local build and tests; fix obvious failures.
   - Execute a code review with the `code-review-expert` skill and fix any critical issues it raises.
   - Push the branch and open a DRAFT pull request, linking the Jira issue key in the title and body.
   - Move the Jira issue to "PR" (or "In Review" or the equivalent transition); if the transition is not available, just add a comment with the PR link.
8. Print the worktree path, branch name, and PR URL on completion.

Implementation:
- Install GLOBALLY (user-scope). YAML frontmatter `user-invocable: true`.
- Description (verbatim): "Implementing a Jira issue end-to-end: branch, worktree, code, tests, draft PR."
- On any failure, print the exact error and proposed fix before retrying.
```

---



## Keeping Things Up to Date

Treat this table as the minimum maintenance checklist for the advanced setup in this part. If a skill pack, LSP, or MCP integration starts behaving strangely after a tool update, stale installs are one of the first things worth ruling out.

| What | How to update |
|---|---|
| **OpenCode CLI** | `npm i -g opencode-ai@latest` |
| **OpenCode Desktop** | The app prompts when a new version is available; otherwise re-download from https://opencode.ai/download |
| **Oh-My-OpenAgent** | `npm i -g oh-my-opencode@latest` |
| **Skills (any pack installed via `git clone`)** | `cd` into the pack directory under `~/.config/opencode/skills/<pack>` (or OS equivalent) and run `git pull --ff-only`. To force a clean re-install, delete the pack folder and re-run its installation prompt. |
| **Custom skills (karpathy-guidelines, evidence-validator, code-review-expert, branch-review, release-review, jira-refine, jira-implement, azure-devops-build-doctor)** | Re-run the corresponding creation prompt; the agent should detect the existing skill and update it in place. |
| **Graphify** | Re-run its installer per https://github.com/safishamsi/graphify, then re-index this repo: `graphify rebuild` (or the equivalent current command). |
| **MemPalace** | Re-run its installer per https://github.com/MemPalace/mempalace; then `mempalace mine` again to refresh memory for the current repo. |
| **markitdown** | `pipx upgrade markitdown` (or `pip install -U markitdown` if installed via pip). |
| **Jira MCP / Atlassian Remote MCP** | Re-check https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/ for the latest endpoint or client version, then update the global MCP config. Rotate the API token periodically at https://id.atlassian.com/manage-profile/security/api-tokens. |
| **Azure DevOps MCP** | Pull the latest from https://github.com/microsoft/azure-devops-mcp and re-run its install steps. Refresh the PAT before it expires. |
| **Azure MCP** | Update per https://github.com/microsoft/github-copilot-for-azure. Re-run `az login` if tokens have expired. |
| **SQL Tools Service / MSSQL LSP** | Download the newest release from the Microsoft repo identified during install and replace the binary in the global location. |
| **MCP servers in general** | If installed via `npm`, run `npm i -g <package>@latest`; if via `pipx`, run `pipx upgrade <package>`; if via `git`, `git pull --ff-only` in the install directory. |
| **Global config sanity check** | Periodically run a prompt like: "List every MCP and skill currently registered in OpenCode, Visual Studio Copilot, and VS Code Copilot, with their versions and source paths, and flag anything missing, duplicated, or out of date." |

---

> [!NOTE]
> Previous: [Part 3: A default setup](part-3-default-setup.md)  
> Continue with [Part 5: Optimisation](part-5-optimisation.md) to simplify and verify the orchestration layers you have added.
