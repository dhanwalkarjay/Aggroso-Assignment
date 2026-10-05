Project: Grant completeness assistant (Next.js App Router, TypeScript, Node runtime).
Rules:
- Business logic lives in src/lib/logic as pure functions with no LLM calls.
- Every LLM response is validated with Zod before use.
- Every AI quote is verified against the source text with citations.ts.
- Never output eligibility or funding decisions. Only completeness suggestions.
- Only user-confirmed or validly corrected mappings count toward completion.
- Never overwrite documents or runs; create new versions.
- Staleness is computed on read from hashes; never stored.
- Use src/lib/logger.ts, never console.log.
- Validate API input with Zod; return { error, code } on failure.
- Write a Vitest test for every logic function.
- Keep functions small and typed; avoid any.
