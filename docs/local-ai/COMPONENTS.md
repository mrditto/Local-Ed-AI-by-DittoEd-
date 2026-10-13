# Integrated component inventory

The native engine is llama.cpp b11146 (7fe450e19305b828c199d602c23a8337aaa1f03b), Windows x64 CPU archive pinned in config/local-ai-artifacts.json. RUNTIME-FILES.csv records all 44 shipped engine/DLL/notice files by byte length and SHA-256. Packaging verifies this inventory before staging. Files include baseline/CPU variants, libomp, llama-server and its required libraries; the entire pinned DLL set is retained for this pilot.

Bundled notices: llama.cpp MIT, LLVM OpenMP notice, Qwen Apache 2.0. The MSIX includes catalog-pinned Qwen3.5-4B Q4_K_M weights; optional imported files must also match the catalog. Exact quantizer revisions, hashes and licenses are recorded there. GGUF files are excluded from Git.

App dependencies remain locked in package-lock.json and src-tauri/Cargo.lock. Compatible npm updates on October 13 reduced the audit to zero high/three moderate/no critical findings. The remaining Mammoth CLI dependency chain was not found in the app's browser document-extraction path; this scoped reachability assessment is not a claim of zero risk. See STATUS.md and local audit evidence. Development tests do not establish production release clearance.

System prerequisites still require testing: Windows x64 supported by the runtime, WebView2, and any PE import dependencies. No Python, Docker, GPU or external AI application is needed for the integrated inference path.

The 10 Microsoft VC143 CRT DLLs are staged app-locally from Visual Studio C++ Redist 14.44.35112 x64. Runtime imports require vcruntime140, vcruntime140_1 and msvcp140; the complete redistributable CRT set is retained. MSVC-REDIST.txt points to Microsoft's distributable code list. Local development packaging is not a claim that public redistribution licensing/security review has passed. Windows supplies UCRT/system DLLs. WebView2 remains a system prerequisite.

Visual Studio Community 2026 installation was verified on October 13. Its pinned CRT files match all ten shipped DLL hashes. Microsoft's 2026 redistribution list covers unmodified VC/redist files subject to edition license terms, excluding debug_nonredist: https://learn.microsoft.com/en-us/visualstudio/releases/2026/redistribution . No runtime version change was made.
