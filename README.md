# DittoEd (formerly EducatorLLM)

Echoing the educator, not replacing the magic.

A local, privacy-preserving AI assistant for educators — a prompt library and chat interface running entirely offline against [Ollama](https://ollama.com/) directly. No data leaves the machine.

**Status:** Phase 1 (MVP) in progress. See `docs/PHASE1_IMPLEMENTATION_PLAN.md` for the full build plan, task breakdown, and done criteria.

## Stack

- **Shell:** Tauri v2 (Rust) — packages the app as a native Windows/Mac/Linux installer
- **UI:** React + TypeScript + Vite
- **Model runtime:** Ollama (phi4-mini primary), accessed directly via its local REST API
- **License:** Apache 2.0

## Prerequisites (one-time, per machine)

1. [Node.js](https://nodejs.org/) (LTS)
2. [Rust toolchain](https://www.rust-lang.org/tools/install) — required by Tauri
3. Windows only: [Microsoft C++ Build Tools + WebView2](https://tauri.app/start/prerequisites/) — see Tauri's prerequisites page for your OS
4. [Ollama](https://ollama.com/) installed and running
5. Download the model you want to use, e.g. `ollama pull phi4-mini:latest`

## Getting started

```bash
npm install
cp .env.example .env
# optional: adjust .env with your Ollama base URL + model name
npm run tauri dev
```

This opens the app in a native window backed by a Vite dev server. Make sure Ollama is running first — the app will show a connection error otherwise.

## Building the installer

```bash
npm run tauri build
```

Produces a platform-native installer under `src-tauri/target/release/bundle/`. Phase 1 installers are **unsigned** — Windows SmartScreen will show an "unknown publisher" warning; that's expected until code signing is added in a later phase.

## Project structure

See `docs/PHASE1_IMPLEMENTATION_PLAN.md` §1 for the annotated file/folder layout.

## Docs

- `docs/EDUCATORLLM_ARCHITECTURE.md` — full architectural blueprint
- `docs/EDUCATORLLM_QUICKSTART.md` — quickstart guide
- `docs/PHASE1_IMPLEMENTATION_PLAN.md` — Phase 1 task breakdown, testing checklist, done criteria
