import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Bug, CalendarDays, FileArchive, Moon, Search, Sun, FolderKanban, LayoutDashboard, LogOut, Menu, RefreshCw, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { supabase, configured, arrivedViaInvite } from "./lib/supabase";
import { demoApi, resetDemo, supabaseApi } from "./lib/api";
import type { Api } from "./lib/api";
import { DEMO_ADMIN, DEMO_MEMBER, seedDemo } from "./lib/demo";
import type { Assignment, Data, Profile, Tab, Task, Ticket } from "./lib/types";
import { REVIEW, OPEN, ROLE_LABEL } from "./lib/utils";
import { Avatar, Brand, Skeleton, Toasts } from "./components/ui";
import type { ToastMsg } from "./components/ui";
import { Login, SetPassword } from "./views/Auth";
import { Overview } from "./views/Overview";
import { Tasks } from "./views/Tasks";
import { Detail } from "./views/Detail";
import { InternDetail, Interns, Reviews } from "./views/People";
import { Calendar } from "./views/Calendar";
import { Palette } from "./components/Palette";
import { TicketDetail, TicketModal, Tickets } from "./views/Tickets";
import { Bell } from "./components/Bell";
import { InternModal, TaskModal } from "./views/Modals";

const TABS: Tab[] = ["overview", "tasks", "tickets", "calendar", "interns", "submissions"];
const EMPTY: Data = { tasks: [], assignments: [], interns: [], members: [], tickets: [] };
type DemoRole = "admin" | "member" | "intern";
const readDemo = (): DemoRole | null => { try { return sessionStorage.getItem("vivakti-demo-role") as any; } catch { return null; } };

export default function App() {
  const [session, setSession] = useState<any>(null), [authReady, setAuthReady] = useState(!configured);
  const [profile, setProfile] = useState<Profile | null>(null), [profileError, setProfileError] = useState("");
  const [needPassword, setNeedPassword] = useState(arrivedViaInvite);
  const [demoRole, setDemoRole] = useState<DemoRole | null>(configured ? null : readDemo());

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setNeedPassword(true);
      if (!s) { setProfile(null); setProfileError(""); }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!configured || !session?.user) return;
    let live = true;
    (async () => {
      setProfileError("");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (!live) return;
      if (error || !data) setProfileError("We couldn't find your profile. Ask your administrator to check your invitation.");
      else setProfile(data as Profile);
    })();
    return () => { live = false; };
  }, [session?.user?.id]);

  const demoUser: Profile | null = useMemo(() => {
    if (!demoRole) return null;
    return demoRole === "admin" ? DEMO_ADMIN : demoRole === "member" ? DEMO_MEMBER : seedDemo().interns[0];
  }, [demoRole]);
  const me = configured ? profile : demoUser;
  const api: Api | null = useMemo(() => me ? (configured ? supabaseApi(me) : demoApi(me)) : null, [me?.id, me?.role]);

  async function signOut() {
    if (configured) await supabase.auth.signOut();
    else { try { sessionStorage.removeItem("vivakti-demo-role"); } catch { /* ignore */ } setDemoRole(null); }
  }
  function enterDemo(role: DemoRole) { try { sessionStorage.setItem("vivakti-demo-role", role); } catch { /* ignore */ } setDemoRole(role); }

  if (!authReady) return <div className="loading"><div className="spinner" />Opening workspace…</div>;
  if (configured && session && needPassword) return <SetPassword done={() => { setNeedPassword(false); history.replaceState(null, "", window.location.pathname); }} />;
  if (configured && !session) return <Login />;
  if (!configured && !demoUser) return <Login onDemo={enterDemo} />;
  if (configured && !profile) return <div className="loading">{profileError ? <><AlertCircle />{profileError}<button className="btn secondary" onClick={signOut}>Sign out</button></> : <><div className="spinner" />Loading your profile…</>}</div>;
  return <Workspace me={me!} api={api!} signOut={signOut} demo={!configured} switchDemo={enterDemo} />;
}

