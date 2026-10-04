# Decisions

- Work from master 7a457c62e7a240795bdd3a7b701e9363b8c17aa8 on codex/integrated-local-ai.
- Preserve app version 0.5.5 and Store version 1.0.0.0 and identity.
- Qwen3.5-4B is the integrated default; 2B is the low-memory alternative. Exact GGUF artifacts, hashes and runtime revision remain unverified.
- Keep Ollama active during migration. Transport retains its existing serialization, system guardrail and request-scoped cancellation.
- No model downloads, training, Store publishing or reference redistribution until their corresponding milestone is implemented and verified.
- Standards and education law are separate reference sources. Only permitted data, explicit jurisdiction/version and validated citations.
- Target CPU-only 8 GB and 16 GB PCs; support and speed require measured evidence.
