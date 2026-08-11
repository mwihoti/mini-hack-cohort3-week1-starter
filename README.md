# Mini Hack — Cohort 3, Week 1 Starter

**Building Agentic Solutions on Avalanche** · Team1 Kenya

This is the starter repo for Week 1: a CLI chatbot built with the Claude API
that maintains conversation history across turns. It is the foundation every
Week 1 deliverable builds on top of (adding a web search tool and the
Avalanche MCP server in Session 2).

## What this does

Run `chat.js` and you get a terminal chatbot that:
- Sends your message to Claude via the official Anthropic SDK
- Remembers everything said so far in the conversation (in memory, per session)
- Keeps going until you type `exit`

## Setup

```bash
npm install
cp .env.example .env
# paste your key from console.anthropic.com into .env
npm start
```

## Files

| File | Purpose |
|---|---|
| `chat.js` | The chatbot — client setup, system prompt, conversation loop |
| `.env.example` | Template for your API key — copy to `.env`, never commit `.env` |
| `package.json` | Dependencies: `@anthropic-ai/sdk`, `dotenv` |

## Next steps (your Week 1 deliverable)

Fork this repo and extend `chat.js` (or build alongside it) so your agent
can call **two tools**: a web search tool, and the Avalanche MCP server
(`docs_search` at minimum). See `COMMANDS.md` for the exact commands and
`CONTRIBUTING_GUIDE.md` for how to submit your PR.

## Cost awareness

Every message you send and receive costs tokens. Check your usage at
console.anthropic.com/settings/usage before and after a session so you know
what a typical chat costs, and set a spend limit under Settings → Limits.

## Week 1 agent (this branch)

`chat.js` is now a tool-calling agent: it answers Avalanche questions using
a **web search tool** (Tavily) and the official **Avalanche MCP server**
(`docs_search` via https://build.avax.network/api/mcp), with full
conversation memory across tool calls. It runs on OpenRouter
(`deepseek/deepseek-v4-flash`) through the Anthropic-compatible endpoint;
Anthropic and OpenAI keys also work.

To run: `cp .env.example .env`, paste your `OPENROUTER_API_KEY` and
`TAVILY_API_KEY`, then `npm install && npm start`. Type `exit` to quit.
Tool calls are shown inline as `➔ Using web_search: ...` while the agent
works. Errors from a failing tool are returned to the model as text, so a
broken key or a down API degrades the answer instead of crashing the chat.
