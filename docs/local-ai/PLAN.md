# Local Ed AI build roadmap and quality review

October 4, 2026. Design assessment only: no integrated build, hardware benchmark, factual-accuracy test, or certification success is claimed.

## Decision

Use Qwen3.5-4B as the product default. Offer Qwen3.5-2B prominently for older 8 GB machines, and source/download links for 9B and Phi-4 Mini. Specialized models and training are deferred. Keep the same repository and isolate development on a feature branch. Preserve the current Store submission and existing app data.

The design can improve installation and usability. Factual quality depends on retrieval, reference maintenance, and evaluation as much as model choice. The current proposal is ready for a prototype, not a production-readiness claim.

## Build map

| Milestone | Build | Evidence required before proceeding |
| --- | --- | --- |
| 0. Baseline | Inspect current master and instructions; inventory every prompt, inference caller, export and stored setting | Record baseline behavior and synthetic regression fixtures; define supported Windows/CPU hardware |
| 1. Packaged inference | Pin engine/source/model/hash; package CPU runtime and required DLLs; add backend-neutral Rust adapter | Fresh installed MSIX generates, streams and cancels without Ollama; no admin or GPU required |
| 2. First-run setup | Hardware check, model choices, downloads, offline import, recovery, licenses | Nontechnical users reach first response without terminal; interrupted downloads resume; errors explain a workable next step |
| 3A. Data and rights | Inspect Learning Commons dataset/download licenses and schema; select permitted state/subject data; inventory separate official federal/state legal sources | Rights, attribution, available subjects/editions and redistribution path documented per source; no gated publisher content bundled without permission |
| 3B. Offline packs | Build state-filtered SQLite full-text indexes and federal/legal packs; signed manifests, hashes and bounded streaming import; state/grade/subject selection | Download once then restart offline; correct code and relevant passage retrieval; missing coverage visible; indexing fits 8 GB hardware |
| 3C. Updates and citations | User-triggered version checks, staged updates, rollback, immutable citation snapshots; standard code/source/version beside drafts | Interrupted update preserves working pack; older draft still opens its cited passage; offline source viewer and exported citations work |
| 4. Guided educator workflows | Integrate sources into existing lesson, differentiation, IEP and communication prompts | Every current prompt category passes regression; unsupported student facts are not inserted; state and standard edition are explicit |
| 5. District imports | Local PDF/Word/text import, provenance, extraction preview and deletion/reindexing | Scanned/failed extraction is detected; document text cannot override system rules; district documents are distinguished from government sources |
| 6. Quality and accessibility | Educator scoring, factual review, low-memory testing, keyboard/screen-reader testing | Proposed release gates below pass on actual shipping artifacts |
| 7. Release preparation | Reproducible Windows build, signed package path, dependency/license inventory, update/migration and WACK tests | Package inspection, clean-machine install/update, export and history preservation pass; Store description matches real dependencies |

Reference work must begin while runtime work proceeds; it cannot be left until the end. Milestone 3 initially ships federal coverage plus explicitly named, reviewed state packs. All 50 states is the architecture target, not an automatic first-release coverage claim.

## Offline reference implementation

Data flow: permitted Learning Commons downloads plus separate official legal sources → validated pack builder → versioned state/subject packs → local SQLite full-text search → bounded relevant passages with stable source IDs → guided prompt → Qwen → draft with application-rendered citations.

Use Learning Commons for standards and permitted curriculum metadata/materials, not as a presumed source of education law. Its published catalog supports local-file access, lists U.S. standards as open, and distinguishes open curriculum scope/sequence from gated instructional and assessment materials. Inspect each exact download's terms before distribution. If redistribution is unavailable, provide a permitted user-download/import route or use an alternative source with clear rights; do not treat open access as automatic bundling permission.

Prefer a lightweight local index over shipping the whole graph or a database server. Partition by state, subject and version; preserve prerequisite/crosswalk relationships and warn when a required related dataset is absent. Store packs outside the read-only MSIX installation folder. Initial full-text retrieval needs grade/state/subject filters, exact-code matching and synonyms. Evaluate paraphrased questions; add compact hybrid retrieval only if full-text search fails the relevance target.

Each pack manifest records source revision, schema version, content hashes, byte size, rights/attribution, source dates and last checked date. Sign app-distributed pack manifests and verify against a pinned public key; a checksum alone does not establish authenticity. Secure extraction must reject path traversal and excessive expansion. Model and reference manifests use data-only schemas, never executable instructions.

