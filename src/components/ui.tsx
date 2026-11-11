import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, FileText, FolderKanban, Link2, PlayCircle, X } from "lucide-react";
import type { Assignment, Task } from "../lib/types";
import { KIND_LABEL, STATUS_LABEL, dueInfo, initials } from "../lib/utils";

export const kindIcon = (t: string) => t === "website" ? Link2 : t === "youtube" ? PlayCircle : t === "project" ? FolderKanban : FileText;

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>{initials(name)}</div>;
}
export function Status({ status }: { status: string }) {
  return <span className={`status s-${status}`}><i />{STATUS_LABEL[status] || status}</span>;
}
export function Priority({ p }: { p: string }) {
  return <span className={`priority ${p}`}><i />{p}</span>;
}
export function Due({ task, status }: { task: Task; status?: string }) {
  const d = dueInfo(task.due_date, status);
  return <span className={`due ${d.tone}`}>{d.label}</span>;
}
export function KindBadge({ kind }: { kind: string }) {
  const I = kindIcon(kind);
  return <div className="type-icon" title={KIND_LABEL[kind]}><I size={18} /></div>;
}
export function Progress({ value, label }: { value: number; label?: string }) {
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div style={{ width: `${value}%` }} /></div>;
}
export function Empty({ icon: Icon, title, text, action }: { icon: any; title: string; text: string; action?: ReactNode }) {
  return <div className="empty"><div><Icon size={21} /></div><b>{title}</b><p>{text}</p>{action}</div>;
}
export function Heading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
export function Brand({ centered }: { centered?: boolean }) {
  return <div className={`brand ${centered ? "centered" : ""}`}><div className="mark">v.</div><div><b>vivakti</b><small>INTERNSHIP WORKSPACE</small></div></div>;
}
export function Stat({ icon: Icon, label, value, note, tone }: { icon: any; label: string; value: ReactNode; note: string; tone?: string }) {
  return <div className={`stat ${tone || ""}`}><div className="stat-top"><span>{label}</span><Icon size={18} /></div><b>{value}</b><small>{note}</small></div>;
}
export function Skeleton() {
  return <div className="page"><div className="sk sk-h" /><div className="stats">{[0, 1, 2, 3].map(i => <div key={i} className="sk sk-card" />)}</div><div className="sk sk-panel" /></div>;
}

/** Locks scroll, traps Escape, restores focus. Used by Modal and Drawer. */
function useOverlay(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),textarea,select,[tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("input,textarea,select");
    (first || ref.current)?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, []); // eslint-disable-line
  return ref;
}
export function Modal({ title, subtitle, close, children }: { title: string; subtitle?: string; close: () => void; children: ReactNode }) {
  const ref = useOverlay(close);
  return <div className="backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
      <div className="modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon" onClick={close} aria-label="Close"><X /></button></div>
      {children}
    </div></div>;
}
export function Drawer({ close, children, label }: { close: () => void; children: ReactNode; label: string }) {
  const ref = useOverlay(close);
  return <div className="backdrop drawer-bg" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>
      <button className="icon drawer-x" onClick={close} aria-label="Close"><X /></button>{children}
    </aside></div>;
}

export type ToastMsg = { id: number; text: string; kind: "ok" | "err" };
export function Toasts({ items, dismiss }: { items: ToastMsg[]; dismiss: (id: number) => void }) {
  return <div className="toasts" aria-live="polite">{items.map(t =>
    <div key={t.id} className={`toast ${t.kind}`} role="status">
      {t.kind === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}<span>{t.text}</span>
      <button onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
    </div>)}</div>;
}

export const taskText = (a: Assignment | Task) => {
  const t = "task" in a ? a.task : a;
  return `${t.title} ${t.description}`.toLowerCase();
};
