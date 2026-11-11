import { useMemo, useState } from "react";
import { ArrowUpDown, FolderKanban, Plus, Search } from "lucide-react";
import type { Assignment, Data, Task } from "../lib/types";
import { Avatar, Due, Empty, Heading, KindBadge, Priority, Progress, Status } from "../components/ui";
import { KIND_LABEL, OPEN, PRIORITY_RANK, REVIEW, byUrgency, dueInfo, parseDay, progressOf } from "../lib/utils";

type Props = { admin: boolean; data: Data; newTask: () => void; open: (a: Assignment) => void; openTask: (t: Task) => void };
type Sort = "urgency" | "newest" | "priority";

export function Tasks({ admin, data, newTask, open, openTask }: Props) {
  const [q, setQ] = useState(""), [filter, setFilter] = useState("all"), [kind, setKind] = useState("all"), [sort, setSort] = useState<Sort>("urgency");

  const rows = useMemo(() => {
    const text = q.trim().toLowerCase();
    const hit = (t: Task) => (!text || `${t.title} ${t.description}`.toLowerCase().includes(text)) && (kind === "all" || t.task_type === kind);
    const cmpTask = (a: Task, b: Task) => sort === "newest" ? b.created_at.localeCompare(a.created_at)
      : sort === "priority" ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      : (a.due_date ? parseDay(a.due_date).getTime() : Infinity) - (b.due_date ? parseDay(b.due_date).getTime() : Infinity);
    if (admin) {
      const items = data.tasks.filter(hit).map(t => ({ t, as: data.assignments.filter(a => a.task_id === t.id) }));
      const f = items.filter(({ as }) => filter === "all" ? true
        : filter === "review" ? as.some(a => REVIEW.includes(a.status))
        : filter === "done" ? as.length > 0 && as.every(a => a.status === "approved")
        : filter === "overdue" ? as.some(a => a.status !== "approved" && dueInfo(a.task.due_date, a.status).tone === "overdue")
        : as.some(a => a.status !== "approved"));
      return { admin: f.sort((x, y) => cmpTask(x.t, y.t)) };
    }
    const f = data.assignments.filter(a => hit(a.task)).filter(a => filter === "all" ? true
      : filter === "todo" ? OPEN.includes(a.status) : filter === "review" ? REVIEW.includes(a.status) : a.status === "approved");
    return { intern: f.sort(sort === "urgency" ? byUrgency : (x, y) => cmpTask(x.task, y.task)) };
  }, [q, filter, kind, sort, data, admin]);

  const chips = admin
    ? [["all", "All"], ["active", "In flight"], ["review", "Needs review"], ["overdue", "Overdue"], ["done", "Completed"]]
    : [["all", "All"], ["todo", "To do"], ["review", "In review"], ["done", "Approved"]];
  const count = (rows.admin || rows.intern || []).length;

  return <>
    <Heading eyebrow="WORK QUEUE" title="Tasks" subtitle={admin ? "Create assignments and keep track of the work in motion." : "Everything assigned to you, in one place."}
      action={admin && <button className="btn primary" onClick={newTask}><Plus size={17} /> Create task</button>} />
    <div className="toolbar">
      <div className="search"><Search size={17} /><input aria-label="Search tasks" placeholder="Search tasks…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <select aria-label="Task type" value={kind} onChange={e => setKind(e.target.value)}><option value="all">All types</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <label className="sort"><ArrowUpDown size={14} /><select aria-label="Sort" value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="urgency">Due soonest</option><option value="priority">Priority</option><option value="newest">Newest</option></select></label>
    </div>
    <div className="chips" role="tablist">{chips.map(([id, label]) => <button key={id} role="tab" aria-selected={filter === id} className={`chip ${filter === id ? "on" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}<span className="count">{count} {count === 1 ? "task" : "tasks"}</span></div>

    <div className="task-grid">
      {rows.admin?.map(({ t, as }) => {
        const p = progressOf(as);
        return <button key={t.id} className="panel task-card" onClick={() => openTask(t)}>
          <div className="task-card-top"><KindBadge kind={t.task_type} /><Priority p={t.priority} /></div>
          <h3>{t.title}</h3>{t.created_by_name && <small className="given">Given by {t.created_by_name}</small>}<p className="clamp">{t.description}</p>
          <div className="card-progress"><Progress value={p} label="Approved share" /><span>{as.filter(a => a.status === "approved").length}/{as.length} approved</span></div>
          <div className="task-foot"><div className="stack">{as.slice(0, 4).map(a => <Avatar key={a.id} name={a.intern?.full_name || "?"} size={24} />)}{as.length > 4 && <em>+{as.length - 4}</em>}</div><Due task={t} /></div>
        </button>;
      })}
      {rows.intern?.map(a => <button key={a.id} className="panel task-card" onClick={() => open(a)}>
        <div className="task-card-top"><KindBadge kind={a.task.task_type} /><Status status={a.status} /></div>
        <h3>{a.task.title}</h3><p className="clamp">{a.task.description}</p>
        <div className="task-foot"><Priority p={a.task.priority} /><Due task={a.task} status={a.status} /></div>
      </button>)}
      {count === 0 && <div className="panel wide"><Empty icon={FolderKanban} title={q || filter !== "all" || kind !== "all" ? "No tasks match" : "No tasks yet"} text={q || filter !== "all" || kind !== "all" ? "Try a different search or clear the filters." : admin ? "Create a task and assign it to an intern." : "Your admin will add tasks here when they're ready."}
        action={admin && !q && filter === "all" ? <button className="btn primary small" onClick={newTask}><Plus size={15} /> Create task</button> : undefined} /></div>}
    </div>
  </>;
}
