# CPU runtime validation

Candidate manifest: config/local-ai-artifacts.json. Every download uses a fixed revision and validates exact byte length and SHA-256 before activation. These are developer helpers; app model management, resumable downloads and offline imports are not implemented yet.

Commands from the repository root:

```powershell
npm run test:inference
npm run local-ai:runtime
npm run local-ai:model -- qwen3.5-2b-q4-k-m
npm run local-ai:model -- qwen3.5-4b-q4-k-m
Expand-Archive local-ai-data/runtime/b11146-windows-x64.zip local-ai-data/runtime/extracted
node scripts/smoke-local-ai.mjs local-ai-data/runtime/extracted/llama-server.exe
node scripts/smoke-local-ai.mjs local-ai-data/runtime/extracted/llama-server.exe qwen3.5-4b-q4-k-m
```

The smoke helper owns and terminates only its child process, hides the Windows console, uses an ephemeral loopback port and a random API key, disables Web UI, GPU layers and reasoning, and limits context to 4096 with one generation slot and four CPU threads. It tests nonempty completion, real streamed text, HTTP abort and subsequent generation. Releasing the reserved port before launch has a possible port-selection race; production startup must detect bind failure and retry. Product lifecycle must also handle abnormal app termination, clean model-switch shutdown and idle unloading; this helper is not that implementation.

llama-server.exe is not standalone: the archive includes llama-server-impl.dll, llama-common.dll, llama.dll, ggml libraries, CPU dispatch libraries and libomp.dll. Do not ship just the EXE. Preserve LLVM OpenMP attribution from the archive plus the upstream MIT and model Apache licenses. Installed MSIX resource resolution and DLL loading need a real installed-package test.

Sources checked through upstream APIs:

- https://github.com/ggml-org/llama.cpp/releases/tag/b11146
- https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/tree/e87f176479d0855a907a41277aca2f8ee7a09523
- https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/tree/f6d5376be1edb4d416d56da11e5397a961aca8ae

The runtime and both model files were verified locally. Successful generation does not establish accuracy, older CPU compatibility, peak RAM or useful speed on 8 GB PCs. The short 2B fractions sample gave weak instructions and was truncated at 96 tokens; it is transport evidence only. No model weights or downloaded executables belong in Git.
