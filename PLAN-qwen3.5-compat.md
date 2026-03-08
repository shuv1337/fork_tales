# PLAN — Patch Qwen 3.5 Ollama Compatibility (Reasoning-Only Responses)

## Problem summary

With `qwen3.5:*` on Ollama, OpenAI-compatible chat responses arrive as:
- `choices[0].message.content == ""` (empty string)
- `choices[0].message.reasoning` populated with chain-of-thought text

The native Ollama `/api/chat` path uses `message.thinking` for the same data.

The current runtime `max_tokens` default (`192`) is too small for reasoning models.
Qwen 3.5 allocates tokens to reasoning _first_ — when the budget is exhausted,
content stays empty. With sufficient tokens (≈200+), content IS populated alongside
reasoning. This means the problem is _primarily_ a token budget issue, but the parser
also needs a fallback path for cases where reasoning still consumes the full budget.

Current runtime/weaver parsing only reads `content`/`text`, so:
- world chat falls back to `"mode": "canonical"` with canned responses
- weaver LLM summaries fall back to heuristic/structural summaries
- image commentary returns `"error": "empty_caption"` for vision models

### Empirical evidence (captured 2026-03-04)

```
# max_tokens=50 → content empty, reasoning truncated
curl .../v1/chat/completions -d '{"model":"qwen3.5:2b","max_tokens":50,...}'
→ { "content": "", "reasoning": "Thinking Process:\n\n1. ..." }

# max_tokens=200 → content populated AND reasoning populated
curl .../v1/chat/completions -d '{"model":"qwen3.5:2b","max_tokens":200,...}'
→ { "content": "Hello", "reasoning": "Thinking Process:\n\n1. ..." }

# Native API with think:false → content populated, no thinking overhead
curl .../api/chat -d '{"model":"qwen3.5:2b","think":false,...}'
→ { "content": "Hi!" }
```

## Code surfaces affected

All of these call `_extract_openai_chat_response_text` which only reads
`message.content` and `choice.text`:

| Surface | File | Line | Context |
|---------|------|------|---------|
| Chat text generation | `ai.py` | 1130 | `_ollama_generate_text_remote` |
| Image commentary | `ai.py` | 2619 | `_generate_image_commentary` |
| Embedding caption | `ai.py` | 3180 | `_eta_mu_image_vllm_caption_for_embedding` |
| Central parser | `ai.py` | 3076 | `_extract_openai_chat_response_text` |
| Content sub-parser | `ai.py` | 3057 | `_extract_openai_chat_content_text` |
| Weaver LLM analysis | `web_graph_weaver.js` | 1970 | `_analyzeNodeText` candidate extraction |

## Fix strategy (two-pronged)

1. **Increase token budget** for reasoning models so `content` is populated normally.
2. **Add reasoning-fallback parser** as a safety net for when reasoning still consumes
   the full budget (short prompts, complex reasoning chains, vision models with
   tight token caps).

This avoids relying solely on parsing chain-of-thought text while still being robust.

---

## Phase 1 — Reproduce + record baseline fixtures

- [ ] Record the three curl payloads above as baseline reference in commit body.
- [ ] Confirm current runtime behavior:
  - `POST /api/chat` with `TEXT_GENERATION_MODEL=qwen3.5:9b` returns `"mode": "canonical"`.
  - Weaver status shows `llm_analysis_success` staying at 0 with `WEAVER_LLM_MODEL=qwen3.5:2b`.
  - Image commentary returns `"error": "empty_caption"` for vision-capable Qwen 3.5 models.

Deliverable: baseline note in commit body with exact commands and observed responses.

---

## Phase 2 — Python: token budget adjustment for reasoning models

The default `max_tokens=192` is too small when reasoning overhead is active.

- [ ] In `_ollama_generate_text_remote` (ai.py:1050), detect reasoning model heuristic:
  - Check if model name contains `qwen3` (covers qwen3, qwen3.5, future qwen3.x).
  - When detected, multiply effective `max_tokens` by a configurable factor.
