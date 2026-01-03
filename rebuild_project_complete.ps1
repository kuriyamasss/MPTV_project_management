# =============================================================================
# MPTV System - Frontend Rebuild (English Only / ASCII Safe Mode)
# =============================================================================
# This script rewrites frontend files using PURE ASCII characters.
# This guarantees NO encoding errors (mojibake) on Windows PowerShell.
# =============================================================================

$frontend = "pms_system\frontend"
$src = "$frontend\src"
$components = "$src\components"
$pages = "$src\pages"

# Helper: Write file with UTF-8 (No BOM)
function Write-AsciiFile {
    param ([string]$Path, [string]$Content)
    $enc = New-Object System.Text.UTF8Encoding $false
    # Ensure dir exists
    $dir = [System.IO.Path]::GetDirectoryName($Path)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    # Write
    [System.IO.File]::WriteAllText($Path, $Content, $enc)
    Write-Host "Fixed: $Path" -ForegroundColor Gray
}

Write-Host "STARTING ENGLISH-ONLY REBUILD..." -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. BUILD CONFIGURATION (tsconfig, vite)
# -----------------------------------------------------------------------------

$tsconfig = @'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
'@
Write-AsciiFile "$frontend\tsconfig.json" $tsconfig

$tsconfigNode = @'
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
'@
Write-AsciiFile "$frontend\tsconfig.node.json" $tsconfigNode

$viteConfig = @'
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
})
'@
Write-AsciiFile "$frontend\vite.config.ts" $viteConfig

# -----------------------------------------------------------------------------
# 2. COMPONENTS (Gantt, Table, Kanban - English UI)
# -----------------------------------------------------------------------------

$compGantt = @'
import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight, User, Clock } from "lucide-react";
import { Project, Task } from "../types";
import api from "../lib/api";
import { message, Empty } from "antd";

interface GanttViewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
}

