import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, ArrowUpRight, Bug, Calendar, Hammer, Lightbulb, Pencil, Plus, Search, Sparkles, Ticket as TicketIcon, Trash2 } from "lucide-react";
import type { Api } from "../lib/api";
import type { Data, NewTicket, Profile, Ticket, TicketKind, TicketPriority, TicketStatus } from "../lib/types";
import { Avatar, Drawer, Empty, Heading, Modal } from "../components/ui";
import { Thread } from "../components/Thread";
import { TICKET_KIND, TICKET_PRIORITY_RANK, TICKET_STATUS, ROLE_LABEL, dueInfo, fmtDay, relTime, toDay } from "../lib/utils";

type Act = (fn: () => Promise<void>, ok: string) => Promise<boolean>;
const kindIcon = (k: string) => k === "bug" ? Bug : k === "improvement" ? Lightbulb : k === "feature" ? Sparkles : Hammer;

export const TicketStatusPill = ({ s }: { s: string }) => <span className={`status t-${s}`}><i />{TICKET_STATUS[s]}</span>;
const PriorityTag = ({ p }: { p: string }) => <span className={`priority ${p}`}><i />{p}</span>;
const TicketDue = ({ t }: { t: Ticket }) => { const d = dueInfo(t.due_date, t.status === "resolved" || t.status === "closed" ? "approved" : t.status); return <span className={`due ${d.tone}`}>{d.label}</span>; };

