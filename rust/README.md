# Mini Hack Starter (Rust edition)

This folder is a Rust version of `chat.js`: the same CLI chatbot, one
system prompt, a growing message history, one loop. This file covers the
Rust side only, the [main README](../README.md) has the bigger picture.

## Why there's no SDK in here

`chat.rs` calls the OpenAI chat completions API directly: an HTTPS POST
with two headers and a JSON body. That really is all an "AI client" is.
Once you've seen it raw, SDKs stop being magic, you know exactly what
they wrap.

```
POST https://api.openai.com/v1/chat/completions
  Authorization: Bearer <your key>
  content-type: application/json

{ "model": ..., "max_completion_tokens": ..., "messages": [ ... ] }
```

## Setup

```bash
# 1. Rust toolchain if you don't have one: https://rustup.rs
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. API key goes in the REPO ROOT .env, same file chat.js uses
cd ..
cp .env.example .env   # paste your OpenAI key

# 3. Build and run
cd rust
cargo run
```

You can also run it from the repo root with
`cargo run --manifest-path rust/Cargo.toml`. Either way the `.env` at the
repo root is found, because `dotenvy` walks up parent directories looking
for it.

| Variable | Default | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | *(required)* | Your key from platform.openai.com |
| `OPENAI_MODEL` | `gpt-5.6` | Which model to call (same default as chat.js) |
| `MAX_TOKENS` | `1024` | Cap on each reply. Raise it if replies look cut off |

## How this maps to chat.js

| In `chat.js` | In `chat.rs` |
|---|---|
| `const messages = []` | `let mut messages: Vec<Message>` |
| `client.responses.create({...})` | `send_message(...)`, a raw HTTP POST |
| `response.output_text` | `reply.text()` |
| `MODEL` constant | `OPENAI_MODEL` env var, default `gpt-5.6` |

One difference worth knowing: `chat.rs` resends the whole `messages`
history on every call, so the model sees the full conversation each turn.
That is the pattern the week 1 agent builds on.

## Adding the week 1 tools

The week 1 task is the same as on the JS side: give the agent a web
search tool and the Avalanche MCP server's `docs_search`. The hook point
in `chat.rs` is the `finish_reason` check. What you need to change:

1. **Declare tools.** Add a `"tools": [...]` field to the request body.
   Each tool is `{ "type": "function", "function": { "name",
   "description", "parameters" } }` where `parameters` is JSON Schema.
2. **Detect tool calls.** When `finish_reason` is `"tool_calls"`, the
   reply message carries a `tool_calls` array, each entry with an `id`
   and a `function` holding `name` and `arguments` (a JSON string).
   Extend the response structs with those fields.
3. **Echo the assistant turn back with its `tool_calls` intact**, then
   push one `{ "role": "tool", "tool_call_id": <id>, "content":
   <result> }` message per call.
4. **Loop.** Call the API again with the grown history until
   `finish_reason` is `"stop"`.
5. **Wrap every tool call in error handling.** Return the error message
   as the tool result instead of crashing, so the model can recover.

The `ureq` crate is already there for the web search tool's own HTTP
calls (Tavily and Brave both have free tiers), and the Avalanche MCP
server at `https://build.avax.network/api/mcp` speaks plain JSON-RPC
over HTTP, so the same crate covers that too.

## Common issues

| Problem | Likely cause |
|---|---|
| `cargo: command not found` | No toolchain. Install via rustup, then reopen your shell |
| `OPENAI_API_KEY is not set.` | `.env` is missing at the **repo root**, or the key line has extra quotes or spaces |
| `API returned 401: ...` | The key is wrong or revoked. The body printed after the code is the API's own explanation |
| `API returned 429: ...` | Rate limited or out of quota. Check your usage page |
| Reply looks cut off | You hit `MAX_TOKENS`. The program warns when this happens, raise it in `.env` |
| Compile errors on `let ... else` | Old toolchain. Run `rustup update` (needs Rust 1.65+) |

The submission flow (branch naming, testing, screenshots, the PR) is the
same as on the JS side, see
[`CONTRIBUTING_GUIDE.md`](../CONTRIBUTING_GUIDE.md) and
[`COMMANDS.md`](../COMMANDS.md).
