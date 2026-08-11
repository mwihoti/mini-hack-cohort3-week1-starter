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

## Prefer Rust?

`rust/chat.rs` is the same starter chatbot in plain Rust. It calls the
OpenAI chat completions API directly over HTTPS with no SDK, so the whole
request is visible in one file. It reads the same `.env` at the repo root
(`OPENAI_API_KEY`), and it resends the full message history on every call,
which is what gives the bot its memory.

```bash
# needs a Rust toolchain: https://rustup.rs
cd rust
cargo run
```

Setup details, a chat.js to chat.rs mapping, and where the week 1 tools
plug in are covered in [`rust/README.md`](rust/README.md).

## Files

| File | Purpose |
|---|---|
| `chat.js` | The chatbot — client setup, system prompt, conversation loop |
| `.env.example` | Template for your API key — copy to `.env`, never commit `.env` |
| `package.json` | Dependencies: `@anthropic-ai/sdk`, `dotenv` |
| `rust/` | The same chatbot in plain Rust, no SDK. See "Prefer Rust?" above |

## Next steps (your Week 1 deliverable)

Fork this repo and extend `chat.js` (or build alongside it) so your agent
can call **two tools**: a web search tool, and the Avalanche MCP server
(`docs_search` at minimum). See `COMMANDS.md` for the exact commands and
`CONTRIBUTING_GUIDE.md` for how to submit your PR.

## Cost awareness

Every message you send and receive costs tokens. Check your usage at
console.anthropic.com/settings/usage before and after a session so you know
what a typical chat costs, and set a spend limit under Settings → Limits.
