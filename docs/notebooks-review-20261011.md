# IELTS notebooks — implementation and verification, 2026-10-11

## Scope

The mock section links to the authenticated mistake notebook. Submission of a listening or reading stage archives incorrect/blank answer groups for Cambridge 16–21, preserving paired-answer order independence and answer variants. Writing is not auto-graded. Existing completed attempts are not retroactively imported. Reason categories are user-selected, not inferred as an examiner diagnosis. Redo retrieves canonical original section/question content from an authenticated, non-mutating GET endpoint. Review intervals are 1/3/7/14/30 days after successive correct attempts; a miss resets the streak and schedules the following day.

The Other section links to the authenticated wordbook. Manual words/phrases support definitions, examples and groups. Existing vocabulary and dictation words can be collected with their verified local audio IDs; manual entries without a matching recording are not sent to a pronunciation service. The notebooks support filtering, deletion, JSON export and due review.

## Privacy boundaries

Notebook records are browser-local, bounded, whitelisted and namespaced by server-verified account UUID. They are neither uploaded nor synchronized. This is UI/account separation, not encryption or protection against someone with access to the same browser profile, developer tools, malicious same-origin JavaScript or a compromised device. The page and privacy policy disclose this. Exports contain user notes/answers and must be treated as private files.

SSR pages require authentication, disable the demo bypass outside development, return private/no-store headers even on their login redirects, and disable analytics. The review endpoint authenticates before reading paper content, rejects duplicate/out-of-range selectors and has private/no-store responses. It accepts no notes or answer submissions and performs no application data mutations. DOM rendering uses text nodes, never stored HTML. Audio playback is restricted to known catalog entries. Cross-tab auth events, pagehide/BFCache and revalidation clear private lists, custom group options, forms, review content and counts. Epoch/abort checks prevent late review/identity responses from restoring wiped content. Storage errors do not report a successful save or overwrite malformed JSON.

## Completed verification

Astro check: 152 files, 0 errors/warnings/hints. Unit/regression tests: 159 passed, 0 failed. This includes every C16–21 L/R answer set, pair/variant scoring, archive merge, review intervals, deduplication/capacity, local storage account separation, malformed storage, API authentication/validation and the existing authentication/booking/material/security attack-chain suites.

Headless Chrome: 12 flows passed with zero page errors, external requests or answer-upload requests. Actual local SSR/API anonymous guards were exercised. A real local reading exam submission created the notebook; note persistence, redo, due filters, export, manual edits, audio collection/playback, review outcomes, quota errors, account namespaces, cross-tab signout, mobile/dark layouts and inline-injection rejection were verified. Authorized review GET and dictation identity responses were fixtures in this isolated browser; they were not live Supabase sessions. Production CSP was used with hashes for only the local development runtime. Production build/CSP verification passed for all six prerendered IELTS pages.

Privacy scanner: 223 source files and 137 client build files, no detected credentials, unsafe public variables, source maps or excluded entry-test material. Production dependency audit: no known vulnerabilities reported. Git diff whitespace check passed. Screenshots and browser output are in /private/tmp/ielts-notebook-check; not uploaded as user records.

Live Supabase RLS/RPC, email delivery, provider sessions and platform WAF configuration were not independently audited in this run. Automated tests and scans do not establish absence of all vulnerabilities. The reviewed source/assets exceed Hobby's CLI source-upload allowance. Publishing therefore uses the existing GitHub integration: one fast-forward push to the configured production branch main, creating one production deployment. No CLI or extra preview deployment is created. The prior remote main commit was confirmed identical to the local reviewed base. Local editor state and credentials are excluded.
