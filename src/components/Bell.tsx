import { useEffect, useMemo, useRef, useState } from "react";
import { Bell as BellIcon } from "lucide-react";
import type { Assignment, Profile, Ticket } from "../lib/types";
import { buildNotices, readSeen, writeSeen } from "../lib/notify";
import { relTime } from "../lib/utils";

export function Bell({ me, admin, list, tickets, open, openTicket }: { me: Profile; admin: boolean; list: Assignment[]; tickets: Ticket[]; open: (a: Assignment) => void; openTicket: (t: Ticket) => void }) {
  const [show, setShow] = useState(false), [seen, setSeen] = useState(() => readSeen(me.id));
  const ref = useRef<HTMLDivElement>(null);
  const notices = useMemo(() => buildNotices(me, admin, list, tickets), [me, admin, list, tickets]);
  const unread = notices.filter(n => new Date(n.at).getTime() > seen).length;
  useEffect(() => {
    if (!show) return;
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [show]);
  function close() { setShow(false); writeSeen(me.id); setSeen(Date.now()); }
  return <div className="bell" ref={ref}>
    <button className="icon" onClick={() => (show ? close() : setShow(true))} aria-label={`Notifications${unread ? `, ${unread} new` : ""}`} aria-expanded={show}>
      <BellIcon size={17} />{unread > 0 && <span className="dot-n">{unread > 9 ? "9+" : unread}</span>}</button>
    {show && <div className="pop" role="menu"><div className="pop-head"><b>Notifications</b></div>
      {notices.length ? <ul>{notices.map(n => <li key={n.id}><button onClick={() => { close(); if (n.t) openTicket(n.t); else if (n.a) open(n.a); }} className={new Date(n.at).getTime() > seen ? "new" : ""}>
        <div><b>{n.title}</b><span>{n.text}</span></div><small>{relTime(n.at)}</small></button></li>)}</ul>
        : <p className="muted pop-empty">You're all caught up.</p>}</div>}
  </div>;
}
