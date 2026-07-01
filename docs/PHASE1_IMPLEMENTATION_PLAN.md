# EducatorLLM — Phase 1 Implementation Plan (Weeks 1–2)

*Companion to `EDUCATORLLM_ARCHITECTURE.md` and `EDUCATORLLM_QUICKSTART.md`. This is the working plan for the MVP milestone only.*

**Phase 1 scope:** 10 core prompts, basic React UI at `localhost:3000` (no wizard yet), chat wired to AnythingLLM Desktop, unsigned Windows installer, disclaimer footers on every AI response.

**Note on source docs:** this plan is built from the architecture summary in project memory (Tauri v2 shell → AnythingLLM Desktop local REST API → Ollama + phi4-mini, React JSON Schema Form for later prompt rendering, Apache 2.0, GitHub Actions CI) plus this conversation's Phase 1 spec. I didn't have direct access to `EDUCATORLLM_ARCHITECTURE.md` / `EDUCATORLLM_QUICKSTART.md` or the five example prompt JSONs in this session — if anything below conflicts with those files, they win. Worth a quick diff pass once they're back in reach.

---

## 1. Repo file/folder structure

```
educatorllm/
├── .github/
│   └── workflows/
│       └── build.yml               # lint + build on push; Windows installer as artifact
├── src-tauri/                       # Tauri v2 Rust shell
│   ├── src/
│   │   └── main.rs
│   ├── icons/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── src/                             # React frontend, runs in the Tauri webview
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   └── anythingllm.ts          # client for AnythingLLM's local REST API
│   ├── components/
│   │   ├── PromptLibrary.tsx       # grid of the 10 prompts
│   │   ├── PromptCard.tsx
│   │   ├── ChatPanel.tsx           # chat view wired to AnythingLLM
│   │   ├── DisclaimerFooter.tsx
│   │   └── ui/                     # Button, Card, Spinner, etc.
│   ├── prompts/
│   │   ├── index.ts                # loads + validates the 10 prompt JSON files
│   │   ├── schema.ts               # TS type for a "prompt" object
│   │   └── data/
│   │       ├── prompt-01-lesson-plan.json
│   │       ├── prompt-02-....json
│   │       └── ...                 # 10 total
│   ├── hooks/
│   │   └── useChat.ts
│   ├── styles/
│   │   └── globals.css
│   └── config/
│       └── anythingllm.config.ts   # base URL, workspace slug, API key placeholder
├── public/
├── docs/
│   ├── EDUCATORLLM_ARCHITECTURE.md
│   ├── EDUCATORLLM_QUICKSTART.md
│   └── PHASE1_IMPLEMENTATION_PLAN.md
├── .env.example
├── .gitignore                       # must include .env, .env.local
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENSE                          # Apache 2.0
└── README.md
```

**Why Tauri from day one, not added later:** the Phase 1 deliverable list includes a Windows installer. Tauri is what produces that installer, so the Rust shell needs to exist from the first scaffold, not get bolted on afterward.

---

## 2. Step-by-step tasks, in dependency order

**Task 1 — Project scaffolding & infrastructure** *(no dependencies — this is what we do next)*
`npm create tauri-app@latest` with the React+TS+Vite template, apply the folder structure above, init git, Apache 2.0 `LICENSE`, `.env.example`, `.gitignore`, ESLint/Prettier config, README stub, skeleton `.github/workflows/build.yml` (lint step only for now).

**Task 2 — AnythingLLM connection layer** *(depends on: Task 1)*
`api/anythingllm.ts` — thin client for AnythingLLM Desktop's local REST API (chat endpoint, workspace list). `config/anythingllm.config.ts` for base URL + workspace slug + API key. Detect "AnythingLLM isn't running / model not loaded" and surface a plain-language message rather than a raw fetch error.

**Task 3 — Prompt library data layer** *(depends on: Task 1; can run in parallel with Task 2)*
Finalize the prompt JSON schema (id, title, description, category, system-prompt/template text). Bring in the existing example prompts, author the rest to reach 10. `prompts/index.ts` loads and validates all 10 at startup and fails loudly if one is malformed.

**Task 4 — Core UI shell** *(depends on: Tasks 2 & 3)*
`App.tsx` layout with two views: prompt library (grid of `PromptCard`s from Task 3) and chat. Selecting a prompt opens the chat view pre-seeded with that prompt's template.

**Task 5 — Chat integration** *(depends on: Task 4)*
`useChat.ts` + `ChatPanel.tsx` wired to the Task 2 client — send message, show loading state, render response, handle errors (AnythingLLM down, model not pulled, network timeout).

**Task 6 — Disclaimer footer** *(depends on: Task 5)*
`DisclaimerFooter.tsx` rendered under every AI response in `ChatPanel`. Keep the copy in one constant so wording can change without touching layout code.

**Task 7 — End-to-end local QA pass** *(depends on: Tasks 1–6)*
Manual run against a real AnythingLLM Desktop + Ollama + phi4-mini on `localhost:3000`. Send all 10 prompts, confirm responses, confirm disclaimer on every response, confirm the "AnythingLLM not running" error path actually triggers when it's off.

