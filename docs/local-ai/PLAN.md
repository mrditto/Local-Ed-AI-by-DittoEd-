# Integrated local AI plan

Adopted October 8, 2026 from the user's current request and October 7 handbook. The current user request governs scope; earlier reference-first plans are superseded.

1. Inspect the existing codex/integrated-local-ai branch and preserve production installers/data.
2. Activate the existing native CPU inference foundation in an isolated development build. Bundle the pinned llama.cpp runtime; explicitly import verified Qwen3.5 4B or 2B Q4_K_M weights. No Ollama prerequisite or promotion in integrated setup/settings. Preserve legacy transport/settings for existing builds.
3. Produce an actual MSIX and test the installed development app: import, load, stream, cancel, generate again, restart, model switch/failure, exit/crash cleanup, history and export.
4. Measure memory and evaluate educator outputs on named hardware. This computer is not proof of 8 GB/16 GB support.
5. Only after integrated inference and installed-app checks pass, revisit Markdown ingestion and RAG as separate work.

Production identity, installer copies and production data stay preserved. Models and runtime staging remain ignored. No cloud inference, automatic model downloads, publication, remote pushes, merges or Microsoft Store submission are authorized by this task.

A successful build is not an installed-app pass. Record actual results and missing evidence in STATUS.md and INSTALLED-TEST.md.
