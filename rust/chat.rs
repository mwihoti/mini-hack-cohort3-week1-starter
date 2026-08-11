// chat.rs, a Rust version of chat.js.
//
// Same program as the JS starter: one system prompt, one Vec holding the
// whole conversation, one loop. It calls the OpenAI chat completions API
// directly over HTTPS with no SDK, so the whole request is visible in
// this file. Every call sends the full history in `messages` because the
// model itself is stateless. It re-reads the transcript each turn, and
// that is what makes it feel like it remembers you.
//
// To run:
//   1. Install a toolchain from https://rustup.rs
//   2. At the repo root: cp .env.example .env  (same OPENAI_API_KEY as chat.js)
//   3. cd rust && cargo run
//
// For the week 1 tools, start where finish_reason is read below. A
// "tool_calls" finish means run the tool, push the result into `messages`
// and call the API again.

use serde::Deserialize;
use serde_json::{json, Value};
use std::error::Error;
use std::io::{self, Write};

const API_URL: &str = "https://api.openai.com/v1/chat/completions";

const SYSTEM_PROMPT: &str = "You are Mini Hack Assistant, a patient technical mentor for
Team1 Kenya's Cohort 3 builders. Explain concepts in plain English before
using jargon. Keep answers under 150 words unless asked for more detail.";

// One turn of the conversation. Plain string content is enough for chat,
// tool calls will need richer shapes later.
struct Message {
    role: String, // "user" or "assistant"
    content: String,
}

// Only the response fields we need, serde ignores the rest.
#[derive(Deserialize)]
struct ApiResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ReplyMessage,
    // "stop" normally, "length" on the token cap, "tool_calls" once you
    // add tools.
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct ReplyMessage {
    #[serde(default)]
    content: Option<String>,
}

impl ApiResponse {
    // The assistant's reply text ("" if the model sent none).
    fn text(&self) -> String {
        self.choices
            .first()
            .and_then(|choice| choice.message.content.clone())
            .unwrap_or_default()
    }

    fn finish_reason(&self) -> Option<&str> {
        self.choices
            .first()
            .and_then(|choice| choice.finish_reason.as_deref())
    }
}

fn main() {
    if let Err(err) = run() {
        eprintln!("Agent error: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    // Load .env into real environment variables. A missing file is fine.
    // dotenvy walks up parent directories, so it finds the .env at the
    // repo root even though this runs from rust/.
    let _ = dotenvy::dotenv();

    let api_key = std::env::var("OPENAI_API_KEY").map_err(|_| "OPENAI_API_KEY is not set.")?;
    // Same defaults as chat.js so both starters behave the same.
    let model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-5.6".to_string());
    let max_tokens: u32 = std::env::var("MAX_TOKENS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(1024);

    let mut messages: Vec<Message> = Vec::new();

    println!("Mini Hack CLI Chatbot (Rust) - type 'exit' to quit\n");

    loop {
        // None means stdin closed (Ctrl-D), treat it like "exit".
        let Some(user_input) = ask("You: ")? else {
            println!();
            break;
        };
        let trimmed = user_input.trim();
        if trimmed.eq_ignore_ascii_case("exit") {
            break;
        }
        if trimmed.is_empty() {
            continue;
        }

        messages.push(Message {
            role: "user".to_string(),
            content: user_input,
        });

        let reply = send_message(&api_key, &model, max_tokens, &messages)?;
        let text = reply.text();
        println!("\nGPT: {text}\n");
        if reply.finish_reason() == Some("length") {
            eprintln!("(reply hit the token limit, raise MAX_TOKENS in .env)\n");
        }

        messages.push(Message {
            role: "assistant".to_string(),
            content: text,
        });
    }

    Ok(())
}

// Print a prompt, read one line. Ok(None) on end of input.
fn ask(prompt: &str) -> io::Result<Option<String>> {
    print!("{prompt}");
    io::stdout().flush()?;
    let mut line = String::new();
    if io::stdin().read_line(&mut line)? == 0 {
        return Ok(None);
    }
    Ok(Some(line.trim_end().to_string()))
}

// One API call. POST the system prompt plus the full history, parse the reply.
fn send_message(
    api_key: &str,
    model: &str,
    max_tokens: u32,
    messages: &[Message],
) -> Result<ApiResponse, Box<dyn Error>> {
    // The system prompt goes first, then everything said so far.
    let mut all_messages: Vec<Value> = vec![json!({
        "role": "system",
        "content": SYSTEM_PROMPT,
    })];
    all_messages.extend(messages.iter().map(|message| {
        json!({
            "role": message.role,
            "content": message.content,
        })
    }));

    let result = ureq::post(API_URL)
        .set("Authorization", &format!("Bearer {api_key}"))
        .send_json(json!({
            "model": model,
            "max_completion_tokens": max_tokens,
            "messages": all_messages,
        }));

    let response = match result {
        Ok(response) => response,
        // On non-2xx, return the API's own error body. It names the real
        // problem (bad key, unknown model, rate limit) better than we
        // could guess here.
        Err(ureq::Error::Status(code, response)) => {
            let body = response.into_string().unwrap_or_default();
            return Err(format!("API returned {code}: {body}").into());
        }
        Err(err) => return Err(err.into()),
    };

    Ok(response.into_json()?)
}
