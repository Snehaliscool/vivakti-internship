import { useState } from "react";
import { ArrowDownToLine, Check, Download, CheckCircle2, MessageSquare, Plus, Search, Users } from "lucide-react";
import type { Api } from "../lib/api";
import type { Assignment, Data, Profile } from "../lib/types";
import { Avatar, Drawer, Due, Empty, Heading, KindBadge, Progress, Status } from "../components/ui";
import { REVIEW, dueInfo, latestFeedback, fmtDateTime, fmtDay, fmtSize, latestSubmission, progressOf, relTime } from "../lib/utils";

type Act = (fn: () => Promise<void>, ok: string) => Promise<boolean>;

function exportCsv(data: Data) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Name", "Email", "Assigned", "Approved", "In review", "Needs revision", "Overdue", "Progress %", "Joined"];
  const rows = data.interns.map(i => {
    const m = data.assignments.filter(a => a.intern_id === i.id);
    const overdue = m.filter(a => a.status !== "approved" && dueInfo(a.task.due_date, a.status).tone === "overdue").length;
    return [i.full_name, i.email, m.length, m.filter(a => a.status === "approved").length, m.filter(a => REVIEW.includes(a.status)).length, m.filter(a => a.status === "revision_requested").length, overdue, progressOf(m), i.created_at.slice(0, 10)];
  });
  const csv = [head, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `vivakti-intern-progress-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

export function Interns({ data, invite, view, isAdmin }: { data: Data; invite: () => void; view: (i: Profile) => void; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const list = data.interns.filter(i => `${i.full_name} ${i.email}`.toLowerCase().includes(q.toLowerCase()));
  return <>
    <Heading eyebrow="PEOPLE" title={isAdmin ? "People" : "Interns"} subtitle={isAdmin ? "Interns and members of your programme." : "The interns you can give tasks to."} action={isAdmin && <button className="btn primary" onClick={invite}><Plus size={17} /> Invite</button>} />
    <div className="toolbar"><div className="search"><Search size={17} /><input aria-label="Search interns" placeholder="Search by name or email…" value={q} onChange={e => setQ(e.target.value)} /></div><span>{list.length} {list.length === 1 ? "person" : "people"}</span><button className="btn secondary small export" onClick={() => exportCsv(data)} disabled={!data.interns.length}><Download size={14} /> Export CSV</button></div>
    <div className="panel table-panel">
      {list.length ? <div className="table-scroll"><table><thead><tr><th>INTERN</th><th>ASSIGNED</th><th>PROGRESS</th><th>NEEDS ACTION</th><th>JOINED</th></tr></thead><tbody>
        {list.map(i => {
          const mine = data.assignments.filter(a => a.intern_id === i.id);
          const waiting = mine.filter(a => REVIEW.includes(a.status)).length;
          return <tr key={i.id} className="click" tabIndex={0} onClick={() => view(i)} onKeyDown={e => { if (e.key === "Enter") view(i); }}>
            <td><div className="person"><Avatar name={i.full_name || i.email} /><div><b>{i.full_name || "Intern"}</b><span className="sub">{i.email}</span></div></div></td>
            <td>{mine.length}</td>
            <td><div className="cell-prog"><Progress value={progressOf(mine)} label="Progress" /><span>{progressOf(mine)}%</span></div></td>
            <td>{waiting ? <span className="status s-submitted"><i />{waiting} to review</span> : <span className="muted">—</span>}</td>
            <td>{fmtDay(i.created_at.slice(0, 10))}</td></tr>;
        })}</tbody></table></div>
        : <Empty icon={Users} title={q ? "No one matches" : "No interns yet"} text={q ? "Try a different name or email." : isAdmin ? "Invite your first intern to get started." : "An admin needs to invite interns first."} action={!q && isAdmin ? <button className="btn primary small" onClick={invite}><Plus size={15} /> Invite</button> : undefined} />}
    </div>
    {isAdmin && <div className="panel table-panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><div><h2>Members</h2><p>They give tasks to interns, review work and take on tickets.</p></div></div>
      {data.members.length ? <div className="table-scroll"><table><thead><tr><th>MEMBER</th><th>TASKS GIVEN</th><th>ACTIVE TICKETS</th><th>JOINED</th></tr></thead><tbody>
        {data.members.map(m => <tr key={m.id}><td><div className="person"><Avatar name={m.full_name || m.email} /><div><b>{m.full_name || "Member"}</b><span className="sub">{m.email}</span></div></div></td>
          <td>{data.tasks.filter(t => t.created_by === m.id).length}</td>
          <td>{data.tickets.filter(t => (t.status === "open" || t.status === "in_progress") && t.assignees.some(a => a.user_id === m.id)).length}</td>
          <td>{fmtDay(m.created_at.slice(0, 10))}</td></tr>)}</tbody></table></div>
        : <Empty icon={Users} title="No members yet" text="Invite a member to let them give tasks to interns and take on tickets." action={<button className="btn primary small" onClick={invite}><Plus size={15} /> Invite member</button>} />}
    </div>}</>;
}

export function Reviews({ data, api, act }: { data: Data; api: Api; act: Act }) {
  const [view, setView] = useState<"pending" | "done">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const pending = data.assignments.filter(a => REVIEW.includes(a.status)).sort((a, b) => (latestSubmission(a)?.created_at || "").localeCompare(latestSubmission(b)?.created_at || ""));
  const done = data.assignments.filter(a => ["approved", "revision_requested"].includes(a.status) && (a.feedback?.length || 0) > 0)
    .sort((a, b) => (latestFeedback(b)?.created_at || "").localeCompare(latestFeedback(a)?.created_at || ""));
  const rows = view === "pending" ? pending : done;

  async function decide(a: Assignment, status: "approved" | "revision_requested") {
    const msg = (notes[a.id] || "").trim();
    if (status === "revision_requested" && !msg) { setErrs(e => ({ ...e, [a.id]: "Tell the intern what to change so they can improve it." })); return; }
    setErrs(e => ({ ...e, [a.id]: "" }));
    await act(() => api.review(a.id, status, msg || "Approved. Good work."), status === "approved" ? "Submission approved." : "Revision requested.");
  }
  return <>
    <Heading eyebrow="REVIEW QUEUE" title="Submissions" subtitle="Review deliverables, leave feedback and approve completed work." />
    <div className="chips" role="tablist">
      <button role="tab" aria-selected={view === "pending"} className={`chip ${view === "pending" ? "on" : ""}`} onClick={() => setView("pending")}>Awaiting review <b>{pending.length}</b></button>
      <button role="tab" aria-selected={view === "done"} className={`chip ${view === "done" ? "on" : ""}`} onClick={() => setView("done")}>Reviewed <b>{done.length}</b></button>
    </div>
    <div className="review-list">{rows.length ? rows.map(a => {
      const s = latestSubmission(a); const lastFb = latestFeedback(a);
      return <div className="panel review-card" key={a.id}>
        <div className="review-head"><div className="person"><Avatar name={a.intern?.full_name || "?"} /><div><div className="eyebrow">{a.intern?.full_name || "Intern"} · {a.task.title}{a.task.created_by_name ? ` · given by ${a.task.created_by_name}` : ""}</div>
          <h3>{s?.file_name || "No file"}</h3><small>{s ? `${fmtSize(s.file_size)} · submitted ${relTime(s.created_at)} (${fmtDateTime(s.created_at)})` : "No file attached"}</small></div></div><Status status={a.status} /></div>
        {(a.submissions?.length || 0) > 1 && <small className="muted">Attempt {a.submissions!.length}: earlier versions were already reviewed.</small>}
        {s?.note && <p className="quote">“{s.note}”</p>}
        {view === "pending" ? <>
          <div className="row-actions">
            <button className="btn secondary small" disabled={!s} onClick={() => s && act(() => api.download(s), "Download started.")}><ArrowDownToLine size={15} /> Download ZIP</button>
            {a.status === "submitted" && <button className="btn secondary small" onClick={() => act(() => api.setStatus(a.id, "under_review"), "Marked as under review.")}>Start review</button>}
          </div>
          <textarea rows={2} value={notes[a.id] || ""} onChange={e => setNotes(v => ({ ...v, [a.id]: e.target.value }))} placeholder="Feedback for the intern (required to request a revision)…" aria-label="Feedback" />
          {errs[a.id] && <div className="error" role="alert">{errs[a.id]}</div>}
          <div className="review-actions"><button className="btn secondary small" onClick={() => decide(a, "revision_requested")}><MessageSquare size={14} /> Request revision</button>
            <button className="btn primary small" onClick={() => decide(a, "approved")}><Check size={15} /> Approve</button></div>
        </> : <>
          {lastFb && <p className="quote"><b>Your feedback · {relTime(lastFb.created_at)}:</b> “{lastFb.message}”</p>}
          <div className="row-actions">{s && <button className="btn secondary small" onClick={() => act(() => api.download(s), "Download started.")}><ArrowDownToLine size={15} /> Download ZIP</button>}</div>
        </>}
      </div>;
    }) : <div className="panel"><Empty icon={CheckCircle2} title={view === "pending" ? "All caught up" : "Nothing reviewed yet"} text={view === "pending" ? "New submissions will appear here for review." : "Approved work and revision requests will be listed here."} /></div>}</div>
  </>;
}

export function InternDetail({ intern, data, close, open }: { intern: Profile; data: Data; close: () => void; open: (a: Assignment) => void }) {
  const mine = data.assignments.filter(a => a.intern_id === intern.id);
  const count = (f: (a: Assignment) => boolean) => mine.filter(f).length;
  return <Drawer close={close} label={intern.full_name}>
    <div className="drawer-head"><Avatar name={intern.full_name || intern.email} size={46} /><div><div className="eyebrow">INTERN</div><h2>{intern.full_name || "Intern"}</h2></div></div>
    <div className="meta"><span className="meta-item">{intern.email}</span><span className="meta-item">Joined {fmtDay(intern.created_at.slice(0, 10))}</span></div>
    <div className="mini-stats">
      <div><b>{mine.length}</b><span>Assigned</span></div><div><b>{count(a => a.status === "approved")}</b><span>Approved</span></div>
      <div><b>{count(a => REVIEW.includes(a.status))}</b><span>In review</span></div><div><b>{progressOf(mine)}%</b><span>Complete</span></div></div>
    <Progress value={progressOf(mine)} label="Progress" />
    <h3 className="sec">Assignments</h3>
    {mine.length ? <div>{mine.map(a => <button key={a.id} className="task-row" onClick={() => { close(); open(a); }}>
      <KindBadge kind={a.task.task_type} /><div className="task-copy"><b>{a.task.title}</b><span><Due task={a.task} status={a.status} /></span></div><Status status={a.status} /></button>)}</div>
      : <p className="muted">Nothing assigned yet.</p>}
  </Drawer>;
}
