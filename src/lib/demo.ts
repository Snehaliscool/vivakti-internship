import type { Assignment, Comment, Data, Feedback, Profile, Submission, Task, Ticket } from "./types";
import { toDay } from "./utils";

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return toDay(d); };
const ago = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();

export const DEMO_ADMIN: Profile = { id: "u-admin", full_name: "Aarav Mehta", email: "aarav@vivakti.demo", role: "admin", created_at: ago(24 * 90) };
export const DEMO_INTERN_ID = "u-isha";
export const DEMO_MEMBER: Profile = { id: "u-priya", full_name: "Priya Sharma", email: "priya@vivakti.demo", role: "member", created_at: ago(24 * 60) };

export function seedDemo(): Data & { admin: Profile } {
  const members: Profile[] = [DEMO_MEMBER, { id: "u-dev", full_name: "Dev Patel", email: "dev@vivakti.demo", role: "member", created_at: ago(24 * 45) }];
  const interns: Profile[] = [
    { id: "u-isha", full_name: "Isha Nair", email: "isha@vivakti.demo", role: "intern", created_at: ago(24 * 40) },
    { id: "u-rohan", full_name: "Rohan Gupta", email: "rohan@vivakti.demo", role: "intern", created_at: ago(24 * 38) },
    { id: "u-meera", full_name: "Meera Iyer", email: "meera@vivakti.demo", role: "intern", created_at: ago(24 * 21) },
    { id: "u-kabir", full_name: "Kabir Shah", email: "kabir@vivakti.demo", role: "intern", created_at: ago(24 * 9) },
  ];
  const mk = (id: string, title: string, description: string, task_type: Task["task_type"], priority: Task["priority"], due: number | null, url: string | null, age: number): Task =>
    ({ id, title, description, task_type, priority, due_date: due === null ? null : day(due), resource_url: url, created_at: ago(age), created_by: "u-admin", created_by_name: "Aarav Mehta" });
  const tasks: Task[] = [
    mk("t1", "Competitor landscape brief", "Research five direct competitors. For each, capture positioning, pricing and one thing they do better than us.\n\nDeliver a short ZIP with a PDF summary and your source notes.", "project", "high", -2, null, 24 * 12),
    mk("t2", "Read: How Notion thinks about onboarding", "Read the article and write three takeaways we could apply to our own intern onboarding. Keep it under 300 words.", "website", "medium", 2, "https://www.notion.so/blog", 24 * 8),
    mk("t3", "Watch: Design systems in 20 minutes", "Watch the talk and sketch how our brand colours and type could become a minimal design system.", "youtube", "medium", 5, "https://www.youtube.com/", 24 * 6),
    mk("t4", "Landing page copy audit", "Review the current landing page and mark every sentence that is vague, jargon-heavy or buries the value. Propose rewrites for the top five.", "project", "high", 1, null, 24 * 5),
    mk("t5", "Weekly learning log", "Keep a running log of what you learned this week. Bullet points are fine.", "general", "low", null, null, 24 * 3),
    mk("t6", "Customer interview synthesis", "Cluster the eight interview transcripts into themes and pull three quotes per theme.", "project", "medium", 9, null, 24 * 2),
  ];
  for (const id of ["t2", "t3", "t6"]) { const t = tasks.find(x => x.id === id)!; t.created_by = "u-priya"; t.created_by_name = "Priya Sharma"; }
  const sub = (id: string, assignment_id: string, intern_id: string, file_name: string, size: number, note: string, hours: number): Submission =>
    ({ id, assignment_id, intern_id, storage_path: `demo/${file_name}`, file_name, file_size: size, note, created_at: ago(hours) });
  const fb = (id: string, assignment_id: string, message: string, action: Feedback["action"], hours: number): Feedback =>
    ({ id, assignment_id, admin_id: "u-admin", message, action, created_at: ago(hours) });
  const cm = (id: string, assignment_id: string, who: "admin" | "intern", name: string, body: string, hours: number): Comment =>
    ({ id, assignment_id, author_id: who === "admin" ? "u-admin" : "u-isha", author_name: name, author_role: who, body, created_at: ago(hours) });
  const A = (id: string, task: string, intern: string, status: Assignment["status"], extra: Partial<Assignment> = {}): Assignment => {
    const t = tasks.find(x => x.id === task)!; const p = interns.find(x => x.id === intern)!;
    return { id, task_id: task, intern_id: intern, status, created_at: t.created_at, task: t, intern: p, submissions: [], feedback: [], comments: [], ...extra };
  };
  const assignments: Assignment[] = [
    A("a1", "t1", "u-isha", "revision_requested", {
      submissions: [sub("s1", "a1", "u-isha", "competitor-brief-v1.zip", 4_200_000, "First pass, covers four of five competitors.", 30)],
      feedback: [fb("f1", "a1", "Strong structure. Please add the fifth competitor and cite pricing sources for each.", "revision_requested", 6)],
      comments: [cm("c1", "a1", "intern", "Isha Nair", "Should pricing include enterprise tiers or just the public plans?", 20), cm("c2", "a1", "admin", "Aarav Mehta", "Public plans are fine. Note any \"contact sales\" tiers separately.", 18)],
    }),
    A("a2", "t1", "u-rohan", "submitted", { submissions: [sub("s2", "a2", "u-rohan", "competitors-rohan.zip", 8_900_000, "All five covered, pricing sheet included.", 3)] }),
    A("a3", "t2", "u-isha", "in_progress"),
    A("a4", "t2", "u-meera", "assigned"),
    A("a5", "t3", "u-isha", "assigned"),
    A("a6", "t3", "u-rohan", "approved", {
      submissions: [sub("s3", "a6", "u-rohan", "design-system-sketch.zip", 2_100_000, "Colour and type tokens plus two component sketches.", 70)],
      feedback: [fb("f2", "a6", "Approved. Good work.", "approved", 48)],
    }),
    A("a7", "t4", "u-meera", "submitted", { submissions: [sub("s4", "a7", "u-meera", "copy-audit.zip", 1_300_000, "Marked up PDF and rewrites in a doc.", 9)] }),
    A("a8", "t4", "u-kabir", "in_progress"),
    A("a9", "t5", "u-isha", "approved", {
      submissions: [sub("s5", "a9", "u-isha", "learning-log-week1.zip", 300_000, "", 120)],
      feedback: [fb("f3", "a9", "Lovely, specific reflections.", "approved", 100)],
    }),
    A("a10", "t5", "u-kabir", "assigned"),
    A("a11", "t6", "u-meera", "in_progress"),
    A("a12", "t6", "u-isha", "assigned"),
  ];
  const asg = (ticket_id: string, p: Profile) => ({ ticket_id, user_id: p.id, user_name: p.full_name, user_role: p.role });
  const tk = (id: string, application: string, title: string, description: string, kind: Ticket["kind"], priority: Ticket["priority"], status: Ticket["status"], who: Profile[], h: number, extra: Partial<Ticket> = {}): Ticket => ({
    id, application, title, description, kind, priority, status, reference_url: null, due_date: null, created_by: "u-admin", created_by_name: "Aarav Mehta",
    created_at: ago(h), updated_at: ago(h / 2), assignees: who.map(p => asg(id, p)), comments: [], ...extra });
  const tickets: Ticket[] = [
    tk("k1", "Orbit Mobile App", "Login button unresponsive on small Android phones", "On devices narrower than 360px the sign-in button sits under the keyboard and can't be tapped.\n\nSteps: open the app on a 5\" Android phone, tap the email field, try to sign in.\nExpected: the button stays reachable.", "bug", "critical", "in_progress", [members[0], interns[0]], 30, { due_date: day(2), reference_url: "https://github.com/" , comments: [{ id: "tc1", ticket_id: "k1", author_id: "u-priya", author_name: "Priya Sharma", author_role: "member", body: "Reproduced on a Pixel 4a. Looks like the layout isn't using the visual viewport.", created_at: ago(10) }] }),
    tk("k2", "Orbit Mobile App", "Add offline mode for saved notes", "Notes should stay readable and editable without a connection and sync when back online.", "feature", "high", "open", [members[1]], 72, { due_date: day(14) }),
    tk("k3", "Orbit Web Dashboard", "Build the CSV export for the reports page", "Add an export button to the Reports page. One row per report, UTF-8, ISO dates.", "build", "medium", "open", [interns[1], interns[2]], 20, { due_date: day(7) }),
    tk("k4", "Orbit Web Dashboard", "Chart tooltips are hard to read in dark mode", "Contrast between tooltip text and background is too low.", "improvement", "low", "resolved", [interns[0]], 120),
    tk("k5", "Orbit Mobile App", "Crash when opening settings after update", "Stack trace attached in the repo issue.", "bug", "high", "closed", [members[0]], 200),
  ];
  return { tasks, assignments, interns, members, tickets, admin: DEMO_ADMIN };
}
