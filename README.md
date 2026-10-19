# Local Ed AI by DittoEd

Echoing the educator, not replacing the magic.

A local AI drafting assistant for educators: lesson planning, differentiation, assessment, feedback and Maryland IEP drafts. Review every AI-assisted draft before use.

## Current status — October 19, 2026

The integrated Windows x64 implementation bundles **Qwen3.5-4B Q4_K_M** and its native CPU inference runtime. The included model does not require another AI application or a separate model download.

**Published in Microsoft Store.** Store package **1.0.3.0**, application **0.5.5**, passed certification and its public listing was verified October 19, 2026. [Install Local Ed AI from Microsoft Store](https://apps.microsoft.com/detail/9P36L75MD2NS).

The integrated implementation was merged into master through [PR #36](https://github.com/mrditto/Local-Ed-AI-by-DittoEd-/pull/36). The Store workflow uses the explicit integrated production build. Earlier build paths remain for compatibility; use the integrated build guide rather than historical setup instructions.

The [verified Windows workflow](https://github.com/mrditto/Local-Ed-AI-by-DittoEd-/actions/runs/38967153682) generated the approximately **2.73 GB** MSIX. Locked dependency installation, typecheck, lint, inference/native tests, build, packaging and actual bundled-file verification passed. Store publication was verified separately in Partner Center and on the public listing.

## Educator workflows

- Prompt library and Ask DittoEd for editable drafts.
- Maryland IEP narrative drafting, with Word/PDF draft exports for team review.
- Local chat and IEP history, projects, search and reusable attachments.
- Tone, language and response-length preferences.
- Generation cancellation and recovery.
- User-initiated feedback/reporting through email, with copyable report text for webmail.

The app assists educators; it does not determine eligibility, placement, services or disciplinary outcomes. Verify facts, standards and legal references against current authoritative sources.

## Installation and requirements

[Install Local Ed AI from Microsoft Store](https://apps.microsoft.com/detail/9P36L75MD2NS). Use the Store version rather than historical GitHub installers or development packages.

The Store release targets Windows x64, Windows 10 build 19041 or later, and requires Microsoft Edge WebView2. It includes the CPU runtime, reviewed runtime dependencies and default model. A dedicated GPU is not required by the included CPU runtime.

Installed development startup, generation, cancellation/recovery and history reopening have been tested on the maintainer's computer. The owner reported a successful disconnected-internet lesson request. Simulated unavailable-WebView2 testing displayed the framework's native dependency error. The owner also reported two prompts working on an earlier development build on an 8 GB work computer. These checks do not establish comprehensive 8 GB/16 GB performance, clean production installation or migration from earlier installations.

Independent Windows API checks confirm Per-Monitor V2 awareness at the observed 125% scale. The local certification kit still reports a binary-inspection infrastructure warning and an optional scanner overflow; no clean certification-kit pass is claimed.

## Privacy and review

AI inference runs locally, with no cloud AI fallback. Chats and drafts are stored locally. Exports, reference websites, optional email reports and operating-system backups are separate user or device actions. Review student information before sharing it and follow district policy.

[Website](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/) · [Privacy](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/privacy.html) · [AI use](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/ai-policy.html) · [Terms](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/terms.html)

## Developer build

Use the current [integrated build guide](docs/local-ai/BUILD-GUIDE.md) and [build handoff](docs/local-ai/STATUS.md). Follow its pinned runtime/model staging, license inventory and Windows toolchain instructions before building. Do not use generic build commands from historical plans to produce the Store candidate.

Historical architecture notes, changelogs and Git history describe earlier implementations; they are not current installation instructions. The source is Apache-2.0 licensed; bundled components retain their own notices.

For release provenance, exact package hashes and limitations, see [published release status](docs/local-ai/RELEASE-STATUS.md).
