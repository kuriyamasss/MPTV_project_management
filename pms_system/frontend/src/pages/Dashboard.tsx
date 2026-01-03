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