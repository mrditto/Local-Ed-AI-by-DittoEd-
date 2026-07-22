# Changelog

All notable changes to Local Ed AI are documented here.

## 0.4.2 — 2026-07-22

### Added

- Copy / Download as Word / Download as PDF actions under every assistant chat response, in both Prompt Library chat and Ask DittoEd. Word and PDF preserve headings, bold, and lists from the response's markdown; Copy copies the raw markdown to the clipboard.

### Fixed

- The clipboard plugin had no permissions granted, so Copy silently failed.
- The filesystem write scope was restricted to a temp-only path, so saving an exported Word/PDF file to a normal location (Desktop, Documents, etc.) via the save dialog was silently blocked — this also affected the existing IEP Form Assistant's Word export.

## 0.4.1 — 2026-07-20

### Fixed
- A chat turn could get saved to history with only the user's prompt and no assistant response, caused by reading the final transcript from a value assigned inside a `setMessages` closure — not reliably synchronous under React 18+'s automatic batching. History now tracks the transcript via a ref updated synchronously on every message append.

## 0.4.0 — 2026-07-19

### Added
- Persistent chat and IEP draft history (IndexedDB-backed) — every conversation and IEP draft autosaves and can be resumed later with full context.
- Manual projects for organizing chats and drafts; deleting a project ungroups its contents rather than deleting them.
- Pin chats/drafts to the top of History.
- Full-text search across session titles, previews, and message/draft content.
- Reusable saved-files library — attach a document once, reuse it in later chats without re-uploading.
- "New chat" action that starts a fresh saved session instead of continuing to overwrite the current one.
- One-time migration recovers any in-progress IEP draft from the previous single-slot storage format.

### Fixed
- Long-running chat/IEP generations (e.g. a full IEP with many sections) were being cut off by a fixed wall-clock timeout even while the model was still actively responding. The timeout is now idle-based — it only fires if the model actually stops responding, not because a response is simply taking a while.

## 0.3.0 — Attachments + Personalization

- File attachments in chat (PDF, DOCX, TXT, MD) with automatic text extraction.
- Personalization settings (tone, response length) applied across chats.
