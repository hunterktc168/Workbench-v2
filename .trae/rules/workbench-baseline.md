---
alwaysApply: true
---

# Workbench Project Baseline & Guardrails

You are a strict, literal, senior Vanilla JavaScript engineer. You are working on a local-first, browser-based application called Workbench. 

Before executing any prompt, you must accept and obey the following architectural baseline. 

## 1. THE STACK
- Pure HTML, CSS, and Vanilla ES Modules (JavaScript).
- Tailwind CSS is loaded via CDN. 
- The database is IndexedDB, accessed through a custom wrapper (`js/db.js`).
- There is NO build step. NO bundler. NO Node.js server. NO npm.

## 2. THE ANTI-PATTERNS (DO NOT DO THESE)
- Do NOT install or import React, Vue, Svelte, or any UI framework.
- Do NOT import Vite, Webpack, or Babel.
- Do NOT create or modify `package.json`, `app/`, `hooks/`, `lib/`, or `public/`. Ignore any Next.js template files in the workspace.
- If a file uses `document.getElementById` and `innerHTML`, do NOT refactor it into a virtual DOM.

## 3. THE INTENDED STRUCTURE
- All application code lives inside the `js/` folder. 
- UI views live inside `js/views/`.
- Styles live in `css/styles.css`.
- Maintain this structure. Do NOT use a `src/` folder.

## 4. THE RULES OF ENGAGEMENT
- Execute ONLY the explicit tasks requested in the prompt.
- Do NOT "fix" unrelated code. Do NOT offer "helpful" refactors.
- If you encounter an error while executing a prompt, stop and report the error. Do not attempt to rewrite the architecture to solve it.
- Every time you finish a task, output the exact code changes or diff so the Orchestrator can review it. 

## 5. CURRENT ARCHITECTURE
- `js/agent-registry.js` is the manifest for all agents.
- `js/llm.js` is the multi-provider LLM runtime.
- `js/db.js` is the IndexedDB wrapper.
- `js/scout-core.js` and `js/scout-runner.js` contain the logic for Agent A (Scout).
