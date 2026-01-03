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