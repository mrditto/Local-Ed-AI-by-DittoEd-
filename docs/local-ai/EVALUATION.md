# Evaluation

## Required runtime scenarios (not yet executed)

- Existing chat and IEP generation retain system prompts, history, export and settings.
- Two simultaneous callers serialize; cancelling one never cancels the other.
- Cancel while queued, cancel during streaming, unmount during generation; following request succeeds.
- Offline, model missing, empty/malformed response, timeout and out-of-memory remain understandable.
- Integrated installed MSIX generates without Ollama, stops only its own process and recovers from a crash.
- Verify downloads/hash/resume, disk-full and model switching preserve working installations.
- Standards exact-code lookup, wrong state, stale edition, missing source, citation export and offline restart.
- District text and retrieved content cannot override application instructions.

## Hardware evidence required

Measure cold load, first token, tokens/second, peak application/system RAM and cancellation latency on real older 8 GB and 16 GB CPU-only Windows PCs. Include a long input and other normal desktop applications running. No measurements or performance claims yet.

Use synthetic student information only. Educator review must assess factual support, useful lesson/assessment alignment and invented student data across every prompt category. Legal citations must resolve to official dated sources.
