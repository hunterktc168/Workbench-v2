/**
 * Workbench Agent Hub View Module
 * Route: #/
 *
 * Displays available registered agents and launches into each agent workspace.
 */

import { AGENTS } from '../agent-registry.js';
import { escapeHtml } from '../markdown.js';

function renderAgentIcon(icon) {
  const isSvgPath = typeof icon === 'string' && /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.-]+$/.test(icon.trim());
  if (isSvgPath) {
    return `<svg class="w-5 h-5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${escapeHtml(icon)}" /></svg>`;
  }
  return `<span class="w-5 h-5 flex items-center justify-center text-base shrink-0">${escapeHtml(icon || '')}</span>`;
}

export async function render(container, params = {}) {
  const cardsHtml = AGENTS.map((agent) => `
    <div class="panel p-5 border-subtle flex flex-col justify-between gap-4">
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            ${renderAgentIcon(agent.icon)}
          </div>
          <div class="min-w-0">
            <h2 class="font-serif text-xl text-slate-100 truncate">${escapeHtml(agent.name)}</h2>
          </div>
        </div>
        <p class="text-xs sm:text-sm text-muted leading-relaxed">
          ${escapeHtml(agent.description || '')}
        </p>
      </div>
      <div class="pt-2 border-t border-subtle flex items-center justify-end">
        <a href="${escapeHtml(agent.route)}" class="btn btn-primary text-xs px-4 py-2">
          Launch
        </a>
      </div>
    </div>
  `).join('');

  const settingsCardHtml = `
    <div class="panel p-5 border-subtle flex flex-col justify-between gap-4">
      <div class="space-y-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-brass/10 border border-brass/30 flex items-center justify-center shrink-0">
            <svg class="w-5 h-5 text-brass-light shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="min-w-0">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-brass-light">Configuration</div>
            <h2 class="font-serif text-xl text-slate-100 truncate">Settings &amp; Keys</h2>
          </div>
        </div>
        <p class="text-xs sm:text-sm text-muted leading-relaxed">
          Providers, credentials, and local storage tools.
        </p>
      </div>
      <div class="pt-2 border-t border-subtle flex items-center justify-end">
        <a href="#/settings" class="btn btn-ghost border border-subtle text-slate-200 hover:border-brass/40 text-xs px-4 py-2">
          Configure
        </a>
      </div>
    </div>
  `;

  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <!-- Hub Header -->
      <div class="panel p-6 border-subtle">
        <div class="inline-flex items-center gap-2 chip text-xs bg-brass/10 text-brass-light border-brass/30 mb-3">
          <span class="w-1.5 h-1.5 rounded-full bg-brass-light"></span>
          Workbench
        </div>
        <h1 class="font-serif text-3xl sm:text-4xl text-slate-100">AI Venture Operating System</h1>
        <p class="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
          Local-first workspace for research, agent coordination, and strategic work. Select an agent to begin — additional agents will appear here as they are built.
        </p>
      </div>

      <!-- Agent & Workspace Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${cardsHtml}
        ${settingsCardHtml}
      </div>
    </div>
  `;
}
