/**
 * Scout Research Agent Core Logic
 * Pure Vanilla ES Module — Zero dependencies, zero UI
 */

export const SCOUT_SYSTEM_PROMPT = `You are Scout, an autonomous research agent. Your job is to answer the user's query by searching the web and synthesizing findings.

You have access to exactly one tool:
- search_web: Executes a web search. Input: { "query": "string" }

INSTRUCTIONS:
1. Broad to Narrow: Start with short, 3-5 word exploratory queries to map the domain. Then drill down into specific follow-ups.
2. If you need information, output a JSON block requesting the tool. Format it EXACTLY like this:
\`\`\`json
{
  "tool": "search_web",
  "query": "your search terms here"
}
\`\`\`

3. Wait for the tool result before continuing.
4. Synthesize your findings into a comprehensive markdown report with inline citations [1], [2] corresponding to the sources provided.
5. When you have the final answer and no more searches are needed, output exactly: [RESEARCH_COMPLETE] at the end of your response.`;

/**
 * Validate a parsed object as a search_web tool call.
 */
function extractValidSearchQuery(parsed) {
  if (
    parsed &&
    typeof parsed === 'object' &&
    parsed.tool === 'search_web' &&
    typeof parsed.query === 'string' &&
    parsed.query.trim().length > 0
  ) {
    return parsed.query.trim();
  }
  return null;
}

/**
 * Scan model output for a search_web JSON tool call (fenced or unfenced).
 * Returns { hasToolCall: true, query } or { hasToolCall: false, query: null }.
 */
export function parseToolCall(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { hasToolCall: false, query: null };
  }

  // 1. Check markdown code blocks first (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json)?[ \t]*\r?\n?([\s\S]*?)```/gi;
  let fenceMatch;
  while ((fenceMatch = fenceRegex.exec(text)) !== null) {
    const candidate = fenceMatch[1].trim();
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      const query = extractValidSearchQuery(parsed);
      if (query) {
        return { hasToolCall: true, query };
      }
    } catch (e) {
      // Malformed JSON inside fence; continue scanning
    }
  }

  // 2. Fallback: scan for balanced JSON object literals in raw text
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let j = i; j < text.length; j++) {
      const ch = text[j];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(i, j + 1);
          try {
            const parsed = JSON.parse(candidate);
            const query = extractValidSearchQuery(parsed);
            if (query) {
              return { hasToolCall: true, query };
            }
          } catch (e) {
            // Not valid JSON; advance outer scan
          }
          break;
        }
      }
    }
  }

  return { hasToolCall: false, query: null };
}

/**
 * Format a query and Tavily search response into a context block for the LLM.
 */
export function buildSearchContext(query, searchResults) {
  const safeQuery = typeof query === 'string' ? query : String(query ?? '');
  const results = Array.isArray(searchResults?.results) ? searchResults.results : [];

  if (results.length === 0) {
    return `=== SEARCH RESULTS FOR: ${safeQuery} ===\nNo results found.`;
  }

  const formattedSources = results
    .map((item, idx) => {
      const title = item?.title || 'Untitled';
      const url = item?.url || '';
      const content = item?.content || '';
      return `[Source ${idx + 1}] Title: ${title}, URL: ${url}\nContent: ${content}`;
    })
    .join('\n\n---\n\n');

  return `=== SEARCH RESULTS FOR: ${safeQuery} ===\n${formattedSources}`;
}
