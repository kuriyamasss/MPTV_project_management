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