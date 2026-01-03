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