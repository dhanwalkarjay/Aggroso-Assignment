"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Mapping = {
  id: string;
  applicationQuote: string | null;
  citationValid: boolean;
  evidenceStrength: "strong" | "weak" | "ambiguous" | "missing";
  reasoning: string;
  userStatus: "suggested" | "confirmed" | "corrected" | "rejected";
  correctedQuote: string | null;
  correctedQuoteValid: boolean | null;
};
type Requirement = { id: string; text: string; type: "mandatory" | "recommended"; category: string; sourceQuote: string; sourceQuoteValid: boolean; mapping: Mapping | null; questions: { id: string; text: string }[] };
type WorkspaceData = { assessment: { id: string; title: string }; run: { id: string; status: string } | null; requirements: Requirement[]; unsupportedClaims: { id: string; claim: string; quote: string; quoteValid: boolean; reason: string }[]; completion: { mandatory: Progress; recommended: Progress }; missingDocs: { missing: SupportingDoc[]; missingMandatoryRequirementCount: number }; stale: boolean; latestDocuments: { guideline: DocumentVersion | null; application: DocumentVersion | null }; supportingDocs: SupportingDoc[] };
type Progress = { done: number; total: number; pct: number };
type DocumentVersion = { id: string; kind: "guideline" | "application"; version: number; content: string };
type SupportingDoc = { id: string; name: string; type: string; status: "provided" | "missing"; linkedRequirementId: string | null };
type Run = { id: string; createdAt: string; status: string; guidelineVersion: number | null; applicationVersion: number | null };

