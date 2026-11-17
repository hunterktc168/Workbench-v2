/**
 * Ledger Runner
 *
 * Orchestration layer for the Ledger agent: loads the user profile, drives a
 * single turn against the configured LLM provider, lints and validates the
 * response, and persists commitments.
 *
 * Depends only on ./llm.js, ./db.js, and ./ledger-core.js.
 */

import { stream } from './llm.js';
import { get, put, getSetting } from './db.js';
import { buildLedgerPrompt, parseLedgerOutput, lintResponse, BANNED_WORDS } from './ledger-core.js';

/**
 * Load the user's profile from the dossier store.
 * @returns {Promise<{goals: string[], values: string[], constraints: string[]}>}
 */
export async function loadProfile() {
  const profile = await get('dossier', 'user_profile');
  if (!profile) return { goals: [], values: [], constraints: [] };
  return profile;
}

/**
 * Run a single Ledger turn against the configured provider.
 *
 * @param {object} options
 * @param {'intake'|'interrogation'|'decision'} options.state
 * @param {{goals?: string[], values?: string[], constraints?: string[]}} options.profile
 * @param {Array<{role: 'user'|'assistant', content: string}>} options.context
 * @param {string} options.userMessage
 * @param {(fullText: string, phase: string) => void} [options.onUpdate]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ok: true, data: object, fullText: string} | {ok: false, reason: string, fullText: string}>}
 */
export async function runLedgerTurn({ state, profile, context, userMessage, onUpdate, signal }) {
  // 1. Require a real provider.
  const provider = await getSetting('llm_provider_type', 'mock');
  if (provider === 'mock') {
    throw new Error('Ledger requires a real LLM provider. Configure Gemini or OpenAI in Settings.');
  }

  // 2. Build the system prompt.
  const systemPrompt = buildLedgerPrompt(state, profile, { history: context });

  // 3. Build the messages array.
  const messages = [...(Array.isArray(context) ? context : []), { role: 'user', content: userMessage }];

  // 4. Stream and accumulate.
  let fullText = '';
  for await (const chunk of stream({ system: systemPrompt, messages, signal })) {
    fullText += chunk;
    if (typeof onUpdate === 'function') onUpdate(fullText, 'streaming');
  }

  // 5. Lint for banned words.
  const violations = lintResponse(fullText);
  if (violations.length > 0) {
    return { ok: false, reason: 'Banned words: ' + violations.join(', '), fullText };
  }

  // 6. Parse and validate the JSON payload.
  const parsed = parseLedgerOutput(fullText, state);
  if (parsed.ok === false) {
    return { ok: false, reason: parsed.reason, fullText };
  }

  // 7. Valid.
  return { ok: true, data: parsed.data, fullText };
}

/**
 * Persist an accepted/declined Ledger commitment to the dossier store.
 * Only called after a successful 'interrogation' turn where data.state === 'decision'.
 *
 * @param {object} profile
 * @param {object} data
 * @param {string} userMessage
 * @returns {Promise<object>} the saved record
 */
export async function persistLedgerCommitment(profile, data, userMessage) {
  const record = {
    id: 'commitment_' + Date.now(),
    label: userMessage,
    cost_items: data.cost_items,
    recommendation: data.recommendation,
    reasoning: data.reasoning,
    state: data.state,
    date_made: Date.now(),
  };

  await put('dossier', record);
  return record;
}