- [ ] Add env knob: `TEXT_GENERATION_REASONING_TOKEN_MULTIPLIER` (default `3`).
  - Applied as: `effective_max_tokens = max_tokens * multiplier` (capped at 4096).
  - Only active when reasoning model is detected.
- [ ] Apply same logic to image commentary path (ai.py:2590, `max_tokens: 160`):
  - When vision model name matches reasoning pattern, increase to `160 * multiplier`.

This is the primary fix — with enough tokens, `content` populates normally.

---

## Phase 3 — Python: reasoning-fallback parser (safety net)

Even with higher token budgets, some edge cases may still produce empty content
with populated reasoning. Add a fallback extraction path.

- [ ] Modify `_extract_openai_chat_response_text` (ai.py:3076) to check reasoning
  fields _after_ content and text checks fail:
  ```
  for choice in choices:
      # ... existing content/text checks ...
      if isinstance(message, dict):
          for key in ("reasoning", "thinking", "reasoning_content"):
              raw_reasoning = message.get(key)
              if isinstance(raw_reasoning, str) and raw_reasoning.strip():
                  return _sanitize_reasoning_fallback(raw_reasoning)
  ```
- [ ] Add `_sanitize_reasoning_fallback(raw: str) -> str` helper:
  1. Try to extract the conclusion: look for the last paragraph after markers like
     `"Output"`, `"Final"`, `"Answer"`, `"Response"`. If found, use that segment.
  2. If no conclusion marker: take the last non-empty paragraph of the reasoning.
  3. Strip structural labels (`"Thinking Process:"`, numbered list markers).
  4. Collapse whitespace.
  5. Cap length at `TEXT_GENERATION_REASONING_FALLBACK_MAX_CHARS` (env, default `512`).
  6. If result is empty after sanitization, return `""` (preserves existing failure behavior).
- [ ] Keep `content` / `text` precedence so non-reasoning models are completely unchanged.

### Telemetry

- [ ] Log when reasoning-fallback path is used: `logger.info("reasoning_fallback_used", model=..., key=..., original_content_empty=True)`.
- [ ] Add counter: increment a module-level `_REASONING_FALLBACK_COUNT` for diagnostic visibility via status endpoint.

---

## Phase 4 — Weaver JS: reasoning-fallback parser

The weaver (`web_graph_weaver.js:1970`) uses the same OpenAI-compat API and has the
same extraction gap.

- [ ] Extract a helper function `extractLlmResponseText(payload)`:
  ```js
  function extractLlmResponseText(payload) {
    const choice = payload?.choices?.[0];
    const content = String(choice?.message?.content || "").trim();
    if (content) return content;
    const text = String(choice?.text || "").trim();
    if (text) return text;
    // reasoning fallback
    const reasoning = String(
      choice?.message?.reasoning || choice?.message?.thinking || ""
    ).trim();
    if (reasoning) return sanitizeReasoningFallback(reasoning);
    return "";
  }
  ```
- [ ] Add `sanitizeReasoningFallback(raw)`:
  - Extract last paragraph after conclusion markers (`Output:`, `Final Answer:`, etc.).
  - Fallback: last non-empty paragraph.
  - Strip `"Thinking Process:"` prefix.
  - Cap at 512 chars.
- [ ] Replace inline extraction at line 1970-1973 with `extractLlmResponseText(payload)`.
- [ ] Add `llm_reasoning_fallback` counter to `this.stats` for observability.
- [ ] Expose in weaver status events for monitoring.

---

## Phase 5 — Tests

### Python (new file: `part64/code/tests/test_ai_response_extraction.py`)

Create a dedicated test file — the extraction logic is distinct from embeddings/ingest.

- [ ] Test `_extract_openai_chat_response_text`:
  - Normal response (`content` populated) → returns content.
  - Reasoning-only response (`content: ""`, `reasoning` populated) → returns sanitized reasoning.
  - Both `content` and `reasoning` present → content wins (no regression).
  - `thinking` field (native Ollama shape) → returns sanitized thinking.
  - `reasoning_content` field (OpenAI extended shape) → returns sanitized reasoning_content.
  - Empty/invalid payload → returns `""`.
  - Malformed reasoning (just `"Thinking Process:"`) → returns `""`.

