import React, { useEffect, useMemo, useState } from "react";
import api, { getErrorMessage } from "./lib/api";
import { useAuthStore } from "./store/useAuthStore";
import { ConfigContext, type Language, type Theme, TRANSLATIONS } from "./config";
import type { PageResponse, ProjectSummary, User, WeeklyReportResponse } from "./types";
import { FilePreviewModal, type PreviewFile } from "./components/shared";
import { LoginPage } from "./pages/LoginPage";
import { AppLayout } from "./components/layout";
import { DashboardPage } from "./pages/DashboardPage";
import { ArchivesPage } from "./pages/ArchivesPage";
import { ProjectFilesPage } from "./pages/ProjectFilesPage";
import { ProjectBoardPage } from "./pages/ProjectBoardPage";
import { useNotifier } from "./components/notifications";

type View = "dashboard" | "files" | "archives" | "project";

export default function App() {
  const notify = useNotifier();
  const { token, user, login, logout, setUser } = useAuthStore();
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem("mptv-lang") as Language) || "zh");
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("mptv-theme") as Theme) || "light");
  const [booting, setBooting] = useState(true);
  const t = TRANSLATIONS[lang];

  const loadProjects = async () => {
    const pageSize = 100;
    let page = 1;
    let total = 0;
    const allItems: ProjectSummary[] = [];
    let safety = 0;
    do {
      const { data } = await api.get<PageResponse<ProjectSummary>>("/projects", {
        params: { page, page_size: pageSize }
      });
      allItems.push(...data.items);
      total = data.total;
      if (data.items.length === 0) break;
      page += 1;
      safety += 1;
    } while (allItems.length < total && safety < 1000);
    setProjects(allItems);
    setProjectsError(null);
  };

  useEffect(() => {
    localStorage.setItem("mptv-lang", lang);
  }, [lang]);

  useEffect(() => {
    localStorage.setItem("mptv-theme", theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      if (!token) {
        if (mounted) {
          setBooting(false);
          setProjects([]);
        }
        return;
      }
      try {
        const { data } = await api.get<User>("/users/me");
        if (!mounted) return;
        setUser(data);
        await loadProjects();
      } catch (error) {
        if (!mounted) return;
        const message = getErrorMessage(error, t.failedInitializeApp);
        if (useAuthStore.getState().token) {
          setProjectsError(message);
        } else {
          logout();
        }
      } finally {
        if (mounted) setBooting(false);
      }
    };
    bootstrap();
    return () => {
      mounted = false;
    };
  }, [token]);

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active"), [projects]);
  const archiveProjects = useMemo(() => projects.filter((project) => project.status === "inactive"), [projects]);

  const handleLogin = async (nextToken: string, nextUser: User) => {
    login(nextToken, nextUser);
    setCurrentView("dashboard");
    try {
      await loadProjects();
    } catch (error) {
      notify.error(getErrorMessage(error, t.failedLoadProjects));
    }
  };

  const openProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    setCurrentView("project");
  };

  const goBackFromProject = () => {
    const current = projects.find((project) => project.id === selectedProjectId);
    setCurrentView(current?.status === "inactive" ? "archives" : "dashboard");
  };

  if (booting) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">{t.loading}</div>;
  }

  return (
    <ConfigContext.Provider
      value={{
        lang,
        setLang,
        theme,
        setTheme,
        t
      }}
    >
      {!token || !user ? (
        <LoginPage onLoggedIn={handleLogin} />
      ) : (
        <AppLayout
          view={currentView}
          setView={(view) => {
            setCurrentView(view);
            setSelectedProjectId(null);
          }}
          user={user}
          onLogout={() => {
            logout();
            setCurrentView("dashboard");
            setSelectedProjectId(null);
            setProjectsError(null);
            setProjects([]);
          }}
          onUserUpdated={setUser}
        >
          {projectsError && (
            <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/30 text-sm text-red-700 dark:text-red-200 flex items-center justify-between gap-3">
              <span>{projectsError}</span>
              <button
                className="px-3 py-1 rounded border border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-800/40"
                onClick={async () => {
                  try {
                    await loadProjects();
                  } catch (error) {
                    notify.error(getErrorMessage(error, t.failedRefreshProjects));
                  }
                }}
              >
                {t.retry}
              </button>
            </div>
          )}
          {currentView === "dashboard" && (
            <DashboardPage
              projects={activeProjects}
              openProject={openProject}
              onCreateProject={async (payload) => {
                await api.post("/projects", payload);
                await loadProjects();
              }}
              onGenerateReport={async (payload) => {
                const { data } = await api.post<WeeklyReportResponse>("/reports/weekly", payload);
                return data;
              }}
            />
          )}
          {currentView === "archives" && <ArchivesPage projects={archiveProjects} openProject={openProject} />}
          {currentView === "files" && <ProjectFilesPage projects={projects} onPreview={setPreviewFile} />}
          {currentView === "project" && selectedProjectId && (
            <ProjectBoardPage projectId={selectedProjectId} onBack={goBackFromProject} onProjectsChanged={loadProjects} onPreview={setPreviewFile} />
          )}
        </AppLayout>
      )}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </ConfigContext.Provider>
  );
}
