import { Activity, AlertTriangle, ArrowUpRight, BookOpen, CheckCircle2, Clock3, FolderKanban, MessageSquare, Plus, Users } from "lucide-react";
import type { Assignment, Data, Profile, Tab, Ticket } from "../lib/types";
import { TicketStatusPill } from "./Tickets";
import { Avatar, Due, Empty, Heading, KindBadge, Progress, Stat, Status } from "../components/ui";
import { TICKET_KIND, TICKET_PRIORITY_RANK, OPEN, REVIEW, byUrgency, dueInfo, greeting, latestSubmission, progressOf, relTime } from "../lib/utils";

type P = { me: Profile; admin: boolean; data: Data; go: (t: Tab) => void; newTask: () => void; open: (a: Assignment) => void; openTicket: (t: Ticket) => void };

export function Overview({ me, admin, data, go, newTask, open, openTicket }: P) {
  const as = data.assignments;
  const done = as.filter(a => a.status === "approved").length;
  const reviewing = as.filter(a => REVIEW.includes(a.status));
  const active = as.filter(a => a.status === "in_progress").length;
  const overdue = as.filter(a => !["approved", "submitted", "under_review"].includes(a.status) && dueInfo(a.task.due_date, a.status).tone === "overdue");
  const first = (me.full_name || "there").split(" ")[0];

  const queue = admin
    ? [...reviewing].sort((a, b) => (latestSubmission(a)?.created_at || "").localeCompare(latestSubmission(b)?.created_at || ""))
    : as.filter(a => OPEN.includes(a.status)).sort((a, b) => (a.status === "revision_requested" ? -1 : 0) - (b.status === "revision_requested" ? -1 : 0) || byUrgency(a, b));
  const revisions = as.filter(a => a.status === "revision_requested");
  const activity = admin ? as.flatMap(a => [
    ...(a.submissions || []).map(x => ({ at: x.created_at, a, text: `${a.intern?.full_name || "An intern"} submitted ${x.file_name}` })),
    ...(a.feedback || []).map(x => ({ at: x.created_at, a, text: `You ${x.action === "approved" ? "approved" : "requested changes on"} ${a.intern?.full_name || "an intern"}'s work` })),
  ]).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 5) : [];
  const liveTickets = data.tickets.filter(t => t.status === "open" || t.status === "in_progress").sort((a, b) => TICKET_PRIORITY_RANK[a.priority] - TICKET_PRIORITY_RANK[b.priority]);
  const recent = as.flatMap(a => (a.feedback || []).map(f => ({ f, a }))).sort((x, y) => y.f.created_at.localeCompare(x.f.created_at)).slice(0, 3);

  return <>
    <Heading eyebrow="YOUR WORKSPACE" title={`${greeting()}, ${first}.`}
      subtitle={admin ? "Here's what's happening across your internship programme." : "Your learning queue, deadlines and recent progress."}
      action={admin && <button className="btn primary" onClick={newTask}><Plus size={17} /> Create task</button>} />

    {!admin && revisions.length > 0 && <button className="banner warn" onClick={() => open(revisions[0])}>
      <MessageSquare size={18} /><div><b>{revisions.length === 1 ? "1 task needs a revision" : `${revisions.length} tasks need a revision`}</b><span>Read the feedback and resubmit when you're ready.</span></div><ArrowUpRight size={18} /></button>}
    {admin && reviewing.length > 0 && <button className="banner" onClick={() => go("submissions")}>
      <Clock3 size={18} /><div><b>{reviewing.length} {reviewing.length === 1 ? "submission is" : "submissions are"} waiting for review</b><span>Interns learn fastest with feedback in a day or two.</span></div><ArrowUpRight size={18} /></button>}

    <div className="stats">
      <Stat icon={FolderKanban} label={admin ? "Total tasks" : "Assigned to you"} value={admin ? data.tasks.length : as.length} note={admin ? `${as.length} assignments in total` : "Across your workspace"} />
      <Stat icon={Activity} label="In progress" value={active} note="Currently being worked on" />
      <Stat icon={CheckCircle2} label="Approved" value={done} note={`${progressOf(as)}% of all assignments`} />
      <Stat icon={overdue.length ? AlertTriangle : Clock3} tone={overdue.length ? "danger" : ""} label={overdue.length ? "Overdue" : "Needs review"} value={overdue.length || reviewing.length} note={overdue.length ? "Past their due date" : "Requires attention"} />
    </div>

    <div className="columns">
      <section className="panel">
        <div className="panel-head"><div><h2>{admin ? "Review queue" : "Up next"}</h2><p>{admin ? "Oldest submissions first." : "Most urgent first. Pick up where you left off."}</p></div>
          <button className="text-btn" onClick={() => go(admin ? "submissions" : "tasks")}>View all <ArrowUpRight size={15} /></button></div>
        {queue.length ? queue.slice(0, 6).map(a => <button className="task-row" key={a.id} onClick={() => open(a)}>
          <KindBadge kind={a.task.task_type} />
          <div className="task-copy"><b>{a.task.title}</b><span>{admin ? a.intern?.full_name || "Intern" : <Due task={a.task} status={a.status} />}{admin && <> · submitted {relTime(latestSubmission(a)?.created_at || a.created_at)}</>}</span></div>
          <Status status={a.status} /></button>)
          : <Empty icon={CheckCircle2} title={admin ? "All caught up" : "You're all caught up"} text={admin ? "New submissions will appear here." : "Nothing waiting. New tasks will show up here."} />}
      </section>

      <section className="panel side-panel">
        {admin ? <>
          <div className="panel-head"><div><h2>Intern progress</h2><p>Approved work per person.</p></div><Users size={18} color="var(--orange)" /></div>
          {data.interns.length ? <div className="prog-list">{data.interns.slice(0, 6).map(i => {
            const mine = as.filter(a => a.intern_id === i.id);
            return <div key={i.id} className="prog-row"><Avatar name={i.full_name || i.email} size={28} /><div><div className="prog-top"><b>{i.full_name || i.email}</b><span>{mine.filter(a => a.status === "approved").length}/{mine.length}</span></div><Progress value={progressOf(mine)} label={`${i.full_name} progress`} /></div></div>;
          })}</div> : <Empty icon={Users} title="No interns yet" text="Invite your first intern to begin." />}
          <button className="text-btn" onClick={() => go("interns")}>Manage interns <ArrowUpRight size={15} /></button>
        </> : <>
          <div className="panel-head"><div><h2>Your progress</h2><p>Approved assignments.</p></div></div>
          <div className="donut" style={{ background: `conic-gradient(var(--orange) 0 ${progressOf(as)}%, #f2eee9 ${progressOf(as)}% 100%)` }}><b>{progressOf(as)}%</b><span>approved</span></div>
          <p className="center muted">{done} of {as.length} assignments approved</p>
          {recent.length > 0 && <div className="mini-feed"><div className="eyebrow">RECENT FEEDBACK</div>{recent.map(({ f, a }) =>
            <button key={f.id} onClick={() => open(a)}><b>{a.task.title}</b><span>“{f.message}”</span><small>{relTime(f.created_at)}</small></button>)}</div>}
        </>}
      </section>
    </div>

    {(liveTickets.length > 0 || me.role === "admin") && <section className="panel feed">
      <div className="panel-head"><div><h2>{me.role === "admin" ? "Open tickets" : "Your tickets"}</h2><p>{liveTickets.length ? `${liveTickets.length} active, most urgent first.` : "Nothing active right now."}</p></div><button className="text-btn" onClick={() => go("tickets")}>View all <ArrowUpRight size={15} /></button></div>
      {liveTickets.slice(0, 4).map(t => <button key={t.id} className="feed-row" onClick={() => openTicket(t)}><i className={`pdot ${t.priority}`} /><div><b>{t.title}</b><span>{t.application} · {TICKET_KIND[t.kind]}</span></div><TicketStatusPill s={t.status} /></button>)}
      {!liveTickets.length && <p className="muted small-print">{me.role === "admin" ? "Raise a ticket from the Tickets page to report a bug or request build work." : "Assigned tickets will show up here."}</p>}
    </section>}
    {admin && activity.length > 0 && <section className="panel feed"><div className="panel-head"><div><h2>Recent activity</h2><p>The latest submissions and reviews.</p></div></div>
      {activity.map((e, i) => <button key={i} className="feed-row" onClick={() => open(e.a)}><i /><div><b>{e.text}</b><span>{e.a.task.title}</span></div><small>{relTime(e.at)}</small></button>)}</section>}
    <div className="tip"><BookOpen size={20} /><div><b>{admin ? "Build a culture of clear feedback." : "Make your work visible."}</b>
      <span>{admin ? "Specific instructions and timely reviews help interns learn faster." : "Add a short note with each submission to explain what you completed."}</span></div></div>
  </>;
}