- [ ] Test `_sanitize_reasoning_fallback`:
  - Reasoning with `"Output: Hello"` conclusion → extracts `"Hello"`.
  - Reasoning without conclusion markers → returns last paragraph.
  - Reasoning exceeding max chars → truncated.
  - Empty/whitespace-only → returns `""`.

Run: `python -m pytest part64/code/tests/test_ai_response_extraction.py -q`

### JavaScript (in `part64/code/tests/weaver_semantic_references.test.js`)

- [ ] Add section for `extractLlmResponseText`:
  - Normal response → extracts content.
  - Reasoning-only → extracts sanitized reasoning.
  - Both present → content wins.
  - Empty payload → returns `""`.

Run: `cd part64/code && node --test tests/weaver_semantic_references.test.js`

---

## Phase 6 — Docker validation with Qwen 3.5

- [ ] Set runtime env in compose override:
  ```yaml
  TEXT_GENERATION_MODEL: "qwen3.5:9b"
  WEAVER_LLM_MODEL: "qwen3.5:2b"
  TEXT_GENERATION_REASONING_TOKEN_MULTIPLIER: "3"
  ```
- [ ] Restart compose stack: `docker compose up --build -d`
- [ ] Validate chat:
  ```bash
  curl -s http://127.0.0.1:8787/api/chat \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","text":"What is the world state?"}],"mode":"llm"}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['mode'], bool(d['reply']))"
  # Expected: "llm True"
  ```
- [ ] Validate weaver:
  ```bash
  # Start weaver with seeds, wait 30s, check stats
  curl -s http://127.0.0.1:8787/api/weaver/status \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('success:', d.get('stats',{}).get('llm_analysis_success',0))"
  # Expected: success count > 0
  ```
- [ ] Verify gateway health:
  - `http://127.0.0.1:8787/` → HTTP 200
  - `http://127.0.0.1:8787/api/catalog` → HTTP 200
  - `ws://127.0.0.1:8787/ws` → websocket connects

---

## Phase 7 — Docs + traceability

- [ ] Add a `## Reasoning Model Compatibility` section to `PLAN-llm-dependencies.md` documenting:
  - Which models trigger reasoning-mode handling (Qwen 3.5 family).
  - New env knobs: `TEXT_GENERATION_REASONING_TOKEN_MULTIPLIER`,
    `TEXT_GENERATION_REASONING_FALLBACK_MAX_CHARS`.
  - Parsing precedence: `content` → `text` → `reasoning` → `thinking` → `reasoning_content`.
- [ ] Append `receipts.log` entry:
  - timestamp, change kind (`runtime-compat`), owner, definition-of-done ref,
    file refs (`ai.py`, `web_graph_weaver.js`), verification commands.

---

## Acceptance criteria

1. Qwen 3.5 chat returns `"mode": "llm"` with substantive reply (not canonical fallback).
2. Weaver can produce LLM summaries with Qwen 3.5 models (`llm_analysis_success > 0`).
3. Image commentary path does not return `"error": "empty_caption"` with Qwen 3.5 vision models.
4. Existing non-Qwen models keep identical behavior — `content` precedence unchanged.
5. New tests pass for both Python and JS parsing behavior (including edge cases).
6. Reasoning-fallback telemetry is observable in logs and status endpoints.
7. Docker-first verification succeeds end-to-end with Qwen 3.5 models.

---

## Risk notes

- **Model detection heuristic** (checking model name for `qwen3`) is fragile. Future
  reasoning models (DeepSeek-R1, Phi-4-reasoning, etc.) will need the same treatment.
  Consider a `TEXT_GENERATION_REASONING_MODELS` env list in the future.
- **Token multiplier cost**: 3× tokens means 3× inference time for reasoning models.
  This is acceptable because the alternative (no useful output) is worse, and the
  reasoning overhead is inherent to these models regardless.
- **Sanitizer quality**: Extracting conclusions from chain-of-thought is heuristic.
  Test with real Qwen 3.5 outputs across prompt types (short, long, ambiguous) before
  declaring the sanitizer robust.
