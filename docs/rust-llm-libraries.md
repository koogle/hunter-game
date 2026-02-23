# Rust LLM Libraries — Research Notes

> Research date: 2026-02-23
> Topic: Rust libraries for LLM integration with streaming and structured output

---

## Summary / Recommendation

For this project (hunter-game), if we want to add LLM-powered NPC dialogue or dungeon narration:

| Goal | Best choice |
|------|-------------|
| Multi-provider + streaming | **`genai`** or **`rig`** |
| Structured typed output from LLM | **`rstructor`** (most ergonomic) |
| OpenAI only, full API coverage | **`async-openai`** |
| Full agentic pipelines | **`rig`** |
| Low-level / minimalist | **`llm-toolkit`** |

**Top pick for this game**: `genai` + `rstructor` — genai handles multi-provider streaming, rstructor adds type-safe structured outputs on top.

---

## Libraries

### 1. `genai` (rust-genai)

- **Crate**: `genai`
- **GitHub**: https://github.com/jeremychone/rust-genai
- **Providers**: OpenAI, Anthropic, Gemini, Ollama, Groq, xAI/Grok, DeepSeek, Cohere
- **Streaming**: Yes (SSE + stream support for DeepSeekR1 reasoning tokens)
- **Structured output**: Via function calling / tool use (JSON schema)
- **Status**: Actively maintained, clean API

**When to use**: Best for multi-provider chat + streaming. Straightforward API without heavy framework abstractions. The author (Jeremy Chone) also has tutorial content around function calling as structured output.

**Example (function calling for structured output)**:
```rust
use genai::chat::{ChatMessage, ChatRequest, Tool};
use serde_json::json;

let grammar_tool = Tool::new("rate_grammar")
    .with_description("Rate the grammatical correctness of English text")
    .with_schema(json!({
        "type": "object",
        "properties": {
            "rating": {
                "type": "integer",
                "minimum": 1,
                "maximum": 10
            },
            "explanation": {
                "type": "string"
            }
        },
        "required": ["rating", "explanation"]
    }));

let chat_req = ChatRequest::new(vec![
    ChatMessage::system("You are a grammar expert."),
    ChatMessage::user("Rate this text: 'The quick brown fox'"),
]).append_tool(grammar_tool);

let chat_res = client.exec_chat("gpt-4o-mini", chat_req, None).await?;
```

**Pros**: Clean API, multi-provider, streaming works well, good tutorial resources
**Cons**: Structured output is via function calling (no native derive macros), no built-in agent abstractions

---

### 2. `rig` (rig-core)

- **Crate**: `rig-core`
- **GitHub**: https://github.com/0xPlaygrounds/rig
- **Website**: https://rig.rs
- **Providers**: OpenAI, Cohere, and others via plugins
- **Streaming**: Yes (multi-turn streaming, pipeline streaming)
- **Structured output**: Yes — `AgentBuilder::schema_output()` added in v0.31
- **Status**: Actively maintained, production users (Coral Protocol, Dria, Nethermind)

**When to use**: Best for full agentic workflows — RAG, tool use, multi-step pipelines, vector store integration. Most batteries-included option.

**Key features**:
- `Agent` type with built-in RAG support
- Pipeline API for chaining LLM + non-LLM operations
- Vector store integration (MongoDB, in-memory, Qdrant via plugin)
- Image + audio generation abstractions
- Structured output via schema enforcement (v0.31+)

**Pros**: Most feature-complete, production-proven, good abstractions
**Cons**: More complex API surface, fewer providers than genai

---

### 3. `async-openai`

- **Crate**: `async-openai`
- **GitHub**: https://github.com/64bit/async-openai
- **Docs**: https://docs.rs/async-openai
- **Providers**: OpenAI (+ OpenAI-compatible APIs)
- **Streaming**: Yes — SSE on all supported APIs (audio, images, chat, etc.)
- **Structured output**: Bring-your-own-types via serde, JSON schema via OpenAI's native structured output
- **Status**: Mature, stable, actively maintained

