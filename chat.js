import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

// ANSI Color Codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  magenta: "\x1b[35m",
  red: "\x1b[31m"
};

let client;
let provider;
let model;

// --- Initialization ---

if (process.env.OPENROUTER_API_KEY) {
  client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/mini-hack-cohort3",
      "X-Title": "Mini Hack Assistant",
    },
  });
  provider = "openrouter";
  model = "deepseek/deepseek-v4-flash";
} else if (process.env.ANTHROPIC_API_KEY) {
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  provider = "anthropic";
  model = "claude-3-5-sonnet-20240620";
} else if (process.env.OPENAI_API_KEY) {
  client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  provider = "openai";
  model = "gpt-4o";
} else {
  console.error(
    `${colors.red}Error: No API key found. Please set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY in your .env file.${colors.reset}`
  );
  process.exit(1);
}

const SYSTEM_PROMPT = `You are Mini Hack Assistant, a patient technical mentor for
Team1 Kenya's Cohort 3 builders. You have access to tools for web search and Avalanche documentation.
Explain concepts in plain English before using jargon. Keep answers under 250 words unless asked for more detail.
Today's date is ${new Date().toDateString()}. Always use the current date
when writing search queries about news, prices, or anything time-sensitive.`;

const MAX_TOKENS = 1024;

// --- Tool Implementations ---

/**
 * Search the web using Tavily API
 */
async function webSearch(query) {
  if (!process.env.TAVILY_API_KEY) {
    return "Error: TAVILY_API_KEY not found in .env";
  }
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        num_results: 3
      }),
    });
    const data = await response.json();
    return JSON.stringify(data.results.map(r => ({ title: r.title, url: r.url, content: r.content })));
  } catch (error) {
    return `Web search failed: ${error.message}`;
  }
}

/**
 * Direct HTTP call to Avalanche MCP Server (Cleaner than using the bridge SDK)
 */
async function avalancheSearch(query) {
  try {
    const response = await fetch("https://build.avax.network/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "docs_search",
          arguments: { query }
        }
      })
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return JSON.stringify(data.result);
  } catch (error) {
    return `Avalanche search failed: ${error.message}`;
  }
}

// --- LLM Interaction Logic ---

const tools = [
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for real-time information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "docs_search",
      description: "Search Avalanche documentation and technical guides.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The technical query about Avalanche" }
        },
        required: ["query"]
      }
    }
  }
];

async function handleToolCall(toolCall) {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);
  
  process.stdout.write(`${colors.dim}  ➔ Using ${name}: "${args.query}"...${colors.reset}\r`);
  
  let result;
  if (name === "web_search") {
    result = await webSearch(args.query);
  } else if (name === "docs_search") {
    result = await avalancheSearch(args.query);
  } else {
    result = "Unknown tool";
  }

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  console.log(`${colors.yellow}  ✓ Used ${name}${colors.reset}`);
  
  return result;
}

async function getCompletion(messages) {
  try {
    if (provider === "anthropic") {
      const response = await client.messages.create({
        model: model,
        system: SYSTEM_PROMPT,
        max_tokens: MAX_TOKENS,
        messages: messages,
        tools: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }))
      });

      if (response.stop_reason === "tool_use") {
        const toolUse = response.content.find(c => c.type === "tool_use");
        const toolResult = await handleToolCall({
          function: { name: toolUse.name, arguments: JSON.stringify(toolUse.input) }
        });

        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: toolResult
          }]
        });

        return await getCompletion(messages);
      }
      return response.content[0].text;
    } else {
      const response = await client.chat.completions.create({
        model: model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: MAX_TOKENS,
        tools: tools
      });

      const message = response.choices[0].message;

      if (message.tool_calls) {
        messages.push(message);
        for (const toolCall of message.tool_calls) {
          const result = await handleToolCall(toolCall);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result
          });
        }
        return await getCompletion(messages);
      }
      return message.content;
    }
  } catch (error) {
    throw new Error(`Completion failed: ${error.message}`);
  }
}

// --- Main Loop ---

async function main() {
  const rl = readline.createInterface({ input, output });
  const messages = [];

  console.log(`\n${colors.magenta}${colors.bright}Avalanche Mini Hack CLI Agent${colors.reset}`);
  console.log(`${colors.dim}Provider: ${provider} | Model: ${model}${colors.reset}\n`);

  while (true) {
    const userInput = await rl.question(`${colors.cyan}${colors.bright}You: ${colors.reset}`);
    if (userInput.trim().toLowerCase() === "exit") break;

    messages.push({ role: "user", content: userInput });

    try {
      process.stdout.write(`\n${colors.dim}Thinking...${colors.reset}\r`);
      
      const reply = await getCompletion(messages);
      
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      
      console.log(`${colors.green}${colors.bright}Assistant:${colors.reset} ${reply}\n`);

      messages.push({ role: "assistant", content: reply });
    } catch (err) {
      console.error(`\n${colors.red}Agent error: ${err.message}${colors.reset}\n`);
      messages.pop();
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
