import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Eye,
  FileDigit,
  Folder,
  LayoutGrid,
  List,
  Search,
  Upload,
  X
} from "lucide-react";
import api, { getErrorMessage, triggerAttachmentDownload } from "../lib/api";
import type {
  PageResponse,
  Project,
  ProjectFileItem,
  ProjectSummary
} from "../types";
import { formatDate, formatSize, PreviewFile } from "../components/shared";
import { useConfig } from "../config";
import { useNotifier } from "../components/notifications";

const SHARED_UPLOAD_TARGET = "__PROJECT_SHARED__";
const SYSTEM_SHARED_FILES_MARKER = "__system_project_shared_files__";

export const ProjectFilesPage = ({
  projects,
  onPreview
}: {
  projects: ProjectSummary[];
  onPreview: (file: PreviewFile) => void;
}) => {
  const { t } = useConfig();
  const notify = useNotifier();
  const [openedProjectId, setOpenedProjectId] = useState<number | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<ProjectFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [filesRefreshToken, setFilesRefreshToken] = useState(0);
  const [filesPage, setFilesPage] = useState(1);
  const [filesTotal, setFilesTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [projectTasks, setProjectTasks] = useState<Array<{ id: number; title: string }>>(
    []
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTaskId, setUploadTaskId] = useState<number | typeof SHARED_UPLOAD_TARGET>(
    SHARED_UPLOAD_TARGET
  );
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const pageSize = 10;
  const filesPageSize = 20;

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        project.name.toLowerCase().includes(query.toLowerCase())
      ),
    [projects, query]
  );
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const pagedProjects = filteredProjects.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const openedProject = useMemo(
    () => projects.find((project) => project.id === openedProjectId) ?? null,
    [openedProjectId, projects]
  );
  const filesPages = Math.max(1, Math.ceil(filesTotal / filesPageSize));

  useEffect(() => {
    if (!openedProjectId) {
      setFiles([]);
      setSelected(new Set());
      setFilesError(null);
      setProjectTasks([]);
      setUploadTaskId(SHARED_UPLOAD_TARGET);
      setUploadFiles([]);
      setUploadOpen(false);
      return;
    }
    let mounted = true;
    setLoadingFiles(true);
    setFilesError(null);
    api
      .get<PageResponse<ProjectFileItem>>(`/projects/${openedProjectId}/files`, {
        params: { page: filesPage, page_size: filesPageSize }
      })
      .then((response) => {
        if (!mounted) return;
        setFiles(response.data.items);
        setFilesTotal(response.data.total);
        setSelected(new Set());
      })
      .catch((error) => {
        if (!mounted) return;
        const message = getErrorMessage(error, t.failedLoadFiles);
        setFiles([]);
        setFilesTotal(0);
        setFilesError(message);
      })
      .finally(() => {
        if (mounted) setLoadingFiles(false);
      });
    return () => {
      mounted = false;
    };
  }, [openedProjectId, filesPage, filesRefreshToken]);

  useEffect(() => {
    if (!openedProjectId) return;
    let mounted = true;
    api
      .get<Project>(`/projects/${openedProjectId}`)
      .then((response) => {
        if (!mounted) return;
        const tasks = response.data.columns
          .flatMap((column) => column.tasks)
          .filter((task) => task.remarks !== SYSTEM_SHARED_FILES_MARKER)
          .map((task) => ({ id: task.id, title: task.title }));
        setProjectTasks(tasks);
        setUploadTaskId((prev) => {
          if (prev === SHARED_UPLOAD_TARGET) return prev;
          if (typeof prev === "number" && tasks.some((task) => task.id === prev)) {
            return prev;
          }
          return SHARED_UPLOAD_TARGET;
        });
      })
      .catch((error) => {
        if (!mounted) return;
        notify.error(getErrorMessage(error, t.failedLoadProjectTasks));
        setProjectTasks([]);
        setUploadTaskId(SHARED_UPLOAD_TARGET);
      });
    return () => {
      mounted = false;
    };
  }, [openedProjectId]);

  const toggle = (fileId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(fileId) ? next.delete(fileId) : next.add(fileId);
      return next;
    });
  };

  const batchDownload = async () => {
    let failed = 0;
    for (const id of selected) {
      try {
        await triggerAttachmentDownload(id);
      } catch {
        failed += 1;
      }
    }
    if (failed === 0) {
      notify.success(t.downloadsStarted.replace("{count}", String(selected.size)));
    } else {
      notify.error(t.downloadsFailed.replace("{count}", String(failed)));
    }
  };

  const submitUpload = async () => {
    if (!openedProjectId) {
      notify.error(t.projectNotSelected);
      return;
    }
    if (uploadFiles.length === 0) {
      notify.error(t.chooseAtLeastOneFile);
      return;
    }

    setUploading(true);
    try {
      let uploadedCount = 0;
      for (const file of uploadFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (uploadTaskId === SHARED_UPLOAD_TARGET) {
          await api.post(`/projects/${openedProjectId}/attachments`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        } else {
          await api.post(`/tasks/${uploadTaskId}/attachments`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        }
        uploadedCount += 1;
      }
      setUploadOpen(false);
      setUploadFiles([]);
      setFilesPage(1);
      setFilesRefreshToken((prev) => prev + 1);
      notify.success(t.uploadedFiles.replace("{count}", String(uploadedCount)));
    } catch (error) {
      notify.error(getErrorMessage(error, t.fileUploadFailed));
    } finally {
      setUploading(false);
    }
  };

  if (!openedProject) {
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t.projectFiles}</h1>
            <p className="text-slate-500 mt-1">{t.browseFilesByProject}</p>
          </div>
          <div className="flex items-center gap-2">
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
              <button
                className={`p-2 rounded-md ${view === "grid" ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                onClick={() => setView("grid")}
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`p-2 rounded-md ${view === "list" ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                onClick={() => setView("list")}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 text-slate-400">{t.noFiles}</div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {pagedProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setOpenedProjectId(project.id);
                  setFilesPage(1);
                }}
                className="text-center group"
              >
                <div className="aspect-square rounded-2xl border-2 border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 group-hover:border-blue-400 flex items-center justify-center mb-2">
                  <Folder
                    size={54}
                    className="text-blue-500"
                    fill="currentColor"
                    fillOpacity={0.2}
                  />
                </div>
                <p className="font-medium truncate">{project.name}</p>
                <p className="text-xs text-slate-400">
                  {new Date(project.created_at).getFullYear()}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {pagedProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  setOpenedProjectId(project.id);
                  setFilesPage(1);
                }}
                className="w-full px-4 py-3 text-left border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3"
              >
                <Folder size={18} className="text-blue-500" />
                <span className="flex-1 font-medium">{project.name}</span>
                <span className="text-xs text-slate-400">
                  {formatDate(project.created_at)}
                </span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              className="px-3 py-1.5 border rounded"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t.prev}
            </button>
            <span className="text-sm text-slate-500">
              {t.page} {page} / {totalPages}
            </span>
            <button
              className="px-3 py-1.5 border rounded"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              {t.next}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
          onClick={() => setOpenedProjectId(null)}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-xs text-slate-500">
            <button className="hover:underline" onClick={() => setOpenedProjectId(null)}>
              {t.allProjects}
            </button>{" "}
            / {openedProject.name}
          </p>
          <h1 className="text-3xl font-bold">{t.files}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
            onClick={() => setUploadOpen(true)}
          >
            <Upload size={16} />
            {t.upload}
          </button>
          <button
            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 ${
              selected.size > 0
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-slate-200 text-slate-500 cursor-not-allowed"
            }`}
            disabled={selected.size === 0}
            onClick={batchDownload}
          >
            <Download size={16} />
            {t.downloadSelected} ({selected.size})
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={files.length > 0 && selected.size === files.length}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? new Set(files.map((file) => file.id))
                        : new Set()
                    )
                  }
                />
              </th>
              <th className="px-4 py-3">{t.fileColumn}</th>
              <th className="px-4 py-3">{t.taskColumn}</th>
              <th className="px-4 py-3">{t.uploadedColumn}</th>
              <th className="px-4 py-3">{t.sizeColumn}</th>
              <th className="px-4 py-3 text-right">{t.actionsColumn}</th>
            </tr>
          </thead>
          <tbody>
            {loadingFiles ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>
                  {t.loading}
                </td>
              </tr>
            ) : filesError ? (
              <tr>
                <td className="px-4 py-8 text-center text-red-500" colSpan={6}>
                  <div className="space-y-2">
                    <p>{filesError}</p>
                    <button
                      className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      onClick={() => setFilesRefreshToken((prev) => prev + 1)}
                    >
                      {t.retry}
                    </button>
                  </div>
                </td>
              </tr>
            ) : files.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-400" colSpan={6}>
                  {t.noFiles}
                </td>
              </tr>
            ) : (
              files.map((file) => (
                <tr
                  key={file.id}
                  className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(file.id)}
                      onChange={() => toggle(file.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    <FileDigit size={14} className="text-blue-500" />
                    {file.file_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{file.task_title}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(file.uploaded_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatSize(file.size)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => onPreview({ id: file.id, name: file.file_name })}
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        onClick={async () => {
                          try {
                            await triggerAttachmentDownload(file.id);
                          } catch (error) {
                            notify.error(
                              getErrorMessage(error, t.failedDownloadFile)
                            );
                          }
                        }}
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filesPages > 1 && (
        <div className="mt-6 flex justify-center items-center gap-2">
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            disabled={filesPage === 1}
            onClick={() => setFilesPage((prev) => Math.max(1, prev - 1))}
          >
            {t.prev}
          </button>
          <span className="text-sm text-slate-500">
            {t.page} {filesPage} / {filesPages}
          </span>
          <button
            className="px-3 py-1.5 border rounded disabled:opacity-50"
            disabled={filesPage === filesPages}
            onClick={() => setFilesPage((prev) => Math.min(filesPages, prev + 1))}
          >
            {t.next}
          </button>
        </div>
      )}

      {uploadOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Upload size={16} />
                {t.uploadFiles}
              </h3>
              <button
                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => {
                  if (uploading) return;
                  setUploadOpen(false);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-sm">
                <span className="text-slate-500">{t.targetTask}</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                  value={uploadTaskId}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === SHARED_UPLOAD_TARGET) {
                      setUploadTaskId(SHARED_UPLOAD_TARGET);
                    } else {
                      setUploadTaskId(Number(value));
                    }
                  }}
                  disabled={uploading}
                >
                  <option value={SHARED_UPLOAD_TARGET}>
                    {t.projectSharedFolder}
                  </option>
                  {projectTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      #{task.id} {task.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-500">{t.files}</span>
                <input
                  type="file"
                  multiple
                  className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2"
                  onChange={(event) =>
                    setUploadFiles(Array.from(event.target.files ?? []))
                  }
                  disabled={uploading}
                />
              </label>

              <div className="text-xs text-slate-500">
                {uploadFiles.length > 0
                  ? t.selectedFiles.replace("{count}", String(uploadFiles.length))
                  : t.noFilesSelected}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                {t.cancel}
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={submitUpload}
                disabled={uploading}
              >
                {uploading ? t.uploading : t.upload}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
