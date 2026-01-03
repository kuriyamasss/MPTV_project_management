import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, User, Clock } from 'lucide-react';
import { Project, Task } from '../types';
import api from '../lib/api';
import { message, Empty } from 'antd';

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
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('day');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dragState, setDragState] = useState<{
    taskId: number;
    type: 'move' | 'resize-left' | 'resize-right';
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
    ? tasks.reduce((min: string, t: any) => t.start_date < min ? t.start_date : min, tasks[0].start_date || '') 
    : new Date().toISOString().split('T')[0];
  const minDate = new Date(minDateStr); 
  minDate.setDate(minDate.getDate() - 5);

  const config = useMemo(() => {
    switch(zoomLevel) {
      case 'week': return { colWidth: 20, cols: 90, dayStep: 1, labelStep: 7 }; 
      case 'month': return { colWidth: 10, cols: 120, dayStep: 1, labelStep: 30 }; 
      case 'day': default: return { colWidth: 40, cols: 45, dayStep: 1, labelStep: 1 };
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
        message.error('ä¿å­˜å¤±è´¥');
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      e.preventDefault();
      const deltaX = e.clientX - dragState.startX;
      const deltaDays = Math.round(deltaX / config.colWidth);
      if (deltaDays === 0) return;

      if (dragState.type === 'move') {
        updateTaskData(dragState.taskId, {
            actual_start_date: addDays(dragState.originalStart, deltaDays),
            actual_end_date: addDays(dragState.originalEnd, deltaDays)
        });
      } else if (dragState.type === 'resize-left') {
        const newStart = addDays(dragState.originalStart, deltaDays);
        if (new Date(newStart) < new Date(dragState.originalEnd)) {
            updateTaskData(dragState.taskId, { actual_start_date: newStart });
        }
      } else if (dragState.type === 'resize-right') {
        const newEnd = addDays(dragState.originalEnd, deltaDays);
        if (new Date(newEnd) > new Date(dragState.originalStart)) {
            updateTaskData(dragState.taskId, { actual_end_date: newEnd });
        }
      }
    };
    const handleMouseUp = () => setDragState(null);

    if (dragState) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, config]);

  const handleDragStart = (e: React.MouseEvent, task: Task, type: 'move' | 'resize-left' | 'resize-right') => {
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

  if (tasks.length === 0) return <Empty description="æš‚æ— å¸¦æ—¶é—´çš„ä»»åŠ¡" style={{marginTop: 50}} />;

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9fafb' }}>
        <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#4b5563' }}>
            <div style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:12, height:12, background:'#e5e7eb', border:'1px solid #d1d5db', borderRadius:2}}></span> è®¡åˆ’æ—¶é—´</div>
            <div style={{display:'flex', alignItems:'center', gap:4}}><span style={{width:12, height:12, background:'#3b82f6', borderRadius:2}}></span> å®žé™…è¿›åº¦ (å¯æ‹–æ‹½)</div>
        </div>
        <div style={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 6, overflow: 'hidden' }}>
            {['day', 'week', 'month'].map(mode => (
                <button key={mode} onClick={() => setZoomLevel(mode as any)} 
                    style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', background: zoomLevel===mode ? '#eff6ff' : '#fff', color: zoomLevel===mode ? '#2563eb' : '#6b7280', border: 'none', borderRight: '1px solid #d1d5db' }}>
                    {mode === 'day' ? 'æ—¥' : mode === 'week' ? 'å‘¨' : 'æœˆ'}
                </button>
            ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 250, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ height: 40, borderBottom: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', padding: '0 16px', fontWeight: 'bold', fontSize: 12, color: '#6b7280' }}>ä»»åŠ¡åç§°</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {visibleTasks.map((task: any) => (
                    <div key={task.id} style={{ height: 48, display: 'flex', alignItems: 'center', padding: '0 16px', paddingLeft: 16 + task.level * 16, fontSize: 14, borderBottom: '1px solid transparent', cursor: 'pointer' }}
                         className="hover:bg-gray-50">
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }} 
                            style={{ marginRight: 4, border: 'none', background: 'transparent', cursor: 'pointer', visibility: task.children.length ? 'visible' : 'hidden' }}>
                            {expandedIds.has(task.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                    </div>
                ))}
            </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <div style={{ height: 40, display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', position: 'sticky', top: 0, zIndex: 10, width: 'max-content' }}>
                {days.map((day, i) => (
                    <div key={i} style={{ width: config.colWidth, flexShrink: 0, textAlign: 'center', borderRight: '1px solid #e5e7eb', paddingTop: 8, fontSize: 12, color: '#6b7280' }}>
                        {i % config.labelStep === 0 && (zoomLevel === 'month' ? `${day.getMonth()+1}æœˆ` : day.getDate())}
                    </div>
                ))}
            </div>
            <div style={{ width: 'max-content', paddingTop: 8 }}>
                {visibleTasks.map((task: any) => {
                    const planLeft = getOffsetPixels(task.start_date);
                    const planWidth = getWidthPixels(task.start_date, task.end_date);
                    let actLeft = 0, actWidth = 0;
                    if (task.actual_start_date) {
                        actLeft = getOffsetPixels(task.actual_start_date);
                        actWidth = getWidthPixels(task.actual_start_date, task.actual_end_date || new Date().toISOString());
                    }
                    return (
                        <div key={task.id} style={{ height: 48, position: 'relative', borderBottom: '1px solid #f3f4f6', width: '100%' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
                                {days.map((_, i) => <div key={i} style={{ width: config.colWidth, borderRight: '1px solid #f3f4f6', height: '100%' }}></div>)}
                            </div>
                            <div style={{ position: 'absolute', top: 8, height: 32, background: 'rgba(229, 231, 235, 0.5)', border: '1px solid #d1d5db', borderRadius: 4, left: planLeft, width: planWidth }}></div>
                            {task.actual_start_date && (
                                <div onMouseDown={(e) => handleDragStart(e, task, 'move')}
                                     style={{ 
                                        position: 'absolute', top: 16, height: 16, 
                                        left: actLeft, width: Math.max(actWidth, 4), 
                                        background: task.progress === 100 ? '#22c55e' : '#3b82f6', 
                                        borderRadius: 2, cursor: 'grab', zIndex: 5,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff'
                                     }}>
                                    {actWidth > 30 && `${task.progress}%`}
                                    <div style={{ position: 'absolute', left: 0, width: 4, height: '100%', cursor: 'ew-resize' }} 
                                         onMouseDown={(e) => handleDragStart(e, task, 'resize-left')}></div>
                                    <div style={{ position: 'absolute', right: 0, width: 4, height: '100%', cursor: 'ew-resize' }} 
                                         onMouseDown={(e) => handleDragStart(e, task, 'resize-right')}></div>
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
