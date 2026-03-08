import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Kanban,
  MoreHorizontal,
  Paperclip,
  Plus,
  Settings,
  Table as TableIcon,
  Trash2,
  Upload,
  X
} from "lucide-react";
import api, { getErrorMessage } from "../lib/api";
import type { Attachment, Priority, Project, ProjectStatus, Task } from "../types";
import { Avatar, cn, PreviewFile, PriorityTag, toDateInput, toDateTimeInput, toISOOrNull } from "../components/shared";
import { useConfig } from "../config";
import { useNotifier } from "../components/notifications";

const SYSTEM_SHARED_FILES_MARKER = "__system_project_shared_files__";

type TaskFormState = {
  id?: number;
  title: string;
  description: string;
  priority: Priority;
  assignee: string;
  progress: number;
  parent_id: string;
  related_task_id: string;
  start_date: string;
  end_date: string;
  actual_start_date: string;
  actual_end_date: string;
  remarks: string;
  column_id: number;
};

const createEmptyTaskForm = (columnId: number): TaskFormState => ({
  title: "",
  description: "",
  priority: "medium",
  assignee: "",
  progress: 0,
  parent_id: "",
  related_task_id: "",
  start_date: "",
  end_date: "",
  actual_start_date: "",
  actual_end_date: "",
  remarks: "",
  column_id: columnId
});

const toTaskForm = (task: Task): TaskFormState => ({
  id: task.id,
  title: task.title ?? "",
  description: task.description ?? "",
  priority: task.priority ?? "medium",
  assignee: task.assignee ?? "",
  progress: task.progress ?? 0,
  parent_id: task.parent_id ? String(task.parent_id) : "",
  related_task_id: task.related_task_id ? String(task.related_task_id) : "",
  start_date: toDateTimeInput(task.start_date),
  end_date: toDateTimeInput(task.end_date),
  actual_start_date: toDateTimeInput(task.actual_start_date),
  actual_end_date: toDateTimeInput(task.actual_end_date),
  remarks: task.remarks ?? "",
  column_id: task.column_id ?? 0
});

const buildTree = (tasks: Task[]) => {
  const byId = new Map<number, Task & { children: number[]; level: number }>();
  tasks.forEach((task) => byId.set(task.id, { ...task, children: [], level: 0 }));
  const roots: Array<Task & { children: number[]; level: number }> = [];
  byId.forEach((task) => {
    if (task.parent_id && byId.has(task.parent_id)) {
      const parent = byId.get(task.parent_id)!;
      parent.children.push(task.id);
      task.level = parent.level + 1;
    } else {
      roots.push(task);
    }
  });
  const flattened: Array<Task & { children: number[]; level: number }> = [];
  const walk = (task: Task & { children: number[]; level: number }) => {
    flattened.push(task);
    task.children.forEach((childId) => {
      const child = byId.get(childId);
      if (child) walk(child);
    });
  };
  roots.forEach(walk);
  return flattened;
};

const KanbanBoard = ({
  project,
  onMoveTask,
  onCreateTask,
  onEditTask
}: {
  project: Project;
  onMoveTask: (taskId: number, columnId: number) => Promise<void>;
  onCreateTask: (columnId?: number) => void;
  onEditTask: (task: Task) => void;
}) => {
  const { t } = useConfig();
  const [dragging, setDragging] = useState<{ taskId: number; fromColumn: number } | null>(null);
  const getColumnName = (name: string): string => {
    if (name === "To Do") return t.columnTodo;
    if (name === "In Progress") return t.columnInProgress;
    if (name === "Done") return t.columnDone;
    if (name === "Won't Do") return t.columnWontDo;
    if (name === "Backlog") return t.columnBacklog;
    return name;
  };

  return (
    <div className="flex gap-5 overflow-x-auto pb-3 items-start h-full scrollbar-thin">
      {project.columns.map((column) => (
        <div
          key={column.id}
          className="w-80 flex-shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/70 flex flex-col max-h-full"
          onDragOver={(event) => event.preventDefault()}
          onDrop={async () => {
            if (!dragging) return;
            await onMoveTask(dragging.taskId, column.id);
            setDragging(null);
          }}
        >
          <div className="px-3 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              {getColumnName(column.name)}
              <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                {column.tasks.length}
              </span>
            </h3>
            <MoreHorizontal size={14} className="text-slate-400" />
          </div>
          <div className="p-2 space-y-2 overflow-y-auto min-h-[160px]">
            {column.tasks.map((task) => (
              <button
                key={task.id}
                draggable
                onDragStart={() => setDragging({ taskId: task.id, fromColumn: column.id })}
                className="w-full text-left p-3 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all"
                onClick={() => onEditTask(task)}
              >
                <div className="flex justify-between items-start mb-2">
                  <PriorityTag value={task.priority} />
                  {task.parent_id && <span className="text-[10px] text-slate-400">{t.subTask}</span>}
                </div>
                <p className="text-sm font-medium mb-3">{task.title}</p>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-600 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {task.end_date ? new Date(task.end_date).toLocaleDateString() : "--"}
                  </span>
                  <Avatar name={task.assignee} />
                </div>
              </button>
            ))}
          </div>
          <button
            className="m-2 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/60 flex items-center justify-center gap-1.5"
            onClick={() => onCreateTask(column.id)}
          >
            <Plus size={14} />
            {t.createTask}
          </button>
        </div>
      ))}
    </div>
  );
};

