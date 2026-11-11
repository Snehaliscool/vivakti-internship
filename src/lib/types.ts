export type Role = "admin" | "member" | "intern";
export type Tab = "overview" | "tasks" | "tickets" | "calendar" | "interns" | "submissions";
export type Status = "assigned" | "in_progress" | "submitted" | "under_review" | "revision_requested" | "approved";
export type TaskKind = "project" | "website" | "youtube" | "general";
export type Priority = "low" | "medium" | "high";

export type Profile = { id: string; full_name: string; email: string; role: Role; created_at: string };
export type Task = {
  id: string; title: string; description: string; task_type: TaskKind; resource_url: string | null;
  priority: Priority; due_date: string | null; created_by?: string; created_by_name?: string; created_at: string;
};
export type Submission = {
  id: string; assignment_id: string; intern_id: string; storage_path: string;
  file_name: string; file_size: number; note: string; created_at: string;
};
export type Feedback = {
  id: string; assignment_id: string; admin_id: string; message: string;
  action: "approved" | "revision_requested"; created_at: string;
};
export type Comment = {
  id: string; assignment_id: string; author_id: string; author_name: string; author_role: Role; body: string; created_at: string;
};
export type Assignment = {
  id: string; task_id: string; intern_id: string; status: Status; created_at: string;
  task: Task; intern?: Profile | null; submissions?: Submission[]; feedback?: Feedback[]; comments?: Comment[];
};
export type TicketKind = "bug" | "improvement" | "feature" | "build";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketAssignee = { ticket_id: string; user_id: string; user_name: string; user_role: Role };
export type TicketComment = { id: string; ticket_id: string; author_id: string; author_name: string; author_role: Role; body: string; created_at: string };
export type Ticket = {
  id: string; application: string; title: string; description: string; kind: TicketKind; priority: TicketPriority; status: TicketStatus;
  reference_url: string | null; due_date: string | null; created_by: string; created_by_name: string; created_at: string; updated_at: string;
  assignees: TicketAssignee[]; comments: TicketComment[];
};
export type NewTicket = Pick<Ticket, "application" | "title" | "description" | "kind" | "priority" | "reference_url" | "due_date">;
export type Data = { tasks: Task[]; assignments: Assignment[]; interns: Profile[]; members: Profile[]; tickets: Ticket[] };
export type NewTask = {
  title: string; description: string; task_type: TaskKind; resource_url: string | null;
  priority: Priority; due_date: string | null;
};
