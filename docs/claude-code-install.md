# Installation, setup and configuration of Claude Code

Due to changes in token usage, I also started trying Claude Code. Creating a setup comparable to the configuration in this OpenCode Guide repository is much easier with Claude Code. Below is a brief overview of the steps to achieve this.

I did skip a number of skill packs because there was a lot of overlap. The ones skipped are the Agency, Product Management, and Minimalist Entrepreneur skills. 
I also didn’t install any of the LSPs yet, since I’m still investigating which ones are already available by default in Claude Code. 
The Oh-my-OpenAgent and OpenCode-DCP plugins are also not necessary / not supported.

## The main software from Anthropic
Go to https://claude.ai/downloads and download the Terminal, Desktop app and VS Code extension. (Maybe also the Chrome and Jetbrains extensions?)

## Connectors & Plugins
In Claude Code go to Customize, Connectors and browse the library to install the connectors for all the systems that you use. Do the same for Plugins. (If you don't know if you will actively use them, then you could still install these but disable them so that they won't add extra processing time.

Connectors installed by me:
- Atlassian Rovo
- Context 7
- Exa
- GitHub integration
- Microsoft 365
- Microsoft Learn
- Notion
- Slack
- Azure MCP Server
- Claude in Chrome
- Filesystem

Tried but not functioning yet:
- Freshservice

Plugins installed by me:
- Design
- Enginering
- Slack
- Data
- Customer Support
- Enterprise Search
- Marketing
- Product Management
- cc-safety-net from https://github.com/kenryu42/cc-safety-net - follow repo instructions for Claude Code
- graphify from https://github.com/safishamsi/graphify - follow repo instructions for Claude Code
- mempalace from https://github.com/MemPalace/mempalace - follow repo instructions for Claude Code
- superposers https://github.com/obra/superpowers - follow repo instructions for Claude Code
- gstack https://github.com/garrytan/gstack - follow repo instructions for Claude Code
- .net skill pack https://github.com/dotnet/skills - follow repo instructions for Claude Code
- Azure DevOps MCP https://github.com/microsoft/azure-devops-mcp - follow repo instructions for Claude Code

## Custom skills
Download the [custom-skills.zip](https://github.com/evermeer/CodingAgentOrchestration/raw/refs/heads/main/docs/custom-skils.zip) extract the folders and put these into your ~/.claude/skills folder.
- evidence-validator some rule to make sure your LLM is not making up things.
- karpathy-guidelines guidelines for improving the quality of your LLM responses.
- code-review-expert compare the current branch to the develop branch and analyse the changes using the evidence-validator, karpathy-guidelinse and code-review skills. Do a functional compare against the Jira issue. Ask which findings to implement.
- branch-review Specify a jira ticket and the branch that is made for that ticket will be evaluated in a worktree using the code-review-expert skill. Instead of asking what issues to implement it will only open the markdown with the found issues.
- release-review same as the branc-review skill only that it will always compare the latest release branch to the release branch before that.
- jira-refine Specify a jira ticket id and this skill will then analyse it togather with your repository content and add an improved description with questions added if there is something not clear.
- jira-implement Specify a jira ticket id and a new branch will be created in a worktree and the ticket will be implemented.
