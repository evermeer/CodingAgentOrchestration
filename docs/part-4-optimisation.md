# Part 4: Optimisation

> [!NOTE]
> Complete [Part 2 (Default setup)](part-2-default-setup.md) first. If you added skills, LSP, or MCP servers from [Part 3 (Advanced use)](part-3-advanced-use.md), those will be preserved during optimisation.

## Improved loop control

It could happen that your agent does not respond well on continue or stop messages causing your agent to stay in a loop.
This happens because your loop control is not deterministic. To force deterministic loop control instead of “hope the LLM behaves” you could add the following to your Agents.md file.

** Add this to your Agents.md in every repository:**

```
You are an autonomous coding agent operating inside a controlled execution loop.

You MUST follow the output protocol EXACTLY. The loop controller depends on it.

## OUTPUT FORMAT (STRICT JSON — NO EXTRA TEXT)

You must ALWAYS return a valid JSON object with this structure:

{
  "status": "continue" | "end",
  "step_goal": "short description of what you are doing now",
  "reasoning": "brief explanation of why this step is needed",
  "action": {
    "type": "tool_call" | "final_answer" | "noop",
    "name": "tool name or empty",
    "input": { }
  }
}

## RULES

1. The "status" field is AUTHORITATIVE:
   - If "status" = "end" → the loop WILL terminate immediately
   - If "status" = "continue" → the loop WILL continue

2. You MUST NOT contradict your own status:
   - If the task is complete → MUST output "status": "end"
   - If more steps are required → MUST output "status": "continue"

3. You MUST NOT continue unnecessarily:
   - If no meaningful progress can be made → use "end"
   - If the objective has been achieved → use "end"

4. You MUST NOT loop infinitely:
   - If you are repeating actions or not making progress → output "end"

5. Tool usage:
   - Only call a tool if it is REQUIRED for progress
   - If no tool is needed → use "final_answer"

6. Completion criteria:
   You MUST stop when:
   - The requested task is solved
   - The answer is complete and usable
   - Further steps add no value

7. Forbidden:
   - No natural language outside JSON
   - No explanations outside the "reasoning" field
   - No missing fields
   - No extra fields

8. Loop detecion rule:
   - If your last 2 steps did not produce new useful information or progress, you MUST output: "status": "end"

## IMPORTANT FAILSAFE

If you are unsure whether to continue or stop:
→ DEFAULT TO "end"

This prevents infinite loops.

## EXAMPLES

### Continue:
{
  "status": "continue",
  "step_goal": "Read repository files",
  "reasoning": "Need context before modifying code",
  "action": {
    "type": "tool_call",
    "name": "read_file",
    "input": { "path": "main.py" }
  }
}

### End:
{
  "status": "end",
  "step_goal": "Task complete",
  "reasoning": "All requested functionality implemented",
  "action": {
    "type": "final_answer",
    "name": "",
    "input": {}
  }
}

```

## A quick health check and tune-up.

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

By default, oh-my-openagent already includes good model-routing rules for its current set of agents and categories. If you want custom routing, then adjust the oh-my-openagent config. If you have a multi model provider like GitHub Copilot, then evaluate your model routing regularly.

> [!TIP]
> Perform a model routing evaluation regularly to ensure optimal performance and cost efficiency.

**Prompt for OpenCode:**

```
Evaluate the model routing here in OpenCode which is in the oh-my-openagent config and propose an optimal 
model-routing config for an agentic coding workflow which is loop safe while taking 
in consideration my providers costs plan. 
For GitHub Copilotsee https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing
Fine tune the routing for the following categories of tasks:
self-healing loops (retry before fallback)
token-budget aware routing
auto-difficulty detection per step
```

## Confidence scoring

When using the oh-my-openagent plugin then you don't need confidence scoring like other platforms use. The oh-my-openagent uses the better Category- and agent-based routing, Iterative verification + self-correction loops, Fallback chains (failure-based escalation) and Heuristic / learned routing (cost + success patterns)

If you do want to use Confidence scoring, then you can let your prompt return a confidence score for each step of the workflow, and then use that to trigger escalation to more powerful models or human review. Add the following to your Agent.md file to add confidence scoring to your workflow:

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

In your Agent.md file, you can adjust the model routing for the oh-my-openagent categories to optimize for cost and performance.

By Default, the loop category routing is as follows:
```
For the oh-my-openagent loop Category use "loop-default"
```
And if you are spending too much on loops, you can adjust the routing to use cheaper models for loops:
"loop-cheap"
"loop-ultra-cheap"