const buildTaskTree = (tasks: Task[]) => {
  const taskMap = new Map<number, Task & { children: any[], level: number }>();
  const roots: any[] = [];
  tasks.forEach(t => taskMap.set(t.id, { ...t, children: [], level: 0 }));
  tasks.forEach(t => {
    const node = taskMap.get(t.id)!;
    if (t.parent_id && taskMap.has(t.parent_id)) {
      const parent = taskMap.get(t.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const flattened: any[] = [];
  const traverse = (nodes: any[]) => {
    nodes.forEach(node => {
      flattened.push(node);
      if (node.children.length > 0) traverse(node.children);
    });
  };
  traverse(roots);
  return flattened;
};

const GanttView: React.FC<GanttViewProps> = ({ project, setProject }) => {
  const [zoomLevel, setZoomLevel] = useState<"day" | "week" | "month">("day");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dragState, setDragState] = useState<{
    taskId: number;
    type: "move" | "resize-left" | "resize-right";
    startX: number;
    originalStart: string;
    originalEnd: string;
  } | null>(null);

  useEffect(() => {
    const allTasks = project.columns.flatMap(c => c.tasks);
    const parents = new Set(allTasks.filter(t => t.parent_id).map(t => t.parent_id!));
    setExpandedIds(parents);
  }, [project.id]);

  const toggleExpand = (id: number) => { 
    const newSet = new Set(expandedIds); 
    newSet.has(id) ? newSet.delete(id) : newSet.add(id); 
    setExpandedIds(newSet); 
  };

  const tasks = useMemo(() => {
    const rawTasks = project.columns.flatMap(c => c.tasks)
      .filter(t => t.start_date && t.end_date);
    return buildTaskTree(rawTasks);
  }, [project]);

  const visibleTasks = tasks.filter((t: any) => !t.parent_id || expandedIds.has(t.parent_id));

  const minDateStr = tasks.length > 0 
    ? tasks.reduce((min: string, t: any) => t.start_date < min ? t.start_date : min, tasks[0].start_date || "") 
    : new Date().toISOString().split("T")[0];
  const minDate = new Date(minDateStr); 
  minDate.setDate(minDate.getDate() - 5);

  const config = useMemo(() => {
    switch(zoomLevel) {
      case "week": return { colWidth: 20, cols: 90, dayStep: 1, labelStep: 7 }; 
      case "month": return { colWidth: 10, cols: 120, dayStep: 1, labelStep: 30 }; 
      case "day": default: return { colWidth: 40, cols: 45, dayStep: 1, labelStep: 1 };
    }
  }, [zoomLevel]);

  const days = Array.from({ length: config.cols }, (_, i) => { 
    const d = new Date(minDate); 
    d.setDate(d.getDate() + i * config.dayStep); 
    return d; 
  });

  const getOffsetPixels = (dateStr: string) => { 
    const d = new Date(dateStr); 
    const diffDays = (d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24); 
    return diffDays * config.colWidth; 
  };
  const getWidthPixels = (startStr: string, endStr: string) => { 
    const start = new Date(startStr); 
    const end = new Date(endStr); 
    const diffDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1); 
    return diffDays * config.colWidth; 
  };
  const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  const updateTaskData = async (taskId: number, updates: Partial<Task>) => {
    const newProject = { ...project };
    let taskFound = false;
    newProject.columns.forEach(col => {
      const t = col.tasks.find(t => t.id === taskId);
      if (t) {
        Object.assign(t, updates);
        taskFound = true;
      }
    });
    if (taskFound) setProject(newProject);
    try {
        await api.put(`/projects/tasks/${taskId}`, updates);
    } catch (e) {
        console.error(e);
        message.error("Save failed");
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      e.preventDefault();
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / config.colWidth);
      if (deltaDays === 0) return;

      if (dragState.type === "move") {
        updateTaskData(dragState.taskId, {
            actual_start_date: addDays(dragState.originalStart, deltaDays),
            actual_end_date: addDays(dragState.originalEnd, deltaDays)
        });
      } else if (dragState.type === "resize-left") {
        const newStart = addDays(dragState.originalStart, deltaDays);
        if (new Date(newStart) < new Date(dragState.originalEnd)) {
            updateTaskData(dragState.taskId, { actual_start_date: newStart });
        }
      } else if (dragState.type === "resize-right") {
        const newEnd = addDays(dragState.originalEnd, deltaDays);
        if (new Date(newEnd) > new Date(dragState.originalStart)) {
            updateTaskData(dragState.taskId, { actual_end_date: newEnd });
        }
      }
    };
    const handleMouseUp = () => setDragState(null);

    if (dragState) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, config]);

  const handleDragStart = (e: React.MouseEvent, task: Task, type: "move" | "resize-left" | "resize-right") => {
    e.stopPropagation(); e.preventDefault();
    if (!task.actual_start_date || !task.actual_end_date) return;
    setDragState({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: task.actual_start_date,
      originalEnd: task.actual_end_date
    });
  };

  if (tasks.length === 0) return <Empty description="No tasks with dates" style={{marginTop: 50}} />;

  return (
    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", height: "calc(100vh - 200px)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb" }}>
        <div style={{ display: "flex", gap: 16, fontSize: 14, color: "#4b5563" }}>
            <div style={{display:"flex", alignItems:"center", gap:4}}><span style={{width:12, height:12, background:"#e5e7eb", border:"1px solid #d1d5db", borderRadius:2}}></span> Plan</div>
            <div style={{display:"flex", alignItems:"center", gap:4}}><span style={{width:12, height:12, background:"#3b82f6", borderRadius:2}}></span> Actual (Draggable)</div>
        </div>
        <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 6, overflow: "hidden" }}>
            {["day", "week", "month"].map(mode => (
                <button key={mode} onClick={() => setZoomLevel(mode as any)} 
                    style={{ padding: "4px 12px", fontSize: 12, cursor: "pointer", background: zoomLevel===mode ? "#eff6ff" : "#fff", color: zoomLevel===mode ? "#2563eb" : "#6b7280", border: "none", borderRight: "1px solid #d1d5db" }}>
                    {mode.toUpperCase()}
                </button>
            ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ width: 250, borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ height: 40, borderBottom: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", alignItems: "center", padding: "0 16px", fontWeight: "bold", fontSize: 12, color: "#6b7280" }}>Task Name</div>
            <div style={{ flex: 1, overflow: "hidden" }}>
                {visibleTasks.map((task: any) => (
                    <div key={task.id} style={{ height: 48, display: "flex", alignItems: "center", padding: "0 16px", paddingLeft: 16 + task.level * 16, fontSize: 14, borderBottom: "1px solid transparent", cursor: "pointer" }}
                         className="hover:bg-gray-50">
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }} 
                            style={{ marginRight: 4, border: "none", background: "transparent", cursor: "pointer", visibility: task.children.length ? "visible" : "hidden" }}>
                            {expandedIds.has(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</span>
                    </div>
                ))}
            </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
            <div style={{ height: 40, display: "flex", borderBottom: "1px solid #e5e7eb", background: "#f9fafb", position: "sticky", top: 0, zIndex: 10, width: "max-content" }}>
                {days.map((day, i) => (
                    <div key={i} style={{ width: config.colWidth, flexShrink: 0, textAlign: "center", borderRight: "1px solid #e5e7eb", paddingTop: 8, fontSize: 12, color: "#6b7280" }}>
                        {i % config.labelStep === 0 && (zoomLevel === "month" ? `${day.getMonth()+1}` : day.getDate())}
                    </div>
                ))}
            </div>
            <div style={{ width: "max-content", paddingTop: 8 }}>
                {visibleTasks.map((task: any) => {
                    const planLeft = getOffsetPixels(task.start_date);
                    const planWidth = getWidthPixels(task.start_date, task.end_date);
                    let actLeft = 0, actWidth = 0;
                    if (task.actual_start_date) {
                        actLeft = getOffsetPixels(task.actual_start_date);
                        actWidth = getWidthPixels(task.actual_start_date, task.actual_end_date || new Date().toISOString());
                    }
                    return (
                        <div key={task.id} style={{ height: 48, position: "relative", borderBottom: "1px solid #f3f4f6", width: "100%" }}>
                            <div style={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none" }}>
                                {days.map((_, i) => <div key={i} style={{ width: config.colWidth, borderRight: "1px solid #f3f4f6", height: "100%" }}></div>)}
                            </div>
                            <div style={{ position: "absolute", top: 8, height: 32, background: "rgba(229, 231, 235, 0.5)", border: "1px solid #d1d5db", borderRadius: 4, left: planLeft, width: planWidth }}></div>
                            {task.actual_start_date && (
                                <div onMouseDown={(e) => handleDragStart(e, task, "move")}
                                     style={{ 
                                        position: "absolute", top: 16, height: 16, 
                                        left: actLeft, width: Math.max(actWidth, 4), 
                                        background: task.progress === 100 ? "#22c55e" : "#3b82f6", 
                                        borderRadius: 2, cursor: "grab", zIndex: 5,
                                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff"
                                     }}>
                                    {actWidth > 30 && `${task.progress}%`}
                                    <div style={{ position: "absolute", left: 0, width: 4, height: "100%", cursor: "ew-resize" }} 
                                         onMouseDown={(e) => handleDragStart(e, task, "resize-left")}></div>
                                    <div style={{ position: "absolute", right: 0, width: 4, height: "100%", cursor: "ew-resize" }} 
                                         onMouseDown={(e) => handleDragStart(e, task, "resize-right")}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};
export default GanttView;
'@
Write-AsciiFile "$components\GanttView.tsx" $compGantt

$compTable = @'
import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Project, Task } from "../types";
import api from "../lib/api";
import { message } from "antd";

interface TableViewProps {
  project: Project;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
}

const buildTaskTree = (tasks: Task[]) => {
  const taskMap = new Map<number, Task & { children: any[], level: number }>();
  const roots: any[] = [];
  tasks.forEach(t => taskMap.set(t.id, { ...t, children: [], level: 0 }));
  tasks.forEach(t => {
    const node = taskMap.get(t.id)!;
    if (t.parent_id && taskMap.has(t.parent_id)) {
      const parent = taskMap.get(t.parent_id)!;
      node.level = parent.level + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const flattened: any[] = [];
  const traverse = (nodes: any[]) => {
    nodes.forEach(node => {
      flattened.push(node);
      if (node.children.length > 0) traverse(node.children);
    });
  };
  traverse(roots);
  return flattened;
};

const TableView: React.FC<TableViewProps> = ({ project, setProject }) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const tasks = useMemo(() => {
    const allTasks = project.columns.flatMap(c => c.tasks);
    return buildTaskTree(allTasks);
  }, [project]);
  const toggleExpand = (id: number) => { 
    const newSet = new Set(expandedIds); 
    newSet.has(id) ? newSet.delete(id) : newSet.add(id); 
    setExpandedIds(newSet); 
  };
  const updateTask = async (id: number, field: keyof Task, value: any) => {
    const newProject = { ...project };
    newProject.columns.forEach(col => {
        const t = col.tasks.find(t => t.id === id);
        if (t) (t as any)[field] = value;
    });
    setProject(newProject);
    try {
        await api.put(`/projects/tasks/${id}`, { [field]: value });
    } catch {
        message.error("Save failed");
    }
  };
  const isRowVisible = (task: any) => !task.parent_id || expandedIds.has(task.parent_id);

  return (
    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", height: "calc(100vh - 200px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ overflow: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", minWidth: 200 }}>Task Name</th>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", width: 130 }}>Plan Start</th>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", width: 130 }}>Plan End</th>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", width: 130, color: "#2563eb" }}>Actual Start</th>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", width: 130, color: "#2563eb" }}>Actual End</th>
                    <th style={{ padding: "12px", textAlign: "left", borderBottom: "1px solid #e5e7eb", width: 200 }}>Notes</th>
                </tr>
            </thead>
            <tbody>
                {tasks.map((task: any) => {
                    if (!isRowVisible(task)) return null;
                    return (
                        <tr key={task.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "8px 12px" }}>
                                <div style={{ display: "flex", alignItems: "center", paddingLeft: task.level * 20 }}>
                                    <button onClick={() => toggleExpand(task.id)} style={{ border: "none", background: "transparent", cursor: "pointer", marginRight: 4, visibility: task.children.length ? "visible" : "hidden" }}>
                                        {expandedIds.has(task.id) ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                                    </button>
                                    {task.title}
                                </div>
                            </td>
                            <td style={{ padding: 8 }}><input type="date" value={task.start_date ? task.start_date.split("T")[0] : ""} onChange={(e) => updateTask(task.id, "start_date", e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 8px", width: "100%" }} /></td>
                            <td style={{ padding: 8 }}><input type="date" value={task.end_date ? task.end_date.split("T")[0] : ""} onChange={(e) => updateTask(task.id, "end_date", e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: "1px solid #e5e7eb", borderRadius: 4, padding: "4px 8px", width: "100%" }} /></td>
                            <td style={{ padding: 8, background: "#eff6ff" }}><input type="date" value={task.actual_start_date ? task.actual_start_date.split("T")[0] : ""} onChange={(e) => updateTask(task.id, "actual_start_date", e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: "1px solid #bfdbfe", borderRadius: 4, padding: "4px 8px", width: "100%" }} /></td>
                            <td style={{ padding: 8, background: "#eff6ff" }}><input type="date" value={task.actual_end_date ? task.actual_end_date.split("T")[0] : ""} onChange={(e) => updateTask(task.id, "actual_end_date", e.target.value ? new Date(e.target.value).toISOString() : null)} style={{ border: "1px solid #bfdbfe", borderRadius: 4, padding: "4px 8px", width: "100%" }} /></td>
                            <td style={{ padding: 8 }}><input type="text" value={task.remarks || ""} onChange={(e) => updateTask(task.id, "remarks", e.target.value)} placeholder="..." style={{ border: "none", width: "100%", background: "transparent" }} /></td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
      </div>
    </div>
  );
};
export default TableView;
'@
Write-AsciiFile "$components\TableView.tsx" $compTable

# -----------------------------------------------------------------------------
# 3. PAGES (Login, Dashboard, ProjectBoard - English UI)
# -----------------------------------------------------------------------------

$pageLogin = @'
import React, { useState } from "react";
import { Form, Input, Button, Card, message, Typography, Tabs } from "antd";
import { UserOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import api from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [form] = Form.useForm();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isRegister) {
        await api.post("/users/", {
          username: values.username,
          email: values.email,
          password: values.password
        });
        message.success("Registration successful! Please login.");
        setIsRegister(false);
        form.resetFields();
      } else {
        const formData = new URLSearchParams();
        formData.append("username", values.username);
        formData.append("password", values.password);

        const tokenRes = await api.post("/token", formData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const token = tokenRes.data.access_token;
        const userRes = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${token}` }
        });

        login(token, userRes.data);
        message.success("Welcome back " + userRes.data.username);
        navigate("/");
      }
    } catch (error: any) {
      console.error(error);
      const msg = error.response?.data?.detail || "Action failed";
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f0f2f5" }}>
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", borderRadius: 8 }} bodyStyle={{ padding: "40px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={3} style={{ color: "#1890ff", margin: 0 }}>MPTV System</Title>
          <div style={{ color: "#8c8c8c", marginTop: 8 }}>Project Management</div>
        </div>
        <Tabs activeKey={isRegister ? "register" : "login"} onChange={(key) => { setIsRegister(key === "register"); form.resetFields(); }} centered
          items={[ { label: "Login", key: "login" }, { label: "Register", key: "register" } ]} style={{ marginBottom: 24 }} />
        <Form form={form} name="auth" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: "Required" }]}>
            <Input prefix={<UserOutlined />} placeholder="Username" />
          </Form.Item>
          {isRegister && (
            <Form.Item name="email" rules={[{ required: true, message: "Required", type: "email" }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" />
            </Form.Item>
          )}
          <Form.Item name="password" rules={[{ required: true, message: "Required" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {isRegister ? "Register" : "Login"}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
export default Login;
'@
Write-AsciiFile "$pages\Login.tsx" $pageLogin

$pageDashboard = @'
import React, { useEffect, useState } from "react";
import { Layout, Card, Button, Row, Col, Typography, Modal, Form, Input, message, Empty, Segmented } from "antd";
import { PlusOutlined, ProjectOutlined, LogoutOutlined, AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { Project } from "../types";

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [form] = Form.useForm();

  const fetchProjects = async () => {
    try {
      const res = await api.get("/projects/");
      setProjects(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleCreateProject = async (values: any) => {
    try {
      await api.post("/projects/", values);
      message.success("Project created");
      setIsModalOpen(false);
      form.resetFields();
      fetchProjects();
    } catch (error) {
      message.error("Failed to create project");
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 2px 8px #f0f1f2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ProjectOutlined style={{ fontSize: 24, color: "#1890ff" }} />
          <Title level={4} style={{ margin: 0 }}>PMS Console</Title>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span>Welcome, {user?.username}</span>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} danger type="text">Exit</Button>
        </div>
      </Header>
      <Content style={{ padding: "24px 50px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 24 }}>
          <div>
            <Title level={3}>My Projects</Title>
            <Segmented options={[{ label: "Grid", value: "grid", icon: <AppstoreOutlined /> }, { label: "List", value: "list", icon: <BarsOutlined /> }]} value={viewMode} onChange={(v) => setViewMode(v as any)} />
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>New Project</Button>
        </div>
        {projects.length === 0 ? <Empty description="No projects found" /> : (
          viewMode === "grid" ? (
            <Row gutter={[16, 16]}>
              {projects.map(project => (
                <Col xs={24} sm={12} md={8} lg={6} key={project.id}>
                  <Card hoverable title={project.name} extra={<Button type="link" size="small" onClick={() => navigate(`/project/${project.id}`)}>Enter</Button>} onClick={() => navigate(`/project/${project.id}`)}>
                    <Paragraph ellipsis={{ rows: 2 }}>{project.description || "No description"}</Paragraph>
                    <div style={{ marginTop: 12, color: "#888", fontSize: 12 }}>Created: {new Date(project.created_at).toLocaleDateString()}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #f0f0f0" }}>
               {projects.map(project => (
                 <div key={project.id} onClick={() => navigate(`/project/${project.id}`)} style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} className="hover:bg-gray-50">
                    <div><div style={{ fontWeight: "bold", fontSize: 16 }}>{project.name}</div><div style={{ color: "#666", fontSize: 14 }}>{project.description || "No description"}</div></div>
                    <div style={{ color: "#999", fontSize: 12 }}>Created: {new Date(project.created_at).toLocaleDateString()}</div>
                 </div>
               ))}
            </div>
          )
        )}
      </Content>
      <Modal title="Create Project" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreateProject}>
          <Form.Item name="name" label="Project Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};
export default Dashboard;
'@
Write-AsciiFile "$pages\Dashboard.tsx" $pageDashboard

$pageProjectBoard = @'
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout, Button, Spin, Breadcrumb, message, Modal, Form, Input, Select, DatePicker, Segmented } from "antd";
import { ArrowLeftOutlined, PlusOutlined, AppstoreOutlined, BarsOutlined, TableOutlined } from "@ant-design/icons";
import api from "../lib/api";
import { Project } from "../types";
import KanbanBoard from "../components/KanbanBoard";
import GanttView from "../components/GanttView";
import TableView from "../components/TableView";

const { Content, Header } = Layout;
const { Option } = Select;

const ProjectBoard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "gantt" | "table">("kanban");
  const [form] = Form.useForm();

  const fetchProject = async () => {
    try {
      const res = await api.get(`/projects/${id}`);
      setProject(res.data);
    } catch (error) {
      message.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProject(); }, [id]);

  const handleCreateTask = async (values: any) => {
    if (!project) return;
    try {
      const firstColumnId = project.columns[0].id;
      await api.post(`/projects/${project.id}/tasks/`, {
        ...values,
        column_id: firstColumnId,
        start_date: values.start_date ? values.start_date.toISOString() : null,
        end_date: values.end_date ? values.end_date.toISOString() : null,
      });
      message.success("Task created");
      setIsModalOpen(false);
      form.resetFields();
      fetchProject();
    } catch (error) {
      message.error("Failed to create task");
    }
  };

  if (loading) return <div style={{textAlign: "center", marginTop: 50}}><Spin size="large" /></div>;
  if (!project) return <div>Project not found</div>;

  return (
    <Layout style={{ height: "100vh" }}>
      <Header style={{ background: "#fff", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/")} />
          <Breadcrumb items={[{ title: "Dashboard" }, { title: project.name }]} />
        </div>
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}>
          <Segmented
            options={[
              { label: "Kanban", value: "kanban", icon: <AppstoreOutlined /> },
              { label: "Gantt", value: "gantt", icon: <BarsOutlined /> },
              { label: "Table", value: "table", icon: <TableOutlined /> },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as any)}
          />
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          New Task
        </Button>
      </Header>
      <Content style={{ padding: "24px", overflow: "hidden" }}>
        {viewMode === "kanban" && <KanbanBoard project={project} setProject={setProject} />}
        {viewMode === "gantt" && <GanttView project={project} setProject={setProject} />}
        {viewMode === "table" && <TableView project={project} setProject={setProject} />}
      </Content>
      <Modal title="New Task" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={form.submit}>
        <Form form={form} layout="vertical" onFinish={handleCreateTask}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue="medium">
            <Select>
              <Option value="high">High</Option>
              <Option value="medium">Medium</Option>
              <Option value="low">Low</Option>
            </Select>
          </Form.Item>
          <Form.Item name="start_date" label="Plan Start">
             <DatePicker showTime style={{width: "100%"}} />
          </Form.Item>
          <Form.Item name="end_date" label="Plan End">
             <DatePicker showTime style={{width: "100%"}} />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};
export default ProjectBoard;
'@
Write-AsciiFile "$pages\ProjectBoard.tsx" $pageProjectBoard

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "✅ FRONTEND REBUILT (ASCII MODE)" -ForegroundColor Green
Write-Host "Please restart docker to compile:" -ForegroundColor Yellow
Write-Host "cd pms_system" -ForegroundColor Yellow
Write-Host "docker-compose up -d --build" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor Green