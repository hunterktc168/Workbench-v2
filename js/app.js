/**
 * Boardroom Application Bootstrap & Router
 * Pure Vanilla ES Module — Zero build step, zero frameworks
 */

import { get, getSetting } from './db.js';
import { escapeHtml } from './markdown.js';
import { AGENTS } from './agent-registry.js';
import * as HubView from './views/hub.js';
import * as SettingsView from './views/settings.js';

// Application State
const state = {
  currentVenture: {
    id: 'default',
    name: 'New Venture',
    thesis: 'Define the opportunity, strategy, and execution plan for your venture.',
  },
  currentRoute: '',
  currentParams: {},
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Route Definitions
const routes = [
  {
    pattern: /^#\/?$/,
    name: 'root',
    render: HubView.render,
  },
  ...AGENTS.map((agent) => ({
    pattern: new RegExp(`^${escapeRegExp(agent.route)}\\/?$`),
    name: agent.id,
    render: agent.viewModule.render,
  })),
  {
    pattern: /^#\/settings\/?$/,
    name: 'settings',
    render: SettingsView.render,
  },
];

/**
 * Resolve the current hash and route match (supports query parameters like ?phase=ideation)
 */
function resolveRoute() {
  const fullHash = window.location.hash || '#/';
  const [hashPath, queryString] = fullHash.split('?');

  let matched = null;
  for (const route of routes) {
    const match = hashPath.match(route.pattern);
    if (match) {
      const params = {};
      if (route.paramKeys) {
        route.paramKeys.forEach((key, index) => {
          params[key] = match[index + 1];
        });
      }
      matched = { route, params, hash: fullHash };
      break;
    }
  }

  if (!matched) {
    matched = {
      route: routes[0],
      params: {},
      hash: '#/',
    };
  }

  // Parse query parameters
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    for (const [key, val] of searchParams.entries()) {
      matched.params[key] = val;
    }
  }

  return matched;
}

/**
 * Router Dispatcher
 */
async function navigate() {
  const { route, params, hash } = resolveRoute();

  if (window.location.hash !== hash) {
    window.location.hash = hash;
    return;
  }

  state.currentRoute = route.name;
  state.currentParams = params;

  // Sync active venture details if ventureId is present
  if (params.ventureId) {
    const v = await get('ventures', params.ventureId);
    if (v) {
      state.currentVenture = { id: v.id, name: v.name, thesis: v.oneliner || v.thesis };
    }
  } else {
    const storedName = await getSetting('active_venture_name');
    const storedId = await getSetting('active_venture_id');
    if (storedName) state.currentVenture.name = storedName;
    if (storedId) state.currentVenture.id = storedId;
  }

  // Mount view
  const actionSlot = document.getElementById('topbar-action-slot');
  if (actionSlot) {
    actionSlot.innerHTML = '';
  }

  const root = document.getElementById('view-root');
  if (root && route.render) {
    try {
      await route.render(root, params);
      root.focus();
    } catch (err) {
      console.error('View render error:', err);
      root.innerHTML = `
        <div class="panel p-6 border-danger/40 bg-danger/10 text-danger text-sm">
          <strong>Error rendering view:</strong> ${escapeHtml(err.message || 'Unknown error')}
        </div>
      `;
    }
  }

  // Synchronize Chrome Elements
  updateTopBar(route.name, params);
  closeMobileDrawer();
}

/**
 * Synchronize Top Bar titles & phase badge
 */
function updateTopBar(routeName, params) {
  const ventureEl = document.getElementById('topbar-venture');
  const phaseBadgeEl = document.getElementById('topbar-phase-badge');

  if (ventureEl) {
    ventureEl.textContent = state.currentVenture.name;
  }

  if (phaseBadgeEl) {
    if (routeName === 'settings') {
      phaseBadgeEl.textContent = 'Settings';
      phaseBadgeEl.className = 'chip text-slate-300 bg-panel text-xs py-0.5 border-subtle';
    } else if (routeName === 'root') {
      phaseBadgeEl.textContent = 'Root';
      phaseBadgeEl.className = 'chip text-slate-300 bg-panel text-xs py-0.5 border-subtle';
    } else {
      phaseBadgeEl.textContent = routeName ? routeName.charAt(0).toUpperCase() + routeName.slice(1) : '';
      phaseBadgeEl.className = 'chip text-slate-300 bg-panel text-xs py-0.5 border-subtle';
    }
  }

  document.querySelectorAll('.sidebar-nav-link').forEach((link) => {
    const isActive = link.dataset.route === routeName;
    link.classList.toggle('bg-white/10', isActive);
    link.classList.toggle('text-slate-100', isActive);
    link.classList.toggle('text-slate-300', !isActive);
  });
}

/**
 * Mobile Drawer Controls
 */
function openMobileDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
}

function closeMobileDrawer() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  if (sidebar && backdrop) {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

/**
 * Bootstrap Application
 */
async function init() {
  // Populate sidebar navigation dynamically from AGENTS registry
  const sidebarNav = document.querySelector('#sidebar nav');
  if (sidebarNav) {
    sidebarNav.innerHTML = '';
    for (const agent of AGENTS) {
      const link = document.createElement('a');
      link.href = agent.route;
      link.className = 'sidebar-nav-link flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-white/5 transition-colors';
      link.dataset.route = agent.id;
      if (agent.description) {
        link.title = agent.description;
      }

      const isSvgPath = typeof agent.icon === 'string' && /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.-]+$/.test(agent.icon.trim());
      const iconHtml = isSvgPath
        ? `<svg class="w-4 h-4 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${escapeHtml(agent.icon)}" /></svg>`
        : `<span class="w-4 h-4 flex items-center justify-center text-sm shrink-0">${escapeHtml(agent.icon || '')}</span>`;

      link.innerHTML = `${iconHtml}<span>${escapeHtml(agent.name)}</span>`;
      sidebarNav.appendChild(link);
    }
  }

  // Mobile drawer events
  const menuBtn = document.getElementById('mobile-menu-btn');
  const closeBtn = document.getElementById('close-sidebar-btn');
  const backdrop = document.getElementById('mobile-backdrop');

  if (menuBtn) menuBtn.addEventListener('click', openMobileDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileDrawer);
  if (backdrop) backdrop.addEventListener('click', closeMobileDrawer);

  // Close drawer on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileDrawer();
  });

  // Hash change listener
  window.addEventListener('hashchange', navigate);

  // Cross-view state synchronization listener
  window.addEventListener('boardroom:sync', () => {
    const { route, params } = resolveRoute();
    updateTopBar(route.name, params);
  });

  // Initial navigation
  if (!window.location.hash) {
    window.location.hash = '#/';
  } else {
    await navigate();
  }
}

// Kick off when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
