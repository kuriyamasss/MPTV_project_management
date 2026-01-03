export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface FileAttachment {
  id: number;
  filename: string;
}

export interface Task {
  id: number;
  project_id: number;
  column_id: number;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  start_date?: string;
  end_date?: string;
  progress: number;
  parent_id?: number;
  actual_start_date?: string;
  actual_end_date?: string;
  remarks?: string;
  attachments?: FileAttachment[];
  assignee_id?: number; 
}

export interface Column {
  id: number;
  name: string;
  order_index: number;
  tasks: Task[];
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  created_at: string;
  columns: Column[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}
