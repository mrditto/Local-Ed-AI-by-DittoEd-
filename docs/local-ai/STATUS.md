# Build status

Branch: codex/integrated-local-ai. Base: 7a457c62e7a240795bdd3a7b701e9363b8c17aa8.

## Completed

- Shared inference interface and existing Ollama caller routing; no changes to UI behavior, prompts, settings/history or Store identity/versions.
- Four mocked-Tauri regression tests cover serialized callers, request-isolated streams, queued/in-flight cancellation, listener cleanup and failure recovery. Added npm run test:inference and Windows workflow step.
- Pinned llama.cpp b11146 at 7fe450e19305b828c199d602c23a8337aaa1f03b and fixed Qwen3.5 4B/2B Q4_K_M artifact revisions, byte lengths and hashes in config/local-ai-artifacts.json.
- Download helpers validate checksums and keep models/runtime out of Git. These are developer tools, not product installers; resumable app downloads are pending.
- Both complete GGUF files and Windows runtime archive downloaded and verified. llama-server runs locally.
- CPU smoke tests for both models passed completion, streamed text, HTTP abort and subsequent generation. Each child process terminated after testing.
- License copies: upstream llama.cpp MIT, Qwen Apache-2.0 and LLVM OpenMP notice.

## Validation

- npm ci --cache ../../npm-cache: passed in initial foundation step (global npm cache denied).
- npm run test:inference: 4 passed.
- npm run typecheck and npm run lint: passed.
- npm run build: local esbuild ancestor-directory access restriction.
- npm run build -- --configLoader runner: passed again after changes; existing large-chunk warning.
- Node syntax checks for all download/smoke scripts and git diff --check: passed.
- Install audit reports 2 moderate and 6 high vulnerabilities; no blind dependency upgrades.

## Runtime evidence (single machine, four threads, 4096 context, CPU only)

- 2B: load 3651 ms, generation 13.924 tokens/sec, streaming and recovery passed.
- 4B: load 7789 ms, generation 6.022 tokens/sec, streaming and recovery passed.
- These short synthetic runs do not establish older 8 GB/16 GB PC support, peak RAM or educator accuracy. 2B's fraction instructions were weak and truncated at the 96-token limit. 4B's sample was more relevant but is not an accuracy evaluation.

## Next task

Implement Rust-owned integrated process lifecycle and authenticated loopback streaming adapter, app model selection/import/download UI, packaged runtime DLL resources and abnormal-exit cleanup. Preserve Ollama settings and transport behavior. Test clean installed MSIX without Ollama before declaring integrated inference delivered. RUNTIME.md records preparation commands and pending port-race/process-lifecycle requirements.

No integrated app/MSIX produced. No pushes, releases, publication or Partner Center changes.
