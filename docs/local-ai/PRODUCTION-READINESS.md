> Current release update — October 19, 2026: Store package **1.0.3.0** (app **0.5.5**) is published. See [release status](RELEASE-STATUS.md). Dated checkpoints below retain their historical meaning; publication does not erase recorded test limitations.

# Production readiness checkpoint October 12 2026

The installed development package 0.5.5.2 verifies local model import/load, completed streaming, cancellation before and after visible output, incomplete-draft preservation, restart model recovery, history reopening, and normal engine shutdown. Bradley reports successful disconnected-internet Grade 4 energy lesson generation. These checks do not establish complete release readiness.

## Decisions needed

Production model provisioning is unresolved: bundle verified 4B weights (2,740,937,888 bytes), implement an explicit in-app verified download, or retain manual import. Current development package contains runtime only. Do not assume manual import meets Store onboarding expectations or solves all distribution-policy concerns. Production packaging must not use the development identity/signing certificate or its four-part development version.

## Packaging corrections

Integrated source now contains verified branded wide tile and prepack tile checks. These changes postdate installed 0.5.5.2. Production config remains 1.0.0.0, below already submitted 1.0.1.0: choose a higher Store-only version when preparing a production candidate and synchronize workflow expectations. Preserve DittoED.LocalEdAI, original publisher CN=1E8CAC31-13E1-436C-A5ED-F5F454796ADD and publisherDisplayName Ditto ED. Build integrated frontend with production Tauri identity and verified runtime resource mappings; default legacy build still routes to Ollama.

## Review and validation remaining

- Current npm audit evidence: local-ai-data/audit-production-readiness.json, seven high/five moderate/no critical findings. These are advisory counts, not verified reachable exploit counts. Review application versus tooling paths and exact advisories; do not use audit fix --force (suggested mammoth downgrade would materially alter import behavior).
- Runtime/model redistribution notices and Microsoft CRT source/license inventory need final review against shipped files.
- Invalid model import, replacement failure/cancellation, disk-space failure and prior-model recovery require installed tests.
- Clean Windows machine/WebView2 prerequisites, intended older CPU instruction support, actual 8 GB/16 GB whole-app memory and responsiveness remain unverified.
- Verify original teacher storage and production update compatibility; isolated development history is not evidence of production migration.
- Final actual production MSIX requires manifest, architecture, executable, all branded assets, runtime DLLs, no placeholders and exactly one full-trust capability checks. Preserve actual path/hash and run Windows validation where available.
- Store policy rejection 10.1.5 concerned promotion of Ollama. Production UI/listing/onboarding must match integrated behavior and not promote acquiring another AI application. No certification guarantee from these tests.

Next checkpoint is the model-provisioning decision, followed by implementing only that onboarding path and its tests. No production artifact, source publication or Store submission completed at this checkpoint.

## October 12 Microsoft model distribution research

User asked for research before choosing model provisioning. Decision remains pending.

- Policy 7.19 is current on October 12; latest published 7.20 takes effect October 22, 2026. Both 10.1.5 permit qualifying enhancements but restrict acquisition/promotion of other products. Rejection specifically identified Ollama external software promotion. Do not infer that all model-weight downloads are prohibited.
- Microsoft Windows ML distribution documentation explicitly describes bundled models and app-managed downloads. This is architecture guidance, not certification approval of our GGUF/llama.cpp app. https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/model-distribution
- Microsoft AI Dev Gallery README states it is available in Microsoft Store and browses/downloads/runs models from Hugging Face/GitHub. This supports feasibility, not guaranteed approval for our implementation. https://github.com/microsoft/ai-dev-gallery
- Official package requirements list 25 GB maximum for Windows 10/11 MSIX packages/bundles. Our pinned 4B weights are 2.74 GB, comfortably under that limit before full-package verification. https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/app-package-requirements?pivots=store-installer-msix
- Best next-submission reliability recommendation: bundle pinned 4B weights with licensed native runtime, available without manual import or external installer; test CPU/RAM/disk compatibility, avoid duplicate full weight copies where possible. Larger installer and disk footprint are real tradeoffs. 2B remains a candidate requiring older-hardware evaluation; file size alone proves no RAM suitability.
- Explicit in-app model download is a viable alternative: fixed allowlisted weights, consent, size/disk disclosure, progress, resumable/cancellable transfer, checksum validation, error recovery, license notices, and working reviewer setup. Do not download executable installers or direct users to install Ollama. Requires more implementation/testing than bundling. Manual local import should not be the only mainstream first-run path.
- Certification still requires testability/compatible device experience and policy 11.16 generative-AI metadata/Partner Center disclosure and inappropriate-content reporting. Review existing reporting behavior and listing before submission.
- Policy sources: https://learn.microsoft.com/en-us/windows/apps/publish/store-policy-archive/store-policy-7-19 and https://learn.microsoft.com/en-us/windows/apps/publish/store-policies

## Current readiness as of October 13, after DPI review

These notes supersede the initial audit and packaging sections above. A production integrated candidate 1.0.2.0 has been generated with original identity/publisher and bundled catalog-verified 4B weights. Compatible npm updates reduced advisories to zero high/three moderate/no critical; the remaining Mammoth CLI chain has a documented scoped reachability assessment. Community installation and pinned CRT hashes were verified.

Installed development 0.5.5.3 WACK report: 22 PASS, optional Blocked executables FAIL due to an internal scanner overflow, and DPI warning. Explicit executable DPI manifest correction is compiled and being packaged separately in local-ai-data/store-candidate-dpi; an installed retest is required. Do not call the overflow resolved or the candidate certified.

Reproducibility gap: .github/workflows/store-msix.yml still validates 1.0.0.0 and invokes the legacy Ollama build. Before promoting this branch, align the workflow with the integrated production build/staging path and current Store-only version. A fresh runner also needs the exact pinned 14.44.35112 CRT source; do not substitute arbitrary newer DLLs or assume hosted images contain it. The release helper currently uses Cargo --offline, so a fresh runner requires prefetching locked Cargo dependencies or an explicit supported online locked-build option. Model/runtime downloads must remain catalog-verified and build-time only. No workflow run for the integrated path has passed yet.

Remaining installed release checks include production update/data recovery, clean-machine WebView2/dependencies, intended older 8/16 GB hardware support, and Store AI listing/reporting disclosures. GitHub About metadata now states the integrated build is in development; full public README/setup claims must be aligned when source is promoted.
