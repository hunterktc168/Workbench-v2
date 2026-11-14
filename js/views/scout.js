/**
 * Scout Research Agent View Module
 * Route: #/scout
 *
 * Interactive research chat interface for the autonomous Scout agent.
 */

import { runScout } from '../scout-runner.js';
import { stream } from '../llm.js';
import { saveDossierSession, getDossierSession, deleteDossierSession } from '../db.js';
import { escapeHtml, renderMarkdown } from '../markdown.js';

let activeController = null;
let hashChangeHandler = null;

function createMessageBubble(role, htmlContent, extraClass = '') {
  const wrapper = document.createElement('div');
  if (role === 'user') {
    wrapper.className = 'flex justify-end';
    wrapper.innerHTML = `
      <div class="max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 bg-brass/15 border border-brass/30 text-slate-100 text-xs sm:text-sm leading-relaxed">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-brass-light mb-1">Research Query</div>
        <div>${htmlContent}</div>
      </div>
    `;
  } else {
    wrapper.className = 'flex justify-start';
    wrapper.innerHTML = `
      <div class="w-full max-w-[92%] rounded-xl px-4 py-3 bg-panel border border-subtle text-slate-200 ${extraClass}">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="scout-agent-icon w-2 h-2 rounded-full bg-cyan-400 transition-shadow"></span>
          <span class="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Scout Agent</span>
        </div>
        <div class="scout-bubble-body markdown-body text-xs sm:text-sm leading-relaxed">${htmlContent}</div>
      </div>
    `;
  }
  return wrapper;
}

