// Scout Eval Harness — pure Node.js, zero dependencies.
// Run with: node tests/eval.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load js/scout-core.js (ESM `export`) into a CommonJS-runnable factory.
// package.json has no "type":"module", so we strip `export ` and eval the body.
const scoutSource = readFileSync(join(__dirname, '../js/scout-core.js'), 'utf8');
const transformed = scoutSource.replace(/^export\s+/gm, '');
const factory = new Function(`${transformed}\nreturn { parseToolCall, buildSearchContext, SCOUT_PROMPTS };`);
const { parseToolCall, buildSearchContext, SCOUT_PROMPTS } = factory();

const fmt = (value) => (typeof value === 'function' ? '(predicate)' : JSON.stringify(value));

const tests = [
  // ---- parseToolCall ----
  {
    name: 'parseToolCall: valid fenced JSON',
    fn: () => parseToolCall('```json\n{ "tool": "search_web", "query": "test query" }\n```'),
    expect: { hasToolCall: true, query: 'test query' },
  },
  {
    name: 'parseToolCall: valid unfenced JSON',
    fn: () => parseToolCall('{ "tool": "search_web", "query": "unfenced query" }'),
    expect: { hasToolCall: true, query: 'unfenced query' },
  },
  {
    name: 'parseToolCall: JSON with prose around it',
    fn: () => parseToolCall('Here is my plan.\n{ "tool": "search_web", "query": "surrounded query" }\nDone.'),
    expect: { hasToolCall: true, query: 'surrounded query' },
  },
  {
    name: 'parseToolCall: malformed JSON',
    fn: () => parseToolCall('```json\n{ "tool": "search_web", "query": broken }\n```'),
    expect: { hasToolCall: false, query: null },
  },
  {
    name: 'parseToolCall: empty string',
    fn: () => parseToolCall(''),
    expect: { hasToolCall: false, query: null },
  },
  {
    name: 'parseToolCall: null input',
    fn: () => parseToolCall(null),
    expect: { hasToolCall: false, query: null },
  },
  {
    name: "parseToolCall: tool 'other_tool' is not search_web",
    fn: () => parseToolCall('{ "tool": "other_tool", "query": "something" }'),
    expect: { hasToolCall: false, query: null },
  },
  {
    name: 'parseToolCall: empty query string',
    fn: () => parseToolCall('{ "tool": "search_web", "query": "" }'),
    expect: { hasToolCall: false, query: null },
  },
  {
    name: 'parseToolCall: nested braces inside JSON string',
    fn: () => parseToolCall('{ "tool": "search_web", "query": "a {nested} query" }'),
    expect: { hasToolCall: true, query: 'a {nested} query' },
  },

  // ---- buildSearchContext ----
  {
    name: 'buildSearchContext: empty results reports no results',
    fn: () => buildSearchContext('anything', { results: [] }),
    expect: (out) => typeof out === 'string' && out.includes('No results found'),
  },
  {
    name: 'buildSearchContext: two results include titles, URLs, separator',
    fn: () =>
      buildSearchContext('q', {
        results: [
          { title: 'Title One', url: 'https://one.example', content: 'Content one' },
          { title: 'Title Two', url: 'https://two.example', content: 'Content two' },
        ],
      }),
    expect: (out) =>
      typeof out === 'string' &&
      out.includes('Title One') &&
      out.includes('Title Two') &&
      out.includes('https://one.example') &&
      out.includes('https://two.example') &&
      out.includes('---'),
  },

  // ---- SCOUT_PROMPTS structure ----
  {
    name: 'SCOUT_PROMPTS: all provider keys present',
    fn: () => SCOUT_PROMPTS,
    expect: (p) =>
      !!p &&
      typeof p === 'object' &&
      ['default', 'gemini', 'openai', 'anthropic'].every((k) => k in p),
  },
  {
    name: 'SCOUT_PROMPTS: every prompt is a non-empty string',
    fn: () => SCOUT_PROMPTS,
    expect: (p) =>
      !!p &&
      Object.values(p).every((v) => typeof v === 'string' && v.trim().length > 0),
  },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  let actual;
  let ok = false;

  try {
    actual = test.fn();
    if (typeof test.expect === 'function') {
      ok = !!test.expect(actual);
    } else {
      ok = JSON.stringify(actual) === JSON.stringify(test.expect);
    }
  } catch (err) {
    ok = false;
    actual = `threw: ${err && err.message ? err.message : String(err)}`;
  }

  if (ok) {
    passed += 1;
    console.log(`PASS  ${test.name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${test.name}`);
    console.log(`      expected: ${fmt(test.expect)}`);
    console.log(`      actual:   ${fmt(actual)}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length}`);
process.exit(failed > 0 ? 1 : 0);