function Workspace({ me, api, signOut, demo, switchDemo }: { me: Profile; api: Api; signOut: () => void; demo: boolean; switchDemo: (r: DemoRole) => void }) {
  const isAdmin = me.role === "admin";
  const admin = me.role !== "intern"; // staff view: admins and members
  const [data, setData] = useState<Data>(EMPTY), [loaded, setLoaded] = useState(false), [loadError, setLoadError] = useState("");
  const [tab, setTabState] = useState<Tab>(() => { const v = new URLSearchParams(location.search).get("view") as Tab; return TABS.includes(v) ? v : "overview"; });
  const [modal, setModal] = useState<"task" | "intern" | null>(null), [editing, setEditing] = useState<Task | null>(null), [internView, setInternView] = useState<Profile | null>(null), [palette, setPalette] = useState(false), [ticketId, setTicketId] = useState<string | null>(null), [ticketModal, setTicketModal] = useState<{ ticket?: Ticket } | null>(null), [mobile, setMobile] = useState(false);
  const [detail, setDetail] = useState<{ task: string; assignment?: string } | null>(null);
  const [dark, setDark] = useState(() => { try { const v = localStorage.getItem("vivakti-theme"); return v ? v === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } });
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; try { localStorage.setItem("vivakti-theme", dark ? "dark" : "light"); } catch { /* ignore */ } }, [dark]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(p => !p); } };
    document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k);
  }, []);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const setTab = (t: Tab) => { setTabState(t); setMobile(false); window.scrollTo({ top: 0 }); history.replaceState(null, "", t === "overview" ? location.pathname : `?view=${t}`); };
  const toast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random(); setToasts(t => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === "err" ? 7000 : 3500);
  }, []);

  const reload = useCallback(async (quiet = false) => {
    try { setData(await api.load()); setLoadError(""); } catch (e: any) { if (!quiet) setLoadError(e.message || "Couldn't load your workspace."); }
    setLoaded(true);
  }, [api]);
  useEffect(() => { setLoaded(false); reload(); }, [reload]);
  useEffect(() => { // refresh when the tab regains focus, so admin and intern stay in sync
    const f = () => { if (document.visibilityState === "visible") reload(true); };
    document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f);
  }, [reload]);

  const act = useCallback(async (fn: () => Promise<void>, ok: string) => {
    try { await fn(); toast(ok); await reload(true); return true; }
    catch (e: any) { toast(e.message || "Something went wrong.", "err"); return false; }
  }, [reload, toast]);

  const open = (a: Assignment) => setDetail({ task: a.task_id, assignment: a.id });
  const openTask = (t: Task) => setDetail({ task: t.id });
  const openTicket = (t: Ticket) => setTicketId(t.id);
  const ticket = data.tickets.find(t => t.id === ticketId) || null;
  const pendingReview = data.assignments.filter(a => REVIEW.includes(a.status)).length;
  const openCount = data.assignments.filter(a => OPEN.includes(a.status)).length;

  const nav: { id: Tab; label: string; icon: any; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "tasks", label: "Tasks", icon: FolderKanban, badge: admin ? 0 : openCount },
    { id: "tickets", label: "Tickets", icon: Bug, badge: data.tickets.filter(t => t.status === "open" || t.status === "in_progress").length },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    ...(admin ? [{ id: "interns" as Tab, label: isAdmin ? "People" : "Interns", icon: Users }, { id: "submissions" as Tab, label: "Submissions", icon: FileArchive, badge: pendingReview }] : []),
  ];
  const current = admin || ["overview", "tasks", "tickets", "calendar"].includes(tab) ? tab : "overview";

  return <div className="shell">
    <a className="skip" href="#main">Skip to content</a>
    <aside className={`sidebar ${mobile ? "open" : ""}`}>
      <div className="side-top"><Brand /><button className="icon mobile-close" onClick={() => setMobile(false)} aria-label="Close menu"><X /></button></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main">{nav.map(n => <button key={n.id} className={`nav-item ${current === n.id ? "active" : ""}`} aria-current={current === n.id ? "page" : undefined} onClick={() => setTab(n.id)}>
        <n.icon size={18} />{n.label}{!!n.badge && <span className="badge">{n.badge}</span>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="privacy"><ShieldCheck size={17} /><div><b>Private workspace</b><span>Your work stays within Vivakti.</span></div></div>
        <div className="user"><Avatar name={me.full_name || me.email} /><div className="user-copy"><b>{me.full_name || me.email}</b><span>{ROLE_LABEL[me.role]}</span></div>
          <button className="icon" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></div>
      </div>
    </aside>
    {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
    <main className="main" id="main">
      {demo && <div className="demo-bar"><Sparkles size={14} /><span>Demo mode · changes stay in this browser</span>
        {(["admin", "member", "intern"] as const).filter(r => r !== me.role).map(r => <button key={r} onClick={() => switchDemo(r)}>Switch to {r} view</button>)}
        <button onClick={() => { resetDemo(); reload(); toast("Demo data reset."); }}>Reset data</button></div>}
      <header className="topbar">
        <button className="icon mobile-menu" onClick={() => setMobile(true)} aria-label="Open menu"><Menu /></button>
        <div className="crumb">Vivakti <span>/</span> <b>{nav.find(n => n.id === current)?.label}</b></div>
        <div className="top-right"><button className="kbd-btn" onClick={() => setPalette(true)} aria-label="Quick search"><Search size={14} />Search<kbd>Ctrl K</kbd></button>
          <button className="icon" onClick={() => setDark(d => !d)} title={dark ? "Light mode" : "Dark mode"} aria-label="Toggle theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <Bell me={me} admin={admin} list={data.assignments} tickets={data.tickets} open={open} openTicket={openTicket} />
          <button className="icon" onClick={() => reload().then(() => toast("Up to date."))} title="Refresh" aria-label="Refresh"><RefreshCw size={16} /></button>
          <span className="role">{me.role.toUpperCase()}</span><Avatar name={me.full_name || me.email} size={30} /></div>
      </header>
      {!loaded ? <Skeleton /> : loadError ? <div className="page"><div className="panel err-panel"><AlertCircle /><div><b>Couldn't load your workspace</b><p>{loadError}</p></div><button className="btn secondary" onClick={() => { setLoaded(false); reload(); }}>Try again</button></div></div>
        : <div className="page" key={current}>
          {current === "overview" && <Overview me={me} admin={admin} data={data} go={setTab} newTask={() => setModal("task")} open={open} openTicket={openTicket} />}
          {current === "tickets" && <Tickets isAdmin={isAdmin} data={data} open={openTicket} raise={() => setTicketModal({})} />}
          {current === "tasks" && <Tasks admin={admin} data={data} newTask={() => setModal("task")} open={open} openTask={openTask} />}
          {current === "calendar" && <Calendar admin={admin} data={data} open={open} openTask={openTask} />}
          {current === "interns" && admin && <Interns data={data} invite={() => setModal("intern")} view={setInternView} isAdmin={isAdmin} />}
          {current === "submissions" && admin && <Reviews data={data} api={api} act={act} />}
        </div>}
    </main>
    {detail && <Detail admin={admin} data={data} target={detail} api={api} act={act} close={() => setDetail(null)} goReview={() => setTab("submissions")} edit={setEditing} meId={me.id} />}
    {internView && <InternDetail intern={internView} data={data} close={() => setInternView(null)} open={open} />}
    {palette && <Palette admin={admin} data={data} go={setTab} openTicket={openTicket} openTask={t => admin ? openTask(t) : open(data.assignments.find(a => a.task_id === t.id)!)} close={() => setPalette(false)} />}
    {modal === "task" && <TaskModal interns={data.interns} api={api} close={() => setModal(null)} done={async () => { setModal(null); toast("Task created and assigned."); await reload(true); }} />}
    {editing && <TaskModal task={editing} assignedIds={data.assignments.filter(a => a.task_id === editing.id).map(a => a.intern_id)} interns={data.interns} api={api} close={() => setEditing(null)} done={async () => { setEditing(null); toast("Task updated."); await reload(true); }} />}
    {ticket && <TicketDetail ticket={ticket} isAdmin={isAdmin} me={me} api={api} act={act} close={() => setTicketId(null)} edit={t => setTicketModal({ ticket: t })} />}
    {ticketModal && <TicketModal ticket={ticketModal.ticket} people={[...data.members, ...data.interns]} apps={[...new Set(data.tickets.map(t => t.application))]} api={api} close={() => setTicketModal(null)}
      done={async () => { const edited = !!ticketModal.ticket; setTicketModal(null); toast(edited ? "Ticket updated." : "Ticket raised."); await reload(true); }} />}
    {modal === "intern" && <InternModal api={api} close={() => setModal(null)} done={async () => { setModal(null); toast("Invitation sent."); await reload(true); }} />}
    <Toasts items={toasts} dismiss={id => setToasts(t => t.filter(x => x.id !== id))} />
  </div>;
}
