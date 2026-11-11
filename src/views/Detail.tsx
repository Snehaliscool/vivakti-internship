import { useRef, useState } from "react";
import { ArrowUpRight, Calendar, CheckCircle2, FileArchive, Flag, MessageSquare, Pencil, RotateCcw, Send, Trash2, UploadCloud } from "lucide-react";
import type { Api } from "../lib/api";
import type { Assignment, Data, Task } from "../lib/types";
import { Thread } from "../components/Thread";
import { Avatar, Drawer, Due, KindBadge, Priority, Progress, Status } from "../components/ui";
import { KIND_LABEL, REVIEW, fmtDay, fmtDateTime, fmtSize, latestSubmission, progressOf } from "../lib/utils";

type Act = (fn: () => Promise<void>, ok: string) => Promise<boolean>;
type P = { admin: boolean; data: Data; target: { task: string; assignment?: string }; api: Api; act: Act; close: () => void; goReview: () => void; edit: (t: Task) => void; meId: string };

export function Detail({ admin, data, target, api, act, close, goReview, edit, meId }: P) {
  const task = data.tasks.find(t => t.id === target.task) || data.assignments.find(a => a.task_id === target.task)?.task;
  if (!task) return null;
  const mine = admin ? undefined : data.assignments.find(a => a.id === target.assignment) || data.assignments.find(a => a.task_id === task.id);
  const all = data.assignments.filter(a => a.task_id === task.id);
  return <Drawer close={close} label={task.title}>
    <div className="drawer-head">
      <KindBadge kind={task.task_type} />
      <div><div className="eyebrow">{KIND_LABEL[task.task_type]}</div><h2>{task.title}</h2></div>
    </div>
    <div className="meta">
      {mine ? <Status status={mine.status} /> : <span className="status"><i />{all.length} assigned</span>}
      <Priority p={task.priority} />
      <span className="meta-item"><Calendar size={14} /><Due task={task} status={mine?.status} /></span>
      {task.due_date && <span className="meta-item muted">{fmtDay(task.due_date)}</span>}
      {task.created_by_name && <span className="meta-item">Given by {task.created_by_name}</span>}
    </div>
    <h3 className="sec">Instructions</h3>
    <p className="desc">{task.description}</p>
    {task.resource_url && <a className="btn secondary small link" href={task.resource_url} target="_blank" rel="noopener noreferrer">
      {task.task_type === "youtube" ? "Watch video" : task.task_type === "website" ? "Read website" : "Open resource"} <ArrowUpRight size={14} /></a>}
    {mine ? <InternPanel a={mine} api={api} act={act} me={meId} /> : <AdminPanel task={task} all={all} api={api} act={act} close={close} goReview={goReview} edit={() => edit(task)} me={meId} />}
  </Drawer>;
}