const GanttView = ({ project }: { project: Project }) => {
  const { t } = useConfig();
  const [zoom, setZoom] = useState<"day" | "week" | "month">("day");
  const tasks = useMemo(
    () => buildTree(project.columns.flatMap((column) => column.tasks).filter((task) => task.start_date && task.end_date)),
    [project]
  );
  const config =
    zoom === "week"
      ? { colWidth: 24, cols: 80, labelEvery: 7 }
      : zoom === "month"
      ? { colWidth: 12, cols: 120, labelEvery: 30 }
      : { colWidth: 40, cols: 45, labelEvery: 1 };
  const baseDate = new Date("2024-01-01T00:00:00.000Z");
  const days = Array.from({ length: config.cols }).map((_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return date;
  });
  const offset = (iso?: string | null): number => {
    if (!iso) return 0;
    const date = new Date(iso);
    return ((date.getTime() - baseDate.getTime()) / 86400000) * config.colWidth;
  };
  const width = (start?: string | null, end?: string | null): number => {
    if (!start) return 0;
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : startDate;
    return Math.max(1, (Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1) * config.colWidth);
  };

  return (
    <div className="h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div className="text-xs text-slate-500">{t.plannedVsActualTimeline}</div>
        <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-lg flex">
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              className={cn(
                "px-3 py-1 text-xs rounded-md capitalize",
                zoom === mode ? "bg-white dark:bg-slate-600 shadow" : "text-slate-500"
              )}
              onClick={() => setZoom(mode)}
            >
              {mode === "day" ? t.zoomDay : mode === "week" ? t.zoomWeek : t.zoomMonth}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800">
          <div className="h-10 px-4 flex items-center text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-700">
            {t.taskName}
          </div>
          <div className="flex-1 overflow-auto">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="h-12 px-4 border-b border-slate-50 dark:border-slate-700 text-sm flex items-center"
                style={{ paddingLeft: `${16 + task.level * 16}px` }}
              >
                {task.title}
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto relative">
          <div className="h-10 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur flex w-max">
            {days.map((day, index) => (
              <div
                key={day.toISOString()}
                className="border-r border-slate-100 dark:border-slate-700 text-[10px] text-slate-500 flex items-center justify-center"
                style={{ width: config.colWidth }}
              >
                {index % config.labelEvery === 0 ? day.getDate() : ""}
              </div>
            ))}
          </div>
          <div className="w-max relative">
            {tasks.map((task) => (
              <div key={task.id} className="h-12 relative border-b border-slate-50 dark:border-slate-700">
                <div className="absolute top-3 h-6 rounded bg-slate-200 dark:bg-slate-600 border border-slate-300 dark:border-slate-500" style={{ left: offset(task.start_date), width: width(task.start_date, task.end_date) }} />
                {task.actual_start_date && (
                  <div className={`absolute top-4 h-4 rounded text-[10px] text-white flex items-center justify-center ${task.progress >= 100 ? "bg-emerald-500" : "bg-blue-600"}`} style={{ left: offset(task.actual_start_date), width: Math.max(width(task.actual_start_date, task.actual_end_date), 8) }}>
                    {task.progress}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TableView = ({
  project,
  onPatchTask
}: {
  project: Project;
  onPatchTask: (taskId: number, payload: Partial<Task>) => Promise<void>;
}) => {
  const { t } = useConfig();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const tasks = useMemo(() => buildTree(project.columns.flatMap((column) => column.tasks)), [project]);
  const visible = tasks.filter((task) => !task.parent_id || expanded.has(task.parent_id));

  return (
    <div className="h-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <div className="overflow-auto h-full">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 border-b border-slate-200 dark:border-slate-700 sticky top-0">
            <tr>
              <th className="px-4 py-3 w-64">{t.taskTitle}</th>
              <th className="px-4 py-3">{t.planStart}</th>
              <th className="px-4 py-3">{t.planEnd}</th>
              <th className="px-4 py-3 text-blue-600">{t.actStart}</th>
              <th className="px-4 py-3 text-blue-600">{t.actEnd}</th>
              <th className="px-4 py-3">{t.assignee}</th>
              <th className="px-4 py-3">{t.attachments}</th>
              <th className="px-4 py-3">{t.notes}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((task) => (
              <tr key={task.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <td className="px-4 py-2">
                  <div className="flex items-center" style={{ paddingLeft: `${task.level * 16}px` }}>
                    <button
                      className={cn("mr-1.5", task.children.length === 0 && "invisible")}
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.has(task.id) ? next.delete(task.id) : next.add(task.id);
                          return next;
                        })
                      }
                    >
                      {expanded.has(task.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <span className="font-medium">{task.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    className="bg-transparent text-sm"
                    defaultValue={toDateInput(task.start_date)}
                    onBlur={(event) => onPatchTask(task.id, { start_date: toISOOrNull(event.target.value) })}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="date"
                    className="bg-transparent text-sm"
                    defaultValue={toDateInput(task.end_date)}
                    onBlur={(event) => onPatchTask(task.id, { end_date: toISOOrNull(event.target.value) })}
                  />
                </td>
                <td className="px-4 py-2 bg-blue-50/40 dark:bg-blue-900/20">
                  <input
                    type="date"
                    className="bg-transparent text-sm text-blue-700 dark:text-blue-300"
                    defaultValue={toDateInput(task.actual_start_date)}
                    onBlur={(event) => onPatchTask(task.id, { actual_start_date: toISOOrNull(event.target.value) })}
                  />
                </td>
                <td className="px-4 py-2 bg-blue-50/40 dark:bg-blue-900/20">
                  <input
                    type="date"
                    className="bg-transparent text-sm text-blue-700 dark:text-blue-300"
                    defaultValue={toDateInput(task.actual_end_date)}
                    onBlur={(event) => onPatchTask(task.id, { actual_end_date: toISOOrNull(event.target.value) })}
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar name={task.assignee} />
                    <span>{task.assignee ?? t.unassigned}</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                    <Paperclip size={11} />
                    {task.attachments.length}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    className="w-full bg-transparent"
                    defaultValue={task.remarks ?? ""}
                    onBlur={(event) => onPatchTask(task.id, { remarks: event.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export const ProjectBoardPage = ({
  projectId,
  onBack,
  onProjectsChanged,
  onPreview
}: {
  projectId: number;
  onBack: () => void;
  onProjectsChanged: () => Promise<void>;
  onPreview: (file: PreviewFile) => void;
}) => {
  const { t } = useConfig();
  const notify = useNotifier();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "gantt" | "table">("kanban");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<{ name: string; description: string; status: ProjectStatus }>({
    name: "",
    description: "",
    status: "active"
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visibleProject = useMemo(() => {
    if (!project) return null;
    return {
      ...project,
      columns: project.columns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((task) => task.remarks !== SYSTEM_SHARED_FILES_MARKER)
      }))
    };
  }, [project]);

  const loadProject = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get<Project>(`/projects/${projectId}`);
      setProject(data);
      setSettingsForm({
        name: data.name,
        description: data.description,
        status: data.status
      });
    } catch (error) {
      setLoadError(getErrorMessage(error, t.failedLoadProject));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const allTasks = useMemo(
    () => visibleProject?.columns.flatMap((column) => column.tasks) ?? [],
    [visibleProject]
  );

  const openCreateModal = (columnId?: number) => {
    if (!project || !project.columns.length) return;
    const targetColumn = columnId ?? project.columns[0].id;
    setEditingTask(null);
    setTaskForm(createEmptyTaskForm(targetColumn));
    setTaskModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setTaskForm(toTaskForm(task));
    setTaskModalOpen(true);
  };

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project || !taskForm) return;
    setSavingTask(true);
    try {
      const payload = {
        column_id: taskForm.column_id,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assignee: taskForm.assignee || null,
        progress: Number(taskForm.progress || 0),
        parent_id: taskForm.parent_id ? Number(taskForm.parent_id) : null,
        related_task_id: taskForm.related_task_id ? Number(taskForm.related_task_id) : null,
        start_date: toISOOrNull(taskForm.start_date),
        end_date: toISOOrNull(taskForm.end_date),
        actual_start_date: toISOOrNull(taskForm.actual_start_date),
        actual_end_date: toISOOrNull(taskForm.actual_end_date),
        remarks: taskForm.remarks
      };

      if (editingTask) {
        await api.patch(`/tasks/${editingTask.id}`, payload);
        notify.success(t.taskUpdated);
      } else {
        await api.post(`/projects/${project.id}/tasks`, payload);
        notify.success(t.taskCreated);
      }
      await loadProject();
      await onProjectsChanged();
      setTaskModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      notify.error(getErrorMessage(error, t.taskSaveFailed));
    } finally {
      setSavingTask(false);
    }
  };

  const deleteTask = async () => {
    if (!editingTask) return;
    if (!window.confirm(t.deleteTaskConfirm)) return;
    try {
      await api.delete(`/tasks/${editingTask.id}`);
      await loadProject();
      await onProjectsChanged();
      setTaskModalOpen(false);
      setEditingTask(null);
      notify.success(t.taskDeleted);
    } catch (error) {
      notify.error(getErrorMessage(error, t.taskDeletionFailed));
    }
  };

  const patchTask = async (taskId: number, payload: Partial<Task>) => {
    try {
      await api.patch(`/tasks/${taskId}`, payload);
      await loadProject();
    } catch (error) {
      notify.error(getErrorMessage(error, t.taskUpdateFailed));
    }
  };

  const moveTask = async (taskId: number, columnId: number) => {
    await patchTask(taskId, { column_id: columnId });
  };

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!project) return;
    try {
      await api.put(`/projects/${project.id}`, settingsForm);
      await loadProject();
      await onProjectsChanged();
      setSettingsOpen(false);
      notify.success(t.projectUpdated);
      if (settingsForm.status === "inactive") onBack();
    } catch (error) {
      notify.error(getErrorMessage(error, t.projectUpdateFailed));
    }
  };

  const uploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingTask || !event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];
    const body = new FormData();
    body.append("file", file);
    try {
      await api.post(`/tasks/${editingTask.id}/attachments`, body, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      await loadProject();
      notify.success(t.attachmentUploaded);
    } catch (error) {
      notify.error(getErrorMessage(error, t.uploadFailed));
    } finally {
      event.target.value = "";
    }
  };

  const removeAttachment = async (attachment: Attachment) => {
    if (!editingTask) return;
    try {
      await api.delete(`/tasks/${editingTask.id}/attachments/${attachment.id}`);
      await loadProject();
      notify.success(t.attachmentDeleted);
    } catch (error) {
      notify.error(getErrorMessage(error, t.attachmentDeletionFailed));
    }
  };

  if (loading) {
    return <div className="py-24 text-center text-slate-400">{t.loadingProject}</div>;
  }

  if (!project || !visibleProject || loadError) {
    return (
      <div className="py-24 text-center">
        <p className="text-red-500">{loadError ?? t.projectNotFound}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={loadProject}
          >
            {t.retry}
          </button>
          <button
            className="px-3 py-2 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={onBack}
          >
            {t.back}
          </button>
        </div>
      </div>
    );
  }

  const latestEditingTask = editingTask
    ? visibleProject.columns.flatMap((column) => column.tasks).find((task) => task.id === editingTask.id) ?? editingTask
    : null;
  const viewOptions: Array<{
    id: "kanban" | "gantt" | "table";
    icon: React.ComponentType<any>;
    label: string;
  }> = [
    { id: "kanban", icon: Kanban, label: t.board },
    { id: "gantt", icon: Calendar, label: t.gantt },
    { id: "table", icon: TableIcon, label: t.table }
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            <button className="hover:underline" onClick={onBack}>
              {t.projects}
            </button>{" "}
            / {visibleProject.name}
          </div>
          <h1 className="text-2xl font-bold">{visibleProject.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setSettingsOpen(true)}>
            <Settings size={18} />
          </button>
          <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex">
            {viewOptions.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5",
                  view === id ? "bg-white dark:bg-slate-700 shadow" : "text-slate-500"
                )}
                onClick={() => setView(id)}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2" onClick={() => openCreateModal()}>
            <Plus size={16} />
            {t.createTask}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {view === "kanban" && (
          <KanbanBoard project={visibleProject} onMoveTask={moveTask} onCreateTask={openCreateModal} onEditTask={openEditModal} />
        )}
        {view === "gantt" && <GanttView project={visibleProject} />}
        {view === "table" && <TableView project={visibleProject} onPatchTask={patchTask} />}
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-[85] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings size={17} /> {t.settings}
              </h3>
              <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setSettingsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="space-y-4" onSubmit={saveSettings}>
              <label className="block text-sm">
                <span className="text-slate-500">{t.projectName}</span>
                <input
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  value={settingsForm.name}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">{t.description}</span>
                <textarea
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  value={settingsForm.description}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">{t.status}</span>
                <select
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  value={settingsForm.status}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}
                >
                  <option value="active">{t.active}</option>
                  <option value="inactive">{t.inactive}</option>
                </select>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setSettingsOpen(false)}>
                  {t.cancel}
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {taskModalOpen && taskForm && (
        <div className="fixed inset-0 bg-black/55 z-[95] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-xl font-bold">{editingTask ? t.editTask : t.createTask}</h3>
                {editingTask && <p className="text-xs text-slate-500 mt-1">{t.taskId}{editingTask.id}</p>}
              </div>
              <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setTaskModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <form className="space-y-4" onSubmit={submitTask}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-sm md:col-span-2">
                  <span className="text-slate-500">{t.taskTitle}</span>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t.priority}</span>
                  <select
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((prev) => (prev ? { ...prev, priority: event.target.value as Priority } : prev))
                    }
                  >
                    <option value="high">{t.priorityHigh}</option>
                    <option value="medium">{t.priorityMedium}</option>
                    <option value="low">{t.priorityLow}</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t.assignee}</span>
                  <input
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.assignee}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, assignee: event.target.value } : prev))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t.parentTask}</span>
                  <select
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.parent_id}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, parent_id: event.target.value } : prev))}
                  >
                    <option value="">{t.none}</option>
                    {allTasks
                      .filter((task) => task.id !== taskForm.id)
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t.nextTask}</span>
                  <select
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.related_task_id}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, related_task_id: event.target.value } : prev))}
                  >
                    <option value="">{t.none}</option>
                    {allTasks
                      .filter((task) => task.id !== taskForm.id)
                      .map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t.planStart}</span>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.start_date}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, start_date: event.target.value } : prev))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">{t.planEnd}</span>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.end_date}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, end_date: event.target.value } : prev))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-blue-600">{t.actStart}</span>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-700"
                    value={taskForm.actual_start_date}
                    onChange={(event) =>
                      setTaskForm((prev) => (prev ? { ...prev, actual_start_date: event.target.value } : prev))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-blue-600">{t.actEnd}</span>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-700"
                    value={taskForm.actual_end_date}
                    onChange={(event) =>
                      setTaskForm((prev) => (prev ? { ...prev, actual_end_date: event.target.value } : prev))
                    }
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-slate-500">{t.progressPercent}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.progress}
                    onChange={(event) =>
                      setTaskForm((prev) =>
                        prev ? { ...prev, progress: Math.max(0, Math.min(100, Number(event.target.value || 0))) } : prev
                      )
                    }
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-slate-500">{t.description}</span>
                  <textarea
                    rows={3}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="text-slate-500">{t.remarks}</span>
                  <textarea
                    rows={2}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    value={taskForm.remarks}
                    onChange={(event) => setTaskForm((prev) => (prev ? { ...prev, remarks: event.target.value } : prev))}
                  />
                </label>
              </div>

              {latestEditingTask && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Paperclip size={14} /> {t.attachments}
                    </h4>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={uploadAttachment} />
                    <button
                      type="button"
                      className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={12} />
                      {t.upload}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {latestEditingTask.attachments.map((attachment) => (
                      <span
                        key={attachment.id}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                      >
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => onPreview({ id: attachment.id, name: attachment.file_name })}
                        >
                          {attachment.file_name}
                        </button>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-500"
                          onClick={() => removeAttachment(attachment)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {latestEditingTask.attachments.length === 0 && <span className="text-xs text-slate-400">{t.noAttachments}</span>}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                {editingTask ? (
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    onClick={deleteTask}
                  >
                    <Trash2 size={15} />
                    {t.delete}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button type="button" className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setTaskModalOpen(false)}>
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={savingTask}
                  >
                    {savingTask ? t.saving : t.save}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
