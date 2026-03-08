import React, { useMemo, useState } from "react";
import { Archive, Briefcase, ChevronRight, LayoutGrid, List, Search } from "lucide-react";
import type { ProjectSummary } from "../types";
import { formatDate } from "../components/shared";
import { useConfig } from "../config";

export const ArchivesPage = ({
  projects,
  openProject
}: {
  projects: ProjectSummary[];
  openProject: (projectId: number) => void;
}) => {
  const { t } = useConfig();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query]
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Archive size={24} className="text-slate-500" />
            {t.archives}
          </h1>
          <p className="text-slate-500 mt-1">{t.inactiveProjects}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-64"
              placeholder={t.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
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
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">{t.noArchivedProjectsFound}</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {paged.map((project) => (
            <button
              key={project.id}
              onClick={() => openProject(project.id)}
              className="text-left p-5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-slate-400 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 flex items-center justify-center mb-4">
                <Briefcase size={20} />
              </div>
              <h3 className="font-bold">{project.name}</h3>
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
          <button className="px-3 py-1.5 border rounded" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
            {t.prev}
          </button>
          <span className="text-sm text-slate-500">
            {t.page} {page} / {pages}
          </span>
          <button className="px-3 py-1.5 border rounded" onClick={() => setPage((prev) => Math.min(pages, prev + 1))}>
            {t.next}
          </button>
        </div>
      )}
    </div>
  );
};
