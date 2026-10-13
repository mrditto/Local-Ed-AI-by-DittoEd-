# Integrated build decisions

Current decisions as of October 13, 2026 supersede the historical October 8 entries below: bundle catalog-pinned Qwen3.5-4B Q4_K_M with the native runtime; retain optional verified imports. Development package is 0.5.5.3 with isolated storage. Production candidate is 1.0.2.0 using the unchanged production identity/publisher; app version remains 0.5.5. Source remains local, and release testing is incomplete. GitHub About metadata was updated with user authorization; no source publication or Store submission occurred. STATUS.md records acceptance evidence and next checks.

October 8, 2026. Continue local branch codex/integrated-local-ai from checkpoint 099a96b. Origin fetched before editing; this local branch has no remote counterpart and its upstream is origin/master. No applicable AGENTS.md was found in the checkout or its ancestors.

- The existing production Tauri config, Partner Center MSIX identity/version and installer artifacts remain unchanged.
- The integrated variant uses Tauri identifier com.dittoed.localai.integrated.dev and MSIX name DittoED.LocalEdAI.Integrated.Dev. Development version: 0.5.5.1. Separate per-user storage protects production settings/history.
- VITE_INTEGRATED_AI=true selects the native backend only in the integrated build. Default/legacy builds retain their adapter and settings contract.
- Bundle pinned llama.cpp b11146 CPU runtime and all DLLs from the previously verified archive. Include MIT, LLVM OpenMP and Qwen Apache 2.0 notices.
- Weights use explicit local import, not hidden downloads and not weights embedded in the installer. Exact filenames, byte lengths and SHA-256 values are in config/local-ai-artifacts.json. 4B is the default candidate; 2B is the smaller alternative.
- Copy to a staged per-user model file while hashing; reject wrong size/hash; preserve originals and valid installed weights. Serialize setup. Save selection after load succeeds. Retain failed replacement backup and restore previous runtime when candidate loading fails without cancellation.
- Native startup/readiness, authenticated loopback generation, setup cancellation and Windows job cleanup remain native-owned. The UI receives no local authentication secret.
- Development signing uses a separate local development certificate, never the production publisher. Machine trust/admin requirements are separate from inference prerequisites. A self-signed pilot is not a generally trusted distribution installer.
- No storage schema migration, Markdown/RAG work, remote push, publication or Store submission in this task.

Known unfinished work: resumable explicit model downloads, quantified setup progress, experimental memory thresholds, older CPU/8 GB/16 GB validation, educator evaluation, WACK/clean-machine release checks.
