"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SupportingDoc = {
  name: string;
  type: string;
  status: "provided" | "missing";
};

type Assessment = {
  id: string;
  title: string;
  createdAt: string;
  stale: boolean;
};

const emptyDoc: SupportingDoc = { name: "", type: "", status: "missing" };

async function readTextFile(
  event: ChangeEvent<HTMLInputElement>,
  setValue: (value: string) => void,
) {
  const file = event.target.files?.[0];
  if (!file) return;
  setValue(await file.text());
}

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [guideline, setGuideline] = useState("");
  const [application, setApplication] = useState("");
  const [supportingDocs, setSupportingDocs] = useState<SupportingDoc[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/assessments")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load assessments");
        return response.json() as Promise<Assessment[]>;
      })
      .then(setAssessments)
      .catch(() => setError("We could not load previous assessments. Refresh to try again."))
      .finally(() => setLoadingAssessments(false));
  }, []);

  const updateSupportingDoc = (index: number, update: Partial<SupportingDoc>) => {
    setSupportingDocs((current) =>
      current.map((doc, docIndex) => (docIndex === index ? { ...doc, ...update } : doc)),
    );
  };

  const loadSample = async () => {
    setLoadingSample(true);
    setError("");
    try {
      const [guidelineResponse, applicationResponse] = await Promise.all([
        fetch("/samples/guideline.txt"),
        fetch("/samples/application.txt"),
      ]);
      if (!guidelineResponse.ok || !applicationResponse.ok) throw new Error("Sample unavailable");
      setTitle("Community Climate Action Grant draft");
      setGuideline(await guidelineResponse.text());
      setApplication(await applicationResponse.text());
      setSupportingDocs([
        { name: "Signed organizational authorization letter", type: "authorization", status: "missing" },
        { name: "Detailed project schedule", type: "schedule", status: "missing" },
      ]);
    } catch {
      setError("The sample could not be loaded. Check that the sample assets are available.");
    } finally {
      setLoadingSample(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, guideline, application, supportingDocs }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create assessment");
      router.push(`/assessments/${result.id}`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not create assessment");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="site-shell">
        <header className="topbar">
          <Link className="brand" href="/">
            <span className="brand-mark">GA</span>
            <span>Grant review studio</span>
          </Link>
          <span className="topbar-note">Completeness aid · evidence-led</span>
        </header>

        <div className="page-wrap home-grid">
          <section className="intro-block">
            <p className="eyebrow">DRAFT REVIEW WORKSPACE</p>
            <h1>See what your application has covered.</h1>
            <p className="intro-copy">
              Compare a draft application with its grant guideline, verify the evidence, and keep every review decision in one place.
            </p>
            <div className="principle-note">
              <span className="principle-dot" />
              <span>Suggestions are reviewed by you. This tool does not make legal or funding decisions.</span>
            </div>
          </section>

          <section className="form-panel" aria-labelledby="new-assessment-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">START A REVIEW</p>
                <h2 id="new-assessment-title">New assessment</h2>
              </div>
              <button className="button button-quiet" type="button" onClick={loadSample} disabled={loadingSample}>
                {loadingSample ? "Loading…" : "Load sample"}
              </button>
            </div>

            <form onSubmit={submit} className="stack-lg">
              <label className="field-label">
                Assessment title
                <input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Riverside youth grant" required />
              </label>

              <DocumentField label="Grant guideline" value={guideline} onChange={setGuideline} />
              <DocumentField label="Draft application" value={application} onChange={setApplication} />

              <div className="supporting-section">
                <div className="section-label-row">
                  <label className="field-label">Supporting documents <span className="muted-label">optional</span></label>
                  <button className="text-button" type="button" onClick={() => setSupportingDocs((current) => [...current, { ...emptyDoc }])}>+ Add document</button>
                </div>
                {supportingDocs.length === 0 ? (
                  <p className="empty-inline">Track an attachment or evidence file alongside the review.</p>
                ) : (
                  <div className="supporting-list">
                    {supportingDocs.map((doc, index) => (
                      <div className="supporting-row" key={`${index}-${doc.name}`}>
                        <input className="text-input" value={doc.name} onChange={(event) => updateSupportingDoc(index, { name: event.target.value })} placeholder="Document name" aria-label="Document name" required />
                        <input className="text-input" value={doc.type} onChange={(event) => updateSupportingDoc(index, { type: event.target.value })} placeholder="Type" aria-label="Document type" required />
                        <select className="text-input select-input" value={doc.status} onChange={(event) => updateSupportingDoc(index, { status: event.target.value as SupportingDoc["status"] })} aria-label="Document status">
                          <option value="missing">Missing</option>
                          <option value="provided">Provided</option>
                        </select>
                        <button className="icon-button" type="button" aria-label={`Remove ${doc.name || "document"}`} onClick={() => setSupportingDocs((current) => current.filter((_, docIndex) => docIndex !== index))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="error-banner" role="alert">{error}</div>}
              <button className="button button-primary submit-button" disabled={submitting} type="submit">
                {submitting ? "Creating review…" : "Create assessment →"}
              </button>
            </form>
          </section>

          <section className="recent-section" aria-labelledby="recent-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR WORK</p>
                <h2 id="recent-title">Recent assessments</h2>
              </div>
              {!loadingAssessments && <span className="count-label">{assessments.length} total</span>}
            </div>
            {loadingAssessments ? <div className="loading-line">Loading your assessments…</div> : assessments.length === 0 ? (
              <div className="empty-state"><strong>Your review shelf is empty.</strong><span>Create an assessment above to begin.</span></div>
            ) : (
              <div className="assessment-list">
                {assessments.map((assessment) => (
                  <Link className="assessment-row" href={`/assessments/${assessment.id}`} key={assessment.id}>
                    <span className="assessment-initial">{assessment.title.slice(0, 1).toUpperCase()}</span>
                    <span className="assessment-details"><strong>{assessment.title}</strong><small>{new Date(assessment.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></span>
                    {assessment.stale && <span className="status-badge status-stale">Needs refresh</span>}
                    <span className="row-arrow">→</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <footer className="site-footer">Completeness aid only · Confirm requirements with the funder.</footer>
      </main>
    </div>
  );
}

function DocumentField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="document-field">
      <div className="section-label-row">
        <label className="field-label" htmlFor={label}>{label}</label>
        <label className="file-button">Upload .txt/.md<input id={label} type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void readTextFile(event, onChange)} /></label>
      </div>
      <textarea className="text-area" value={value} onChange={(event) => onChange(event.target.value)} placeholder={`Paste the ${label.toLowerCase()} here…`} required />
      <span className="character-count">{value.length.toLocaleString()} characters</span>
    </div>
  );
}
