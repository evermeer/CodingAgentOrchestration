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

