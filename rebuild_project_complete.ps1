# =============================================================================
# MPTV System - Force Frontend Reset (ASCII/Tailwind Mode)
# =============================================================================
# 1. Stops Docker to unlock files.
# 2. Deletes 'frontend/src' to remove old Ant Design code.
# 3. Regenerates fresh Tailwind CSS code (English UI).
# =============================================================================

$root = "pms_system"
$frontend = "$root\frontend"
$src = "$frontend\src"
$components = "$src\components"
$pages = "$src\pages"

# 1. STOP DOCKER
Write-Host "🛑 STOPPING DOCKER CONTAINERS..." -ForegroundColor Yellow
cd $root
docker-compose down
cd ..

# 2. DELETE OLD FILES
Write-Host "🗑️  DELETING OLD SOURCE CODE..." -ForegroundColor Yellow
if (Test-Path $src) {
    Remove-Item -Recurse -Force $src
    Write-Host "✔ Deleted $src" -ForegroundColor Gray
}

# Helper: Write file with UTF-8 (No BOM)
function Write-AsciiFile {
    param ([string]$Path, [string]$Content)
    $enc = New-Object System.Text.UTF8Encoding $false
    $dir = [System.IO.Path]::GetDirectoryName($Path)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content, $enc)
    Write-Host "Created: $Path" -ForegroundColor Gray
}

Write-Host "🎨 REGENERATING FRONTEND (TAILWIND + ASCII)..." -ForegroundColor Cyan

# -----------------------------------------------------------------------------
# 1. CONFIG & DEPENDENCIES
# -----------------------------------------------------------------------------

$pkgJson = @'
{
  "name": "pms-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.1",
    "axios": "^1.6.5",
    "zustand": "^4.4.7",
    "@hello-pangea/dnd": "^16.5.0",
    "dayjs": "^1.11.10",
    "lucide-react": "^0.309.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "vite": "^5.0.8",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.33"
  }
}
'@
Write-AsciiFile "$frontend\package.json" $pkgJson

$tailwindConfig = @'
/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
'@
Write-AsciiFile "$frontend\tailwind.config.js" $tailwindConfig

$postcssConfig = @'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
'@
Write-AsciiFile "$frontend\postcss.config.js" $postcssConfig

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
    "strict": false,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
'@
Write-AsciiFile "$frontend\tsconfig.json" $tsconfig

# -----------------------------------------------------------------------------
# 2. SOURCE FILES
# -----------------------------------------------------------------------------

$indexCss = @'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-50 text-gray-900;
  }
}
.overflow-x-auto::-webkit-scrollbar { height: 8px; }
.overflow-x-auto::-webkit-scrollbar-track { background: transparent; }
.overflow-x-auto::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
'@
Write-AsciiFile "$src\index.css" $indexCss

$srcMain = @'
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
'@
Write-AsciiFile "$src\main.tsx" $srcMain

$tsIndex = @'
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}
export interface Task {
  id: number;
  project_id: number;
  column_id: number;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  start_date?: string;
  end_date?: string;
  progress: number;
  parent_id?: number;
  actual_start_date?: string;
  actual_end_date?: string;
  remarks?: string;
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
'@
Write-AsciiFile "$src\types\index.ts" $tsIndex

$libApi = @'
import axios from "axios";
import { useAuthStore } from "../store/useAuthStore";
const api = axios.create({ baseURL: "/api", headers: { "Content-Type": "application/json" } });
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((r) => r, (e) => {
  if (e.response?.status === 401) useAuthStore.getState().logout();
  return Promise.reject(e);
});
export default api;
'@
Write-AsciiFile "$src\lib\api.ts" $libApi

$storeAuth = @'
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "../types";
interface AuthState {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}
export const useAuthStore = create<AuthState>()(persist((set) => ({
  token: null, user: null,
  login: (token, user) => set({ token, user }),
  logout: () => set({ token: null, user: null }),
}), { name: "pms-auth-storage" }));
'@
Write-AsciiFile "$src\store\useAuthStore.ts" $storeAuth

# -----------------------------------------------------------------------------
# 3. COMPONENTS
# -----------------------------------------------------------------------------

$compLayout = @'
import React from "react";
import { Layout as LayoutIcon, LogOut, FolderKanban } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate, useLocation } from "react-router-dom";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col fixed h-full z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="bg-blue-600 p-1.5 rounded-lg mr-3"><LayoutIcon className="text-white w-5 h-5" /></div>
          <span className="font-bold text-lg text-gray-800">MPTV System</span>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button onClick={() => navigate("/")} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${location.pathname === "/" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50"}`}>
            <FolderKanban size={18} /> My Projects
          </button>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{user?.username?.[0]?.toUpperCase() || "U"}</div>
            <div className="flex-1 overflow-hidden"><p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p></div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"><LogOut size={16} /> Sign Out</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">{children}</main>
    </div>
  );
};
'@
Write-AsciiFile "$components\Layout.tsx" $compLayout

