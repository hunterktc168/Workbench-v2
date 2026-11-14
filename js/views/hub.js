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

  container.innerHTML = `
    <div class="max-w-5xl mx-auto space-y-6 animate-fadeIn">
      <!-- Hub Header -->
      <div class="panel p-6 border-subtle">
        <h1 class="font-serif text-3xl sm:text-4xl text-slate-100">Workbench</h1>
        <p class="text-xs sm:text-sm text-muted mt-1">
          Select an agent to begin.
        </p>
      </div>

      <!-- Agent Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${cardsHtml}
      </div>
    </div>
  `;
}
