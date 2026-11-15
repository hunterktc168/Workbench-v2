/**
 * Scout Research Agent Execution Loop
 * Pure Vanilla ES Module — Connects LLM streaming, tool parsing, and Tavily search
 */

import { stream } from './llm.js';
import { getSetting } from './db.js';
import { SCOUT_SYSTEM_PROMPT, parseToolCall, buildSearchContext } from './scout-core.js';

// Hard ceiling on tool-use rounds. Raised from 5 -> 7 to give complex queries
// a little more room while still preventing runaway loops.
const MAX_ITERATIONS = 7;
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const NETWORK_RETRY_ATTEMPTS = 1; // one retry on transient network errors

/**
 * Execute the autonomous Scout research loop.
 * @param {string} query - User research question
 * @param {Function} onUpdate - Callback receiving (text, status) where status is 'streaming' | 'tool_call'
 * @param {AbortSignal} [signal] - Optional abort signal to cancel streaming and fetches
 * @returns {Promise<Array<{role: string, content: string}>>} Final conversation messages
 */
export async function runScout(query, onUpdate, signal) {
  const emit = typeof onUpdate === 'function' ? onUpdate : () => {};

  const provider = await getSetting('llm_provider_type', 'mock');
  if (provider === 'mock') {
    throw new Error('Scout requires a real LLM provider. Please configure Gemini or OpenAI in Settings.');
  }

  const rawKey = await getSetting('tavily_api_key', '');
  const tavilyKey = typeof rawKey === 'string' ? rawKey.trim() : String(rawKey || '').trim();
  if (!tavilyKey) {
    throw new Error('Tavily API key is missing. Add it in Settings.');
  }

  const messages = [{ role: 'user', content: query }];

  let iterations = 0;
  let completed = false;

  while (true) {
    if (signal && signal.aborted) {
      throw new DOMException('Operation aborted by user', 'AbortError');
    }

    if (iterations >= MAX_ITERATIONS) {
      break;
    }
    iterations++;

    let fullText = '';
    for await (const chunk of stream({ system: SCOUT_SYSTEM_PROMPT, messages, signal })) {
      fullText += chunk;
      emit(fullText, 'streaming');
    }

    if (fullText.includes('[RESEARCH_COMPLETE]')) {
      messages.push({ role: 'assistant', content: fullText });
      completed = true;
      break;
    }

    const toolCall = parseToolCall(fullText);

    if (toolCall.hasToolCall) {
      messages.push({ role: 'assistant', content: fullText });
      emit(`Searching for: "${toolCall.query}"...`, 'tool_call');

      let response;
      let lastErr;
      for (let attempt = 0; attempt <= NETWORK_RETRY_ATTEMPTS; attempt++) {
        try {
          response = await fetch(TAVILY_SEARCH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: tavilyKey,
              query: toolCall.query,
              search_depth: 'basic',
            }),
            signal,
          });
          if (response.ok) break;
          const errText = await response.text().catch(() => response.statusText);
          lastErr = new Error(`Tavily API Error (${response.status}): ${errText || response.statusText}`);
          // Retry only on 5xx / network-ish failures
          if (response.status < 500 || attempt === NETWORK_RETRY_ATTEMPTS) throw lastErr;
        } catch (err) {
          if (err && err.name === 'AbortError') throw err;
          lastErr = err;
          if (attempt === NETWORK_RETRY_ATTEMPTS) throw lastErr;
        }
      }

      if (!response || !response.ok) {
        throw lastErr || new Error('Tavily request failed after retries');
      }

      const searchResult = await response.json();
      messages.push({
        role: 'user',
        content: buildSearchContext(toolCall.query, searchResult),
      });
      continue;
    }

    // Neither a tool call nor [RESEARCH_COMPLETE] was produced
    messages.push({ role: 'assistant', content: fullText });
    messages.push({
      role: 'user',
      content: 'You did not output a tool call and you did not output [RESEARCH_COMPLETE]. Please continue your research or finish the report.',
    });
  }

  if (!completed) {
    messages.push({
      role: 'user',
      content: 'You have reached the maximum number of research iterations. Synthesize a final report immediately based on the information you have gathered so far, and end with [RESEARCH_COMPLETE].',
    });

    let finalReport = '';
    for (let attempt = 0; attempt <= NETWORK_RETRY_ATTEMPTS; attempt++) {
      finalReport = '';
      try {
        for await (const chunk of stream({ system: SCOUT_SYSTEM_PROMPT, messages, signal })) {
          finalReport += chunk;
          emit(finalReport, 'streaming');
        }
        break;
      } catch (err) {
        if ((err && err.name === 'AbortError') || attempt === NETWORK_RETRY_ATTEMPTS) {
          throw err;
        }
      }
    }
    messages.push({ role: 'assistant', content: finalReport });
  }

  return messages;
}
