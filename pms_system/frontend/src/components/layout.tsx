import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Globe,
  Layout,
  LogOut,
  Menu,
  Moon,
  Sun,
  UserCog,
  X
} from "lucide-react";
import api, { getErrorMessage } from "../lib/api";
import type { User } from "../types";
import { cn } from "./shared";
import { useConfig } from "../config";
import { useNotifier } from "./notifications";

const ConfigControls = () => {
  const { lang, setLang, theme, setTheme } = useConfig();
  return (
    <div className="flex items-center gap-1">
      <button
        className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <button
        className="px-2 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 flex items-center gap-1"
        onClick={() => setLang(lang === "zh" ? "vi" : "zh")}
      >
        <Globe size={14} />
        {lang === "zh" ? "CN" : "VN"}
      </button>
    </div>
  );
};

const ProfileModal = ({
  user,
  onClose,
  onSaved
}: {
  user: User;
  onClose: () => void;
  onSaved: (next: User) => void;
}) => {
  const { t } = useConfig();
  const notify = useNotifier();
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    newPassword: ""
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        username: form.username,
        email: form.email
      };
      if (form.newPassword.trim()) payload.new_password = form.newPassword;
      const { data } = await api.put<User>("/users/me", payload);
      onSaved(data);
      notify.success(t.profileUpdated);
      onClose();
    } catch (error) {
      notify.error(getErrorMessage(error, t.profileUpdateFailed));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <UserCog size={18} /> {t.updateProfile}
          </h2>
          <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm">
            <span className="text-slate-500">{t.username}</span>
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t.email}</span>
            <input
              type="email"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-500">{t.newPassword}</span>
            <input
              type="password"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              value={form.newPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" onClick={onClose}>
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AppLayout = ({
  children,
  view,
  setView,
  user,
  onLogout,
  onUserUpdated
}: {
  children: React.ReactNode;
  view: "dashboard" | "files" | "archives" | "project";
  setView: (view: "dashboard" | "files" | "archives") => void;
  user: User;
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
}) => {
  const { t } = useConfig();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", closeOutside);
    return () => window.removeEventListener("mousedown", closeOutside);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="sm:hidden p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setMobileOpen((prev) => !prev)}>
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <button className="flex items-center gap-2" onClick={() => setView("dashboard")}>
                <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <Layout size={16} />
                </span>
                <span className="font-bold text-sm sm:text-base">{t.appName}</span>
              </button>
              <nav className="hidden sm:flex items-center gap-2 ml-4">
                {[
                  ["dashboard", t.dashboard],
                  ["files", t.projectFiles],
                  ["archives", t.archives]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setView(value as "dashboard" | "files" | "archives")}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm",
                      view === value
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                        : "text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="hidden sm:flex items-center gap-3">
              <ConfigControls />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                    {user.username[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm max-w-24 truncate">{user.username}</span>
                  <ChevronDown size={14} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                      <p className="font-medium text-sm truncate">{user.username}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      onClick={() => {
                        setProfileOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      <UserCog size={14} />
                      {t.editProfile}
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      onClick={onLogout}
                    >
                      <LogOut size={14} />
                      {t.logout}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {mobileOpen && (
            <div className="sm:hidden pb-3 space-y-1">
              {[
                ["dashboard", t.dashboard],
                ["files", t.projectFiles],
                ["archives", t.archives]
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={cn(
                    "block w-full text-left px-3 py-2 rounded-md text-sm",
                    view === value
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
                      : "hover:bg-slate-100 dark:hover:bg-slate-700"
                  )}
                  onClick={() => {
                    setView(value as "dashboard" | "files" | "archives");
                    setMobileOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
              <div className="pt-2 flex items-center justify-between px-2">
                <ConfigControls />
                <button
                  className="px-3 py-1.5 rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300 text-sm"
                  onClick={onLogout}
                >
                  {t.logout}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      {profileOpen && (
        <ProfileModal
          user={user}
          onClose={() => setProfileOpen(false)}
          onSaved={onUserUpdated}
        />
      )}
    </div>
  );
};