export default function AssessmentWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<"questions" | "claims" | "documents" | "runs">("questions");
  const [pending, setPending] = useState(false);
  const [correctingId, setCorrectingId] = useState("");
  const [correction, setCorrection] = useState("");
  const [editingKind, setEditingKind] = useState<"guideline" | "application" | "">("");
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");
  const [retryAvailable, setRetryAvailable] = useState(false);

  const load = async (runId?: string) => {
    const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
    const response = await fetch(`/api/assessments/${id}${query}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load assessment");
    setData(result as WorkspaceData);
    setSelectedId((current) => current || result.requirements[0]?.id || "");
  };

  useEffect(() => {
    let cancelled = false;
    const loadInitial = async () => {
      try {
        const [assessmentResponse, historyResponse] = await Promise.all([
          fetch(`/api/assessments/${id}`),
          fetch(`/api/assessments/${id}/runs`),
        ]);
        const assessmentResult = await assessmentResponse.json();
        const history = await historyResponse.json() as Run[];
        if (!assessmentResponse.ok) throw new Error(assessmentResult.error ?? "Could not load assessment");
        if (!cancelled) {
          setData(assessmentResult as WorkspaceData);
          setSelectedId(assessmentResult.requirements[0]?.id ?? "");
          setRuns(history);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load assessment");
      }
    };
    void loadInitial();
    return () => { cancelled = true; };
  }, [id]);

  const selected = data?.requirements.find((requirement) => requirement.id === selectedId) ?? data?.requirements[0];
  const selectedQuote = selected?.mapping?.correctedQuoteValid ? selected.mapping.correctedQuote : selected?.mapping?.applicationQuote;
  const applicationText = data?.latestDocuments.application?.content ?? "";
  const questionItems = data?.requirements.flatMap((requirement) => requirement.questions.map((question) => ({ ...question, requirement: requirement.text }))) ?? [];
  const progress = useMemo(() => data ? [data.completion.mandatory, data.completion.recommended] : [], [data]);

  const refresh = async () => {
    setError("");
    try { await load(); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Could not refresh assessment"); }
  };

  const analyze = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/assessments/${id}/analyze`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Analysis could not be completed");
      await load(result.id);
      const history = await fetch(`/api/assessments/${id}/runs`).then((runResponse) => runResponse.json() as Promise<Run[]>);
      setRuns(history);
      setRetryAvailable(false);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis could not be completed");
      setRetryAvailable(true);
    } finally { setPending(false); }
  };

  const reviewMapping = async (mappingId: string, action: "confirm" | "reject" | "correct", quote?: string) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/mappings/${mappingId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "correct" ? { action, quote } : { action }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Mapping could not be updated");
      setCorrectingId("");
      setCorrection("");
      await refresh();
    } catch (reviewError) { setError(reviewError instanceof Error ? reviewError.message : "Mapping could not be updated"); }
    finally { setPending(false); }
  };

  const saveDocument = async () => {
    if (!editingKind) return;
    setPending(true);
    try {
      const response = await fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assessmentId: id, kind: editingKind, content: editValue }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Document could not be saved");
      setEditingKind("");
      await refresh();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Document could not be saved"); }
    finally { setPending(false); }
  };

  const updateDocumentStatus = async (documentId: string, status: "provided" | "missing") => {
    setPending(true);
    try {
      const response = await fetch(`/api/supporting-docs/${documentId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) throw new Error("Supporting document could not be updated");
      await refresh();
    } catch (statusError) { setError(statusError instanceof Error ? statusError.message : "Supporting document could not be updated"); }
    finally { setPending(false); }
  };

  if (!data) return <main className="site-shell"><div className="loading-screen">Loading assessment…</div></main>;

  return (
    <main className="site-shell">
      <header className="topbar workspace-topbar">
        <Link className="brand" href="/"><span className="brand-mark">GA</span><span>Grant review studio</span></Link>
        <div className="workspace-actions"><a className="text-button" href={`/assessments/${id}/summary`}>Open summary →</a><button className="button button-primary" type="button" onClick={analyze} disabled={pending}>{pending ? "Working…" : data.run ? "Re-analyze" : "Analyze draft"}</button></div>
      </header>

      <div className="workspace-wrap">
        <div className="workspace-heading">
          <div><p className="eyebrow">ASSESSMENT WORKSPACE</p><h1>{data.assessment.title}</h1></div>
          <div className="version-stack"><span>Guideline v{data.latestDocuments.guideline?.version ?? "—"}</span><span>Application v{data.latestDocuments.application?.version ?? "—"}</span></div>
        </div>
        {data.stale && <div className="stale-banner"><span className="stale-icon">!</span><span><strong>This review is out of date.</strong> A document changed since the last analysis. Re-analyze to refresh the evidence suggestions.</span></div>}
        {error && <div className="error-banner workspace-error" role="alert"><span>{error}</span>{retryAvailable && <button className="text-button" type="button" onClick={analyze} disabled={pending}>Retry analysis</button>}</div>}

        <div className="progress-grid">
          <ProgressBar label="Mandatory" value={progress[0]} accent="coral" />
          <ProgressBar label="Recommended" value={progress[1]} accent="teal" />
        </div>

        <div className="review-grid">
          <section className="requirements-panel" aria-label="Requirements">
            <div className="panel-title-row"><div><p className="eyebrow">REQUIREMENTS</p><h2>Review the evidence</h2></div><span className="count-label">{data.requirements.length} items</span></div>
            {data.requirements.length === 0 ? <div className="empty-state"><strong>No analysis yet.</strong><span>Run an analysis to see the guideline requirements here.</span></div> : <div className="requirement-list">{data.requirements.map((requirement) => <RequirementCard key={requirement.id} requirement={requirement} selected={requirement.id === selected?.id} pending={pending} correctingId={correctingId} correction={correction} onSelect={() => setSelectedId(requirement.id)} onReview={reviewMapping} onCorrectStart={() => { setCorrectingId(requirement.mapping?.id ?? ""); setCorrection(requirement.mapping?.applicationQuote ?? ""); }} onCorrectionChange={setCorrection} />)}</div>}
          </section>

          <section className="evidence-panel" aria-label="Application evidence">
            <div className="panel-title-row"><div><p className="eyebrow">DRAFT APPLICATION</p><h2>Source text</h2></div>{data.latestDocuments.application && <button className="text-button" type="button" onClick={() => { setEditingKind("application"); setEditValue(data.latestDocuments.application?.content ?? ""); }}>Edit application</button>}</div>
            {editingKind ? <div className="edit-document"><p className="empty-inline">Editing the {editingKind} creates a new document version.</p><textarea className="text-area large-area" value={editValue} onChange={(event) => setEditValue(event.target.value)} minLength={200} maxLength={24000} /><div className="edit-actions"><button className="button button-quiet" type="button" onClick={() => setEditingKind("")}>Cancel</button><button className="button button-primary" type="button" disabled={pending || editValue.length < 200 || editValue.length > 24000} onClick={saveDocument}>Save new version</button></div></div> : <div className="source-text">{highlightText(applicationText, selectedQuote)}</div>}
            <div className="source-footer"><span>Guideline: v{data.latestDocuments.guideline?.version ?? "—"}</span><button className="text-button" type="button" onClick={() => { setEditingKind("guideline"); setEditValue(data.latestDocuments.guideline?.content ?? ""); }}>Edit guideline</button></div>
          </section>
        </div>

        <section className="lower-panel">
          <nav className="tab-bar" aria-label="Assessment details">{(["questions", "claims", "documents", "runs"] as const).map((item) => <button className={tab === item ? "tab active" : "tab"} type="button" onClick={() => setTab(item)} key={item}>{item === "questions" ? `Questions (${questionItems.length})` : item === "claims" ? `Unsupported claims (${data.unsupportedClaims.length})` : item === "documents" ? `Supporting docs (${data.supportingDocs.length})` : `Run history (${runs.length})`}</button>)}</nav>
          <div className="tab-content">
            {tab === "questions" && (questionItems.length ? questionItems.map((question) => <div className="detail-row" key={question.id}><span className="detail-marker">?</span><div><strong>{question.text}</strong><small>{question.requirement}</small></div></div>) : <div className="empty-inline">Clarification questions will appear for weak, ambiguous, or missing evidence.</div>)}
            {tab === "claims" && (data.unsupportedClaims.length ? data.unsupportedClaims.map((claim) => <div className="detail-row" key={claim.id}><span className="detail-marker claim-marker">!</span><div><strong>{claim.claim}</strong><small>{claim.reason} · {claim.quoteValid ? "Quote verified" : "Quote unverified"}</small></div></div>) : <div className="empty-inline">No unsupported claims were returned for this review.</div>)}
            {tab === "documents" && (data.supportingDocs.length ? data.supportingDocs.map((document) => <div className="detail-row" key={document.id}><span className="detail-marker">□</span><div><strong>{document.name}</strong><small>{document.type}</small></div><select className="mini-select" value={document.status} disabled={pending} onChange={(event) => void updateDocumentStatus(document.id, event.target.value as "provided" | "missing")}><option value="missing">Missing</option><option value="provided">Provided</option></select></div>) : <div className="empty-inline">No supporting documents have been added.</div>)}
            {tab === "runs" && (runs.length ? runs.map((run) => <button className="detail-row run-row" type="button" key={run.id} onClick={() => void load(run.id)}><span className="detail-marker">↻</span><div><strong>{new Date(run.createdAt).toLocaleString()}</strong><small>{run.status} · Guideline v{run.guidelineVersion} · Application v{run.applicationVersion}</small></div><span>→</span></button>) : <div className="empty-inline">No analysis runs yet.</div>)}
          </div>
        </section>
      </div>
      <footer className="site-footer">Completeness aid only · Confirm all requirements with the funder.</footer>
    </main>
  );
}

function ProgressBar({ label, value, accent }: { label: string; value: Progress; accent: "coral" | "teal" }) {
  return <div className="progress-card"><div className="progress-label"><span>{label}</span><strong>{value.done}/{value.total} <em>{value.pct}%</em></strong></div><div className="progress-track"><span className={`progress-fill ${accent}`} style={{ width: `${value.pct}%` }} /></div></div>;
}

function RequirementCard({ requirement, selected, pending, correctingId, correction, onSelect, onReview, onCorrectStart, onCorrectionChange }: { requirement: Requirement; selected: boolean; pending: boolean; correctingId: string; correction: string; onSelect: () => void; onReview: (id: string, action: "confirm" | "reject" | "correct", quote?: string) => Promise<void>; onCorrectStart: () => void; onCorrectionChange: (value: string) => void }) {
  const mapping = requirement.mapping;
  return <article className={selected ? "requirement-card selected" : "requirement-card"} onClick={onSelect}>
    <div className="requirement-card-head"><span className={requirement.type === "mandatory" ? "type-badge mandatory" : "type-badge recommended"}>{requirement.type}</span><span className={`evidence-chip ${mapping?.evidenceStrength ?? "missing"}`}>{mapping?.evidenceStrength ?? "unreviewed"}</span></div>
    <h3>{requirement.text}</h3>
    <p className="reasoning">{mapping?.reasoning ?? "Analyze the draft to receive an evidence suggestion."}</p>
    {mapping?.applicationQuote && <blockquote className={!mapping.citationValid ? "quote unverified" : "quote"}>{mapping.applicationQuote}{!mapping.citationValid && <small>Citation could not be verified</small>}</blockquote>}
    {mapping?.correctedQuoteValid && <blockquote className="quote corrected">Corrected: {mapping.correctedQuote}</blockquote>}
    {mapping && <div className="review-controls"><span className={`review-status ${mapping.userStatus}`}>{mapping.userStatus}</span>{correctingId === mapping.id ? <div className="correction-box"><textarea className="text-area" value={correction} onChange={(event) => onCorrectionChange(event.target.value)} placeholder="Paste the exact application quote" /><div className="edit-actions"><button className="button button-quiet" type="button" onClick={onCorrectStart}>Cancel</button><button className="button button-primary" type="button" disabled={pending || !correction.trim()} onClick={() => void onReview(mapping.id, "correct", correction)}>Save correction</button></div></div> : <div className="review-buttons"><button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); void onReview(mapping.id, "confirm"); }}>Confirm</button><button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); onCorrectStart(); }}>Correct</button><button type="button" disabled={pending} onClick={(event) => { event.stopPropagation(); void onReview(mapping.id, "reject"); }}>Reject</button></div>}</div>}
  </article>;
}

function highlightText(source: string, quote: string | null | undefined) {
  if (!source) return <span className="empty-inline">No application text is available.</span>;
  if (!quote) return source.split("\n").map((line, index) => <p key={index}>{line || " "}</p>);
  const start = source.toLowerCase().indexOf(quote.toLowerCase());
  if (start < 0) return source.split("\n").map((line, index) => <p key={index}>{line || " "}</p>);
  return <>{source.slice(0, start).split("\n").map((line, index) => <p key={`before-${index}`}>{line || " "}</p>)}<mark>{source.slice(start, start + quote.length)}</mark>{source.slice(start + quote.length).split("\n").map((line, index) => <p key={`after-${index}`}>{line || " "}</p>)}</>;
}
