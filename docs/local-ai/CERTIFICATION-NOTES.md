# Integrated Store candidate review notes

These are preparation notes, not a certification result or a submission.

## Candidate

- App version: 0.5.5. Store package: 1.0.2.0, Windows x64.
- Identity: DittoED.LocalEdAI. Publisher: CN=1E8CAC31-13E1-436C-A5ED-F5F454796ADD. Publisher display name: Ditto ED.
- Candidate: local-ai-data/store-candidate-dpi/Local Ed AI_1.0.2.0_x64.msix.
- SHA256: A2ECBBF2C53B33E4EF875BD7330B5989FB3BFF332307BF11A02484BEE7239C0D.

The integrated candidate includes the native llama.cpp CPU runtime and pinned Qwen3.5-4B Q4_K_M weights. It loads the included model directly from package resources; initial inference requires no Ollama installation or external model download. Optional imported models must match the reviewed catalog. WebView2 remains a Windows prerequisite, with clean-machine validation pending.

## Full-trust explanation

The desktop app uses a bundled native inference process, with authenticated loopback transport and lifecycle cleanup. Full trust supports this desktop architecture. Inference startup launches the packaged llama-server.exe directly, without requiring a command shell or an external AI installer. Process-launch API imports alone do not establish an attempt to install or acquire another application.

## Local certification-kit evidence

Installed development 0.5.5.3 was tested with Windows App Certification Kit 10.0.28000.2526 on Windows 11. Report: local-ai-data/msix/wack-dev-0.5.5.3.xml, PARTIAL_RUN FALSE, OVERALL_RESULT WARNING. There were 22 passing tests, one optional failure and one required warning. An exit code of zero indicates tool execution completed, not a clean test pass.

Branding, app manifest and app resources passed. The optional Blocked executables analyzer recorded process-launch imports, then failed inside its own TextByteReader.ReadToEnd with System.OverflowException. It did not identify a particular banned executable in the reported messages. The exact overflow trigger is unverified; the bundled model is larger than 2 GB. Do not claim this failure is resolved or that Microsoft will waive it.

The DPI-awareness warning led to an explicit per-monitor executable manifest. The corrected production binary and package have that declaration; installed retesting is pending. This development report does not certify the later production binary, production identity update behavior, or Store policy compliance.

## Before submission

Verify installed DPI/scaling and generation/recovery on the final build, production data preservation, Windows prerequisites and intended older hardware. Align public instructions and Partner Center AI disclosures/reporting with the actual integrated package. Include relevant limitations and setup details for reviewers, without claiming verified performance on untested 8 GB or 16 GB computers. Preserve the original identity and remove superseded defective packages only when the replacement is ready.

## Installed update retest, October 13

Development 0.5.5.4 installed successfully and retains history; a prior IEP draft reopens. Bundled startup reaches the educator library without importing weights. WACK still reports the same optional scanner overflow and DPI warning. Detailed DPI trace identifies COM E_FAIL in BinaryInfoClass.IsPerMonitorV2DPIAwarenessSet. SDK extraction confirms the installed DPI declarations, and a direct Windows GetProcessDpiAwareness query returned HRESULT 0 and awareness 2 (per-monitor aware). This does not establish all monitor-scale behavior or waive the WACK warning. Keep both actual report and independent evidence; do not describe this as a clean certification pass.
