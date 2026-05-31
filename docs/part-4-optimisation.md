# Part 4: Optimisation

> [!NOTE]
> Complete [Part 2 (Default setup)](part-2-default-setup.md) first. If you added skills, LSP, or MCP servers from [Part 3 (Advanced use)](part-3-advanced-use.md), those will be preserved during optimisation.

## A quick health check and tune-up.

Over time your OpenCode configuration accumulates layers — skill packs, custom agents, routing rules, pipeline definitions. Some of these overlap or conflict. This part provides a prompt that you paste into OpenCode to let it audit and simplify its own orchestration.

**Prompt for OpenCode:**

```
Review the new OpenCode orchestration model and identify:
- any remaining hidden orchestration overlap
- any unnecessary planning loops
- any places where execution could be simplified

Propose only minimal changes.
```

## Creating a Minimal Orchestration Model

Depending on how many skills and pipelines you have added, your current orchestration may have multiple agents trying to plan the same task, execution loops that feed back into planning without a clear owner, and verification steps that are mixed into editing prompts. You then could create a custom orchestration layer.

**How it works:** 
The prompt implements a 3-phase model — **Conductor** (routes work), **Planner/Executor** (does work), and **Verifier** (checks results) — replacing any redundant orchestration layers while keeping all your installed capabilities (MCP servers, skills, parallelism) intact.

The important mindset is to treat orchestration changes the same way you treat code changes: make the smallest useful change, verify it, and keep the system understandable.

Below is a prompt you can paste into OpenCode.

- Run it at repo root.
- Let it run 2–3 iterations for best results.

It is designed to:

- ✅ analyse your current setup (Oh‑My‑OpenAgent + skills + pipelines)
- ✅ remove orchestration overlap
- ✅ implement the minimal 3‑phase model
- ✅ preserve all your power (MCP, routing, parallelism, etc.)

When the optimization is complete, you will have a much simpler, more efficient orchestration model with a single Conductor agent and clear role separation between Planner, Executor, and Verifier.



## Main Prompt

### What Good Looks Like

Before optimisation:

- multiple skills try to plan the same task
- execution loops back into planning without a clear owner
- verification is mixed into editing prompts

After optimisation:

- one conductor decides the path
- planning happens once unless explicitly re-triggered
- execution follows a plan instead of renegotiating it
- verification approves, retries, or requests replanning without editing code

### Small Before/After Prompt Examples

Weak instruction:

- "be proactive"

Better instruction:

- "when a task requires 3 or more concrete steps, create a todo list before editing files"

Weak verifier rule:

- "check quality"

Better verifier rule:

- "before marking work complete, report the exact verification command and whether it passed, failed, or could not run"

The second version is better in both cases because it is specific enough to verify.

### Rollback Rule

If an orchestration change makes behavior less predictable, revert that change instead of layering on another workaround. Prompt systems become fragile quickly when every problem is solved by adding more text.

**Prompt for OpenCode:**

```
You are an expert AI agent architect.

Goal:
Refactor my OpenCode / Oh-My-OpenAgent setup into a minimal, high-performance orchestration model with less complexity but full capabilities preserved.

---

## Target architecture (strict)

Implement a minimal (global, not at repository level) orchestration model with:

1. ONE central Conductor agent (single decision authority)
2. EXACTLY THREE phases:
   - PLAN
   - EXECUTE
   - VERIFY
3. STRICT role separation:
   - Planner agent: reasoning only
   - Executor agent: execution only (no planning)
   - Verifier agent: validation only (no editing)

No other orchestration layers may compete or overlap.

---

## Requirements

### A. Analyze current system
- Inspect:
  - Oh-My-OpenAgent pipelines
  - Superpowers skills
  - Agency skills
  - Skills folder
  - MCP integrations
  - Context tools (Graphify, Mempalace, Agents.md)

Produce a short report:
- Which components currently act as orchestrators
- Where orchestration overlaps or conflicts exist
- Which skills duplicate planning or execution

---

### B. Refactor orchestration structure

#### 1. Conductor agent
- Centralize all orchestration decisions into one agent
- Ensure it:
  - selects pipeline
  - chooses model via routing
  - delegates tasks
  - decides replan vs retry
- Remove or disable competing orchestration logic elsewhere

---

#### 2. Planner phase
- Create or consolidate into ONE planner skill/agent
- Responsibilities:
  - read Graphify + repo structure
  - read relevant memory (Mempalace)
  - output:
    - ordered execution steps
    - files to modify
    - assumptions and risks
- MUST run only once per task (unless explicitly re-triggered by Conductor)

---

#### 3. Executor phase
- Use Superpowers + relevant execution skills
- Enforce:
  - NO re-planning
  - NO scope changes
  - only follow the plan step-by-step
- Ensure execution can:
  - edit files
  - run commands
  - call MCP tools

---

#### 4. Verifier phase
- Create or consolidate into ONE verifier skill/agent
- Responsibilities:
  - run tests
  - review diff
  - validate against plan
- Output must be one of:
  - SUCCESS
  - RETRY EXECUTION
  - REPLAN REQUIRED
- Verifier must NOT modify code

---

### C. Enforce strict rules

Implement guardrails so that:

1. Planner cannot execute code
2. Executor cannot re-plan or change strategy
3. Verifier cannot modify files
4. Only Conductor can trigger:
   - re-planning
   - retries

Remove any skills or pipelines that violate these constraints.

---

### D. Simplify skill system

- Identify overlapping skills (especially in superpowers + agency)
- Merge or disable redundant ones
- Keep:
  - 1 planner skill
  - 1 executor entrypoint
  - 1 verifier skill
- Keep other skills only as tools (not orchestrators)

---

### E. Context prioritization

Implement a clear priority order for context:

1. Graphify (structure)
2. Active task context
3. Agents.md
4. Mempalace memory

Ensure prompts reflect this priority and avoid sending all context blindly.

---

### F. Model routing optimization

- Keep existing Oh-My-OpenAgent routing
- Ensure:
  - Planner uses high-reasoning model
  - Executor uses fast coding model
  - Verifier uses balanced/reasoning model
- Avoid unnecessary repeated planning cycles

---

### G. Output required

1. Show:
   - updated agent / skill definitions
   - modified config files
   - any disabled or merged components
2. Explain:
   - what was removed and why
   - how the new system enforces the minimal model
3. Ensure:
   - system remains fully functional
   - MCP, LSP, parallel agents still work

---

## Constraints

- Do NOT remove capabilities (parallel agents, MCP, routing)
- Only reduce orchestration complexity
- Keep the system extensible

---

## Execution

Start by analyzing the current repository and configuration.
Then implement the refactor step-by-step.
```
