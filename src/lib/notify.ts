import type { Assignment, Profile, Ticket } from "./types";
import { OPEN, dueInfo, startOfToday } from "./utils";

export type Notice = { id: string; at: string; title: string; text: string; a?: Assignment; t?: Ticket };

export function buildNotices(me: Profile, admin: boolean, list: Assignment[], tickets: Ticket[] = []): Notice[] {
  const out: Notice[] = [];
  for (const t of tickets) {
    if (me.role !== "admin" && t.created_by !== me.id) out.push({ id: `tk${t.id}`, at: t.created_at, title: "Ticket assigned to you", text: `${t.application}: ${t.title}`, t });
    for (const c of t.comments) if (c.author_id !== me.id) out.push({ id: `tc${c.id}`, at: c.created_at, title: `${c.author_name} commented on a ticket`, text: `${t.title}: ${c.body}`, t });
    if (me.role === "admin" && t.status === "resolved") out.push({ id: `tr${t.id}-${t.updated_at}`, at: t.updated_at, title: "Ticket marked resolved", text: `${t.application}: ${t.title}`, t });
  }
  for (const a of list) {
    const who = a.intern?.full_name || "An intern";
    if (admin) {
      for (const s of a.submissions || []) out.push({ id: `s${s.id}`, at: s.created_at, title: `${who} submitted work`, text: a.task.title, a });
      for (const c of a.comments || []) if (c.author_role === "intern") out.push({ id: `c${c.id}`, at: c.created_at, title: `${c.author_name} commented`, text: c.body, a });
    } else {
      for (const f of a.feedback || []) out.push({ id: `f${f.id}`, at: f.created_at, title: f.action === "approved" ? "Your work was approved" : "Revision requested", text: `${a.task.title}: ${f.message}`, a });
      for (const c of a.comments || []) if (c.author_role === "admin") out.push({ id: `c${c.id}`, at: c.created_at, title: "New reply from your admin", text: c.body, a });
      if (OPEN.includes(a.status)) {
        const d = dueInfo(a.task.due_date, a.status);
        if (d.tone === "overdue" || d.tone === "soon") out.push({ id: `d${a.id}-${d.label}`, at: startOfToday().toISOString(), title: d.label, text: a.task.title, a });
      }
    }
  }
  return out.sort((x, y) => y.at.localeCompare(x.at)).slice(0, 25);
}

const key = (id: string) => `vivakti-seen-${id}`;
export function readSeen(id: string): number {
  try { const v = localStorage.getItem(key(id)); return v ? Number(v) : Date.now() - 7 * 864e5; } catch { return Date.now() - 7 * 864e5; }
}
export function writeSeen(id: string) { try { localStorage.setItem(key(id), String(Date.now())); } catch { /* ignore */ } }
