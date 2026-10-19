# Published release — October 19, 2026

**Local Ed AI is available in Microsoft Store:** https://apps.microsoft.com/detail/9P36L75MD2NS

Partner Center showed In Microsoft Store and its live product details confirmed package **1.0.3.0 x64**. The public listing showed Local Ed AI, publisher Ditto ED, and a Download button. Application version remains **0.5.5**. Certification monitoring was paused after publication verification.

## Release provenance

- Source: `ac9cb9eaf3bc007b90a46e7a4fe24dbcb22b4d19`, branch `codex/integrated-local-ai` at build time. Publication does not mean all later branch commits have been merged into master.
- Successful Windows run: https://github.com/mrditto/Local-Ed-AI-by-DittoEd-/actions/runs/38967153682
- Artifact: `12076147041`, `local-ed-ai-integrated-msix`.
- Package: `Local Ed AI_1.0.3.0_x64.msix`, 2,731,610,718 bytes.
- Package SHA256: `fbfeba9e852eaad91aa120cbb62507e3ee063f4f56637e3123738368cedc9a12`.
- Downloaded artifact ZIP SHA256: `22bc6600784f24e4bdd0f21b9462d13b3d2672a9a7b06b8f8900375f85a302d4`.

## What is included

Qwen3.5-4B Q4_K_M weights and the pinned llama.cpp Windows CPU runtime are included. No separate AI application or default-model download is required. Windows x64, minimum build 19041, and Microsoft Edge WebView2 are required. Production identity and publisher remain unchanged.

Integrated-only builds exclude legacy external-runtime installer commands and acquisition permissions. Classroom-safety instructions and an email/webmail report-copy fallback are included. Reporting does not send automatically.

## Evidence and limitations

Hosted locked installation, typecheck, lint, inference/native tests, frontend/native build, MSIX packaging and actual archive checks passed. Archive verification covered identity/version/architecture, assets, executable, runtime inventory and bundled model. Corresponding development installations were tested for startup, generation, cancellation/recovery, retained history, document imports and Word/PDF content. Report text copying was verified in development0.5.5.6.

The owner reported two prompts working on an earlier development build on an8GB work computer. Comprehensive8GB/16GB performance, clean production installation/update migration, accessibility and multimonitor coverage remain incomplete. Earlier development WACK inspection produced an optional scanner exception and a DPI inspection warning; a clean local WACK pass is not claimed. Microsoft Store certification/publication is independently verified.

AI answers can still contain factual or procedural errors. Prompt-only procedure tests failed; a rewrite using an imported verified reference succeeded in one limited example. Teacher review remains essential. Publication does not establish FERPA/IDEA compliance, district approval, guaranteed accuracy or universal hardware compatibility.

Historical checkpoints and old release records remain available for provenance. They are not current installation instructions. Future reference packs, retrieval and model training are not part of this release.
