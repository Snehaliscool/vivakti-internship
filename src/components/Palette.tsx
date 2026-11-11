import { useEffect, useMemo, useRef, useState } from "react";
import { Bug, CalendarDays, CornerDownLeft, FileArchive, FolderKanban, LayoutDashboard, Search, Users } from "lucide-react";
import type { Data, Tab, Task, Ticket } from "../lib/types";
import { kindIcon } from "./ui";

type Item = { id: string; label: string; hint: string; icon: any; run: () => void };

export function Palette({ admin, data, go, openTask, openTicket, close }: { admin: boolean; data: Data; go: (t: Tab) => void; openTask: (t: Task) => void; openTicket: (t: Ticket) => void; close: () => void }) {
  const [q, setQ] = useState(""), [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);
  const items: Item[] = useMemo(() => {
    const pages: Item[] = [
      { id: "p-o", label: "Overview", hint: "Page", icon: LayoutDashboard, run: () => go("overview") },
      { id: "p-t", label: "Tasks", hint: "Page", icon: FolderKanban, run: () => go("tasks") },
      { id: "p-k", label: "Tickets", hint: "Page", icon: Bug, run: () => go("tickets") },
      { id: "p-c", label: "Calendar", hint: "Page", icon: CalendarDays, run: () => go("calendar") },
      ...(admin ? [{ id: "p-i", label: "Interns", hint: "Page", icon: Users, run: () => go("interns") }, { id: "p-s", label: "Submissions", hint: "Page", icon: FileArchive, run: () => go("submissions") }] : []),
    ];
    const tasks: Item[] = data.tasks.map(t => ({ id: t.id, label: t.title, hint: "Task", icon: kindIcon(t.task_type), run: () => openTask(t) }));
    const tix: Item[] = data.tickets.map(t => ({ id: t.id, label: t.title, hint: `Ticket · ${t.application}`, icon: Bug, run: () => openTicket(t) }));
    const all = [...pages, ...tasks, ...tix]; const s = q.trim().toLowerCase();
    return (s ? all.filter(x => x.label.toLowerCase().includes(s)) : all).slice(0, 9);
  }, [q, data, admin]);
  useEffect(() => setI(0), [q]);
  const pick = (it?: Item) => { if (!it) return; close(); it.run(); };
  return <div className="backdrop pal-bg" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="palette" role="dialog" aria-modal="true" aria-label="Quick search"
      onKeyDown={e => {
        if (e.key === "Escape") close();
        if (e.key === "ArrowDown") { e.preventDefault(); setI(v => Math.min(v + 1, items.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setI(v => Math.max(v - 1, 0)); }
        if (e.key === "Enter") pick(items[i]);
      }}>
      <div className="pal-input"><Search size={17} /><input ref={input} placeholder="Jump to a page or task…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" /><kbd>Esc</kbd></div>
      <ul>{items.map((it, n) => <li key={it.id}><button className={n === i ? "on" : ""} onMouseEnter={() => setI(n)} onClick={() => pick(it)}>
        <it.icon size={16} /><span>{it.label}</span><small>{it.hint}</small>{n === i && <CornerDownLeft size={13} />}</button></li>)}
        {!items.length && <li className="pal-none">Nothing matches “{q}”.</li>}</ul>
    </div></div>;
}
