# Project status — read this first in a new session

Last updated: 2026-07-19, after shipping v0.4.0.

This file exists so a new chat/session can pick up this project without re-deriving
everything from scratch. Paste this file (or its path) into a new conversation to
get full context fast.

## What this project is

**Local Ed AI by DittoEd** — a local, privacy-preserving AI assistant for educators
(Tauri v2 + React/TS + Ollama). Built solo by Bradley Ditto. Public repo:
https://github.com/mrditto/Local-Ed-AI-by-DittoEd- · Promo site (GitHub Pages, `/docs`):
https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/

Goals right now: grow adoption among teachers/districts, apply for education-tech
grants, find sponsors to fund a code-signing certificate + a domain + contributor time.

## Current state (v0.4.0, tagged and published)

- **Persistent history**: chats and IEP drafts autosave to IndexedDB
  (`src/storage/historyStore.ts`), resumable with full context, organizable into
  manual "projects," pinnable, full-text searchable. See `src/components/HistoryPanel.tsx`.
- **Reusable saved-files library**: attach a file once, reuse it later without
  re-uploading (`historyStore.ts` `savedFiles` store; picker lives in `ChatPanel.tsx`).
- **Idle-based Ollama timeout**: long generations (e.g. a full IEP) no longer get cut
  off by a fixed wall-clock deadline — see `src/api/ollama.ts` `invokeOllamaLineStream`.
- **Public promo site**: `docs/index.html` (ditto-machine visual identity — echo-effect
  headline, ruled-paper background, stencil/slab type) with a smart download button
  that auto-detects OS and resolves to the latest GitHub Release's actual installer
  asset, falling back to the releases page. `docs/terms.html` has a plain-English
  disclaimer (not legal advice — flagged as such; get real counsel before relying on it,
  especially re: IDEA/special-ed compliance).
- **Release pipeline**: `.github/workflows/release.yml` — push a `v*` tag, GitHub
  Actions builds Windows/macOS(aarch64-only)/Linux installers via `tauri-action` and
  attaches them to a **draft** release (draft is deliberate — you publish manually).
  v0.4.0 is published and live right now with real installers attached.

## Known issues / open items

1. **Local Tauri build is broken on this Windows machine** — the Windows SDK install
   is missing large chunks of `um\x64` and `ucrt\x64` lib files (confirmed via direct
   file checks) despite the VS Installer reporting the component as installed. Fix:
   Visual Studio Installer → Modify "Visual Studio Build Tools" → Individual components
   → uncheck "Windows 11 SDK" → Apply → recheck it → Apply again (forces a real
   redownload). This does **not** block releases — CI builds on GitHub's own clean
   runners, unaffected by this machine's problem.
2. **macOS build is Apple Silicon only** (`aarch64`) — `macos-latest` GitHub runners are
   ARM64 by default, so there's no Intel Mac binary yet. Low priority unless someone
   asks; fixable by adding an `x86_64-apple-darwin` target to the release workflow's
   matrix.
3. **Just fixed, not yet verified against a real Ollama round-trip**: `useChat.ts` had
   a subtle bug where a chat turn could get saved to history with only the user's
   prompt and no assistant response, caused by capturing the "final transcript" via a
   value assigned inside a `setMessages(prev => ...)` closure — not reliably
   synchronous under React 18+'s automatic batching. Fixed by tracking a `messagesRef`
   updated synchronously on every append, independent of React's render schedule
   (commit `8f8a141`). This was verified by code reasoning and a clean
   typecheck/lint/build, but **not yet exercised against a real Ollama response** in
   the actual installed app — worth explicitly testing (send a chat, close the app,
   reopen, confirm the reply is there in History) before considering it fully closed.
4. **`docs/COMPETITIVE_LANDSCAPE.md`** still carries its own header note flagging it as
   unverified for external publication (vendor pricing/stats need re-checking) — it's
   already public since the repo went public, worth a pass if it matters to you.
5. **Sponsorship not wired up yet** — no GitHub Sponsors / FUNDING.yml live. Bradley
   was mid-setup with Stripe Connect onboarding as of this writing.

## Recently answered questions (so they don't get re-asked)

- Push directly to `master`, no PR workflow — confirmed repeatedly, it's a private
  (now public) solo-maintainer repo.
- History: keep the existing IndexedDB-based system (unlimited retention, covers
  chats + IEP) rather than a separate orphaned `chatStore.ts` design that surfaced
  from an unrelated, never-committed effort — ported over its useful ideas (pin,
  search, saved-files) instead of replacing the architecture.
- Release drafts are intentional (not a bug) — publishing is a deliberate manual step.

## How to verify things are actually working (don't trust old claims — check)

- `git log --oneline -10` for real recent history.
- `git tag` and https://github.com/mrditto/Local-Ed-AI-by-DittoEd-/releases for the
  actual current release state.
- Local clone lives at `C:\Users\bradley.ditto\.copilot\repos\educatorllm` — a second,
  stale/unrelated clone exists at `C:\Users\bradley.ditto\Claude\Projects\Local LLM\educatorllm`,
  don't use it.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` — should all be clean on `master`.