function InternPanel({ a, api, act, me }: { a: Assignment; api: Api; act: Act; me: string }) {
  const last = [...(a.feedback || [])].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
  const events = [
    ...(a.submissions || []).map(s => ({ at: s.created_at, kind: "sub" as const, s })),
    ...(a.feedback || []).map(f => ({ at: f.created_at, kind: "fb" as const, f })),
  ].sort((x, y) => y.at.localeCompare(x.at));
  return <>
    {a.status === "revision_requested" && last && <div className="callout warn"><MessageSquare size={17} /><div><b>Revision requested</b><p>“{last.message}”</p></div></div>}
    {a.status === "approved" && <div className="callout ok"><CheckCircle2 size={17} /><div><b>Approved</b><p>{last?.message || "Nice work. This task is complete."}</p></div></div>}
    {REVIEW.includes(a.status) && <div className="callout info"><Send size={17} /><div><b>Submitted</b><p>Your admin will review it soon. You'll see their feedback here.</p></div></div>}
    {a.status === "assigned" && <button className="btn primary full" onClick={() => act(() => api.setStatus(a.id, "in_progress"), "Task started. Good luck!")}>Start task</button>}
    {a.status === "revision_requested" && <button className="btn primary full" onClick={() => act(() => api.setStatus(a.id, "in_progress"), "Revision started.")}><RotateCcw size={15} /> Start revision</button>}
    {a.status === "in_progress" && <Upload a={a} api={api} act={act} />}
    {events.length > 0 && <><h3 className="sec">Activity</h3><ol className="timeline">{events.map(e => e.kind === "sub"
      ? <li key={e.s.id}><i className="dot" /><div><b>You submitted {e.s.file_name}</b><span>{fmtSize(e.s.file_size)} · {fmtDateTime(e.at)}</span>{e.s.note && <p>“{e.s.note}”</p>}</div></li>
      : <li key={e.f.id}><i className={`dot ${e.f.action === "approved" ? "ok" : "warn"}`} /><div><b>{e.f.action === "approved" ? "Approved" : "Revision requested"}</b><span>{fmtDateTime(e.at)}</span><p>“{e.f.message}”</p></div></li>)}</ol></>}
    <h3 className="sec">Discussion</h3><Thread comments={a.comments || []} send={b => act(() => api.addComment(a.id, b), "Message sent.")} me={me} />
  </>;
}

function Upload({ a, api, act }: { a: Assignment; api: Api; act: Act }) {
  const [file, setFile] = useState<File | null>(null), [note, setNote] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false), [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = (f?: File | null) => {
    setErr("");
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".zip")) return setErr("Only .zip files are accepted.");
    if (f.size > 50 * 1024 * 1024) return setErr(`That file is ${fmtSize(f.size)}. The limit is 50 MB.`);
    if (f.size === 0) return setErr("That file is empty.");
    setFile(f);
  };
  async function send() {
    if (!file) return; setBusy(true);
    const ok = await act(() => api.submit(a, file, note.trim()), "Submitted for review.");
    if (!ok) setBusy(false);
  }
  return <div className="upload">
    <h3 className="sec">Submit your work</h3>
    <div className={`drop ${drag ? "drag" : ""} ${file ? "has" : ""}`} role="button" tabIndex={0}
      onClick={() => input.current?.click()} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}>
      {file ? <><FileArchive size={22} /><b>{file.name}</b><span>{fmtSize(file.size)} · click to change</span></>
        : <><UploadCloud size={22} /><b>Drop a ZIP here or click to browse</b><span>ZIP only · up to 50 MB</span></>}
      <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={e => pick(e.target.files?.[0])} />
    </div>
    <textarea rows={3} placeholder="Add a note for your admin (optional)" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} aria-label="Note" />
    {err && <div className="error" role="alert">{err}</div>}
    <button className="btn primary full" disabled={!file || busy} onClick={send}>{busy ? "Uploading…" : "Submit work"} <Send size={14} /></button>
  </div>;
}

function AdminPanel({ task, all, api, act, close, goReview, edit, me }: { me: string; task: Task; all: Assignment[]; api: Api; act: Act; close: () => void; goReview: () => void; edit: () => void }) {
  const [sure, setSure] = useState(false), [talk, setTalk] = useState<string | null>(null);
  const waiting = all.filter(a => REVIEW.includes(a.status)).length;
  return <>
    <h3 className="sec">Assigned interns <span className="muted">({all.length})</span></h3>
    {all.length > 0 && <div className="agg"><Progress value={progressOf(all)} label="Overall progress" /><span>{progressOf(all)}% approved</span></div>}
    <ul className="assignees">{all.map(a => <li key={a.id}>
      <Avatar name={a.intern?.full_name || "?"} size={30} /><div><b>{a.intern?.full_name || "Intern"}</b><span>{latestSubmission(a) ? `Last submitted ${fmtDateTime(latestSubmission(a)!.created_at)}` : "No submission yet"}</span></div><button className="text-btn" onClick={() => setTalk(talk === a.id ? null : a.id)}><MessageSquare size={13} />{a.comments?.length || 0}</button><Status status={a.status} />
      {talk === a.id && <div className="li-thread"><Thread comments={a.comments || []} send={b => act(() => api.addComment(a.id, b), "Message sent.")} me={me} /></div>}</li>)}
      {!all.length && <li className="muted">Nobody is assigned to this task.</li>}</ul>
    {waiting > 0 && <button className="btn primary full" onClick={() => { close(); goReview(); }}><Flag size={15} /> Review {waiting} {waiting === 1 ? "submission" : "submissions"}</button>}
    <button className="btn secondary full gap" onClick={() => { close(); edit(); }}><Pencil size={14} /> Edit task or add interns</button>
    <div className="danger-zone">{!sure
      ? <button className="btn ghost-danger small" onClick={() => setSure(true)}><Trash2 size={14} /> Delete task</button>
      : <div className="confirm"><span>Delete this task, its assignments and feedback? This can't be undone.</span>
        <div><button className="btn secondary small" onClick={() => setSure(false)}>Cancel</button>
          <button className="btn danger small" onClick={async () => { if (await act(() => api.deleteTask(task.id), "Task deleted.")) close(); }}>Yes, delete</button></div></div>}</div>
  </>;
}
