/**
 * Zero-Dependency Markdown to HTML Parser
 * CRITICAL SECURITY: Escapes all HTML characters FIRST before parsing markdown, preventing XSS.
 */

/**
 * Escape raw HTML entities
 */
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render Markdown string into safe, sanitized HTML
 */
export function renderMarkdown(markdown = '') {
  if (!markdown) return '';

  // 1. Strict HTML escape first — eliminates any raw tags like <script>, <iframe>, <img>
  let text = escapeHtml(markdown);

  // 2. Extract Fenced Code Blocks: ```lang\ncode\n```
  const codeBlocks = [];
  text = text.replace(/```([a-zA-Z0-9_-]*)[ \t]*\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `@@CODEBLOCK${codeBlocks.length}@@`;
    codeBlocks.push(
      `<pre class="p-3.5 my-3 rounded-lg bg-[#080B0F] border border-subtle overflow-x-auto font-mono text-xs text-slate-200 leading-relaxed"><code>${code.trim()}</code></pre>`
    );
    return `\n\n${id}\n\n`;
  });

  // 3. Extract Inline Code: `code`
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (match, code) => {
    const id = `@@INLINECODE${inlineCodes.length}@@`;
    inlineCodes.push(
      `<code class="px-1.5 py-0.5 rounded bg-[#080B0F] border border-subtle font-mono text-xs text-brass-light">${code}</code>`
    );
    return id;
  });

  // 4. Process blockquotes, headings, horizontal rules, lists, and paragraphs
  // Blockquotes: > quote line
  text = text.replace(/^(?:&gt;|>)[ ]?([\s\S]*?)(?=\n\n|$)/gm, (match, content) => {
    const cleanLines = content
      .split('\n')
      .map(line => line.replace(/^(?:&gt;|>)[ ]?/, ''))
      .join('<br />');
    return `<blockquote class="p-3 my-2.5 rounded-lg border-l-2 border-brass bg-brass/5 text-xs italic text-slate-200">${cleanLines}</blockquote>`;
  });

  // Headings: # H1, ## H2, ### H3, #### H4
  text = text.replace(/^#### (.*?)$/gm, '<h5 class="font-serif text-sm text-slate-200 font-semibold mt-3 mb-1">$1</h5>');
  text = text.replace(/^### (.*?)$/gm, '<h4 class="font-serif text-base text-slate-100 font-semibold mt-4 mb-1.5">$1</h4>');
  text = text.replace(/^## (.*?)$/gm, '<h3 class="font-serif text-lg text-slate-100 font-semibold mt-4 mb-2">$1</h3>');
  text = text.replace(/^# (.*?)$/gm, '<h2 class="font-serif text-xl sm:text-2xl text-slate-100 font-bold mt-5 mb-2.5">$1</h2>');

  // Horizontal Rules: --- or *** or ___
  text = text.replace(/^(?:---|\*\*\*|___)$/gm, '<hr class="my-4 border-subtle" />');

  // Lists: unordered (- / *) and ordered (1.)
  text = text.replace(/^[-*] (.*?)$/gm, '<li class="ml-4 list-disc text-xs text-slate-300 my-0.5">$1</li>');
  text = text.replace(/^(\d+)\. (.*?)$/gm, '<li class="ml-4 list-decimal text-xs text-slate-300 my-0.5">$2</li>');

  text = text.replace(/(?:<li class="ml-4 list-disc.*?<\/li>(?:\n|$))+/g, match => `\n\n<ul class="my-2 space-y-0.5">\n${match.trim()}\n</ul>\n\n`);
  text = text.replace(/(?:<li class="ml-4 list-decimal.*?<\/li>(?:\n|$))+/g, match => `\n\n<ol class="my-2 space-y-0.5">\n${match.trim()}\n</ol>\n\n`);

  // Paragraphs: double newline separated blocks
  const paragraphs = text.split(/\n\n+/);
  text = paragraphs
    .map(p => {
      p = p.trim();
      if (!p) return '';
      if (
        p.startsWith('<h') ||
        p.startsWith('<pre') ||
        p.startsWith('<blockquote') ||
        p.startsWith('<ul') ||
        p.startsWith('<ol') ||
        p.startsWith('<hr') ||
        p.startsWith('@@CODEBLOCK')
      ) {
        return p;
      }
      return `<p class="text-xs leading-relaxed text-slate-300 my-1.5">${p.replace(/\n/g, '<br />')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  // 5. Process links and bold/italic text
  const links = [];
  const applyBoldItalic = (str) => {
    let out = str;
    out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>');
    out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>');
    out = out.replace(/\b__([^_\n]+)__\b/g, '<strong class="font-semibold text-slate-100">$1</strong>');
    out = out.replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>');
    out = out.replace(/\b_([^_\n]+)_\b/g, '<em class="italic">$1</em>');
    return out;
  };

  // Markdown links: [text](url) - only http, https, mailto, relative #
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|#[^\s)]+)\)/g, (match, label, href) => {
    const id = `@@LINK${links.length}@@`;
    links.push(
      `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-brass-light hover:underline font-medium">${applyBoldItalic(label)}</a>`
    );
    return id;
  });

  // Bare URLs: https://... or http://... (protect URLs from bold/italic underscores)
  text = text.replace(/(https?:\/\/[^\s<>]+)/g, (match) => {
    const cleanUrl = match.replace(/[.,;:!?)]+$/, '');
    const trailing = match.slice(cleanUrl.length);
    const id = `@@LINK${links.length}@@`;
    links.push(
      `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="text-brass-light hover:underline font-medium">${cleanUrl}</a>`
    );
    return `${id}${trailing}`;
  });

  // Bold and Italic on remaining text
  text = applyBoldItalic(text);

  // Restore link placeholders
  links.forEach((linkHtml, idx) => {
    text = text.replace(`@@LINK${idx}@@`, () => linkHtml);
  });

  // 6. Restore Inline Code placeholders
  inlineCodes.forEach((codeHtml, idx) => {
    text = text.replace(`@@INLINECODE${idx}@@`, () => codeHtml);
  });

  // 7. Restore Fenced Code Block placeholders
  codeBlocks.forEach((codeHtml, idx) => {
    text = text.replace(`@@CODEBLOCK${idx}@@`, () => codeHtml);
  });

  return text;
}
