/**
 * Ledger Core
 *
 * Pure logic for the Ledger agent: prompts, banned-word linting, forbidden-key
 * scanning, prompt construction, and output parsing.
 *
 * No DOM. No network. No side effects.
 */

export const LEDGER_BASE_PROMPT = `You are the Ledger. You are not an assistant. You are an accountant of what things cost in life.
JURISDICTION. You compute cost. You evaluate return. You make a recommendation based on the user's Profile.
COST. Report each item as a count with a unit.
Valid types are: hours, attention, health, habit, thing_not_done.
- hours — time spent
- attention — what it holds in your head, named plainly
- health — name the specific one: sleep, body, stress
- habit — the ritual displaced, not the money
- thing_not_done — the named alternative. If unnamed, set count to null.
Do not invent an item to fill the pass. If the pass yields one item, report one item.
RETURN. Never score these. Ask for them. Return comes from the user's words. Quote them back unchanged.
YOU DO NOT MORALIZE. No should. No disappointment. No praise. Report, stop.
QUOTES. You never quote Thoreau. You think like him. Short sentences. Concrete nouns. Counted things over abstract ones.
BANNED WORDS: journey, optimize, leverage, space, unpack, landscape, should, worth, just, simply, actually, basically, effectively.`;

export const BANNED_WORDS = ['journey', 'optimize', 'leverage', 'space', 'unpack', 'landscape', 'should', 'worth', 'just', 'simply', 'actually', 'basically', 'effectively'];

/** Keys that must never appear in a Ledger JSON payload (case-insensitive). */
const FORBIDDEN_KEYS = ['total', 'sum', 'score'];

/** State-specific instructions appended to the base prompt by buildLedgerPrompt. */
const STATE_INSTRUCTIONS = {
  intake:
    'The user will propose an action. Output a JSON block requesting more information. Schema: { "state": "interrogation", "action": "string", "questions": ["string"] }. Ask 1 to 2 specific questions to get the numbers.',
  interrogation:
    'The user has provided numbers. Calculate the cost, evaluate against the Profile, and output a recommendation. Schema: { "state": "decision", "cost_items": [{"type": "string", "count": number|null, "unit": "string", "note": "string"}], "recommendation": "Accept" | "Decline" | "Neutral", "reasoning": "string" }.',
  decision:
    'The user has made a decision. If they declined, output: { "state": "closed", "return_items": [], "verdict": "declined" }. If they accepted, ask for the return and output: { "state": "closed", "return_items": [{"type": "string", "text": "string", "verbatim": true}], "verdict": "accepted" }.',
};

const CRITICAL_RULE = 'CRITICAL RULE FOR ALL STATES: You must output your prose first, followed by the JSON block in a markdown ```json ... ``` fence.';

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Case-insensitive whole-word scan for banned words.
 * @returns {string[]} the banned words present (canonical BANNED_WORDS order).
 */
export function lintResponse(text) {
  const source = typeof text === 'string' ? text : '';
  if (!source) return [];
  return BANNED_WORDS.filter((word) => new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(source));
}

/**
 * Recursively scan an object for forbidden keys (total / sum / score).
 * @returns {string|null} the offending key as written, or null if clean.
 */
export function hasForbiddenKeys(obj) {
  if (obj === null || typeof obj !== 'object') return null;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = hasForbiddenKeys(item);
      if (found) return found;
    }
    return null;
  }

  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.includes(String(key).toLowerCase())) return key;
    const found = hasForbiddenKeys(obj[key]);
    if (found) return found;
  }

  return null;
}

/**
 * Build the full Ledger prompt for a given state.
 * @param {'intake'|'interrogation'|'evaluation'|'decision'} state
 * @param {{goals?: string[], values?: string[], constraints?: string[]}} profile
 * @param {object} context
 * @returns {string}
 */
export function buildLedgerPrompt(state, profile, context) {
  const p = profile || {};

  const formatList = (label, arr) => {
    const items = Array.isArray(arr) ? arr.filter((item) => item != null && String(item).trim() !== '') : [];
    if (items.length === 0) return `${label}: (none provided)`;
    return `${label}:\n${items.map((item) => `- ${item}`).join('\n')}`;
  };

  const profileBlock = [formatList('GOALS', p.goals), formatList('VALUES', p.values), formatList('CONSTRAINTS', p.constraints)].join('\n');

  const contextBlock = context === undefined || context === null ? '{}' : JSON.stringify(context, null, 2);

  const instruction = STATE_INSTRUCTIONS[state] || `Unknown state "${state}".`;

  return [
    LEDGER_BASE_PROMPT,
    '',
    'USER PROFILE',
    profileBlock,
    '',
    'CONVERSATION CONTEXT',
    contextBlock,
    '',
    `CURRENT STATE: ${state}`,
    instruction,
    '',
    CRITICAL_RULE,
  ].join('\n');
}

function validateSchema(data, expectedState) {
  switch (expectedState) {
    case 'intake': {
      if (data.state !== 'interrogation') return `Expected state "interrogation", got ${JSON.stringify(data.state)}`;
      if (typeof data.action !== 'string') return 'Expected "action" to be a string';
      if (!Array.isArray(data.questions)) return 'Expected "questions" to be an array';
      return null;
    }

    case 'interrogation': {
      if (data.state !== 'decision') return `Expected state "decision", got ${JSON.stringify(data.state)}`;
      if (!Array.isArray(data.cost_items)) return 'Expected "cost_items" to be an array';
      for (let i = 0; i < data.cost_items.length; i += 1) {
        const item = data.cost_items[i];
        if (item === null || typeof item !== 'object' || Array.isArray(item)) return `cost_items[${i}] must be an object`;
        if (typeof item.type !== 'string') return `cost_items[${i}].type must be a string`;
        if (!(item.count === null || typeof item.count === 'number')) return `cost_items[${i}].count must be a number or null`;
        if (typeof item.unit !== 'string') return `cost_items[${i}].unit must be a string`;
        if (typeof item.note !== 'string') return `cost_items[${i}].note must be a string`;
      }
      if (typeof data.recommendation !== 'string') return 'Expected "recommendation" to be a string';
      if (typeof data.reasoning !== 'string') return 'Expected "reasoning" to be a string';
      return null;
    }

    case 'decision': {
      if (data.state !== 'closed') return `Expected state "closed", got ${JSON.stringify(data.state)}`;
      if (!Array.isArray(data.return_items)) return 'Expected "return_items" to be an array';
      if (data.verdict !== 'accepted' && data.verdict !== 'declined') return 'Expected "verdict" to be "accepted" or "declined"';
      return null;
    }

    default:
      return `Unknown expected state: ${expectedState}`;
  }
}

/**
 * Extract, parse, and validate a Ledger response.
 * @param {string} rawText
 * @param {'intake'|'interrogation'|'decision'} expectedState
 * @returns {{ok: true, data: object} | {ok: false, reason: string}}
 */
export function parseLedgerOutput(rawText, expectedState) {
  const text = typeof rawText === 'string' ? rawText : '';

  const match = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```[a-zA-Z0-9]*\s*([\s\S]*?)```/);
  if (!match) return { ok: false, reason: 'No fenced JSON block found' };

  let parsed;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch (err) {
    return { ok: false, reason: `Invalid JSON: ${err.message}` };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'JSON block is not an object' };
  }

  const forbidden = hasForbiddenKeys(parsed);
  if (forbidden) return { ok: false, reason: `Forbidden key found: ${forbidden}` };

  const schemaError = validateSchema(parsed, expectedState);
  if (schemaError) return { ok: false, reason: schemaError };

  return { ok: true, data: parsed };
}