export async function render(container, params = {}) {
  if (hashChangeHandler) {
    window.removeEventListener('hashchange', hashChangeHandler);
    hashChangeHandler = null;
  }

  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  hashChangeHandler = () => {
    const currentHash = (window.location.hash || '').split('?')[0];
    if (currentHash !== '#/scout' && currentHash !== '#/scout/') {
      if (activeController) {
        activeController.abort();
      }
      window.removeEventListener('hashchange', hashChangeHandler);
      hashChangeHandler = null;
    }
  };
  window.addEventListener('hashchange', hashChangeHandler);

  const savedSession = await getDossierSession('scout_main');
  const savedMessages = Array.isArray(savedSession?.messages) ? savedSession.messages : [];
  const hasSavedMessages = savedMessages.length > 0;
  const emptyStateHtml = `
    <div class="text-xs text-muted text-center py-8">
      Enter a research topic below to dispatch Scout.
    </div>
  `;

  container.innerHTML = `
    <div class="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto space-y-4 animate-fadeIn">
      <!-- Scout Header -->
      <div class="panel p-5 border-subtle shrink-0">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="inline-flex items-center gap-2 chip text-xs bg-cyan-500/10 text-cyan-300 border-cyan-500/30 mb-2">
              <span id="scout-header-icon" class="w-1.5 h-1.5 rounded-full bg-cyan-400 transition-shadow"></span>
              Autonomous Web Research
            </div>
            <h1 class="font-serif text-2xl sm:text-3xl text-slate-100">Scout Research</h1>
          </div>
          <button
            type="button"
            id="scout-clear-btn"
            class="btn btn-ghost text-xs text-muted hover:text-slate-100 px-2.5 py-1.5"
          >
            Clear History
          </button>
        </div>
        <p class="text-xs text-muted mt-1">
          Ask a research question. Scout iteratively searches the web via Tavily and synthesizes a cited report.
        </p>
      </div>

      <!-- Messages Feed -->
      <div id="scout-feed" class="flex-1 panel p-4 sm:p-5 border-subtle overflow-y-auto space-y-4 min-h-0">
        ${hasSavedMessages ? '' : emptyStateHtml}
      </div>

      <!-- Composer Bar -->
      <form id="scout-form" class="panel p-3 border-subtle flex flex-col gap-2 shrink-0">
        <div id="scout-step-indicator" class="hidden items-center justify-between px-1 text-[11px]" aria-live="polite">
          <div class="inline-flex items-center gap-2">
            <span id="scout-step-dot" class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span class="uppercase tracking-wider text-[10px] text-muted font-semibold">Research Loop</span>
            <span id="scout-step-label" class="font-medium text-cyan-300">Mapping Domain</span>
          </div>
          <span id="scout-step-meta" class="text-[10px] font-mono text-faint"></span>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="text"
            id="scout-input"
            class="input flex-1 text-xs sm:text-sm"
            placeholder="What would you like Scout to research?"
            autocomplete="off"
          />
          <button
            type="button"
            id="scout-summarize-btn"
            class="btn btn-ghost border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs px-3 py-2.5 hidden"
            title="Condense the current research feed into a 3-bullet executive summary"
          >
            Summarize
          </button>
          <button type="submit" id="scout-send-btn" class="btn btn-primary text-xs px-4 py-2.5">
            Send
          </button>
          <button type="button" id="scout-stop-btn" class="btn btn-ghost border border-danger/40 text-danger hover:bg-danger/10 text-xs px-4 py-2.5 hidden">
            Stop
          </button>
        </div>
      </form>
    </div>
  `;

  const feed = document.getElementById('scout-feed');
  const form = document.getElementById('scout-form');
  const input = document.getElementById('scout-input');
  const sendBtn = document.getElementById('scout-send-btn');
  const stopBtn = document.getElementById('scout-stop-btn');
  const summarizeBtn = document.getElementById('scout-summarize-btn');
  const clearBtn = document.getElementById('scout-clear-btn');
  const stepIndicator = document.getElementById('scout-step-indicator');
  const stepDot = document.getElementById('scout-step-dot');
  const stepLabel = document.getElementById('scout-step-label');
  const stepMeta = document.getElementById('scout-step-meta');

  let hasStarted = hasSavedMessages;
  let hasGeneratedReport = savedMessages.some(
    (m) => m.role === 'assistant' && (m.content || '').replace(/\[RESEARCH_COMPLETE\]/g, '').trim().length > 0
  );

  const scrollToBottom = () => {
    if (feed) {
      feed.scrollTop = feed.scrollHeight;
    }
  };

  if (hasSavedMessages && feed) {
    for (const msg of savedMessages) {
      if (msg.role === 'user') {
        feed.appendChild(createMessageBubble('user', escapeHtml(msg.content || '')));
      } else if (msg.role === 'assistant') {
        const cleanText = (msg.content || '').replace(/\[RESEARCH_COMPLETE\]/g, '').trim();
        feed.appendChild(createMessageBubble('assistant', renderMarkdown(cleanText)));
      }
    }
    scrollToBottom();
  }

  if (summarizeBtn) {
    summarizeBtn.classList.toggle('hidden', !hasGeneratedReport);
  }

  const appendThoughtBubble = (text = 'Agent Working...') => {
    const bubble = createMessageBubble(
      'assistant',
      `<span class="text-muted animate-pulse">${escapeHtml(text)}</span>`
    );
    feed.appendChild(bubble);
    scrollToBottom();
    return bubble;
  };

  async function handleSend() {
    const query = input ? input.value.trim() : '';
    if (!query) return;

    if (!hasStarted) {
      feed.innerHTML = '';
      hasStarted = true;
    }

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    if (summarizeBtn) {
      summarizeBtn.disabled = true;
      summarizeBtn.classList.add('hidden');
    }
    stopBtn.classList.remove('hidden');

    const userBubble = createMessageBubble('user', escapeHtml(query));
    feed.appendChild(userBubble);

    let currentThoughtBubble = appendThoughtBubble('Agent Working...');
    let lastStreamedText = '';

    const controller = new AbortController();
    activeController = controller;

    let searchCount = 0;

    const setStepIndicator = (active, label = '', meta = '', isSearching = false) => {
      if (!stepIndicator) return;
      stepIndicator.classList.toggle('hidden', !active);
      stepIndicator.classList.toggle('flex', active);
      if (stepLabel) stepLabel.textContent = label;
      if (stepMeta) stepMeta.textContent = meta;
      if (stepDot) {
        stepDot.classList.toggle('is-scout-thinking', active && isSearching);
      }
    };

    setStepIndicator(true, 'Mapping Domain', 'Initializing', false);

    const headerIcon = document.getElementById('scout-header-icon');
    const setThinkingPulse = (bubble, isThinking) => {
      const bubbleIcon = bubble?.querySelector('.scout-agent-icon');
      [headerIcon, bubbleIcon].forEach((iconEl) => {
        if (!iconEl) return;
        iconEl.classList.toggle('is-scout-thinking', isThinking);
      });
    };

    const onUpdate = (text, status) => {
      const bodyEl = currentThoughtBubble?.querySelector('.scout-bubble-body');
      if (!bodyEl) return;

      if (status === 'streaming') {
        setThinkingPulse(currentThoughtBubble, false);
        setStepIndicator(
          true,
          searchCount > 0 ? 'Synthesizing Data' : 'Mapping Domain',
          searchCount > 0 ? `Pass ${searchCount + 1}` : 'Planning',
          false
        );
        lastStreamedText = text;
        bodyEl.innerHTML = renderMarkdown(text.replace(/\[RESEARCH_COMPLETE\]/g, '').trim());
        scrollToBottom();
      } else if (status === 'tool_call') {
        searchCount += 1;
        setThinkingPulse(currentThoughtBubble, false);
        setStepIndicator(true, 'Searching Web', `Query #${searchCount}`, true);
        bodyEl.innerHTML = `<span class="text-cyan-300 font-mono text-xs">${escapeHtml(text)}</span>`;
        currentThoughtBubble = appendThoughtBubble('Agent Working...');
        setThinkingPulse(currentThoughtBubble, true);
      }
    };

    try {
      const finalMessages = await runScout(query, onUpdate, controller.signal);

      const lastAssistant = [...finalMessages]
        .reverse()
        .find((m) => m.role === 'assistant');
      const finalText = (lastAssistant?.content || lastStreamedText || '')
        .replace(/\[RESEARCH_COMPLETE\]/g, '')
        .trim();

      const bodyEl = currentThoughtBubble?.querySelector('.scout-bubble-body');
      if (bodyEl) {
        bodyEl.innerHTML = renderMarkdown(finalText);
      }
      if (finalText) {
        hasGeneratedReport = true;
      }
      await saveDossierSession({ id: 'scout_main', messages: finalMessages, updatedAt: Date.now() });
      scrollToBottom();
    } catch (err) {
      const bodyEl = currentThoughtBubble?.querySelector('.scout-bubble-body');
      if (err && err.name === 'AbortError') {
        if (bodyEl) {
          bodyEl.innerHTML = `<span class="text-warn font-medium">Research stopped by user.</span>`;
        }
      } else {
        if (bodyEl) {
          bodyEl.innerHTML = `<span class="text-danger font-medium">${escapeHtml(err?.message || 'Research failed.')}</span>`;
        }
      }
      scrollToBottom();
    } finally {
      setThinkingPulse(currentThoughtBubble, false);
      setStepIndicator(false);
      activeController = null;
      input.disabled = false;
      sendBtn.disabled = false;
      if (summarizeBtn) {
        summarizeBtn.disabled = false;
        summarizeBtn.classList.toggle('hidden', !hasGeneratedReport);
      }
      stopBtn.classList.add('hidden');
      input.focus();
    }
  }

  async function handleSummarize() {
    if (activeController || !hasGeneratedReport || !feed) return;

    const feedText = Array.from(feed.children)
      .map((el) => (el.innerText || el.textContent || '').trim())
      .filter(Boolean)
      .join('\n\n---\n\n');

    if (!feedText) return;

    input.disabled = true;
    sendBtn.disabled = true;
    if (summarizeBtn) summarizeBtn.disabled = true;
    stopBtn.classList.remove('hidden');

    if (stepIndicator) {
      stepIndicator.classList.remove('hidden');
      stepIndicator.classList.add('flex');
      if (stepLabel) stepLabel.textContent = 'Synthesizing Data';
      if (stepMeta) stepMeta.textContent = 'Executive Summary';
      if (stepDot) stepDot.classList.add('is-scout-thinking');
    }

    const summaryBubble = appendThoughtBubble('Condensing research feed...');
    const headerIcon = document.getElementById('scout-header-icon');
    const bubbleIcon = summaryBubble?.querySelector('.scout-agent-icon');
    [headerIcon, bubbleIcon].forEach((iconEl) => iconEl?.classList.add('is-scout-thinking'));

    const controller = new AbortController();
    activeController = controller;

    let summaryText = '';

    try {
      const systemPrompt =
        'You are an executive research editor. Condense the provided research feed into a concise 3-bullet executive summary in Markdown. Output exactly 3 crisp, high-signal bullet points with no extra preamble.';

      for await (const chunk of stream({
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Condense the following research feed into a concise 3-bullet executive summary:\n\n${feedText}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 512,
        signal: controller.signal,
      })) {
        summaryText += chunk;
        const bodyEl = summaryBubble?.querySelector('.scout-bubble-body');
        if (bodyEl) {
          bodyEl.innerHTML = renderMarkdown(`**Executive Summary**\n\n${summaryText.trim()}`);
        }
        scrollToBottom();
      }
    } catch (err) {
      const bodyEl = summaryBubble?.querySelector('.scout-bubble-body');
      if (err && err.name === 'AbortError') {
        if (bodyEl) {
          bodyEl.innerHTML = `<span class="text-warn font-medium">Summarization stopped by user.</span>`;
        }
      } else if (bodyEl) {
        bodyEl.innerHTML = `<span class="text-danger font-medium">${escapeHtml(err?.message || 'Summarization failed.')}</span>`;
      }
      scrollToBottom();
    } finally {
      [headerIcon, bubbleIcon].forEach((iconEl) => iconEl?.classList.remove('is-scout-thinking'));
      if (stepIndicator) {
        stepIndicator.classList.add('hidden');
        stepIndicator.classList.remove('flex');
        if (stepDot) stepDot.classList.remove('is-scout-thinking');
      }
      activeController = null;
      input.disabled = false;
      sendBtn.disabled = false;
      if (summarizeBtn) {
        summarizeBtn.disabled = false;
        summarizeBtn.classList.toggle('hidden', !hasGeneratedReport);
      }
      stopBtn.classList.add('hidden');
      input.focus();
    }
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSend();
    });
  }

  if (summarizeBtn) {
    summarizeBtn.addEventListener('click', async () => {
      await handleSummarize();
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      if (activeController) {
        activeController.abort();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (activeController) return;
      await deleteDossierSession('scout_main');
      hasStarted = false;
      hasGeneratedReport = false;
      if (summarizeBtn) {
        summarizeBtn.classList.add('hidden');
      }
      if (feed) {
        feed.innerHTML = emptyStateHtml;
      }
    });
  }
}
