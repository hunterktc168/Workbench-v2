/**
 * Workbench Agent Registry
 * Central manifest of installed agent modules, routes, and navigation metadata.
 */

import * as ScoutView from './views/scout.js';
import * as ProfileView from './views/profile.js';

export const AGENTS = [
  {
    id: 'scout',
    name: 'Scout Research',
    description: 'Autonomous web research agent powered by Tavily search and cited synthesis.',
    route: '#/scout',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    viewModule: ScoutView,
  },
  {
    id: 'profile',
    name: 'User Profile',
    description: 'Define your baseline goals, values, and constraints for The Ledger.',
    route: '#/profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    viewModule: ProfileView,
  },
];
