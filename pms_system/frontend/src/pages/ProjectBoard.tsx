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