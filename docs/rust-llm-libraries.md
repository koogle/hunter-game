# Rust LLM Libraries — Research Notes

> Research date: 2026-02-23
> Topic: Rust libraries for LLM integration with streaming and structured output

---

## Quick Comparison Matrix

| Crate | Streaming | Structured Output | Multi-Provider | Stars | Status |
|---|---|---|---|---|---|
| `rig` (rig-core) | ✅ | ✅ schemars derive | 20+ providers | ~6,100 | Active |
| `async-openai` | ✅ SSE | ✅ JSON Schema / BYOT | OpenAI-compatible | ~1,800 | Active |
| `langchain-rust` | ✅ | ⚠️ Partial | OpenAI, Anthropic, Ollama | ~1,200 | Moderate |
| `llm-chain` | ⚠️ Unclear | ❌ | OpenAI + local | ~1,600 | Slow |
| `genai` | ✅ | ✅ JsonSpec | 14+ providers | ~661 | Active |
| `llm` (graniet) | ✅ | ✅ JSON Schema | 12+ providers | ~312 | Active |
| `rstructor` | ❌ | ✅ Best-in-class | OpenAI, Anthropic, Grok, Gemini | low | Active |
| `instructor-rs` | ⚠️ | ✅ derive macro | OpenAI only | ~52 | Stale |

---

## Summary / Recommendation

