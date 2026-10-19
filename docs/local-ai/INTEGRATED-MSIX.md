> Current release update — October 19, 2026: Store package **1.0.3.0** (app **0.5.5**) is published. See [release status](RELEASE-STATUS.md). Dated checkpoints below retain their historical meaning; publication does not erase recorded test limitations.

# Integrated development MSIX build

Run from repository root on Windows with the existing locked Node/Rust dependencies, MSVC toolchain, Windows SDK and WebView2 installed:

```powershell
npm run local-ai:stage
npm run tauri:integrated:build
npm run tauri:integrated:msix
```

The release command sets the integrated frontend flag, passes the development Tauri config, and records the executable SHA-256. Packaging refuses an executable that does not match that receipt. The packaging script uses a separate development manifest without editing the production template/config.

Output: local-ai-data/msix/LocalEdAI.Integrated.Dev_0.5.5.4_x64.msix and public LocalEdAI.Integrated.Dev.cer. Private signing keys remain in the current user's certificate store; no PFX is exported or committed. The DPI retest package uses the same filename under local-ai-data/msix-dpi when that output directory is selected.

The runtime and pinned Qwen3.5-4B Q4_K_M weights are included. Before packaging, place the catalog-verified model in local-ai-data/models; packaging checks its size and SHA-256. The installed app loads packaged weights directly without copying them into user storage. Optional local imports must match the catalog. Runtime archive/model files are ignored by Git. No Ollama installation is needed for this variant.

For the production candidate, run node scripts/build-integrated-release.mjs --production, then run scripts/package-integrated-msix.ps1 -Production -OutputDirectory local-ai-data/store-candidate. This produces Local Ed AI_1.0.2.0_x64.msix using the original production identity and publisher. It is unsigned for Store signing; do not use the development certificate to sign it. Package generation does not establish installed-update compatibility or Store approval. See STATUS.md for actual checks and remaining blockers.

For a signed development install the public development certificate must be trusted in LocalMachine/TrustedPeople (administrator action), then install the MSIX. Windows signing instructions: https://learn.microsoft.com/windows/msix/package/create-certificate-package-signing. This certificate is for this development identity only; it is not a production trust/signing solution. Do not publish the package or submit it to Store.
