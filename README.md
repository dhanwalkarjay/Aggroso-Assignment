# Grant Review Studio

Grant Review Studio is a completeness assistant for draft funding applications. It compares a grant guideline with an application, identifies evidence for each requirement, verifies citations against the source text, and gives the applicant a reviewable checklist.

It is a completeness aid only. It does not decide legal compliance, eligibility, approval, or funding outcomes.

## What It Does

- Accepts a grant guideline and draft application as pasted text or `.txt`/`.md` files.
- Extracts mandatory and recommended requirements with source citations.
- Maps application evidence to requirements and flags strong, weak, ambiguous, or missing evidence.
- Verifies every AI-provided quote in code before it is displayed as valid.
- Lets the user confirm, correct, or reject every mapping.
- Tracks missing and provided supporting documents.
- Finds unsupported claims in the application.
- Calculates mandatory and recommended completion separately using deterministic code.
- Keeps document versions and analysis runs, and marks assessments stale after document changes.
- Generates a reviewed summary with a permanent disclaimer.

## Completed Scope

The current implementation includes the home assessment workflow, sample loading, document uploads, supporting-document tracking, AI requirement extraction, evidence mapping, citation verification, user review actions, stale-version detection, run history, deterministic completion percentages, reviewed summaries, API error handling, retry behavior, local SQLite support, and Turso-compatible persistence.

## Excluded Scope

The application intentionally does not include authentication, multi-user permissions, external grant searching, grant submission, OCR, scanned-document parsing, financial forecasting, automatic application rewriting, legal advice, eligibility decisions, approval predictions, or funding recommendations.

## Technology

- Next.js App Router and TypeScript
- Groq API using `openai/gpt-oss-20b`
- Zod-validated JSON responses
- Drizzle ORM with LibSQL/Turso or local SQLite
- Pino structured logging
- Vitest tests
- Vercel deployment

## Requirements

- Node.js 22 or newer
- A Groq API key for live analysis
- A Turso database and auth token for hosted or shared persistence

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` or `.env` in the project root:

```env
GROQ_API_KEY=your-groq-api-key
TURSO_DATABASE_URL=file:local.db
TURSO_AUTH_TOKEN=
```

For local SQLite, push the schema and start the app:

```bash
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Do not commit `.env`, `.env.local`, or any file containing credentials. Use `.env.example` as the safe template.

## Using The App

1. Open the home page.
2. Paste or upload a guideline and application, or click **Load sample**.
3. Add optional supporting-document metadata.
4. Create the assessment.
5. Click **Analyze draft**.
6. Review each requirement and confirm, correct, or reject the suggested mapping.
7. Review clarification questions, unsupported claims, supporting documents, and run history.
8. Edit either document to create a new version. The assessment becomes stale until it is re-analyzed.
9. Open the summary page to print or copy the reviewed completeness summary.

## Commands

```bash
npm run dev             # Start the development server
npm run build           # Create a production build
npm run start           # Serve the production build
npm run lint            # Run ESLint
npm test                # Run all Vitest tests
npm run db:push         # Apply the Drizzle schema
npm run db:check        # Insert and read a local database smoke-test row
npm run analyze:sample  # Run the fictional samples through Groq
```

The sample pipeline makes three sequential AI calls and can take a minute. It loads environment variables using the same Next.js configuration as the web app.

## Turso Database

Create a Turso database and an auth token, then set:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-token
```

Apply the schema from the project directory:

```bash
npm run db:push
```

Restart the development server after changing environment variables. A `401 Unauthorized` error means the token is invalid, expired, or belongs to a different database. For Vercel, use Turso rather than `file:local.db`, because serverless filesystem storage is not persistent.

## Deploy To Vercel

1. Push this repository to GitHub.
2. In Vercel, import the GitHub repository as a Next.js project.
3. Add these environment variables for Production, Preview, and Development:

```text
GROQ_API_KEY
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
```

4. Deploy the project.
5. Run `npm run db:push` locally against the Turso URL before using the deployed app.
6. Test assessment creation, analysis, mapping review, document versioning, stale state, and summary generation on the deployed URL.

There is no separate backend to host. The API routes under `src/app/api` are deployed as Next.js serverless functions on Vercel. Turso is the hosted database and Groq is the hosted AI service.

## Architecture

```text
Browser UI
    |
    v
Next.js pages and API routes on Vercel
    |                 |
    v                 v
Turso / LibSQL       Groq openai/gpt-oss-20b
```

The AI layer extracts and assesses evidence. Deterministic code handles hashing, stale detection, citation verification, completion percentages, user decisions, and summary assembly. Business logic is kept in `src/lib/logic`; it has no LLM calls.

## Completion Rules

- A mapping counts only when the user confirms it with a valid citation, or corrects it with a valid corrected quote.
- Suggested, rejected, and invalid-citation mappings do not count.
- Mandatory and recommended percentages are calculated separately.
- Empty categories return `0%`.
- Whitespace-only document changes do not create a stale assessment.

## Data And Privacy

Documents and analysis runs are versioned rather than overwritten. Staleness is computed from normalized SHA-256 content hashes. Logs include request metadata, timing, status, and token usage, but do not log document contents.

This project does not provide authentication or multi-user access. Do not use it for confidential material until an appropriate access-control and data-retention strategy is added.

## Limitations

- Text input only; no OCR or scanned-document processing.
- No external grant-database search or application submission.
- No automatic rewriting or generation of application text.
- Free-tier AI rate limits and model availability can affect analysis time.
- AI output is always a suggestion and must be reviewed by the applicant.

## Responsible Use

AI-assisted code and model output were manually reviewed against the product rules. Every model response is validated with Zod, every quote is checked against source text, and only user-confirmed or validly corrected mappings count toward completion. Users should confirm all requirements directly with the funder.
