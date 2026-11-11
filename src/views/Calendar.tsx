import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Assignment, Data, Task } from "../lib/types";
import { Heading } from "../components/ui";
import { STATUS_LABEL, parseDay, toDay } from "../lib/utils";

type Props = { admin: boolean; data: Data; open: (a: Assignment) => void; openTask: (t: Task) => void };

export function Calendar({ admin, data, open, openTask }: Props) {
  const today = new Date();
  const [cur, setCur] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const days = useMemo(() => {
    const start = new Date(cur); start.setDate(1 - ((cur.getDay() + 6) % 7)); // Monday first
    return Array.from({ length: 42 }, (_, n) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + n));
  }, [cur]);
  const byDay = useMemo(() => {
    const m: Record<string, { label: string; cls: string; go: () => void }[]> = {};
    const add = (d: string, v: { label: string; cls: string; go: () => void }) => (m[d] ||= []).push(v);
    if (admin) data.tasks.forEach(t => t.due_date && add(t.due_date, { label: t.title, cls: `p-${t.priority}`, go: () => openTask(t) }));
    else data.assignments.forEach(a => a.task.due_date && add(a.task.due_date, { label: a.task.title, cls: `s-${a.status}`, go: () => open(a) }));
    return m;
  }, [data, admin]);
  const todayKey = toDay(today);
  const undated = admin ? data.tasks.filter(t => !t.due_date).length : data.assignments.filter(a => !a.task.due_date).length;
  const move = (n: number) => setCur(new Date(cur.getFullYear(), cur.getMonth() + n, 1));
  return <>
    <Heading eyebrow="DEADLINES" title="Calendar" subtitle={admin ? "Due dates across every task you've set." : "See what's due and when."} />
    <div className="panel cal">
      <div className="cal-head"><h2>{cur.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
        <div><button className="btn secondary small" onClick={() => setCur(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
          <button className="icon" onClick={() => move(-1)} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <button className="icon" onClick={() => move(1)} aria-label="Next month"><ChevronRight size={18} /></button></div></div>
      <div className="cal-grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div className="cal-dow" key={d}>{d}</div>)}
        {days.map(d => { const k = toDay(d), items = byDay[k] || [];
          return <div key={k} className={`cal-day ${d.getMonth() !== cur.getMonth() ? "off" : ""} ${k === todayKey ? "today" : ""}`}>
            <span className="num">{d.getDate()}</span>
            {items.slice(0, 3).map((it, n) => <button key={n} className={`cal-chip ${it.cls}`} onClick={it.go} title={it.label}>{it.label}</button>)}
            {items.length > 3 && <small>+{items.length - 3} more</small>}</div>; })}</div>
      <div className="cal-legend">{admin ? <><span className="p-high">High</span><span className="p-medium">Medium</span><span className="p-low">Low</span> priority</>
        : <>{["assigned", "in_progress", "submitted", "revision_requested", "approved"].map(s => <span key={s} className={`s-${s}`}>{STATUS_LABEL[s]}</span>)}</>}
        {undated > 0 && <em>{undated} without a deadline</em>}</div>
    </div></>;
}
