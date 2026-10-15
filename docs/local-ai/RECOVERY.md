# Recovery evidence

October 8, 2026. Preserved existing MSIX files without replacing their source copies:

- Local Ed AI_0.5.5.0_x64.msix: SHA-256 6ab4f7114f0c0f3d173c025eff6bb3c56688cde5cddb0183570f1317b920c580.
- Local Ed AI_1.0.1.0_x64.msix: SHA-256 baa4370c461a2eb7b9c3d1385bd591d8613e11dfd5a3dfad8c587832ad91c835.

Additional copies are in the user's handbook workspace under preserved-installers. These are recovered artifacts; a clean installation, signing trust and public download availability have not been reverified. The production checkout and Store worktrees were not edited.

Existing per-user com.educatorllm.app data was backed up locally under ignored local-ai-private/recovery before development installation. No model/history/settings migration is performed. The integrated variant has its own identity and storage.

Imported source GGUF files stay in place. Valid installed models are never replaced during an import. Model selection is saved only after load succeeds; previous weights remain selectable. Failed activation restores the old destination or leaves a retained backup with an actionable error. Restore only when the app is closed; do not delete teacher work or promise older-version MSIX downgrade installation.