User experience: select state → see subject coverage, sizes and versions → choose/download pack → search and draft offline. Provide a clear “Check for updates” action. It contacts only catalog/version/download endpoints and never sends prompts, IEP content or district files. Show changes before installing, verify staged data and indexes, then switch atomically. Failed updates leave the previous pack working. Offline status describes the installed snapshot without implying it is current today.

Citations include standard code or legal section, title, issuer, jurisdiction, content version and source URL. Clicking opens the local passage even without internet; opening the original website is a separate user action. Preserve cited excerpts/provenance with drafts or retain immutable referenced versions so updates do not rewrite historical evidence. Removing a pack must explain any impact on past citations and retain the minimum permitted citation snapshot. References supporting a lesson do not prove every generated activity is correctly aligned; review activity-to-standard mapping.

Prompt-library integration: use shared factual-grounding and jurisdiction rules, plus workflow-specific templates. Supply only retrieved, identified passages; ask for clarification when required evidence is absent. Treat imported text as untrusted material. Do not force citations on creative suggestions; distinguish suggestions from factual/procedural claims. Missing references should still allow clearly labeled generic drafting, while unsupported legal conclusions remain unavailable.

## Additional pack tests

- With networking disabled after download, restart and complete standard lookup, standards-aligned lesson drafting, legal-source lookup and citation opening/export using installed content.
- On a curated retrieval set, exact-code lookup must find every installed code; target at least 95% supporting-passage recall in the top five results for answerable queries. Record per-state/subject performance and irrelevant/conflicting-source cases, not just an average.
- Check wrong-state codes, same code across editions, superseded material, unsupported subjects, missing related records and conflicting district documents. The app must disclose uncertainty and never silently substitute another jurisdiction.
- Reject corrupt files, altered/untrusted manifests, incompatible schemas, path traversal and insufficient disk space. Interrupt download/indexing, restart and confirm recovery; no partial pack becomes active.
- Update packs while retaining an older draft, then confirm its citation still shows the original version. Test rollback and deletion of unused packs.
- Test streaming pack installation, local search and generation on named 8 GB/16 GB CPU-only machines. Do not hold the full dataset in memory or build embeddings concurrently with low-memory generation. Use 2B when needed.
- Test school proxy, blocked downloads and offline file import; explain manual recovery without requiring terminal use. Never embed a shared provider secret in the desktop app.
- Verify packet captures during update checks contain no prompts, student data or imported document content. Audit any SDK telemetry before choosing it.
- Complete attribution and license inventory for all installed packs. Gated datasets stay excluded until access and redistribution rights are established.

## Shortcomings and corrections

1. **Default versus 8 GB support:** 4B is the product default, but setup recommends 2B when measured available memory is inadequate. Total installed RAM alone is insufficient. Show the reason and let users choose. Avoid swapping and repeated failed model loads.
2. **Links do not complete installation:** distinguish publisher sources from verified GGUF downloads. A model is supported only after a verified file is installed, selected and smoke-tested. Links to original Transformers weights must not be labeled ready-to-use downloads.
3. **Legal coverage needs maintained content:** ingest official statutes, regulations and guidance as different source types. Record jurisdiction, issuer, section, effective date if established, publication date, last checked date, source URL, hash and superseded status. Identify applicable school context and date before interpreting procedure. Do not assume federal/state/district conflicts can be resolved by a simplistic hierarchy; surface conflicts for review.
4. **Citations can look correct while supporting nothing:** have code create citations from retrieved source IDs; never accept model-invented URLs as references. Verify exact locator existence separately from educator/legal review of whether the passage supports the claim. A second LLM is not an authoritative verifier.
5. **Offline references become stale:** display the pack version and last checked date, offer explicit updates with rollback, and disclose offline limitations. Keep change history. Block definitive procedural claims when applicable evidence is missing or conflicting; provide a source-search result or clarification instead.
6. **Standards need precise identifiers:** index state, subject, grade, code and edition. A lesson should show which activity/assessment addresses each selected standard, rather than merely listing standard codes.
7. **District uploads are not legal authority:** label them user-provided, preserve provenance, and distinguish policy from law. Public availability does not itself authorize redistribution of standards, forms or reference packs; check each source's reuse terms.
8. **IEP facts require separation:** separate educator-provided observations, sourced procedural information and proposed draft language. Do not invent baseline scores, diagnoses, services or deadlines. Keep review and draft markings; do not make eligibility or placement determinations.
9. **Retrieval has its own memory cost:** start with a local full-text search baseline and measure recall. Add compact embeddings/hybrid retrieval only if benefits justify memory and storage. Load one generation model at a time; limit concurrent indexing and generation.
10. **Long documents and scanned files:** preview extracted text, flag missing pages or image-only input, and disclose context omissions. Use relevant passage retrieval rather than blindly stuffing complete documents into a small context. OCR is a separate tested capability, not implied by PDF support.
11. **Local does not mean encrypted or compliant:** document actual network activity and storage behavior. Keep downloads separate from inference traffic. Prompt/attachment content must not enter routine logs. Any change to history encryption, retention or migration needs explicit design and regression checks.
12. **Professional usability includes accessibility:** keyboard navigation, visible focus, readable contrast, meaningful error messages, screen-reader labels, controlled streaming announcements and accessible exports must be tested. Do not sacrifice cancel/recovery to visual polish.

