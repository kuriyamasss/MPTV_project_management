export type ProjectStatus = "active" | "inactive";
export type Priority = "high" | "medium" | "low";

export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Attachment {
  id: number;
  task_id: number;
  file_name: string;
  content_type?: string | null;
  size: number;
  uploaded_at: string;
}

export interface Task {
  id: number;
  project_id: number;
  column_id: number;
  title: string;
  description: string;
  priority: Priority;
  start_date?: string | null;
  end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  progress: number;
  parent_id?: number | null;
  related_task_id?: number | null;
  remarks: string;
  assignee?: string | null;
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface ProjectColumn {
  id: number;
  name: string;
  order_index: number;
  tasks: Task[];
}

export interface ProjectSummary {
  id: number;
  name: string;
  description: string;
  status: ProjectStatus;
  owner_id: number;
  created_at: string;
}

export interface Project extends ProjectSummary {
  columns: ProjectColumn[];
}

export interface ProjectFileItem {
  id: number;
  task_id: number;
  task_title: string;
  file_name: string;
  content_type?: string | null;
  size: number;
  uploaded_at: string;
  task_date?: string | null;
}

export interface WeeklyTaskItem {
  task_id: number;
  title: string;
  priority: string;
  progress: number;
  assignee?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
}

export interface WeeklyProjectSummary {
  project_id: number;
  project_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  tasks: WeeklyTaskItem[];
}

export interface WeeklyReportResponse {
  start_date: string;
  end_date: string;
  generated_at: string;
  request_id: string;
  projects: WeeklyProjectSummary[];
}

export interface DownloadUrlResponse {
  url: string;
  expires_at: string;
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  request_id: string;
}