**When to use**: You're using OpenAI (or a compatible provider like Azure OpenAI, Together.ai, etc.) and want full API coverage with idiomatic Rust types.

**Key features**:
- Full coverage of OpenAI API surface (audio, images, embeddings, fine-tuning, batch, etc.)
- Granular feature flags for faster compile times
- Exponential backoff retries on rate limits
- Configurable base URL → works with any OpenAI-compatible provider

**Pros**: Most complete OpenAI API coverage, stable and mature, great for production
**Cons**: OpenAI-only (not truly multi-provider), no built-in derive macros for structured output

---

### 4. `rstructor`

- **Crate**: `rstructor`
- **GitHub**: https://github.com/clifton/rstructor
- **Docs**: https://docs.rs/rstructor
- **Providers**: OpenAI, Anthropic, Grok (xAI), Gemini
- **Streaming**: No
- **Structured output**: Yes — the main purpose. Derive macros → JSON schema → typed response
- **Status**: Active (v0.2.9)

**When to use**: You need guaranteed typed responses from an LLM with validation and auto-retry. The "Pydantic + Instructor" of Rust.

**Example**:
```rust
use rstructor::derive::InstructMacro;
use serde::{Deserialize, Serialize};

#[derive(InstructMacro, Serialize, Deserialize, Debug)]
struct NpcDialogue {
    greeting: String,
    quest_offer: Option<String>,
    mood: Mood,
}

#[derive(Serialize, Deserialize, Debug)]
enum Mood { Friendly, Suspicious, Hostile }

// rstructor generates JSON schema from the struct,
// sends it to the LLM, parses + validates the response,
// and auto-retries on validation failure.
```

**Pros**: Best ergonomics for structured output, automatic retries, type-safe
**Cons**: No streaming, fewer providers than genai

---

### 5. `instructor-ai`

- **Crate**: `instructor-ai`
- **GitHub**: https://github.com/instructor-ai/instructor-rs
- **Website**: https://rust.useinstructor.com
- **Providers**: OpenAI (via `openai-api-rs`)
- **Streaming**: Abstracted
- **Structured output**: Yes — via `InstructMacro` derive macro
- **Status**: Early stage / maturing, API may change

**When to use**: Official Rust port of the Python Instructor library. Good if your team is familiar with the Python version.

```toml
[dependencies]
instructor-ai = "0.1.8"
instruct-macros = "0.1.8"
openai-api-rs = "4.1.0"
```

**Pros**: Familiar to Python instructor users, derive macro API
**Cons**: Still early, OpenAI-only, API stability not guaranteed

---

### 6. `llm` (graniet/llm)

- **Crate**: `llm`
- **GitHub**: https://github.com/graniet/llm
- **Providers**: OpenAI, Anthropic, Ollama, DeepSeek, xAI, Groq, Cohere, Mistral, Google, ElevenLabs
- **Streaming**: Yes
- **Structured output**: Yes — JSON schema based
- **Status**: Active

**When to use**: You want a single unified API across the most providers, with both streaming and structured output, plus optional agent/chain capabilities.

**Key features**:
- Multi-step chains across different backends
- Memory with sliding window (conversation history)
- REST API server (OpenAI-compatible format)
- Vision and reasoning support
- Builder pattern API

**Pros**: Widest provider support, streaming + structured output in one
**Cons**: Less mature than async-openai or rig, heavier dependency

---

### 7. `langchain-rust`

- **Crate**: `langchain-rust`
- **GitHub**: https://github.com/Abraxas-365/langchain-rust
- **Providers**: OpenAI, Anthropic, and others
- **Streaming**: Yes (async/StreamExt)
- **Structured output**: Limited
- **Status**: Active (v4.6.0)

