# Changelog

All notable changes to Local Ed AI are documented here.

## Unreleased

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