**Task 8 — Windows packaging (unsigned)** *(depends on: Task 7 passing)*
Configure `tauri.conf.json` (app name/icon/window size), run `tauri build` for Windows, install the unsigned `.exe`/`.msi` on an actual Windows machine, confirm it launches and the SmartScreen "unknown publisher" warning is the only friction (expected and fine for Phase 1 — signing is a later-phase item per the architecture doc).

**Task 9 — CI build workflow** *(depends on: Task 1 for the skeleton; the Windows-build step depends on Task 8's `tauri.conf.json`)*
Extend `build.yml`: lint + typecheck on every push, and a `windows-latest` job that runs `tauri build` and uploads the installer as a workflow artifact.

**Task 10 — Phase 1 sign-off** *(depends on: everything above)*
Run the full done-criteria checklist below, tag `v0.1.0-mvp`.

**Critical path:** 1 → (2, 3 in parallel) → 4 → 5 → 6 → 7 → 8 → 9 → 10.

---

## 3. Claude Code vs. Brad — division of labor

**Claude Code handles:**
- All scaffolding commands and file/folder creation (Task 1)
- Writing the API client, hooks, components, prompt schema/loader (Tasks 2–6)
- Writing prompt JSON boilerplate from content Brad supplies
- Writing the GitHub Actions workflow (Task 9)
- Running builds, lints, and fixing errors that show up in terminal output

**Brad handles manually:**
- Installing prerequisites once: Node.js, Rust toolchain (required for Tauri), AnythingLLM Desktop, Ollama + `ollama pull phi4-mini`
- Deciding the final 10 prompts and their exact wording/content (Claude Code can draft candidates, but the pedagogical judgment call is yours)
- Visual QA — actually looking at the running app in a window and judging whether it feels right
- Installing and testing the unsigned Windows installer on a real Windows machine (Task 8) — Tauri Windows builds need to run on Windows or a `windows-latest` GitHub Actions runner; a Linux sandbox can't produce or test this artifact
- Approving disclaimer wording (legal/tone judgment call)
- Pushing commits / managing the GitHub repo, unless you hand that off explicitly

---

## 4. Testing checklist per task

| Task | Checklist |
|---|---|
| 1. Scaffolding | `npm run dev` opens a blank Tauri window without errors; `git status` is clean after initial commit; `LICENSE`/`README` present |
| 2. AnythingLLM connection | With AnythingLLM running: a test call returns a real response. With it stopped: app shows a friendly error, not a crash or blank screen |
| 3. Prompt data layer | All 10 JSON files parse; loader throws a clear error if a required field is missing; count check (`prompts.length === 10`) |
| 4. UI shell | Library view renders 10 cards; clicking each one navigates to chat pre-seeded with the right template; back navigation works |
| 5. Chat integration | Send/receive works for a real message; loading spinner shows during the request; three error cases (AnythingLLM down, model missing, timeout) each show distinct, readable messages |
| 6. Disclaimer footer | Footer appears under every response, including the first message of a session and after an error recovery; wording matches the approved copy exactly |
| 7. End-to-end QA | All 10 prompts produce a sane response end-to-end; disclaimer present every time; kill AnythingLLM mid-session and confirm graceful error, not a hang |
| 8. Windows packaging | Installer installs without admin errors beyond the expected SmartScreen prompt; app launches post-install; app can still reach AnythingLLM Desktop after a fresh install (not just from the dev environment) |
| 9. CI workflow | A pushed commit triggers the workflow; lint job fails on a deliberately broken lint rule (sanity check); Windows job produces a downloadable artifact |
| 10. Sign-off | Every row above is checked; tag created; open issues (if any) logged for Phase 2 rather than silently dropped |

---

## 5. Phase 1 done criteria

Phase 1 is complete when all of the following are true:

- App launches from the packaged Windows installer, not just `npm run dev`
- All 10 prompts are visible, selectable, and produce real AnythingLLM-backed responses
- Every AI response — no exceptions — carries the disclaimer footer
- The three key failure modes (AnythingLLM not running, model not pulled, request timeout) each produce a specific, non-technical error message
- CI builds green on the current main branch
- No terminal/dev-tools required for a teacher to open and use the app day-to-day (setup complexity stays on Brad's side, per the project's core UX principle)

---

## Recommendation: scaffolding or Claude Code setup first?

**Set up Claude Code locally on your Windows machine first, then scaffold there — not in this sandbox.**

Reasoning: Tauri needs the Rust toolchain and platform build tools, and the Windows installer (Task 8) has to be built and tested on actual Windows — this Cowork session runs in a Linux sandbox that can't produce or test that artifact. If we scaffold here first, the Rust/Tauri half of the project gets built in an environment that can never validate the one deliverable that matters most for Phase 1 (the installer), and you'd end up re-running Task 1 on your own machine anyway.

Concretely: install Claude Code on your Windows machine (a few minutes), point it at this plan and at `EDUCATORLLM_ARCHITECTURE.md`, and run Task 1 from there. I can still help draft prompt JSON content, review code, and think through architecture from here — but the actual scaffolding and every build/package step should happen where the Windows build can be verified end-to-end.
