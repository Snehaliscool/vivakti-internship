import { useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ArrowUpRight, ShieldCheck } from "lucide-react";
import type { Api } from "../lib/api";
import type { Priority, Profile, Task, TaskKind } from "../lib/types";
import { Modal } from "../components/ui";
import { toDay } from "../lib/utils";

export function TaskModal({ interns, api, close, done, task, assignedIds = [] }: { interns: Profile[]; api: Api; close: () => void; done: () => void; task?: Task; assignedIds?: string[] }) {
  const editing = !!task;
  const [title, setTitle] = useState(task?.title || ""), [description, setDescription] = useState(task?.description || ""), [type, setType] = useState<TaskKind>(task?.task_type || "project");
  const [url, setUrl] = useState(task?.resource_url || ""), [priority, setPriority] = useState<Priority>(task?.priority || "medium"), [due, setDue] = useState(task?.due_date || "");
  const pool = interns.filter(i => !assignedIds.includes(i.id));
  const [selected, setSelected] = useState<string[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function create(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!editing && !selected.length) return setError("Select at least one intern.");
    setBusy(true);
    try {
      const body = { title: title.trim(), description: description.trim(), task_type: type, resource_url: url.trim() || null, priority, due_date: due || null };
      if (task) await api.updateTask(task.id, body, selected); else await api.createTask(body, selected);
      done();
    } catch (err: any) { setError(err.message || "Could not create the task."); setBusy(false); }
  }
  const all = selected.length === pool.length && pool.length > 0;
  return <Modal title={editing ? "Edit task" : "Create a task"} subtitle={editing ? "Update the brief or assign more interns. Existing assignments keep their progress." : "Write a clear brief and assign it to your interns."} close={close}>
    <form className="form" onSubmit={create}>
      <label>Task title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Research competitor landscape" required maxLength={140} /></label>
      <label>Instructions<textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="What needs to be done? Include expected output and context." required /></label>
      <div className="two">
        <label>Task type<select value={type} onChange={e => setType(e.target.value as TaskKind)}><option value="project">Project</option><option value="website">Website reading</option><option value="youtube">YouTube video</option><option value="general">General task</option></select></label>
        <label>Priority<select value={priority} onChange={e => setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
      <div className="two">
        <label>{type === "project" || type === "general" ? "Reference URL (optional)" : "Resource URL"}<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" required={type === "website" || type === "youtube"} /></label>
        <label>Due date<input type="date" value={due} min={editing ? undefined : toDay(new Date())} onChange={e => setDue(e.target.value)} /></label>
      </div>
      <div className="assign-head"><b>{editing ? "Assign to more interns" : "Assign to"}</b>{pool.length > 0 && <button type="button" className="text-btn" onClick={() => setSelected(all ? [] : pool.map(i => i.id))}>{all ? "Clear all" : "Select all"}</button>}</div>
      <div className="intern-picker">{pool.length ? pool.map(i => <label className="check-row" key={i.id}>
        <input type="checkbox" checked={selected.includes(i.id)} onChange={e => setSelected(v => e.target.checked ? [...v, i.id] : v.filter(x => x !== i.id))} />
        <span>{i.full_name || i.email}<small>{i.email}</small></span></label>) : <div className="muted pad">{editing ? "Everyone is already assigned." : "No interns yet. Invite someone first."}</div>}</div>
      {error && <div className="error" role="alert"><AlertCircle size={15} />{error}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={close}>Cancel</button><button className="btn primary" disabled={busy || (!editing && !interns.length)}>{busy ? (editing ? "Saving…" : "Creating…") : editing ? "Save changes" : "Create and assign"} <ArrowUpRight size={15} /></button></div>
    </form></Modal>;
}

export function InternModal({ api, close, done }: { api: Api; close: () => void; done: () => void }) {
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [role, setRole] = useState<"intern" | "member">("intern"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function invite(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try { await api.invite(email.trim().toLowerCase(), name.trim(), role); done(); } catch (err: any) { setError(err.message || "Invitation failed."); setBusy(false); }
  }
  return <Modal title="Invite someone" subtitle="They'll receive an email to set up their account." close={close}>
    <form className="form" onSubmit={invite}>
      <label>Role<select value={role} onChange={e => setRole(e.target.value as "intern" | "member")}><option value="intern">Intern: receives tasks and submits work</option><option value="member">Member: gives tasks to interns, reviews them and works on tickets</option></select></label>
      <label>Full name<input value={name} onChange={e => setName(e.target.value)} required placeholder="Their name" /></label>
      <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" /></label>
      <div className="invite-note"><ShieldCheck size={17} /> Admin access can't be granted from here. Admins are set up manually in the database.</div>
      {error && <div className="error" role="alert"><AlertCircle size={15} />{error}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={close}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? "Sending…" : "Send invitation"} <ArrowUpRight size={15} /></button></div>
    </form></Modal>;
}