$compKanban = @'
import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Project } from "../types";
import api from "../lib/api";
import { Clock, MoreHorizontal, User, Plus } from "lucide-react";

interface KanbanBoardProps { project: Project; setProject: any; }

const PriorityTag = ({ p }: { p: string }) => {
  const styles: any = { high: "bg-red-50 text-red-700 border-red-100", medium: "bg-orange-50 text-orange-700 border-orange-100", low: "bg-green-50 text-green-700 border-green-100" };
  return <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${styles[p] || styles.medium}`}>{p}</span>;
};

const KanbanBoard: React.FC<KanbanBoardProps> = ({ project, setProject }) => {
  const onDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newProject = { ...project };
    const sColIdx = newProject.columns.findIndex(c => c.id.toString() === source.droppableId);
    const dColIdx = newProject.columns.findIndex(c => c.id.toString() === destination.droppableId);
    const sCol = newProject.columns[sColIdx];
    const dCol = newProject.columns[dColIdx];
    const sTasks = [...sCol.tasks];
    const dTasks = source.droppableId === destination.droppableId ? sTasks : [...dCol.tasks];
    const [moved] = sTasks.splice(source.index, 1);
    dTasks.splice(destination.index, 0, moved);
    newProject.columns[sColIdx] = { ...sCol, tasks: sTasks };
    if (source.droppableId !== destination.droppableId) {
       newProject.columns[dColIdx] = { ...dCol, tasks: dTasks };
       moved.column_id = parseInt(destination.droppableId);
    }
    setProject(newProject);
    try { await api.put(`/projects/tasks/${draggableId}`, { column_id: parseInt(destination.droppableId) }); } catch {}
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-6 h-full overflow-x-auto pb-4 items-start">
        {project.columns.map((column) => (
          <div key={column.id} className="flex-shrink-0 w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200 max-h-full">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50/50 rounded-t-xl">
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">{column.name}<span className="bg-white text-gray-500 border border-gray-200 text-xs px-2 py-0.5 rounded-full shadow-sm">{column.tasks.length}</span></h3>
            </div>
            <Droppable droppableId={column.id.toString()}>
              {(provided, snapshot) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className={`p-2 flex-1 overflow-y-auto min-h-[150px] space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-blue-50/50" : ""}`}>
                  {column.tasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                      {(provided, snapshot) => (
                        <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={provided.draggableProps.style}
                             className={`bg-white p-3 rounded-lg border shadow-sm group hover:shadow-md transition-all ${snapshot.isDragging ? "shadow-lg ring-2 ring-blue-500/20 rotate-1" : "border-gray-200"}`}>
                          <div className="flex justify-between items-start mb-2"><PriorityTag p={task.priority} /></div>
                          <h4 className="font-medium text-gray-800 text-sm mb-3 leading-snug">{task.title}</h4>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                            <div className="flex items-center gap-1.5 text-xs text-gray-400"><Clock size={12} />{task.end_date ? new Date(task.end_date).toLocaleDateString() : "--"}</div>
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold"><User size={12}/></div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
            <button className="m-2 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg"><Plus size={14} /> Add Task</button>
          </div>
        ))}
      </div>
    </DragDropContext>
  );
};
export default KanbanBoard;
'@
Write-AsciiFile "$components\KanbanBoard.tsx" $compKanban

