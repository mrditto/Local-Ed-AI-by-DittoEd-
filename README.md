# Local Ed AI by DittoEd

Echoing the educator, not replacing the magic.

A local, privacy-preserving AI assistant for educators — a prompt library and chat interface running entirely offline against [Ollama](https://ollama.com/) directly. Nothing you type, and no chat you save, ever leaves the machine.

**Status:** Phase 1 (MVP) in progress. See `docs/PHASE1_IMPLEMENTATION_PLAN.md` for the full build plan, task breakdown, and done criteria.

## Features

- **Prompt library** — a curated set of ready-to-edit prompts for lesson planning, assessment, feedback, communication, differentiation, and more, organized by category.
- **Ask DittoEd** — a general-purpose assistant for when you're not sure which prompt to reach for.
- **IEP Form Assistant** — walk through a Maryland IEP (MdIEP) section by section, draft narrative fields with AI from your seed notes, and export a `.docx`/PDF draft. Every draft is clearly watermarked as requiring full IEP team review — this tool never makes an eligibility, placement, or disciplinary determination.
- **Persistent history** — every chat and every IEP draft is saved automatically (locally, via IndexedDB) and can be resumed later with full context intact, including any hidden personalization/attachment context from the original conversation.
- **Projects** — manually group related chats and drafts into named projects; ungrouping a project never deletes its contents.
- **Pin & search** — pin the chats you return to often, and full-text search across titles and message content to find anything fast.
- **Reusable file library** — documents you attach once are saved locally so you can reattach them to a future chat without re-uploading.
- **Personalization** — set a preferred tone and response length that carries across chats.
- **Guided first run** — detects whether Ollama is installed, offers to install it, and helps you pick and download a starter model sized to your hardware.
- **Fully offline after setup** — the only network calls this app ever makes are to your own local Ollama instance and, during first-run setup, to download Ollama/a model. No telemetry, no analytics, no cloud fallback.

## Stack

- **Shell:** Tauri v2 (Rust) — packages the app as a native Windows/Mac/Linux installer
- **UI:** React + TypeScript + Vite
- **Model runtime:** Ollama (phi4-mini primary), accessed directly via its local REST API
- **Local storage:** IndexedDB (chat/IEP history, projects, saved files) — nothing is ever synced or uploaded
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
