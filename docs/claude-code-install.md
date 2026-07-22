# Installation, setup and configuration of Claude Code

Due to changes in token usage, I also started trying Claude Code. Creating a setup comparable to the configuration in this OpenCode Guide repository is much easier with Claude Code. Below is a brief overview of the steps to achieve this.

I did skip a number of skill packs because there was a lot of overlap. The ones skipped are Product Management, and Minimalist Entrepreneur skills. 
The Oh-my-OpenAgent and OpenCode-DCP plugins are also not necessary / not supported.

## The main software from Anthropic
Go to https://claude.ai/downloads and download the Terminal, Desktop app and VS Code extension. (Maybe also the Chrome and Jetbrains extensions?)

## Connectors & Plugins
In Claude Code go to Customize, Connectors and browse the library to install the connectors for all the systems that you use. Do the same for Plugins. (If you don't know if you will actively use them, then you could still install these but disable them so that they won't add extra processing time and token usage.

An other great source for plugins is the [Claude Plugin Hub](https://www.claudepluginhub.com/)

Connectors installed by me:
- Atlassian Rovo
- Context 7
- Exa
- GitHub integration (disabled)
- Microsoft 365 (disabled)
- Microsoft Learn
- Notion (disabled)
- Slack (disabled)
- Azure MCP Server
- Claude in Chrome
- Filesystem

Tried but not functioning yet:
- Freshservice

Plugins installed by me:
- Design
- Engineering
- Data
- Customer Support
- Enterprise Search
- Marketing
- Product Management
- cc-safety-net from https://github.com/kenryu42/cc-safety-net - follow repo instructions for Claude Code
- graphify from https://github.com/safishamsi/graphify - follow repo instructions for Claude Code
- mempalace from https://github.com/MemPalace/mempalace - follow repo instructions for Claude Code
- context-mode from https://github.com/mksglu/context-mode - follow repo instructions for Claude Code
- context optimizer https://github.com/evermeer/context-optimizer - follow repo instructions for Claude Code
- superpowers https://github.com/obra/superpowers - follow repo instructions for Claude Code
- gstack https://github.com/garrytan/gstack - follow repo instructions for Claude Code
- .net skill pack https://github.com/dotnet/skills - follow repo instructions for Claude Code
- Azure DevOps MCP https://github.com/microsoft/azure-devops-mcp - follow repo instructions for Claude Code
- Agency Agents https://agencyagents.app/ - install the app and from there all skills.
- Ponytail https://github.com/DietrichGebert/ponytail - follow repo instructions for Claude Code

## Custom skills
Download the [custom-skills.zip](https://github.com/evermeer/CodingAgentOrchestration/raw/refs/heads/main/docs/custom-skils.zip) extract the folders and put these into your ~/.claude/skills folder.
- evidence-validator some rule to make sure your LLM is not making up things.
- karpathy-guidelines guidelines for improving the quality of your LLM responses.
- code-review-expert compare the current branch to the develop branch and analyse the changes using the evidence-validator, karpathy-guidelines and code-review skills. Do a functional compare against the Jira issue. Ask which findings to implement.
- branch-review Specify a jira ticket and the branch that is made for that ticket will be evaluated in a worktree using the code-review-expert skill. Instead of asking what issues to implement it will only open the markdown with the found issues.
- release-review same as the branch-review skill only that it will always compare the latest release branch to the release branch before that.
- jira-refine Specify a jira ticket id and this skill will then analyse it together with your repository content and add an improved description with questions added if there is something not clear.
- jira-implement Specify a jira ticket id and a new branch will be created in a worktree and the ticket will be implemented.

## LSP's

Installing the LSP's that I use

**Prompt for Claude Code**

```
Install and configure LSPs for:

- C#
- Python
- TypeScript/JavaScript
- Bicep
- YAML
- SQL Server (T-SQL)

Detect my operating system, install the appropriate language servers, verify they're working, and update my Claude Code configuration if needed.
Afterwards show me:
1. what was installed
2. where it was installed
3. how to verify each LSP is working
```