$compGantt = @'
import React, { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import api from "../lib/api";
interface GanttViewProps { project: any; setProject: any; }
export default function GanttView({ project, setProject }: GanttViewProps) {
  const [zoomLevel, setZoomLevel] = useState<"day" | "week" | "month">("day");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dragState, setDragState] = useState<any>(null);
  useEffect(() => { setExpandedIds(new Set(project.columns.flatMap((c:any) => c.tasks).filter((t:any) => t.parent_id).map((t:any) => t.parent_id))); }, [project.id]);
  const buildTaskTree = (tasks: any[]) => {
    const taskMap = new Map(); const roots: any[] = [];
    tasks.forEach(t => taskMap.set(t.id, { ...t, children: [], level: 0 }));
    tasks.forEach(t => { if(t.parent_id && taskMap.has(t.parent_id)){ taskMap.get(t.parent_id).children.push(taskMap.get(t.id)); taskMap.get(t.id).level = taskMap.get(t.parent_id).level + 1; } else roots.push(taskMap.get(t.id)); });
    const flat: any[] = []; const traverse = (nodes: any[]) => { nodes.forEach(n => { flat.push(n); if(n.children.length) traverse(n.children); }); }; traverse(roots); return flat;
  };
  const tasks = useMemo(() => buildTaskTree(project.columns.flatMap((c:any) => c.tasks).filter((t:any) => t.start_date && t.end_date)), [project]);
  const visibleTasks = tasks.filter((t: any) => !t.parent_id || expandedIds.has(t.parent_id));
  const config = useMemo(() => {
    if (zoomLevel === "week") return { colWidth: 24, cols: 90, dayStep: 1, labelStep: 7 };
    if (zoomLevel === "month") return { colWidth: 12, cols: 120, dayStep: 1, labelStep: 30 };
    return { colWidth: 48, cols: 45, dayStep: 1, labelStep: 1 };
  }, [zoomLevel]);
  const minDate = new Date(); minDate.setDate(minDate.getDate() - 5);
  const days = Array.from({ length: config.cols }, (_, i) => { const d = new Date(minDate); d.setDate(d.getDate() + i * config.dayStep); return d; });
  const getOffset = (d: string) => ((new Date(d).getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) * config.colWidth;
  const getWidth = (s: string, e: string) => Math.max(1, ((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24) + 1)) * config.colWidth;
  const addDays = (d: string, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString(); };
  const updateTask = async (id: number, pl: any) => {
    const np = { ...project }; np.columns.forEach((c:any) => { const t = c.tasks.find((x:any) => x.id === id); if(t) Object.assign(t, pl); }); setProject(np);
    try { await api.put(`/projects/tasks/${id}`, pl); } catch {}
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if(!dragState) return;
      const dx = Math.round((e.clientX - dragState.sx) / config.colWidth);
      if(dx === 0) return;
      if(dragState.type==="move") updateTask(dragState.tid, { actual_start_date: addDays(dragState.os, dx), actual_end_date: addDays(dragState.oe, dx) });
    };
    const up = () => setDragState(null);
    if(dragState) { window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); }
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }
  }, [dragState, config]);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
        <div className="flex gap-4 text-xs font-medium text-gray-500">
          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-gray-200 rounded-sm border border-gray-300"></span> Plan</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 bg-blue-500 rounded-sm"></span> Actual</div>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {["day", "week", "month"].map((m: any) => (
            <button key={m} onClick={() => setZoomLevel(m)} className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${zoomLevel===m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{m}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-gray-200 flex flex-col bg-white z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="h-10 border-b border-gray-100 flex items-center px-4 text-xs font-semibold text-gray-500 bg-gray-50/30">TASK NAME</div>
          <div className="overflow-y-hidden flex-1">
            {visibleTasks.map((t: any) => (
              <div key={t.id} className="h-12 flex items-center px-4 border-b border-gray-50 hover:bg-gray-50 transition-colors text-sm text-gray-700" style={{ paddingLeft: `${16 + t.level * 16}px` }}>
                <button onClick={() => { const s = new Set(expandedIds); s.has(t.id)?s.delete(t.id):s.add(t.id); setExpandedIds(new Set(s)); }} className={`mr-2 p-0.5 rounded hover:bg-gray-200 text-gray-400 ${!t.children.length && "invisible"}`}>
                  {expandedIds.has(t.id)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}
                </button>
                <span className="truncate">{t.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto relative bg-white">
          <div className="h-10 flex border-b border-gray-200 sticky top-0 z-20 bg-gray-50/80 backdrop-blur w-max">
            {days.map((d, i) => (
              <div key={i} className="flex-shrink-0 border-r border-gray-100/50 flex flex-col justify-center items-center text-[10px] text-gray-400" style={{ width: config.colWidth }}>
                {i % config.labelStep === 0 && <span className="font-medium text-gray-600">{d.getDate()}</span>}
              </div>
            ))}
          </div>
          <div className="w-max relative">
            <div className="absolute inset-0 flex pointer-events-none">{days.map((_, i) => <div key={i} className="border-r border-gray-50 h-full" style={{ width: config.colWidth }}></div>)}</div>
            {visibleTasks.map((t: any) => {
                const pl = getOffset(t.start_date); const pw = getWidth(t.start_date, t.end_date);
                const al = t.actual_start_date ? getOffset(t.actual_start_date) : 0;
                const aw = t.actual_start_date ? getWidth(t.actual_start_date, t.actual_end_date) : 0;
                return (
                  <div key={t.id} className="h-12 relative border-b border-gray-50/50 hover:bg-gray-50/50 w-full group">
                    <div className="absolute top-3 h-6 bg-gray-100 border border-gray-200 rounded-md" style={{ left: pl, width: pw }}></div>
                    {t.actual_start_date && (
                      <div onMouseDown={(e) => setDragState({tid: t.id, type:"move", sx:e.clientX, os:t.actual_start_date, oe:t.actual_end_date})}
                           className={`absolute top-4 h-4 rounded shadow-sm text-[10px] text-white flex items-center justify-center cursor-grab active:cursor-grabbing hover:brightness-110 transition-all ${t.progress===100?"bg-emerald-500":"bg-blue-600"}`}
                           style={{ left: al, width: Math.max(aw, 8) }}>
                        {aw > 30 && `${t.progress}%`}
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
}
'@
Write-AsciiFile "$components\GanttView.tsx" $compGantt

$compTable = @'
import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import api from "../lib/api";
interface TableViewProps { project: any; setProject: any; }
export default function TableView({ project, setProject }: TableViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const buildTaskTree = (tasks: any[]) => {
    const taskMap = new Map(); const roots: any[] = [];
    tasks.forEach(t => taskMap.set(t.id, { ...t, children: [], level: 0 }));
    tasks.forEach(t => { if(t.parent_id && taskMap.has(t.parent_id)){ taskMap.get(t.parent_id).children.push(taskMap.get(t.id)); taskMap.get(t.id).level = taskMap.get(t.parent_id).level + 1; } else roots.push(taskMap.get(t.id)); });
    const flat: any[] = []; const trav = (n: any[]) => n.forEach(x => { flat.push(x); trav(x.children); }); trav(roots); return flat;
  };
  const tasks = useMemo(() => buildTaskTree(project.columns.flatMap((c:any) => c.tasks)), [project]);
  const visible = tasks.filter((t: any) => !t.parent_id || expandedIds.has(t.parent_id));
  const update = async (id: number, f: string, v: any) => {
    const np = { ...project }; np.columns.forEach((c:any) => { const t = c.tasks.find((x:any) => x.id===id); if(t) (t as any)[f]=v; }); setProject(np);
    try { await api.put(`/projects/tasks/${id}`, { [f]: v }); } catch {}
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50/80 text-gray-500 font-semibold border-b border-gray-200 sticky top-0 backdrop-blur z-10 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 w-64">Task Name</th>
              <th className="px-4 py-3 w-32">Start Date</th>
              <th className="px-4 py-3 w-32">End Date</th>
              <th className="px-4 py-3 w-40">Assignee</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((t: any) => (
              <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-6 py-2">
                  <div className="flex items-center" style={{ paddingLeft: `${t.level * 20}px` }}>
                    <button onClick={() => { const s = new Set(expandedIds); s.has(t.parent_id)?s.delete(t.id):s.add(t.id); setExpandedIds(new Set(s)); }} className={`mr-2 text-gray-400 hover:text-gray-600 ${!t.children.length && "invisible"}`}>
                      {expandedIds.has(t.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <span className="font-medium text-gray-700">{t.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2"><input type="date" className="bg-transparent border-0 text-gray-600 focus:ring-0 p-0 text-sm font-mono" value={t.start_date?.split("T")[0] || ""} onChange={(e) => update(t.id, "start_date", e.target.value ? new Date(e.target.value).toISOString() : null)} /></td>
                <td className="px-4 py-2"><input type="date" className="bg-transparent border-0 text-gray-600 focus:ring-0 p-0 text-sm font-mono" value={t.end_date?.split("T")[0] || ""} onChange={(e) => update(t.id, "end_date", e.target.value ? new Date(e.target.value).toISOString() : null)} /></td>
                <td className="px-4 py-2"><div className="flex items-center gap-2 text-gray-600"><div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px]"><User size={10}/></div>{t.assignee_id || "Unassigned"}</div></td>
                <td className="px-4 py-2"><input type="text" className="w-full bg-transparent border-0 placeholder-gray-300 focus:ring-0 p-0 text-sm" placeholder="..." value={t.remarks || ""} onChange={(e) => update(t.id, "remarks", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
'@
Write-AsciiFile "$components\TableView.tsx" $compTable

# -----------------------------------------------------------------------------
# 4. PAGES
# -----------------------------------------------------------------------------

$pageLogin = @'
import React, { useState } from "react";
import api from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";
import { Layout, ArrowRight, User, Lock, Mail } from "lucide-react";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [formData, setFormData] = useState({ username: "", password: "", email: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await api.post("/users/", formData);
        alert("Account created! Please login.");
        setIsRegister(false);
      } else {
        const params = new URLSearchParams();
        params.append("username", formData.username);
        params.append("password", formData.password);
        const { data } = await api.post("/token", params, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const userRes = await api.get("/users/me", { headers: { Authorization: `Bearer ${data.access_token}` } });
        login(data.access_token, userRes.data);
        navigate("/");
      }
    } catch (err: any) { alert("Action failed."); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30"><Layout className="text-white" size={24} /></div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">MPTV System</h1>
          <p className="text-gray-500 mt-2 text-sm">Enterprise Project Management</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button onClick={() => setIsRegister(false)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegister ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Login</button>
          <button onClick={() => setIsRegister(true)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegister ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Register</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative"><User className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" placeholder="Username" required className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
          {isRegister && <div className="relative animate-in fade-in slide-in-from-top-2"><Mail className="absolute left-3 top-3 text-gray-400" size={18} /><input type="email" placeholder="Email" required className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>}
          <div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={18} /><input type="password" placeholder="Password" required className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-70">{loading ? "Processing..." : (isRegister ? "Create Account" : "Sign In")}</button>
        </form>
      </div>
    </div>
  );
}
'@
Write-AsciiFile "$pages\Login.tsx" $pageLogin

$pageDashboard = @'
import React, { useEffect, useState } from "react";
import { LayoutGrid, List, Plus, ChevronRight, Folder } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { AppLayout } from "../components/Layout";
import { Project } from "../types";
export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showModal, setShowModal] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const navigate = useNavigate();
  const load = async () => { try { const { data } = await api.get("/projects/"); setProjects(data); } catch {} };
  useEffect(() => { load(); }, []);
  const create = async (e: React.FormEvent) => { e.preventDefault(); try { await api.post("/projects/", newProject); setShowModal(false); load(); } catch { alert("Failed"); } };
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1><p className="text-gray-500 mt-1">Overview of all your active projects.</p></div>
          <div className="flex items-center gap-3">
            <div className="bg-white border border-gray-200 rounded-lg p-1 flex shadow-sm"><button onClick={() => setView("grid")} className={`p-2 rounded-md transition-all ${view === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}><LayoutGrid size={18} /></button><button onClick={() => setView("list")} className={`p-2 rounded-md transition-all ${view === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}><List size={18} /></button></div>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-sm hover:shadow-md"><Plus size={18} /> New Project</button>
          </div>
        </div>
        {view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{projects.map(p => (<div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="bg-white p-6 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden"><div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform"><Folder size={24} /></div><h3 className="text-lg font-bold text-gray-900 mb-2">{p.name}</h3><p className="text-gray-500 text-sm line-clamp-2 h-10">{p.description}</p><div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-mono"><span>ID: {p.id}</span><span>{new Date(p.created_at).toLocaleDateString()}</span></div></div>))}</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">{projects.map(p => (<div key={p.id} onClick={() => navigate(`/project/${p.id}`)} className="flex items-center p-4 border-b border-gray-100 last:border-0 hover:bg-blue-50/50 cursor-pointer transition-colors group"><div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 mr-4 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors"><Folder size={20} /></div><div className="flex-1"><h3 className="font-semibold text-gray-900">{p.name}</h3><p className="text-sm text-gray-500">{p.description}</p></div><div className="text-sm text-gray-400 font-mono mr-8">{new Date(p.created_at).toLocaleDateString()}</div><ChevronRight className="text-gray-300 group-hover:text-blue-500" size={20} /></div>))}</div>
        )}
      </div>
      {showModal && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200"><h2 className="text-xl font-bold mb-4">Create Project</h2><form onSubmit={create} className="space-y-4"><input autoFocus className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Project Name" value={newProject.name} onChange={e=>setNewProject({...newProject, name:e.target.value})} required /><textarea className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Description" rows={3} value={newProject.description} onChange={e=>setNewProject({...newProject, description:e.target.value})} /><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button></div></form></div></div>)}
    </AppLayout>
  );
}
'@
Write-AsciiFile "$pages\Dashboard.tsx" $pageDashboard

$pageProject = @'
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Kanban, Calendar, Table as TableIcon, Plus } from "lucide-react";
import api from "../lib/api";
import { AppLayout } from "../components/Layout";
import { Project } from "../types";
import KanbanBoard from "../components/KanbanBoard";
import GanttView from "../components/GanttView";
import TableView from "../components/TableView";
export default function ProjectBoard() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [view, setView] = useState<"kanban"|"gantt"|"table">("kanban");
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", priority: "medium", start_date: "", end_date: "" });
  const load = async () => { try { const { data } = await api.get(`/projects/${id}`); setProject(data); } catch {} };
  useEffect(() => { load(); }, [id]);
  const createTask = async (e: React.FormEvent) => { e.preventDefault(); if (!project) return; try { await api.post(`/projects/${project.id}/tasks/`, { ...newTask, column_id: project.columns[0].id }); setShowModal(false); load(); } catch { alert("Failed"); } };
  if (!project) return <div className="p-8 text-center text-gray-500">Loading...</div>;
  return (
    <AppLayout>
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <div><div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><span>Projects</span> / <span>{project.name}</span></div><h1 className="text-2xl font-bold text-gray-900">{project.name}</h1></div>
          <div className="flex items-center gap-4">
            <div className="bg-gray-100 p-1 rounded-lg flex">{[ { id: "kanban", icon: Kanban, label: "Board" }, { id: "gantt", icon: Calendar, label: "Gantt" }, { id: "table", icon: TableIcon, label: "List" } ].map(v => (<button key={v.id} onClick={() => setView(v.id as any)} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === v.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><v.icon size={16} /> {v.label}</button>))}</div>
            <button onClick={() => setShowModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"><Plus size={16} /> New Task</button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {view === "kanban" && <KanbanBoard project={project} setProject={setProject} />}
          {view === "gantt" && <GanttView project={project} setProject={setProject} />}
          {view === "table" && <TableView project={project} setProject={setProject} />}
        </div>
      </div>
      {showModal && (<div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"><div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200"><h2 className="text-xl font-bold mb-4">Create New Task</h2><form onSubmit={createTask} className="space-y-4"><input className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Task Title" value={newTask.title} onChange={e=>setNewTask({...newTask, title:e.target.value})} required /><textarea className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Description" rows={3} value={newTask.description} onChange={e=>setNewTask({...newTask, description:e.target.value})} /><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label><input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" onChange={e=>setNewTask({...newTask, start_date: new Date(e.target.value).toISOString()})} /></div><div><label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label><input type="datetime-local" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" onChange={e=>setNewTask({...newTask, end_date: new Date(e.target.value).toISOString()})} /></div></div><select className="w-full border border-gray-300 rounded-lg px-4 py-2" value={newTask.priority} onChange={e=>setNewTask({...newTask, priority:e.target.value})}><option value="high">High Priority</option><option value="medium">Medium Priority</option><option value="low">Low Priority</option></select><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Task</button></div></form></div></div>)}
    </AppLayout>
  );
}
'@
Write-AsciiFile "$pages\ProjectBoard.tsx" $pageProject

$appTsx = @'
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProjectBoard from "./pages/ProjectBoard";
const ProtectedRoute = ({ children }: { children: JSX.Element }) => { const token = useAuthStore((state) => state.token); if (!token) return <Navigate to="/login" replace />; return children; };
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute><ProjectBoard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
};
export default App;
'@
Write-AsciiFile "$src\App.tsx" $appTsx

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "✅ FRONTEND FULLY RESET (TAILWIND MODE)" -ForegroundColor Green
Write-Host "Run these commands:" -ForegroundColor Yellow
Write-Host "1. cd pms_system" -ForegroundColor Yellow
Write-Host "2. docker-compose up -d --build" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor Green