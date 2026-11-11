import type { Assignment, Status } from "./types";

export const STATUS_LABEL: Record<string, string> = {
  assigned: "To do", in_progress: "In progress", submitted: "Awaiting review",
  under_review: "Under review", revision_requested: "Needs revision", approved: "Approved",
};
export const KIND_LABEL: Record<string, string> = {
  project: "Project", website: "Website reading", youtube: "YouTube video", general: "General task",
};
export const OPEN: Status[] = ["assigned", "in_progress", "revision_requested"];
export const REVIEW: Status[] = ["submitted", "under_review"];

export const parseDay = (d: string) => { const [y, m, day] = d.split("-").map(Number); return new Date(y, m - 1, day); };
export const startOfToday = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
export const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fmtDay = (d: string) => parseDay(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const fmtSize = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
export const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join("") || "?";
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export function relTime(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export type Due = { label: string; tone: "overdue" | "soon" | "ok" | "none" | "done" };
export function dueInfo(due: string | null, status?: string): Due {
  if (!due) return { label: "No deadline", tone: "none" };
  if (status === "approved") return { label: `Due ${fmtDay(due)}`, tone: "done" };
  const days = Math.round((parseDay(due).getTime() - startOfToday().getTime()) / 864e5);
  if (days < 0) return { label: days === -1 ? "Overdue by 1 day" : `Overdue by ${-days} days`, tone: "overdue" };
  if (days === 0) return { label: "Due today", tone: "soon" };
  if (days === 1) return { label: "Due tomorrow", tone: "soon" };
  if (days <= 3) return { label: `Due in ${days} days`, tone: "soon" };
  return { label: `Due ${fmtDay(due)}`, tone: "ok" };
}

export const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
export function byUrgency(a: Assignment, b: Assignment) {
  const da = a.task.due_date ? parseDay(a.task.due_date).getTime() : Infinity;
  const db = b.task.due_date ? parseDay(b.task.due_date).getTime() : Infinity;
  return da - db || PRIORITY_RANK[a.task.priority] - PRIORITY_RANK[b.task.priority];
}
export const latestSubmission = (a: Assignment) =>
  [...(a.submissions || [])].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
export const progressOf = (list: Assignment[]) =>
  list.length ? Math.round((list.filter(a => a.status === "approved").length / list.length) * 100) : 0;
export const latestFeedback = (a: Assignment) =>
  [...(a.feedback || [])].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];

export const TICKET_STATUS: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
export const TICKET_KIND: Record<string, string> = { bug: "Bug", improvement: "Improvement", feature: "Feature", build: "Build task" };
export const TICKET_PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const ROLE_LABEL: Record<string, string> = { admin: "Administrator", member: "Member", intern: "Intern" };
