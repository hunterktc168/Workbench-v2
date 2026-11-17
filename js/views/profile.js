/**
 * User Profile View Module
 * Route: #/profile
 *
 * Defines the user's baseline (goals, values, constraints) that The Ledger uses
 * to evaluate decisions. Persisted in the IndexedDB `dossier` store.
 */

import { get, put } from '../db.js';
import { escapeHtml } from '../markdown.js';

const PROFILE_ID = 'user_profile';

const toLines = (arr) => (Array.isArray(arr) ? arr.join('\n') : '');

const parseLines = (value) =>
  String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export async function render(container, params = {}) {
  const profile = (await get('dossier', PROFILE_ID)) || { goals: [], values: [], constraints: [] };

  container.innerHTML = `
    <div class="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <!-- Profile Header -->
      <div class="panel p-6 border-subtle">
        <div class="inline-flex items-center gap-2 chip text-xs bg-brass/10 text-brass-light border-brass/30 mb-2">
          <span class="w-1.5 h-1.5 rounded-full bg-brass-light"></span>
          Baseline
        </div>
        <h1 class="font-serif text-3xl sm:text-4xl text-slate-100">User Profile</h1>
        <p class="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
          Define your baseline. The Ledger uses this to evaluate your decisions.
        </p>
      </div>

      <!-- Profile Form -->
      <div class="panel p-6 border-subtle space-y-5">
        <div>
          <label for="profile-goals" class="block text-xs font-medium text-slate-300 mb-1.5">
            Goals
          </label>
          <textarea
            id="profile-goals"
            rows="5"
            class="input text-xs font-mono w-full"
            placeholder="One goal per line..."
          >${escapeHtml(toLines(profile.goals))}</textarea>
        </div>

        <div>
          <label for="profile-values" class="block text-xs font-medium text-slate-300 mb-1.5">
            Values
          </label>
          <textarea
            id="profile-values"
            rows="5"
            class="input text-xs font-mono w-full"
            placeholder="One value per line (e.g. Freedom, Learning)..."
          >${escapeHtml(toLines(profile.values))}</textarea>
        </div>

        <div>
          <label for="profile-constraints" class="block text-xs font-medium text-slate-300 mb-1.5">
            Constraints
          </label>
          <textarea
            id="profile-constraints"
            rows="5"
            class="input text-xs font-mono w-full"
            placeholder="One constraint per line (e.g. No weekends, Min $100/hr)..."
          >${escapeHtml(toLines(profile.constraints))}</textarea>
        </div>

        <div class="pt-4 border-t border-subtle flex items-center justify-between gap-3">
          <span id="profile-status" class="text-xs text-muted" aria-live="polite"></span>
          <button type="button" id="save-profile-btn" class="btn btn-primary text-xs py-2 px-5">
            Save Profile
          </button>
        </div>
      </div>
    </div>
  `;

  const goalsEl = document.getElementById('profile-goals');
  const valuesEl = document.getElementById('profile-values');
  const constraintsEl = document.getElementById('profile-constraints');
  const saveBtn = document.getElementById('save-profile-btn');
  const statusEl = document.getElementById('profile-status');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const profileData = {
        id: PROFILE_ID,
        goals: parseLines(goalsEl ? goalsEl.value : ''),
        values: parseLines(valuesEl ? valuesEl.value : ''),
        constraints: parseLines(constraintsEl ? constraintsEl.value : ''),
        updatedAt: Date.now(),
      };

      await put('dossier', profileData);

      if (statusEl) {
        statusEl.textContent = 'Profile saved.';
        statusEl.className = 'text-xs text-success';
      }
    });
  }
}
