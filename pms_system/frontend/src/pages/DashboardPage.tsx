import React, { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  ChevronRight,
  Download,
  FileBarChart,
  LayoutGrid,
  List,
  Plus,
  Search,
  X
} from "lucide-react";
import type { ProjectSummary, WeeklyReportResponse } from "../types";
import { formatDate } from "../components/shared";
import { useConfig } from "../config";
import { useNotifier } from "../components/notifications";
import { getErrorMessage } from "../lib/api";

export const DashboardPage = ({
  projects,
  openProject,
  onCreateProject,
  onGenerateReport
}: {
  projects: ProjectSummary[];
  openProject: (projectId: number) => void;
  onCreateProject: (payload: { name: string; description: string }) => Promise<void>;
  onGenerateReport: (payload: { start_date: string; end_date: string; project_ids: number[] }) => Promise<WeeklyReportResponse>;
}) => {
  const { t } = useConfig();
  const notify = useNotifier();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportState, setReportState] = useState<{ start: string; end: string; selected: Set<number> }>({
    start: "",
    end: "",
    selected: new Set()
  });

  const filtered = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query]
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > pages) setPage(1);
  }, [pages, page]);

  const defaultReportWindow = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() - ((end.getDay() + 2) % 7));
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10)
    };
  };

  const submitProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      await onCreateProject(projectForm);
      setProjectForm({ name: "", description: "" });
      setShowCreate(false);
      notify.success(t.projectCreated);
    } catch (error) {
      notify.error(getErrorMessage(error, t.projectCreationFailed));
    } finally {
      setCreating(false);
    }
  };

  const openReport = () => {
    const defaults = defaultReportWindow();
    setReportState({ ...defaults, selected: new Set(projects.map((project) => project.id)) });
    setShowReport(true);
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const report = await onGenerateReport({
        start_date: reportState.start,
        end_date: reportState.end,
        project_ids: Array.from(reportState.selected)
      });
      const blob = new Blob([JSON.stringify(report, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `weekly_report_${report.start_date}_${report.end_date}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notify.success(t.reportGenerated);
      setShowReport(false);
    } catch (error) {
      notify.error(getErrorMessage(error, t.reportGenerationFailed));
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t.dashboard}</h1>
          <p className="text-slate-500 mt-1">{t.overviewActiveProjects}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-64"
              placeholder={t.search}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex">
            <button className={`p-2 rounded-md ${view === "grid" ? "bg-slate-100 dark:bg-slate-700" : ""}`} onClick={() => setView("grid")}>
              <LayoutGrid size={16} />
            </button>
            <button className={`p-2 rounded-md ${view === "list" ? "bg-slate-100 dark:bg-slate-700" : ""}`} onClick={() => setView("list")}>
              <List size={16} />
            </button>
          </div>
          <button
            className="px-4 py-2.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 flex items-center gap-2"
            onClick={openReport}
          >
            <FileBarChart size={16} />
            {t.weeklyReport}
          </button>
          <button
            className="px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={16} />
            {t.newProject}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">{t.noActiveProjectsFound}</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paged.map((project) => (
            <button
              key={project.id}
              onClick={() => openProject(project.id)}
              className="text-left p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-4">
                <Briefcase size={20} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100">{project.name}</h3>
              <p className="text-sm text-slate-500 mt-2 h-10 line-clamp-2">{project.description}</p>
              <p className="text-xs text-slate-400 mt-4">{formatDate(project.created_at)}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          {paged.map((project) => (
            <button
              key={project.id}
              onClick={() => openProject(project.id)}
              className="w-full px-4 py-3 text-left border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <Briefcase size={16} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{project.name}</p>
                <p className="text-sm text-slate-500">{project.description}</p>
              </div>
              <p className="text-xs text-slate-400">{formatDate(project.created_at)}</p>
              <ChevronRight size={16} className="text-slate-300" />
            </button>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-8 flex justify-center items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            {t.prev}
          </button>
          <span className="text-sm text-slate-500">
            {t.page} {page} / {pages}
          </span>
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
            disabled={page === pages}
          >
            {t.next}
          </button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-4">{t.newProject}</h3>
            <form className="space-y-4" onSubmit={submitProject}>
              <input
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                placeholder={t.projectNamePlaceholder}
                value={projectForm.name}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <textarea
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                rows={3}
                placeholder={t.description}
                value={projectForm.description}
                onChange={(event) => setProjectForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={() => setShowCreate(false)}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={creating}
                >
                  {creating ? t.creating : t.newProject}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReport && (
        <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <FileBarChart size={18} />
                {t.weeklyReport}
              </h3>
              <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setShowReport(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="block text-sm">
                <span className="text-slate-500">{t.startDate}</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                  value={reportState.start}
                  onChange={(event) => setReportState((prev) => ({ ...prev, start: event.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-500">{t.endDate}</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                  value={reportState.end}
                  onChange={(event) => setReportState((prev) => ({ ...prev, end: event.target.value }))}
                />
              </label>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500">{t.selectProjects}</p>
                <button
                  className="text-xs text-blue-600 hover:underline"
                  onClick={() =>
                    setReportState((prev) => {
                      const allIds = projects.map((project) => project.id);
                      const next = new Set(prev.selected);
                      allIds.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
                      return { ...prev, selected: next };
                    })
                  }
                >
                  {t.invertSelection}
                </button>
              </div>
              <div className="max-h-48 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 space-y-1">
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700">
                    <input
                      type="checkbox"
                      checked={reportState.selected.has(project.id)}
                      onChange={() =>
                        setReportState((prev) => {
                          const next = new Set(prev.selected);
                          next.has(project.id) ? next.delete(project.id) : next.add(project.id);
                          return { ...prev, selected: next };
                        })
                      }
                    />
                    <span>{project.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setShowReport(false)}>
                {t.cancel}
              </button>
              <button
                className="px-4 py-2 rounded bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-60 flex items-center gap-2"
                onClick={generateReport}
                disabled={reportLoading}
              >
                <Download size={14} />
                {reportLoading ? t.generating : t.generate}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
