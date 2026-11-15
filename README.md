# Workbench v2

**AI Venture Operating System** — a local-first workspace for research, agent coordination, and strategic work.

## Architecture

This repository contains **two layers** that must not be conflated:

### 1. Primary Application (Vanilla SPA)

The active product is a **zero-build, pure ES-module single-page application**:

- Entry point: `index.html`
- Modules: `/js/**` (app router, IndexedDB, multi-provider LLM engine, Scout agent, views)
- Styles: `/css/styles.css` + Tailwind Play CDN

This SPA is intentionally designed for extensibility. **Additional agents are expected to be added** as they are built. Do not remove or constrain the agent-related scaffolding, stores, or routing patterns that support future agents.

Key characteristics:
- Local-first (IndexedDB)
- Client-side only inference (OpenAI-compatible, Anthropic, Gemini, or offline Mock)
- Hash-based client routing (`#/scout`, `#/settings`, …)
- No build step required for the core application logic

### 2. Next.js / AI Studio Host Layer

The `app/`, `package.json` (Next scripts), `next.config.ts`, and related TypeScript/Tailwind configuration exist primarily for **Google AI Studio applet deployment compatibility**. They provide the hosting shell, environment injection (see `.env.example`), and build pipeline expected by AI Studio.

- Do **not** treat `next dev` as the primary development server for SPA feature work.
- SPA assets live at the repository root so they remain easily editable and agent-extensible.
- When the project is opened or deployed through AI Studio, the Next.js layer acts as the container; the SPA remains the functional application.

## Development Guidance

- **Feature work & new agents**: Edit files under `/js`, `/css`, and `index.html`. Add new routes and view modules following the existing pattern in `js/app.js` and `js/views/`.
- **AI Studio / deployment concerns**: Use the Next.js configuration and `app/` layout only as needed for hosting, metadata, or environment injection.
- Default LLM provider is the offline **Mock** provider. Configure real providers and the Tavily key under **Settings** (`#/settings`).

## Security Note

API keys are stored in the browser’s IndexedDB in plaintext and are sent directly from the client. This is intentional for a local/demo tool. Use scoped keys and rotate them.

## License / Status

Private / work-in-progress. Designed for progressive addition of specialized agents.
