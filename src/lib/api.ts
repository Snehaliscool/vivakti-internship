import { supabase } from "./supabase";
import { seedDemo } from "./demo";
import type { Assignment, Data, NewTask, NewTicket, Profile, Status, Submission, Ticket, TicketStatus } from "./types";

export interface Api {
  load(): Promise<Data>;
  setStatus(id: string, status: Status): Promise<void>;
  review(id: string, status: "approved" | "revision_requested", message: string): Promise<void>;
  createTask(task: NewTask, internIds: string[]): Promise<void>;
  updateTask(id: string, patch: NewTask, addInternIds: string[]): Promise<void>;
  deleteTask(id: string): Promise<void>;
  invite(email: string, name: string, role: "intern" | "member"): Promise<void>;
  createTicket(t: NewTicket, assignees: Profile[]): Promise<void>;
  updateTicket(id: string, t: NewTicket, assignees: Profile[]): Promise<void>;
  setTicketStatus(id: string, status: TicketStatus): Promise<void>;
  deleteTicket(id: string): Promise<void>;
  addTicketComment(id: string, body: string): Promise<void>;
  submit(a: Assignment, file: File, note: string): Promise<void>;
  addComment(assignmentId: string, body: string): Promise<void>;
  download(s: Submission): Promise<void>;
}

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

