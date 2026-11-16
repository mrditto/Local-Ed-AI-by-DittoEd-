# Offline OCR: next implementation checkpoint

Status: initial English OCR implemented and browser-tested locally November 16, 2026; not released. See CURRICULUM-CHECKPOINT.md for exact evidence and remaining limits. The numbered steps below preserve the design checklist, not a claim that every acceptance check is complete.

Development: run npm ci, then npm run ocr:assets once with internet to fetch pinned build inputs. Builds thereafter stage and verify cached OCR inputs offline. All three build workflows prepare these inputs before compiling. End users must not need this developer command or any OCR download. The shipped frontend assets include the worker, compatible CPU cores, English data and license files; Windows installed-package checks remain pending.

Use a bundled OCR engine plus bundled English recognition data, loaded only when requested. Tesseract.js is a candidate because its own documentation supports local workerPath, corePath and langPath. Its defaults use CDNs, so defaults are unacceptable for this product's offline/privacy promise.

Primary sources inspected:
- https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
- https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- https://github.com/naptha/tesseract.js/blob/master/docs/performance.md
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine.trycreatefromuserprofilelanguages?view=winrt-26100

Windows OCR can return null when suitable OCR languages are unavailable. Depending on user-installed language packs would not guarantee first-use offline OCR. Do not claim either route is universally available or fast without measuring it.

Implementation order:
1. Select and pin an exact maintained Tesseract.js/core version and official English trained-data revision. Verify licenses and third-party notices for engine/core/language data; record exact source URL, bytes and SHA256. Run npm for any package changes; do not manually edit lockfile.
2. First replace this worktree's node_modules junction with its own locked install before adding dependencies, to avoid mutating the original checkout's dependency tree. Verify paths and preserve all original resources/data.
3. Stage worker, compatible SIMD and non-SIMD core assets, and English data into the frontend/package during a reproducible build. No CDN or first-run language download. Verify hashes, manifest/inventory and clean npm ci/build behavior.
4. Add explicit Read scanned page/photo action for JPG/PNG (consider WebP only after decoder validation). Render selected scanned PDF file pages locally at bounded resolution; do not OCR an entire book automatically. Process one page at a time; bound dimensions, input size and total text. Preserve page labels.
5. Run OCR in a dedicated worker. Allow cancellation/termination and release image/canvas buffers before Qwen generation; do not run multiple OCR workers beside model inference on older computers.
6. Require educator review/correction of recognized text and scope. Warn about columns, tables, math, handwriting and diagrams; OCR text does not establish diagram understanding. Keep the original image out of history unless separately designed and explained.
7. Test with the network blocked and empty language/worker caches, proving only packaged local assets are used. Test at least crisp text, tilted/blurred photo, scanned two-column page, blank page, numeric values, negation and cancellation/retry. No confidence percentage should be marketed as guaranteed accuracy.
8. Measure peak RAM and latency on available 8/16 GB machines; document unavailable evidence. Validate in an installed development build before any Store update. Scope English initially; additional languages require separate licensed staged assets and checks.

Native desktop build blocker found this checkpoint: local Rust compiler-generated build scripts for ICU data were blocked by Windows Application Control, os error 4551. Do not disable or evade that policy. Existing Windows GitHub workflow has a development_only option; running it on the public feature branch requires the owner's authorization to publish this new branch. This is a separate environment issue, not evidence that the curriculum code passed native packaging.