## Proposed release gates

These are requirements to test, not measured results or guarantees.

- **Hardware:** CPU-only 8 GB and 16 GB Windows machines with browser and Office open; no crashes or sustained paging during a representative 20-task session. Test supported CPU instruction sets and WebView2 availability. Record peak RAM and free-memory headroom; adjust model/context instead of forcing a universal budget.
- **Responsiveness:** initial usability targets are p95 first visible output within 15 seconds after model readiness and p95 completion of a fixed 250-output-token drafting task within 90 seconds on named minimum hardware. Report cold-load time separately and tune targets after the first measured baseline. Never infer speed from parameter count.
- **Cancellation:** stop within 2 seconds of user action under the tested workload, with no orphan process; failed generation must leave the draft recoverable.
- **Factual/legal tests:** 100% citation locators valid; no invented legal sections or numerical student facts; no incorrect high-impact deadlines/requirements in the release evaluation set. At least 95% of sampled factual claims supported by supplied facts or reviewed sources. Any critical failure blocks release; passing does not prove universal accuracy.
- **Missing evidence:** 100% of designated missing-state, missing-baseline and unavailable-source test cases identify the gap instead of inventing an answer.
- **Educator usefulness:** average at least 4/5 for clarity and usefulness in blinded review, with coverage of every existing prompt category. Evaluate content, not just attractive formatting.
- **Usability:** at least 4 of 5 representative nontechnical pilot users complete setup, model selection and one draft without assistance. Include slow download, low disk space, low memory and keyboard-only scenarios.
- **Privacy:** controlled network capture shows no prompt, attachment or generated content leaving the device in integrated local mode. Test remote Ollama settings separately and disclose their effect.
- **Regression:** history, personalization, existing Ollama settings and Word/PDF draft exports survive upgrade. Verify citations and draft labels remain visible in exports.

## Evaluation set

Use at least 100 initial synthetic scenarios across lesson planning, standards alignment, differentiation, parent communications, IEP drafts, federal/state procedural questions, district-policy conflicts, absent facts, document extraction errors and malicious document instructions. Include multiple jurisdictions and dates, not just Maryland. Have qualified educators review outputs; have qualified reviewers assess legal-source interpretation. Keep training material separate if fine-tuning is introduced later. Maintain provenance and expected supporting passages for each case.

## First implementation boundary

Prove packaged CPU inference and reliable first-run setup before adding broad reference coverage. Do not simultaneously add fine-tuning, vision, autonomous tools or all-state production support. The first polished pilot includes the default model, low-memory alternative, cited federal content, a reviewed state pack, existing educator workflows and transparent coverage status.

## Sources used for design

- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf): recognizes confabulation as a risk; model fluency is not verification.
- [Official IDEA regulations](https://sites.ed.gov/idea/regs/b): example of primary regulatory content for reference packs.
- [Official FERPA resource](https://studentprivacy.ed.gov/ferpa): primary privacy reference entry point.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/): accessibility reference for the interface; no conformance claim is made.
- [Learning Commons Knowledge Graph catalog and access](https://github.com/learning-commons-org/knowledge-graph/blob/main/README.md): local-file access and dataset-specific open/gated distinctions.
- [Learning Commons data governance](https://learningcommons.org/data-governance-principles/): evaluate what information any selected integration sends.
