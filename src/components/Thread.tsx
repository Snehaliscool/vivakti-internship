import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Avatar } from "./ui";
import { relTime } from "../lib/utils";

type Msg = { id: string; author_id: string; author_name: string; author_role: string; body: string; created_at: string };

export function Thread({ comments, send, me }: { comments: Msg[]; send: (body: string) => Promise<boolean>; me: string }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const list = [...comments].sort((x, y) => x.created_at.localeCompare(y.created_at));
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [list.length]);
  async function go() {
    const body = text.trim(); if (!body) return; setBusy(true);
    if (await send(body)) setText("");
    setBusy(false);
  }
  return <div className="thread">
    {list.length === 0 && <p className="muted thread-empty">No messages yet. Ask a question or share an update.</p>}
    {list.map(c => <div key={c.id} className={`msg ${c.author_id === me ? "mine" : ""}`}><Avatar name={c.author_name} size={26} />
      <div><div className="msg-top"><b>{c.author_name}</b>{c.author_role !== "intern" && <em>{c.author_role === "admin" ? "Admin" : "Member"}</em>}<small>{relTime(c.created_at)}</small></div><p>{c.body}</p></div></div>)}
    <div ref={end} />
    <div className="composer"><textarea rows={2} placeholder="Write a message…" value={text} maxLength={1000} aria-label="Message"
      onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) go(); }} />
      <button className="btn primary small" disabled={!text.trim() || busy} onClick={go}><Send size={14} /> Send</button></div>
  </div>;
}
