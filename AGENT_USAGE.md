# Agent Usage

This file records how coding agents were used to build and verify Grant Review Studio. It contains no API keys, passwords, tokens, or private environment values.

## Tools Used

- `read_file`, `list_dir`, and targeted searches were used to inspect the existing Next.js scaffold, local instructions, API contracts, and implementation dependencies before editing.
- `apply_patch` was used for focused edits and file cleanup. `create_file` was used for new source, test, sample, and documentation files.
- `run_in_terminal` was used for dependency installation, schema pushes, tests, linting, type-checking, builds, Git checks, and local API smoke tests.
- `get_errors` was used to confirm diagnostics for changed TypeScript and route files.
- Browser tools were used to inspect the home, workspace, and summary routes, load sample data, and check desktop/mobile layout widths.
- No delegated coding subagent was used. Implementation and verification were performed directly in the repository.

## Representative Prompts

The work was organized into the following phase prompts:

- `Read IMPLEMENTATION.md and start phase 0.`
- `Start phase 1` for the Drizzle schema and database client.
- `Start phase 2` for deterministic logic and tests.
- `Start phase 3` for the validated Groq pipeline and samples.
- `Start phase 4` for API routes and versioning.
- `Start phase 5` for the home, workspace, and summary UI.
- `Start phase 6` for input, retry, stale-state, and failure hardening.
- The model was then changed to `openai/gpt-oss-20b`, followed by live model verification.
- The final repository request asked for a public README, GitHub/Vercel preparation, and removal of private implementation material.

## Delegated Work

No work was delegated to another agent. The implementation was kept in the main coding session so the database, deterministic logic, AI contract, API routes, UI, and deployment documentation could be verified together.

## Important Mistakes And Corrections

- An initial `npm install` ran from the workspace parent instead of the project directory. It was rerun from the repository directory.
- The latest Vitest release required newer Node type definitions than the generated scaffold. `@types/node` was aligned with the installed Vitest version.
- The database smoke script initially used top-level `await`, which failed under the project's CommonJS `tsx` execution mode. It was changed to an async `main` function.
- A first UI replacement omitted the home component state and handlers. TypeScript caught the issue immediately; the missing state, sample loader, submit handler, and document field were restored before continuing.
- The GPT-OSS model initially returned incomplete requirement and mapping objects. The prompts were strengthened with explicit JSON key contracts, and `reasoning_effort: "low"` plus a completion budget were added after a minimal provider probe.
- The sample runner initially did not load `.env` because `tsx` does not automatically use Next.js environment loading. It now calls `loadEnvConfig`.
- A Turso connection returned HTTP 401 during deployment preparation. A safe direct LibSQL check identified the problem as the database token, not the application code. Credentials were never printed or committed.
- Starter assets and private planning files were removed only after checking that they were unreferenced or outside the public repository. `AGENTS.md` was retained because it is workspace tooling guidance.

## Rejected Or Avoided Suggestions

- A separate backend host was not added. Next.js API routes deploy as Vercel serverless functions, so a second free backend would add complexity without improving this application.
- AI output was not allowed to determine completion directly. Completion remains deterministic and only user-confirmed or validly corrected mappings count.
- Model-provided citations were not trusted without source-text verification.
- Documents and analysis runs are not overwritten. New versions and new runs preserve history and allow stale-state calculation.
- Credentials were not placed in `.env.example`, README files, source code, logs, or Git commits.

## Verification

The final repository was verified with:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
npm run db:push
npm run analyze:sample
```

The final automated suite contains 28 passing tests covering completion rules, stale hashes, citation matching, supporting documents, pipeline guards, fabricated citations, invalid AI JSON, rate-limit retries, timeout retries, and the GPT-OSS request boundary.

The live sample pipeline was run successfully with `openai/gpt-oss-20b`. It completed three sequential Groq calls, extracted requirements, produced mappings, verified citations, and detected the deliberately unsupported sample claim.

Browser verification covered:

- Home page rendering and assessment history.
- Sample loading into both document fields.
- Responsive layout at mobile and desktop widths without horizontal overflow.
- Empty-input browser validation.
- Workspace empty/no-analysis state.
- Summary no-run state.
- Local API creation, document version deduplication, new document versions, supporting-document updates, and run history.
