# Integration Points
Ledger requires a 'dossier' store in db.js to persist commitments and deltas.
Decision: Add a dedicated 'dossier' store, rather than overloading 'sessions'.

## 2026-11-15 — Scout: cumulative dossier persistence + hideFromUser tag

Scout's view (`js/views/scout.js`) now accumulates runs into `dossier['scout']` via `persistedMessages.push(...finalMessages)` per send. Consequence: the visible feed shows the full history across queries, but `runScout()` still starts each query with `messages = [{ role: 'user', content: query }]`. The LLM does NOT see prior runs' context. Cumulative persistence is a UI affordance, not conversational memory.

`hideFromUser: true` is the internal-message tag. Tool results, control nudges, and intermediate assistant tool-call messages all carry it. `js/llm.js` formatters read only `role` and `content`, so the flag is inert at the provider layer. Do NOT introduce a `role: 'tool'` — `hideFromUser` is the contract.

`isLegacyInternal()` in `scout.js` is a one-time migration filter for pre-tag messages; it exact-matches the three control-nudge prompt strings. If those prompts change, historical filtering degrades gracefully (worst case: a legacy internal message renders once). Not worth engineering around.

## 2026-11-15 — LLM: per-call provider/model override + model policy (deferred)

`getProvider(overrides)`, `stream({ ..., provider?, model? })`, `complete(...)`, and `validateConfig(overrides)` accept optional per-call overrides on top of stored settings. Provider classes (`OpenAIProvider`, `AnthropicProvider`, `GeminiProvider`) accept a `model` param and fall back to `this.model`. `MockProvider` is unchanged. Unknown providers fall through to `MockProvider` rather than throwing.
