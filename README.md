# Local Ed AI by DittoEd

Echoing the educator, not replacing the magic.

A local AI drafting assistant for educators: lesson planning, differentiation, assessment, feedback and Maryland IEP drafts. Review every AI-assisted draft before use.

## Current status — October 15, 2026

The integrated Windows x64 implementation bundles **Qwen3.5-4B Q4_K_M** and its native CPU inference runtime. The included model does not require another AI application or a separate model download.

**Not yet Microsoft Store-certified or publicly available through the Store.** Package **1.0.2.0**, application **0.5.5**, received a website-metadata rejection under policy 10.1.5 on October 15. External installer promotion has been removed from the website source; live deployment and resubmission must be verified separately. No Store approval is claimed.

The integrated implementation was merged into master through [PR #36](https://github.com/mrditto/Local-Ed-AI-by-DittoEd-/pull/36). The Store workflow uses the explicit integrated production build. Earlier build paths remain for compatibility; use the integrated build guide rather than historical setup instructions.

The [verified Windows workflow](https://github.com/mrditto/Local-Ed-AI-by-DittoEd-/actions/runs/38487097804) generated the approximately **2.73 GB** MSIX. Locked dependency installation, typecheck, lint, inference/native tests, build, packaging and actual bundled-file verification passed. This is build evidence, not Store certification.

## Educator workflows

- Prompt library and Ask DittoEd for editable drafts.
- Maryland IEP narrative drafting, with Word/PDF draft exports for team review.
- Local chat and IEP history, projects, search and reusable attachments.
- Tone, language and response-length preferences.
- Generation cancellation and recovery.
- User-initiated feedback/reporting through the user's email application.

The app assists educators; it does not determine eligibility, placement, services or disciplinary outcomes. Verify facts, standards and legal references against current authoritative sources.

## Installation and requirements

A Microsoft Store installation link will be provided after approval and publication. This page does not offer an external installer.

The candidate targets Windows x64, Windows 10 build 19041 or later, and requires Microsoft Edge WebView2. It includes the CPU runtime, reviewed runtime dependencies and default model. A dedicated GPU is not required by the included CPU runtime.

Installed development startup, generation, cancellation/recovery and history reopening have been tested on the maintainer's computer. The owner reported a successful disconnected-internet lesson request. Simulated unavailable-WebView2 testing displayed the framework's native dependency error. These checks do not establish a clean production installation, migration from earlier installations, or performance on older 8 GB/16 GB computers.

Independent Windows API checks confirm Per-Monitor V2 awareness at the observed 125% scale. The local certification kit still reports a binary-inspection infrastructure warning and an optional scanner overflow; no clean certification-kit pass is claimed.

## Privacy and review

AI inference runs locally, with no cloud AI fallback. Chats and drafts are stored locally. Exports, reference websites, optional email reports and operating-system backups are separate user or device actions. Review student information before sharing it and follow district policy.

[Website](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/) · [Privacy](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/privacy.html) · [AI use](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/ai-policy.html) · [Terms](https://mrditto.github.io/Local-Ed-AI-by-DittoEd-/terms.html)

## Developer build

Use the current [integrated build guide](docs/local-ai/BUILD-GUIDE.md) and [build handoff](docs/local-ai/STATUS.md). Follow its pinned runtime/model staging, license inventory and Windows toolchain instructions before building. Do not use generic build commands from historical plans to produce the Store candidate.

Historical architecture notes, changelogs and Git history describe earlier implementations; they are not current installation instructions. The source is Apache-2.0 licensed; bundled components retain their own notices.
