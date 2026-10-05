"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Summary = {
  assessment: { id: string; title: string };
  guidelineVersion: number | null;
  applicationVersion: number | null;
  runDate: string;
  stale: boolean;
  completion: { mandatory: Progress; recommended: Progress };
  mandatory: Record<"confirmed" | "corrected" | "rejected" | "unreviewed", SummaryItem[]>;
  gaps: SummaryItem[];
  questions: { id: string; text: string; requirementId: string }[];
  unsupportedClaims: { id: string; claim: string; reason: string; quote: string; quoteValid: boolean }[];
  missingSupportingDocuments: { id: string; name: string; type: string; status: string }[];
  disclaimer: string;
};
type Progress = { done: number; total: number; pct: number };
type SummaryItem = { requirement: { id: string; text: string; type: string; sourceQuote: string }; mapping: { userStatus: string; applicationQuote: string | null; correctedQuote: string | null; evidenceStrength: string } | null };

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/assessments/${id}/summary`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load summary");
        return result as Summary;
      })
      .then(setSummary)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load summary"));
  }, [id]);

  const copySummary = async () => {
    if (!summary) return;
    const text = [
      summary.assessment.title,
      `Mandatory: ${summary.completion.mandatory.done}/${summary.completion.mandatory.total} (${summary.completion.mandatory.pct}%)`,
      `Recommended: ${summary.completion.recommended.done}/${summary.completion.recommended.total} (${summary.completion.recommended.pct}%)`,
      "Gaps:", ...summary.gaps.map((item) => `- ${item.requirement.text}`),
      "Questions:", ...summary.questions.map((question) => `- ${question.text}`),
      summary.disclaimer,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (error) return <main className="site-shell"><div className="loading-screen error-copy">{error}</div></main>;
  if (!summary) return <main className="site-shell"><div className="loading-screen">Preparing reviewed summary…</div></main>;

  return (
    <main className="site-shell">
      <header className="topbar workspace-topbar print-hide">
        <Link className="brand" href="/"><span className="brand-mark">GA</span><span>Grant review studio</span></Link>
        <div className="workspace-actions"><a className="text-button" href={`/assessments/${id}`}>← Back to workspace</a><button className="button button-quiet" type="button" onClick={() => window.print()}>Print</button><button className="button button-primary" type="button" onClick={copySummary}>{copied ? "Copied" : "Copy summary"}</button></div>
      </header>
      <div className="summary-wrap">
        <div className="summary-heading"><div><p className="eyebrow">REVIEWED COMPLETENESS SUMMARY</p><h1>{summary.assessment.title}</h1><p className="summary-meta">Guideline v{summary.guidelineVersion ?? "—"} · Application v{summary.applicationVersion ?? "—"} · Reviewed {new Date(summary.runDate).toLocaleString()}</p></div>{summary.stale && <span className="status-badge status-stale">Stale review</span>}</div>
        {summary.stale && <div className="stale-banner"><span className="stale-icon">!</span><span>This summary reflects an earlier document version. Re-analyze the assessment before relying on these suggestions.</span></div>}
        <section className="summary-progress"><ProgressBar label="Mandatory" value={summary.completion.mandatory} accent="coral" /><ProgressBar label="Recommended" value={summary.completion.recommended} accent="teal" /></section>
        <SummarySection title="Mandatory requirements" eyebrow="REVIEW STATUS">
          <div className="status-columns">{(["confirmed", "corrected", "rejected", "unreviewed"] as const).map((status) => <div className="status-column" key={status}><h3><span className={`status-dot ${status}`} />{status}</h3>{summary.mandatory[status].length ? summary.mandatory[status].map((item) => <ReviewItem item={item} key={item.requirement.id} />) : <p className="empty-inline">None</p>}</div>)}</div>
        </SummarySection>
        <SummarySection title="Gaps to clarify" eyebrow="MISSING, WEAK, OR AMBIGUOUS">
          {summary.gaps.length ? <div className="summary-list">{summary.gaps.map((item) => <ReviewItem item={item} key={item.requirement.id} />)}</div> : <p className="empty-inline">No unresolved evidence gaps were recorded.</p>}
        </SummarySection>
        <div className="summary-two-col">
          <SummarySection title="Open questions" eyebrow="FOLLOW UP">{summary.questions.length ? <ul className="plain-list">{summary.questions.map((question) => <li key={question.id}>{question.text}</li>)}</ul> : <p className="empty-inline">No open clarification questions.</p>}</SummarySection>
          <SummarySection title="Unsupported claims" eyebrow="EVIDENCE CHECK">{summary.unsupportedClaims.length ? <div className="summary-list">{summary.unsupportedClaims.map((claim) => <div className="claim-summary" key={claim.id}><strong>{claim.claim}</strong><small>{claim.reason}</small></div>)}</div> : <p className="empty-inline">No unsupported claims recorded.</p>}</SummarySection>
        </div>
        <SummarySection title="Missing supporting documents" eyebrow="DOCUMENT TRACKER">{summary.missingSupportingDocuments.length ? <div className="summary-list">{summary.missingSupportingDocuments.map((document) => <div className="claim-summary" key={document.id}><strong>{document.name}</strong><small>{document.type}</small></div>)}</div> : <p className="empty-inline">No documents are marked missing.</p>}</SummarySection>
        <footer className="disclaimer">{summary.disclaimer}</footer>
      </div>
    </main>
  );
}

function ProgressBar({ label, value, accent }: { label: string; value: Progress; accent: "coral" | "teal" }) { return <div className="progress-card"><div className="progress-label"><span>{label}</span><strong>{value.done}/{value.total} <em>{value.pct}%</em></strong></div><div className="progress-track"><span className={`progress-fill ${accent}`} style={{ width: `${value.pct}%` }} /></div></div>; }
function SummarySection({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) { return <section className="summary-section"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><div className="summary-section-body">{children}</div></section>; }
function ReviewItem({ item }: { item: SummaryItem }) { const quote = item.mapping?.correctedQuote ?? item.mapping?.applicationQuote; return <div className="review-item"><strong>{item.requirement.text}</strong><small>{quote ? `“${quote}”` : `Guideline: “${item.requirement.sourceQuote}”`}</small></div>; }
