# Part 4: Optimisation

> [!NOTE]
> Complete [Part 2 (Default setup)](part-2-default-setup.md) first. If you added skills, LSP, or MCP servers from [Part 3 (Advanced use)](part-3-advanced-use.md), those will be preserved during optimisation.

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

You can let your prompt return a confidence score for each step of the workflow, and then use that to trigger escalation to more powerful models or human review. Add the following to your Agent.md file to add confidence scoring to your workflow:

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


## Difficulty detection signals (automatic escalation triggers)

You can control when to escalate to a more powerful category/ model or a human by defining something like the following in your Agents.md file.

```
Add these checks BEFORE escalating:

Detect “hard task”
Escalate to "reasoning" if:

same file changed > 2 times
tests failing repeatedly
response too short / vague
confidence < 0.6


Detect “critical task”
Escalate to "critical" if:

multi-file change
architecture change
security-sensitive code
final verification step
```