| Goal | Best choice |
|------|-------------|
| Full framework (agents, RAG, streaming, structured) | **`rig`** — 6,100 stars, production-proven |
| OpenAI only, full API coverage | **`async-openai`** — most faithful to OpenAI spec |
| Multi-provider + clean streaming API | **`genai`** — best ergonomics per-call |
| Typed structured extraction (like Python's Instructor) | **`rstructor`** — cleanest derive macro API |
| Everything in one crate (incl. TTS, agents, chains) | **`llm`** (graniet) |

**For hunter-game**: `genai` + `rstructor` — genai streams NPC text to the TUI,
rstructor extracts typed game events (e.g. `CombatEvent`, `NpcDialogue`) from LLM responses.

Or just **`rig`** alone if we later want RAG or tool-calling agents.

---

## Libraries

### 1. `rig` (rig-core)

- **Crate**: `rig-core`
- **GitHub**: https://github.com/0xPlaygrounds/rig
- **Website**: https://rig.rs
- **Docs**: https://docs.rs/rig-core
- **Stars**: ~6,100 (largest in the ecosystem)
- **Providers**: OpenAI, Anthropic, Google Gemini, Ollama, Cohere, AWS Bedrock, Google Vertex AI, 20+ total
- **Streaming**: Yes — `StreamingCompletionModel` trait, multi-turn streaming in agents
- **Structured output**: Yes — `Extractor` with `schemars::JsonSchema` derive macros (cleanest approach)
- **Status**: Active, production users: St. Jude, Coral Protocol, Neon, Nethermind

**When to use**: Best overall Rust LLM framework. The `Extractor` abstraction is the standout — it auto-generates JSON Schema from Rust structs using derive macros, then handles LLM communication, parsing, and error recovery.

**Structured output example**:
```rust
use rig::providers::openai;

#[derive(serde::Deserialize, serde::Serialize, schemars::JsonSchema)]
struct Person {
    name: Option<String>,
    age: Option<u8>,
    profession: Option<String>,
}

let openai = openai::Client::new(api_key);
let extractor = openai.extractor::<Person>(openai::GPT_4O).build();
let person = extractor.extract("John Doe is a 30 year old doctor.").await?;
```

**Agent example**:
```rust
let comedian_agent = client
    .agent("gpt-4o")
    .preamble("You are a comedian...")
    .build();

let response = comedian_agent.prompt("Entertain me!").await?;
```

**Pros**: Largest community, clean ergonomics, strong extractor pattern, broad provider + vector store support, WASM-compatible core
**Cons**: Explicitly warns of future breaking changes; more complex for simple use cases

---

### 2. `async-openai`

- **Crate**: `async-openai`
- **GitHub**: https://github.com/64bit/async-openai
- **Docs**: https://docs.rs/async-openai
- **Stars**: ~1,800
- **Version**: v0.33.0 (February 2026)
- **Dependents**: ~1,900 projects
- **Providers**: OpenAI + any OpenAI-compatible API (Azure OpenAI, Together.ai, etc.)
- **Streaming**: Yes — SSE on all APIs; exponential backoff on rate limits
- **Structured output**: JSON Schema via `response_format`, plus BYOT (Bring-Your-Own-Types) via serde
- **Status**: Mature, most widely used Rust OpenAI client

**When to use**: You're using OpenAI or a compatible provider and want full API coverage — audio, video, images, embeddings, fine-tuning, batch, assistants. Granular feature flags for compile time.

**Streaming + structured output example**:
```rust
// BYOT pattern for JSON schema structured output with streaming
let request = json!({
    "model": "gpt-4o-2024-08-06",
    "messages": [{"role": "user", "content": "Extract event from: Alice goes to a fair Friday."}],
    "response_format": {
        "type": "json_schema",
        "json_schema": {
            "name": "event",
            "schema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "date": {"type": "string"}
                },
                "required": ["name", "date"],
                "additionalProperties": false
            },
            "strict": true
        }
    }
});

let mut stream = client.chat().create_stream_byot(request).await?;
while let Some(result) = stream.next().await { /* handle chunk */ }
```

**Pros**: Most faithful to OpenAI spec, well-tested by 1,900+ dependents, always current with new OpenAI features
**Cons**: OpenAI-only (no real multi-provider), no derive macros for schemas, incomplete WASM support

---

### 3. `genai` (rust-genai)

- **Crate**: `genai`
- **GitHub**: https://github.com/jeremychone/rust-genai
- **Docs**: https://docs.rs/genai
- **Stars**: ~661
- **Version**: v0.5.0 (January 2026)
- **Providers**: OpenAI, Anthropic, Gemini, xAI/Grok, Ollama, Groq, DeepSeek, Cohere, Together, Fireworks, Nebius, Mimo, Zai, BigModel (14+)
- **Streaming**: Yes — `exec_chat_stream()` returns `ChatStream` of `ChatStreamEvent`; v0.5.0 has "more robust internal streaming engine"
- **Structured output**: `JsonSpec` on `ChatRequest`; function calling/tool use for all providers
- **Vision**: Yes (OpenAI, Gemini, Anthropic)
- **Reasoning tokens**: Yes — DeepSeek R1 `reasoning_content`, Gemini Thinking, Anthropic Reasoning Effort
- **Status**: Actively maintained; powers the AIPACK agentic runtime

**When to use**: Best multi-provider API with the cleanest per-call ergonomics. Ideal when you want a lightweight client without framework overhead, or need cutting-edge model support (new providers added quickly).

**Streaming example**:
```rust
use genai::chat::{ChatMessage, ChatRequest};
use genai::Client;

let client = Client::default();
let chat_req = ChatRequest::default()
    .append_message(ChatMessage::user("Tell me a story."));

let mut stream = client.exec_chat_stream("gpt-4o-mini", chat_req, None).await?;
use genai::chat::printer::print_chat_stream;
print_chat_stream(stream, None).await?;
```

**Structured output example**:
```rust
use genai::chat::{ChatRequest, JsonSpec};

let json_spec = JsonSpec::new("person_info", serde_json::json!({
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "age":  {"type": "integer"}
    },
    "required": ["name", "age"]
}));

let chat_req = ChatRequest::default()
    .with_response_format(json_spec)
    .append_message(ChatMessage::user("Extract: John is 30 years old."));
```

**Pros**: Clean API, most providers, streaming works across all of them, active development, no heavy framework
**Cons**: Smaller community than `rig`, no derive macros for structured types (manual JSON schema), no built-in agents/RAG

---

### 4. `llm` (graniet)

- **Crate**: `llm`
- **GitHub**: https://github.com/graniet/llm
- **Stars**: ~312
- **Version**: 1.2.4
- **Providers**: OpenAI, Anthropic, Ollama, DeepSeek, xAI, Phind, Groq, Google, Cohere, Mistral, HuggingFace, ElevenLabs (12+)
- **Streaming**: Yes
- **Structured output**: Yes — JSON Schema in request builder
- **Voice / TTS / STT**: Yes (ElevenLabs)
- **Agents**: Yes — reactive agents, shared memory, configurable triggers
- **Memory**: Yes — sliding window conversation history
- **Multi-step chains**: Yes — different backends at each step
- **REST API server**: Yes — OpenAI-compatible format
- **Status**: Active, 50+ examples in repo

> ⚠️ **Name collision warning**: The `llm` crate name previously belonged to the archived `rustformers/llm` project. This is a completely different, actively maintained library.

**When to use**: You want the most complete single-crate solution — streaming, structured output, agents, memory, TTS, and even a REST API server, all without pulling in a second library.

**Basic example**:
```rust
let llm = LLMBuilder::new()
    .backend(LLMBackend::OpenAI)
    .api_key(api_key)
    .model("gpt-4.1-nano")
    .build()?;

let res = llm.chat(&messages).await?;
println!("{}", res.text()?);
```

**Pros**: Most features in one crate, voice/TTS support, built-in agents and memory, 50+ examples
**Cons**: Smaller community, less battle-tested, name confusion with archived crate, ambitious scope may mean thinner implementations

---

### 5. `rstructor`

- **Crate**: `rstructor`
- **GitHub**: https://github.com/clifton/rstructor
- **Docs**: https://docs.rs/rstructor
- **Providers**: OpenAI, Anthropic, Grok (xAI), Gemini
- **Streaming**: No
- **Structured output**: Yes — the sole purpose. Derive macros, validation, auto-retry.
- **Status**: Active

**When to use**: You need guaranteed typed responses from an LLM with validation and retry. The cleanest API for this use case.

```rust
use rstructor::{Instructor, OpenAIClient};
use serde::{Deserialize, Serialize};

#[derive(Instructor, Serialize, Deserialize, Debug)]
#[llm(validate = "validate_npc")]
struct NpcDialogue {
    #[llm(description = "The NPC's greeting to the player")]
    greeting: String,
    #[llm(description = "Optional quest offer")]
    quest_offer: Option<String>,
    mood: Mood,
}

fn validate_npc(npc: &NpcDialogue) -> Result<()> {
    if npc.greeting.is_empty() { return Err("Greeting required".into()); }
    Ok(())
}

let client = OpenAIClient::from_env()?.max_retries(3);
let npc: NpcDialogue = client.generate("Generate dialogue for a suspicious village elder.").await?;
```

**Pros**: Best ergonomics for structured extraction, auto-retry with validation, hides all JSON schema complexity
**Cons**: No streaming, extraction-only (no agents, RAG, chains)

---

### 6. `langchain-rust`

- **Crate**: `langchain-rust`
- **GitHub**: https://github.com/Abraxas-365/langchain-rust
- **Stars**: ~1,200, **Version**: v4.6.0
- **Streaming**: Yes (async/StreamExt, token usage tracking added v4.6.0)
- **Structured output**: Partial in stable v4.x; the `langchain-ai-rust` v5.x fork adds JSON schema, but docs.rs build was failing
- **Status**: Active but slower cadence than `rig`/`genai`

**When to use**: You want LangChain patterns — composable chains, document loaders (PDF, DOCX, HTML), vector stores (Postgres, Qdrant, SQLite, SurrealDB).

**Pros**: Familiar abstractions, rich document loaders, decent community
**Cons**: Structured output incomplete, Rust API feels like a Python port, v5.x fork unstable

---

### 7. `llm-chain`

- **Crate**: `llm-chain`
- **GitHub**: https://github.com/sobelio/llm-chain
- **Stars**: ~1,600, slow update cadence
- **Streaming**: Not prominently documented
- **Structured output**: Not a native feature

Good for prompt chaining and map-reduce pipelines; not recommended for new projects in 2026 compared to `rig` or `genai`.

---

### 8. `candle` (Hugging Face) — for local inference

- **Crate**: `candle-core`
- **GitHub**: https://github.com/huggingface/candle
- **Purpose**: Run models locally — LLaMA, Mistral, Phi, Gemma, Falcon
- **Streaming**: Yes (token-by-token)
- **Structured output**: Manual (constrained decoding)
- **Status**: Actively maintained by HuggingFace

**When to use**: No API costs, full local control, fine-tuning (LoRA), quantization. Much higher setup cost.

---

### 9. `rustformers/llm` — ARCHIVED

Do not use. Officially archived due to lack of maintainer bandwidth.
Alternatives for local inference: `mistral.rs` or `Ratchet`.

---

## `genai` vs `llm` (graniet) — Detailed Comparison

| | `genai` | `llm` (graniet) |
|---|---|---|
| GitHub stars | **661** | 312 |
| Version | 0.5.0 (Jan 2026) | 1.2.4 |
| Commits | 680 | 487 |
| API style | Direct, explicit per-call | Builder pattern (Stripe-like) |
| Provider count | **14+** | 12+ |
| Streaming | ✅ All providers | ✅ |
| Structured output | JsonSpec (manual schema) | ✅ JSON schema |
| Vision | ✅ OpenAI, Gemini, Anthropic | ✅ |
| Audio / TTS | ❌ | ✅ ElevenLabs |
| Agents | Via AIPACK (separate) | ✅ Built-in |
| Memory | ❌ | ✅ Sliding window |
| Multi-step chains | ❌ | ✅ |
| REST API server | ❌ | ✅ OpenAI-compat |
| Templates | ❌ | ✅ |
| Examples | Yes | 50+ |
| License | Apache-2.0 + MIT | MIT |

**Choose `genai` when**: You want a lean, focused multi-provider client with the cleanest API. Great as a building block paired with `rstructor`.

**Choose `llm` when**: You want everything in one crate — especially if TTS, built-in agents, or a REST API server are needed.

---

## Cargo.toml Setup

```toml
# Option 1: rig (full framework — recommended for complex use cases)
[dependencies]
rig-core = "0.9"
schemars = "0.8"
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }

# Option 2: async-openai (OpenAI-focused, mature)
[dependencies]
async-openai = "0.33"
tokio = { version = "1", features = ["full"] }
futures = "0.3"
serde_json = "1"

# Option 3: genai + rstructor (recommended for hunter-game)
[dependencies]
genai = "0.5"
rstructor = "*"  # check crates.io for latest
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }

# Option 4: llm graniet (all-in-one)
[dependencies]
llm = "1.2"
tokio = { version = "1", features = ["full"] }
```

---

## Sources

- [rust-genai GitHub](https://github.com/jeremychone/rust-genai)
- [Rig GitHub](https://github.com/0xPlaygrounds/rig)
- [Rig docs](https://docs.rs/rig-core/latest/rig/)
- [Rig website](https://rig.rs)
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
