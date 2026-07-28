# Local Ed AI by DittoEd

Echoing the educator, not replacing the magic.

A local, privacy-preserving AI assistant for educators — a prompt library and chat interface running entirely offline against [Ollama](https://ollama.com/) directly. Nothing you type, and no chat you save, ever leaves the machine.

**Environmental impact:** there's no data center involved anywhere in this. Every response is generated on your own computer's CPU, the same way any other program on that machine uses electricity — running Local Ed AI doesn't draw meaningfully more power than normal computer use, and there's no server farm running on your behalf in the background.

**Status:** Phase 1 (MVP) in progress. See `docs/PHASE1_IMPLEMENTATION_PLAN.md` for the full build plan, task breakdown, and done criteria.

## Features

- **Prompt library** — a curated set of ready-to-edit prompts for lesson planning, assessment, feedback, communication, differentiation, and more, organized by category.
- **Ask DittoEd** — a general-purpose assistant for when you're not sure which prompt to reach for.
- **IEP Form Assistant** — walk through a Maryland IEP (MdIEP) section by section, draft narrative fields with AI from your seed notes, and export a `.docx`/PDF draft. Every draft is clearly watermarked as requiring full IEP team review — this tool never makes an eligibility, placement, or disciplinary determination.
- **Persistent history** — every chat and every IEP draft is saved automatically (locally, via IndexedDB) and can be resumed later with full context intact, including any hidden personalization/attachment context from the original conversation.
- **Projects** — manually group related chats and drafts into named projects; ungrouping a project never deletes its contents.
- **Pin & search** — pin the chats you return to often, and full-text search across titles and message content to find anything fast.
- **Reusable file library** — documents you attach once are saved locally so you can reattach them to a future chat without re-uploading.
- **Export & verify** — copy any response or export it straight to Word/PDF; Special Education prompts also show a "Verify against" list of authoritative resources to check the draft against.
- **Personalization** — set a preferred tone, response length, and response language that carries across chats. The AI's response language is independent of the app's own interface, which stays in English; the IEP Form Assistant always drafts in English, to match Maryland's official form.
- **Accessible by design** — full keyboard navigation with visible focus indicators throughout, an adjustable text size (small/standard/large), and respect for your OS's reduced-motion preference.
- **Transparent AI labeling** — every AI-generated response is clearly marked "AI-assisted draft — review before use"; the IEP Form Assistant additionally watermarks exported documents as a draft requiring full team review.
- **Bias-aware by default** — every request carries a standing instruction to avoid stereotypes and biased assumptions (race, ethnicity, gender, disability, language, immigration status, religion, socioeconomic status) and to stick to what the teacher actually wrote rather than filling in assumptions. This is prompt-level guidance, not a guarantee — pair it with your own review and the flagging tool below.
- **Flag & report** — flag any response that's wrong, unhelpful, or biased (with an optional note), or report a technical error directly from where it happened. Both open a pre-filled email to the maintainer in your own email app — nothing is sent automatically, and nothing leaves the app until you hit Send yourself.
- **Guided first run** — detects whether Ollama is installed, offers to install it, and helps you pick and download a starter model sized to your hardware.
- **Fully offline after setup** — the only network calls this app ever makes are to your own local Ollama instance and, during first-run setup, to download Ollama/a model. No telemetry, no analytics, no cloud fallback.

## Stack

- **Shell:** Tauri v2 (Rust) — packages the app as a native Windows/Mac/Linux installer
- **UI:** React + TypeScript + Vite
- **Model runtime:** Ollama (phi4-mini primary), accessed directly via its local REST API
- **Local storage:** IndexedDB (chat/IEP history, projects, saved files) — nothing is ever synced or uploaded
- **License:** Apache 2.0

## System requirements

Local Ed AI itself is lightweight; the resource cost comes almost entirely from the local model you pick in first-run setup. All generation runs on CPU by default.

| Tier | Model | Download size | Recommended RAM | Best for |
|---|---|---|---|---|
| Light | `llama3.2:1b` | ~1.3 GB | 8 GB or less | Older or low-memory computers; fastest, simpler responses |
| Recommended (default) | `phi4-mini:latest` | ~2.5 GB | 8 GB+ | Best balance of quality and speed for most school machines |
| Enhanced | `llama3.1:8b` | ~4.9 GB | 16 GB+ | Higher-quality responses, on a newer computer, with more patience |

General guidance:

- **RAM:** 8 GB minimum (Light/Recommended tiers); 16 GB recommended if you want the Enhanced tier or plan to keep other memory-heavy apps open at the same time.
- **Disk space:** at least 5 GB free — covers the app itself, the Ollama runtime, and one downloaded model. Add the download size above for each additional model you try.
- **CPU:** any machine from the last several years; generation speed scales with the model tier above, not with any special hardware.

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