/** Real backend: Supabase Postgres + Storage + Edge Function. Row-level security does the enforcing. */
export function supabaseApi(me: Profile): Api {
  const name = me.full_name || me.email;
  const loadTasks = async (withComments: boolean) => {
    const c = withComments ? ",comments(*)" : "";
    const byNew = { ascending: false };
    if (me.role === "intern") {
      const { data, error } = await supabase.from("task_assignments").select("*,task:tasks(*),submissions(*),feedback(*)" + c).eq("intern_id", me.id).order("created_at", byNew);
      fail(error);
      const rows = ((data || []) as unknown as Assignment[]).filter(x => x.task);
      return { tasks: rows.map(r => r.task), assignments: rows, interns: [] as Profile[] };
    }
    // Admins see everything; members only see the tasks they created (enforced by RLS).
    const [t, a, i] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", byNew),
      supabase.from("task_assignments").select("*,task:tasks(*),intern:profiles!task_assignments_intern_id_fkey(*),submissions(*),feedback(*)" + c).order("created_at", byNew),
      supabase.from("profiles").select("*").eq("role", "intern").order("created_at", byNew),
    ]);
    fail(t.error); fail(a.error); fail(i.error);
    return { tasks: t.data || [], assignments: (a.data || []) as unknown as Assignment[], interns: (i.data || []) as Profile[] };
  };
  // Optional pieces degrade gracefully if their migration hasn't been applied yet.
  const loadTickets = async (): Promise<Ticket[]> => {
    const { data, error } = await supabase.from("tickets").select("*,assignees:ticket_assignees(*),comments:ticket_comments(*)").order("created_at", { ascending: false });
    return error ? [] : (data || []) as unknown as Ticket[];
  };
  const loadMembers = async (): Promise<Profile[]> => {
    if (me.role !== "admin") return [];
    const { data, error } = await supabase.from("profiles").select("*").eq("role", "member").order("created_at", { ascending: false });
    return error ? [] : (data || []) as Profile[];
  };
  return {
    async load() {
      let base;
      // Works before migration 0003 (comments table) has been applied.
      try { base = await loadTasks(true); } catch (e: any) { if (/comments/i.test(e.message || "")) base = await loadTasks(false); else throw e; }
      const [tickets, members] = await Promise.all([loadTickets(), loadMembers()]);
      return { ...base, members, tickets };
    },
    async setStatus(id, status) {
      fail((await supabase.from("task_assignments").update({ status }).eq("id", id)).error);
    },
    async review(id, status, message) {
      fail((await supabase.from("feedback").insert({ assignment_id: id, admin_id: me.id, message, action: status })).error);
      fail((await supabase.from("task_assignments").update({ status }).eq("id", id)).error);
    },
    async createTask(task, internIds) {
      let res = await supabase.from("tasks").insert({ ...task, created_by: me.id, created_by_name: name }).select().single();
      if (res.error && /created_by_name/.test(res.error.message)) res = await supabase.from("tasks").insert({ ...task, created_by: me.id }).select().single(); // before migration 0004
      fail(res.error);
      const { error: e2 } = await supabase.from("task_assignments").insert(internIds.map(intern_id => ({ task_id: res.data!.id, intern_id })));
      if (e2) { await supabase.from("tasks").delete().eq("id", res.data!.id); throw new Error(e2.message); }
    },
    async updateTask(id, patch, add) {
      fail((await supabase.from("tasks").update(patch).eq("id", id)).error);
      if (add.length) fail((await supabase.from("task_assignments").insert(add.map(intern_id => ({ task_id: id, intern_id })))).error);
    },
    async deleteTask(id) { fail((await supabase.from("tasks").delete().eq("id", id)).error); },
    async invite(email, full_name, role) {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-intern", {
        body: { email, full_name, role }, headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Invitation failed.");
    },
    async createTicket(t, assignees) {
      const { data, error } = await supabase.from("tickets").insert({ ...t, created_by: me.id, created_by_name: name }).select().single();
      fail(error);
      if (assignees.length) {
        const { error: e2 } = await supabase.from("ticket_assignees").insert(assignees.map(p => ({ ticket_id: data!.id, user_id: p.id, user_name: p.full_name || p.email, user_role: p.role })));
        if (e2) { await supabase.from("tickets").delete().eq("id", data!.id); throw new Error(e2.message); }
      }
    },
    async updateTicket(id, t, assignees) {
      fail((await supabase.from("tickets").update(t).eq("id", id)).error);
      const cur = await supabase.from("ticket_assignees").select("user_id").eq("ticket_id", id);
      fail(cur.error);
      const have = new Set((cur.data || []).map(r => r.user_id as string)), want = new Set(assignees.map(p => p.id));
      const drop = [...have].filter(x => !want.has(x));
      if (drop.length) fail((await supabase.from("ticket_assignees").delete().eq("ticket_id", id).in("user_id", drop)).error);
      const add = assignees.filter(p => !have.has(p.id));
      if (add.length) fail((await supabase.from("ticket_assignees").insert(add.map(p => ({ ticket_id: id, user_id: p.id, user_name: p.full_name || p.email, user_role: p.role })))).error);
    },
    async setTicketStatus(id, status) { fail((await supabase.from("tickets").update({ status }).eq("id", id)).error); },
    async deleteTicket(id) { fail((await supabase.from("tickets").delete().eq("id", id)).error); },
    async addTicketComment(ticket_id, body) {
      fail((await supabase.from("ticket_comments").insert({ ticket_id, author_id: me.id, author_name: name, author_role: me.role, body })).error);
    },
    async submit(a, file, note) {
      const path = `${me.id}/${a.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const up = await supabase.storage.from("intern-submissions").upload(path, file, { contentType: "application/zip", upsert: false });
      fail(up.error);
      const ins = await supabase.from("submissions").insert({ assignment_id: a.id, intern_id: me.id, storage_path: path, file_name: file.name, file_size: file.size, note });
      if (ins.error) { await supabase.storage.from("intern-submissions").remove([path]); throw new Error(ins.error.message); }
      fail((await supabase.from("task_assignments").update({ status: "submitted" }).eq("id", a.id)).error);
    },
    async addComment(assignment_id, body) {
      fail((await supabase.from("comments").insert({ assignment_id, author_id: me.id, author_name: name, author_role: me.role, body })).error);
    },
    async download(s) {
      const { data, error } = await supabase.storage.from("intern-submissions").createSignedUrl(s.storage_path, 60, { download: s.file_name });
      fail(error);
      window.open(data!.signedUrl, "_blank", "noopener,noreferrer");
    },
  };
}

/** In-browser demo so the portal can be explored without any backend. Persists in localStorage. */
export function demoApi(me: Profile): Api {
  const KEY = "vivakti-demo-v3";
  const read = (): Data => {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    const { admin: _a, ...d } = seedDemo(); return d;
  };
  let db: Data = read();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } };
  const wait = () => new Promise(r => setTimeout(r, 180));
  const find = (id: string) => db.assignments.find(a => a.id === id)!;
  const ticket = (id: string) => db.tickets.find(t => t.id === id)!;
  const uid = () => Math.random().toString(36).slice(2, 10);
  const now = () => new Date().toISOString();
  const toAssignees = (id: string, list: Profile[]) => list.map(p => ({ ticket_id: id, user_id: p.id, user_name: p.full_name, user_role: p.role }));
  return {
    async load() {
      await wait(); db = read();
      const myTickets = me.role === "admin" ? db.tickets : db.tickets.filter(t => t.assignees.some(a => a.user_id === me.id));
      if (me.role === "admin") return structuredClone(db);
      if (me.role === "member") {
        const own = db.tasks.filter(t => t.created_by === me.id), ids = new Set(own.map(t => t.id));
        return structuredClone({ tasks: own, assignments: db.assignments.filter(a => ids.has(a.task_id)), interns: db.interns, members: [], tickets: myTickets });
      }
      const mine = db.assignments.filter(a => a.intern_id === me.id);
      return structuredClone({ tasks: mine.map(a => a.task), assignments: mine.map(a => ({ ...a, intern: undefined })), interns: [], members: [], tickets: myTickets });
    },
    async setStatus(id, status) { await wait(); find(id).status = status; save(); },
    async review(id, status, message) {
      await wait(); const a = find(id); a.status = status;
      (a.feedback ||= []).push({ id: uid(), assignment_id: id, admin_id: me.id, message, action: status, created_at: now() });
      save();
    },
    async createTask(task, internIds) {
      await wait(); const t = { ...task, id: uid(), created_at: now(), created_by: me.id, created_by_name: me.full_name };
      db.tasks.unshift(t);
      for (const iid of internIds) db.assignments.unshift({ id: uid(), task_id: t.id, intern_id: iid, status: "assigned", created_at: t.created_at, task: t, intern: db.interns.find(i => i.id === iid), submissions: [], feedback: [] });
      save();
    },
    async updateTask(id, patch, add) {
      await wait(); const t = db.tasks.find(x => x.id === id)!; Object.assign(t, patch);
      db.assignments.forEach(a => { if (a.task_id === id) a.task = t; });
      for (const iid of add) db.assignments.unshift({ id: uid(), task_id: id, intern_id: iid, status: "assigned", created_at: now(), task: t, intern: db.interns.find(i => i.id === iid), submissions: [], feedback: [] });
      save();
    },
    async deleteTask(id) { await wait(); db.tasks = db.tasks.filter(t => t.id !== id); db.assignments = db.assignments.filter(a => a.task_id !== id); save(); },
    async invite(email, full_name, role) {
      await wait();
      if ([...db.interns, ...db.members].some(i => i.email === email)) throw new Error("That email is already invited.");
      (role === "member" ? db.members : db.interns).unshift({ id: uid(), full_name, email, role, created_at: now() }); save();
    },
    async createTicket(t, assignees) {
      await wait(); const id = uid();
      db.tickets.unshift({ ...t, id, status: "open", created_by: me.id, created_by_name: me.full_name, created_at: now(), updated_at: now(), assignees: toAssignees(id, assignees), comments: [] }); save();
    },
    async updateTicket(id, t, assignees) { await wait(); const x = ticket(id); Object.assign(x, t, { updated_at: now(), assignees: toAssignees(id, assignees) }); save(); },
    async setTicketStatus(id, status) { await wait(); const x = ticket(id); x.status = status; x.updated_at = now(); save(); },
    async deleteTicket(id) { await wait(); db.tickets = db.tickets.filter(t => t.id !== id); save(); },
    async addTicketComment(id, body) {
      await wait(); ticket(id).comments.push({ id: uid(), ticket_id: id, author_id: me.id, author_name: me.full_name, author_role: me.role, body, created_at: now() }); save();
    },
    async submit(a, file, note) {
      await wait(); const row = find(a.id);
      (row.submissions ||= []).push({ id: uid(), assignment_id: a.id, intern_id: row.intern_id, storage_path: `demo/${file.name}`, file_name: file.name, file_size: file.size, note, created_at: now() });
      row.status = "submitted"; save();
    },
    async addComment(id, body) {
      await wait(); (find(id).comments ||= []).push({ id: uid(), assignment_id: id, author_id: me.id, author_name: me.full_name, author_role: me.role, body, created_at: now() }); save();
    },
    async download() { throw new Error("Demo mode: no real file is stored. Connect Supabase to download submissions."); },
  };
}

export const resetDemo = () => { try { localStorage.removeItem("vivakti-demo-v3"); } catch { /* ignore */ } };