export function Tickets({ isAdmin, data, open, raise }: { isAdmin: boolean; data: Data; open: (t: Ticket) => void; raise: () => void }) {
  const [q, setQ] = useState(""), [status, setStatus] = useState("active"), [app, setApp] = useState("all"), [kind, setKind] = useState("all");
  const apps = useMemo(() => [...new Set(data.tickets.map(t => t.application))].sort(), [data.tickets]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.tickets
      .filter(t => (!s || `${t.title} ${t.description} ${t.application}`.toLowerCase().includes(s)) && (app === "all" || t.application === app) && (kind === "all" || t.kind === kind))
      .filter(t => status === "all" ? true : status === "active" ? t.status === "open" || t.status === "in_progress" : t.status === status)
      .sort((a, b) => (a.status === "closed" ? 1 : 0) - (b.status === "closed" ? 1 : 0) || TICKET_PRIORITY_RANK[a.priority] - TICKET_PRIORITY_RANK[b.priority] || b.created_at.localeCompare(a.created_at));
  }, [data.tickets, q, status, app, kind]);
  const n = (f: (t: Ticket) => boolean) => data.tickets.filter(f).length;
  const chips: [string, string, number][] = [["active", "Active", n(t => t.status === "open" || t.status === "in_progress")], ["resolved", "Resolved", n(t => t.status === "resolved")], ["closed", "Closed", n(t => t.status === "closed")], ["all", "All", data.tickets.length]];
  const filtered = q || app !== "all" || kind !== "all";
  return <>
    <Heading eyebrow="BUILD & FIX" title="Tickets" subtitle={isAdmin ? "Raise bugs, improvements and build work on the applications you're making, and hand them to the right people." : "Bugs, improvements and build work the admins have assigned to you."}
      action={isAdmin && <button className="btn primary" onClick={raise}><Plus size={17} /> Raise ticket</button>} />
    <div className="toolbar">
      <div className="search"><Search size={17} /><input aria-label="Search tickets" placeholder="Search tickets…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <select aria-label="Application" value={app} onChange={e => setApp(e.target.value)}><option value="all">All applications</option>{apps.map(a => <option key={a}>{a}</option>)}</select>
      <select aria-label="Kind" value={kind} onChange={e => setKind(e.target.value)}><option value="all">All kinds</option>{Object.entries(TICKET_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
    </div>
    <div className="chips" role="tablist">{chips.map(([id, label, c]) => <button key={id} role="tab" aria-selected={status === id} className={`chip ${status === id ? "on" : ""}`} onClick={() => setStatus(id)}>{label} <b>{c}</b></button>)}</div>
    <div className="panel ticket-list">
      {rows.length ? rows.map(t => { const I = kindIcon(t.kind); return <button key={t.id} className="ticket-row" onClick={() => open(t)}>
        <div className={`type-icon k-${t.kind}`}><I size={18} /></div>
        <div className="task-copy"><b>{t.title}</b><span>{t.application} · {TICKET_KIND[t.kind]} · <TicketDue t={t} /></span></div>
        <div className="stack">{t.assignees.slice(0, 3).map(a => <Avatar key={a.user_id} name={a.user_name} size={24} />)}{t.assignees.length > 3 && <em>+{t.assignees.length - 3}</em>}</div>
        <PriorityTag p={t.priority} /><TicketStatusPill s={t.status} /></button>; })
        : <Empty icon={TicketIcon} title={filtered ? "No tickets match" : data.tickets.length ? "Nothing in this view" : "No tickets yet"}
            text={filtered ? "Try a different search or clear the filters." : isAdmin ? "Raise a ticket to report a bug or request work on one of your applications." : "When an admin assigns you a ticket, it will appear here."}
            action={isAdmin && !data.tickets.length ? <button className="btn primary small" onClick={raise}><Plus size={15} /> Raise ticket</button> : undefined} />}
    </div></>;
}

export function TicketDetail({ ticket, isAdmin, me, api, act, close, edit }: { ticket: Ticket; isAdmin: boolean; me: Profile; api: Api; act: Act; close: () => void; edit: (t: Ticket) => void }) {
  const [sure, setSure] = useState(false);
  const I = kindIcon(ticket.kind);
  const options: TicketStatus[] = isAdmin ? ["open", "in_progress", "resolved", "closed"] : ["open", "in_progress", "resolved"];
  const locked = !isAdmin && ticket.status === "closed";
  return <Drawer close={close} label={ticket.title}>
    <div className="drawer-head"><div className={`type-icon k-${ticket.kind}`}><I size={18} /></div><div><div className="eyebrow">{ticket.application.toUpperCase()} · {TICKET_KIND[ticket.kind].toUpperCase()}</div><h2>{ticket.title}</h2></div></div>
    <div className="meta"><TicketStatusPill s={ticket.status} /><PriorityTag p={ticket.priority} />
      {ticket.due_date && <span className="meta-item"><Calendar size={14} /><TicketDue t={ticket} /></span>}
      <span className="meta-item">Raised by {ticket.created_by_name || "admin"} · {relTime(ticket.created_at)}</span></div>
    <h3 className="sec">Status</h3>
    {locked ? <p className="muted small-print">This ticket is closed. Ask an admin if it needs to be reopened.</p>
      : <div className="seg" role="group" aria-label="Ticket status">{options.map(s => <button key={s} className={ticket.status === s ? "on" : ""} aria-pressed={ticket.status === s}
        onClick={() => ticket.status !== s && act(() => api.setTicketStatus(ticket.id, s), `Marked ${TICKET_STATUS[s].toLowerCase()}.`)}>{TICKET_STATUS[s]}</button>)}</div>}
    <h3 className="sec">Details</h3>
    <p className="desc">{ticket.description || "No description provided."}</p>
    {ticket.reference_url && <a className="btn secondary small link" href={ticket.reference_url} target="_blank" rel="noopener noreferrer">Open reference <ArrowUpRight size={14} /></a>}
    <h3 className="sec">Assigned to <span className="muted">({ticket.assignees.length})</span></h3>
    <ul className="assignees">{ticket.assignees.map(a => <li key={a.user_id}><Avatar name={a.user_name} size={30} /><div><b>{a.user_name}{a.user_id === me.id ? " (you)" : ""}</b><span>{ROLE_LABEL[a.user_role] || a.user_role}</span></div></li>)}
      {!ticket.assignees.length && <li className="muted">Nobody is assigned yet.</li>}</ul>
    <h3 className="sec">Discussion</h3>
    <Thread comments={ticket.comments} me={me.id} send={b => act(() => api.addTicketComment(ticket.id, b), "Message sent.")} />
    {isAdmin && <div className="danger-zone">
      <button className="btn secondary full gap0" onClick={() => { close(); edit(ticket); }}><Pencil size={14} /> Edit ticket or change assignees</button>
      <div className="gap-t">{!sure ? <button className="btn ghost-danger small" onClick={() => setSure(true)}><Trash2 size={14} /> Delete ticket</button>
        : <div className="confirm"><span>Delete this ticket and its discussion? This can't be undone.</span><div><button className="btn secondary small" onClick={() => setSure(false)}>Cancel</button>
          <button className="btn danger small" onClick={async () => { if (await act(() => api.deleteTicket(ticket.id), "Ticket deleted.")) close(); }}>Yes, delete</button></div></div>}</div></div>}
  </Drawer>;
}

export function TicketModal({ ticket, people, apps, api, close, done }: { ticket?: Ticket; people: Profile[]; apps: string[]; api: Api; close: () => void; done: () => void }) {
  const [application, setApplication] = useState(ticket?.application || apps[0] || ""), [title, setTitle] = useState(ticket?.title || ""), [description, setDescription] = useState(ticket?.description || "");
  const [kind, setKind] = useState<TicketKind>(ticket?.kind || "bug"), [priority, setPriority] = useState<TicketPriority>(ticket?.priority || "medium");
  const [due, setDue] = useState(ticket?.due_date || ""), [url, setUrl] = useState(ticket?.reference_url || "");
  const [sel, setSel] = useState<string[]>(ticket?.assignees.map(a => a.user_id) || []), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const members = people.filter(p => p.role === "member"), interns = people.filter(p => p.role === "intern");
  async function save(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!sel.length) return setError("Select at least one person to assign this to.");
    setBusy(true);
    const body: NewTicket = { application: application.trim(), title: title.trim(), description: description.trim(), kind, priority, due_date: due || null, reference_url: url.trim() || null };
    try { const who = people.filter(p => sel.includes(p.id)); if (ticket) await api.updateTicket(ticket.id, body, who); else await api.createTicket(body, who); done(); }
    catch (err: any) { setError(err.message || "Could not save the ticket."); setBusy(false); }
  }
  const group = (label: string, list: Profile[]) => list.length > 0 && <><div className="grp">{label}</div>{list.map(i => <label className="check-row" key={i.id}>
    <input type="checkbox" checked={sel.includes(i.id)} onChange={e => setSel(v => e.target.checked ? [...v, i.id] : v.filter(x => x !== i.id))} /><span>{i.full_name || i.email}<small>{i.email}</small></span></label>)}</>;
  return <Modal title={ticket ? "Edit ticket" : "Raise a ticket"} subtitle="Describe the bug, improvement or build work, and choose who should pick it up." close={close}>
    <form className="form" onSubmit={save}>
      <div className="two">
        <label>Application<input list="app-list" value={application} onChange={e => setApplication(e.target.value)} placeholder="e.g. Orbit Mobile App" required maxLength={80} /><datalist id="app-list">{apps.map(a => <option key={a} value={a} />)}</datalist></label>
        <label>Kind<select value={kind} onChange={e => setKind(e.target.value as TicketKind)}>{Object.entries(TICKET_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
      <label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === "bug" ? "What's going wrong?" : "What should be built or improved?"} required maxLength={160} /></label>
      <label>Description<textarea rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder={kind === "bug" ? "Steps to reproduce, what you expected, what happened, device or browser…" : "What it should do, why it matters, acceptance criteria…"} /></label>
      <div className="two">
        <label>Priority<select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
        <label>Due date <input type="date" value={due} min={ticket ? undefined : toDay(new Date())} onChange={e => setDue(e.target.value)} /></label>
      </div>
      <label>Reference link (optional)<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="Repo issue, design file, recording…" /></label>
      <div className="assign-head"><b>Assign to</b><span className="muted">{sel.length} selected</span></div>
      <div className="intern-picker tall">{people.length ? <>{group("Members", members)}{group("Interns", interns)}</> : <div className="muted pad">Invite members or interns first.</div>}</div>
      {error && <div className="error" role="alert"><AlertCircle size={15} />{error}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={close}>Cancel</button><button className="btn primary" disabled={busy || !people.length}>{busy ? "Saving…" : ticket ? "Save changes" : "Raise ticket"} <ArrowUpRight size={15} /></button></div>
    </form></Modal>;
}
