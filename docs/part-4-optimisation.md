# Part 4: Optimisation

> [!NOTE]
> Complete [Part 2 (Default setup)](part-2-default-setup.md) first. If you added skills, LSP, or MCP servers from [Part 3 (Advanced use)](part-3-advanced-use.md), those will be preserved during optimisation.

## Improved loop control

It could happen that your agent does not respond well to continue or stop messages, causing your agent to stay in a loop.
This happens because your loop control is not deterministic. To force deterministic loop control instead of “hope the LLM behaves,” you could add the following to your Agents.md file.

**Add this to your Agents.md in every repository:**

```
You are an autonomous coding agent operating inside a controlled orchestration loop.

You MUST strictly follow the output schema below. The loop controller depends on exact compliance.

--------------------------------------
## OUTPUT FORMAT (STRICT JSON ONLY)
--------------------------------------

You must ALWAYS return:

{
  "status": "continue" | "end",
  "action": {
    "tool": "<tool_name OR 'final_answer'>",
    "args": { }
  },
  "message": "<short user-facing explanation>"
}

--------------------------------------
## FIELD DEFINITIONS
--------------------------------------

- status:
  Controls the loop execution.
  - "continue" → system executes the action and loops again
  - "end" → system stops immediately

- action.tool:
  - Must match one of the available tools exactly
  - Use "final_answer" when no tool is needed

- action.args:
  - Arguments for the tool
  - Must always be valid JSON (empty {} if not needed)

- message:
  - Short explanation of what you did or concluded
  - No reasoning chain-of-thought

--------------------------------------
## STRICT RULES
--------------------------------------

1. STATUS IS AUTHORITATIVE
   - If task is complete → MUST return "status": "end"
   - If more work is needed → MUST return "status": "continue"

2. NO CONTRADICTIONS
   - NEVER say work is finished while using "continue"
   - NEVER continue after reaching a valid final answer

3. STOP CONDITIONS (MANDATORY)
   You MUST return "status": "end" if:
   - The user request is fulfilled
   - A correct final answer is available
   - Further steps would not improve the result
   - You are repeating actions or not making progress

4. TOOL USAGE DISCIPLINE
   - Only call tools when necessary
   - Do NOT explore or “double-check” without reason
   - If no tool is needed → use:
     "tool": "final_answer"

5. LOOP PREVENTION
   If you detect:
   - repeated tool calls
   - no new information in last steps

   → you MUST terminate with "status": "end"

6. FAIL-SAFE DEFAULT
   If unsure whether to continue:
   → RETURN "status": "end"

--------------------------------------
## EXAMPLES
--------------------------------------

### Continue with tool:
{
  "status": "continue",
  "action": {
    "tool": "read_file",
    "args": { "path": "app/main.py" }
  },
  "message": "Reading main file to understand structure"
}

### Continue with another step:
{
  "status": "continue",
  "action": {
    "tool": "write_file",
    "args": {
      "path": "app/main.py",
      "content": "..."
    }
  },
  "message": "Applying requested code changes"
}

### End:
{
  "status": "end",
  "action": {
    "tool": "final_answer",
    "args": {}
  },
  "message": "Task completed successfully"
}
```

## A quick health check and tune-up

Over time your OpenCode configuration accumulates layers — skill packs, custom agents, routing rules, pipeline definitions. Some of these overlap or conflict. This part provides a prompt that you paste into OpenCode to let it audit and simplify its own orchestration.

**Prompt for OpenCode:**

```
For the current OpenCode installation review the OpenCode orchestration model and skills and identify:
- any remaining hidden orchestration or skills overlap
- any unnecessary planning loops
- any places where execution could be simplified

Propose only minimal changes.
```

## Optimize model routing

By default, oh-my-openagent already includes good model-routing rules for its current set of agents and categories. If you want custom routing, then adjust the oh-my-openagent config. If you have a multi-model provider like GitHub Copilot, then evaluate your model routing regularly.

> [!TIP]
> Perform a model routing evaluation regularly to ensure optimal performance and cost efficiency.

**Prompt for OpenCode:**

```
Evaluate the model routing here in OpenCode, which is in the oh-my-openagent config, and propose an optimal
model-routing config for an agentic coding workflow that is loop safe while taking
into consideration my provider's cost plan.
For GitHub Copilot see https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
Fine tune the routing for the following categories of tasks:
self-healing loops (retry before fallback)
token-budget aware routing
auto-difficulty detection per step
```

## Confidence scoring

When using the oh-my-openagent plugin, you don't need confidence scoring like other platforms use. The oh-my-openagent uses better category- and agent-based routing, iterative verification plus self-correction loops, fallback chains (failure-based escalation), and heuristic / learned routing (cost + success patterns).

If you do want to use confidence scoring, then you can let your prompt return a confidence score for each step of the workflow, and then use that to trigger escalation to more powerful models or human review. Add the following to your Agents.md file to add confidence scoring to your workflow:

```
After completing the task, evaluate your answer:

- Confidence (0–1): How confident are you this solution is correct and complete?
- Issues: List any uncertainties, missing context, or assumptions.
- Improve? (yes/no): Would a more advanced model materially improve this answer?

Respond ONLY in this JSON format:

{
  "confidence": <float>,
  "issues": ["..."],
  "improve": "<yes|no>"
}

If the confidence is ≥ 0.85 and no issues are detected, accept the answer.
If the confidence is 0.6–0.85 or there are issues, retry the same model.
If the confidence is lower than 0.6 or improvement is needed, escalate to a more powerful model or human review.
```




## Budgeting and loop category optimization

During the month you can evaluate the cost and performance of your agentic workflow and adjust the loop category routing to optimize for cost and performance.

In your Agents.md file, you can adjust the model routing for the oh-my-openagent categories to optimize for cost and performance.

By default, the loop category routing is as follows:
```
For the oh-my-openagent loop category use "loop-default"
```
And if you are spending too much on loops, you can adjust the routing to use cheaper models for loops:
`loop-cheap`
`loop-ultra-cheap`

## Tools To Watch

Parts 2 and 3 cover a practical [OpenCode](https://github.com/anomalyco/opencode) setup with a curated set of add-ons, but the landscape is evolving quickly. These are tools that are still on my radar and may be worth evaluating later:

**Agent / orchestration**
- [serena](https://github.com/oraios/serena) — semantic code retrieval, editing and refactoring tools (LSP-aware), often dramatically reduces token usage on large repos.
- [archon](https://github.com/coleam00/Archon) — workflow engine. Instead of one skill doing multiple steps, define a workflow of tasks each using its own steps/skills. Use this when a task is open-ended, uncertain, or long-running.
- [superset](https://github.com/superset-sh/superset) — for AI agent swarm orchestration.
- [aider](https://aider.chat) — alternative coding CLI worth knowing; very strong git integration and a useful benchmark leaderboard even if you don't switch.

**Context & memory**
- [repomix](https://github.com/yamadashy/repomix) — packs an entire repo (or a filtered subset) into a single LLM-friendly file; handy for one-shot "explain this codebase" prompts.
- [Pieces](https://pieces.app) — long-term developer memory across IDEs, browsers and terminals; alternative angle on what MemPalace does.
- [CodeGraph](https://github.com/colbymchenry/codegraph) — graph-based code context tool; more structured than Agents.md and more flexible than LSP for giving the agent a rich understanding of your codebase.
- [Headroom](https://github.com/chopratejas/headroom) - Compress tool outputs, logs, files, and RAG chunks before they reach the LLM. 60-95% fewer tokens, same answers. Library, proxy, MCP server.
- [COO](https://github.com/egorfedorov/claude-context-optimizer) - Stop adding irrelevant information to the context and keep your context clean. 
- [Caveman](https://github.com/JuliusBrussee/caveman) -  Ask your agent to respond with a compact response.

**External system MCPs**
- [github-mcp-server](https://github.com/github/github-mcp-server) — official GitHub MCP for issues, PRs, code search and reviews from the agent.
- [playwright-mcp](https://github.com/microsoft/playwright-mcp) — drive a real browser from the agent for end-to-end test authoring and UI verification.
- [firebase-mcp](https://lobehub.com/nl/mcp/firebase-mcp-firebase-mcp-server) — read static and runtime information from Firebase projects.
- [notion-mcp](https://github.com/makenotion/notion-mcp-server) — pull documentation/specs from Notion into agent context.
- [slack-mcp](https://github.com/korotovsky/slack-mcp-server) — read and send messages to Slack channels from your agent.
- [filesystem / desktop-commander MCPs](https://github.com/wonderwhy-er/DesktopCommanderMCP) — give the agent controlled shell + filesystem access outside the repo (e.g. for ops scripts).
- [sequential-thinking MCP](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) — gives the model an explicit scratchpad for multi-step reasoning; helps on hard refactors.
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) — gives the agent access to the Chrome DevTools Protocol for debugging, profiling, and inspecting web apps

**Tools**
- [PPT-Master](https://github.com/hugohe3/ppt-master) — lets your agent generate a natively editable PPTX from any document: real PowerPoint shapes with native animations, not images.
- [CLI-Anything](https://github.com/HKUDS/CLI-Anything) — bridging the gap between AI agents and the world's software.
- [CodeBurn](https://github.com/getagentseal/codeburn) - Will give you usage statistics for (almost all?) CLI's that you use.

**Cost, routing, observability**
- [ccusage](https://github.com/ryoppippi/ccusage) — token / cost dashboards for Claude-style CLIs; the same pattern is useful for monitoring OpenCode spend.

And there are many more. On GitHub I maintain a list of interesting AI tools: [My list of AI tools](https://github.com/stars/evermeer/lists/ai).

Other great resources for OpenCode are
[Awesome OpenCode](https://github.com/awesome-opencode/awesome-opencode)
and
[OpenCode cafe (Community-driven marketplace)](https://www.opencode.cafe/)