Also: `langchain-ai-rust` (v5.x) — a more feature-complete fork with LangGraph, structured output, and multi-agent support, though docs.rs build was failing as of research date.

**When to use**: If you want LangChain-style concepts (chains, agents, document loaders, memory) in Rust.

**Pros**: Familiar abstractions, document loaders (PDF, DOCX, HTML)
**Cons**: Structured output limited in v4.x; v5.x not yet stable

---

### 8. `candle` (Hugging Face)

- **Crate**: `candle-core`
- **GitHub**: https://github.com/huggingface/candle
- **Purpose**: Local model inference (not API calls)
- **Streaming**: Yes (token-by-token generation)
- **Structured output**: Via constrained decoding (manual)
- **Status**: Actively maintained by HuggingFace

**When to use**: You want to run models locally (LLaMA, Mistral, Phi, Gemma, etc.) without API costs. Supports quantization, LoRA, distributed compute.

**Pros**: No API costs, full control, runs models locally
**Cons**: Requires GPU/CPU resources, much more setup, not suitable for simple API integration

---

## Feature Comparison

| Library | Providers | Streaming | Structured Out | Agents | Maturity |
|---------|-----------|-----------|----------------|--------|----------|
| `genai` | 8+ | ✅ | via tools | ❌ | ✅ Stable |
| `rig` | 2+ (plugins) | ✅ | ✅ (v0.31+) | ✅ | ✅ Production |
| `async-openai` | OpenAI-compat | ✅ | via serde | ❌ | ✅ Mature |
| `rstructor` | 4 | ❌ | ✅ Best-in-class | ❌ | 🔄 Active |
| `instructor-ai` | OpenAI | partial | ✅ | ❌ | 🔬 Early |
| `llm` (graniet) | 12+ | ✅ | ✅ JSON schema | ✅ | 🔄 Active |
| `langchain-rust` | Several | ✅ | ⚠️ Limited | ✅ | ✅ Active |
| `candle` | Local only | ✅ | manual | ❌ | ✅ HF-backed |

---

## For This Project (hunter-game)

The game's `PLAN.md` mentions LLM integration as a future possibility (tile descriptions, NPC dialogue, dynamic narration). Given the existing Rust stack (ratatui, tokio via async):

### Recommended stack:

```toml
[dependencies]
# Multi-provider LLM client with streaming
genai = "0.1"

# Structured typed outputs (for NPC dialogue, game events)
rstructor = "0.2"

# Or alternatively, use rig for everything (streaming + structured + agents)
# rig-core = "0.5"
```

**Option A — genai + rstructor**: Use genai for streaming NPC text to the UI, rstructor when you need a typed game event (e.g., `CombatEvent { enemy_action: Attack, damage: 5 }`).

**Option B — rig only**: Single dependency, handles both streaming and structured output, better if you later want RAG or tool-calling agents.

---

## Sources

- [rust-genai GitHub](https://github.com/jeremychone/rust-genai)
- [Rig GitHub](https://github.com/0xPlaygrounds/rig)
- [Rig docs](https://docs.rs/rig-core/latest/rig/)
- [async-openai GitHub](https://github.com/64bit/async-openai)
- [async-openai docs](https://docs.rs/async-openai)
- [rstructor GitHub](https://github.com/clifton/rstructor)
- [instructor-ai GitHub](https://github.com/instructor-ai/instructor-rs)
- [instructor-ai docs](https://rust.useinstructor.com)
- [graniet/llm GitHub](https://github.com/graniet/llm)
- [langchain-rust GitHub](https://github.com/Abraxas-365/langchain-rust)
- [candle GitHub](https://github.com/huggingface/candle)
- [Rust Ecosystem for AI & LLMs — HackMD](https://hackmd.io/@Hamze/Hy5LiRV1gg)
- [llm-chain Shuttle guide](https://www.shuttle.dev/blog/2024/06/06/llm-chain-langchain-rust)
