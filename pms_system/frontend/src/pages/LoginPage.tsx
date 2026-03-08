import React, { useState } from "react";
import { ArrowRight, Layout, Lock, Mail, User } from "lucide-react";
import api from "../lib/api";
import { getErrorMessage } from "../lib/api";
import type { User as UserModel } from "../types";
import { cn } from "../components/shared";
import { useConfig } from "../config";
import { useNotifier } from "../components/notifications";

export const LoginPage = ({
  onLoggedIn
}: {
  onLoggedIn: (token: string, user: UserModel) => void;
}) => {
  const { t } = useConfig();
  const notify = useNotifier();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: "admin", password: "123456", email: "" });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await api.post("/users", {
          username: form.username,
          email: form.email,
          password: form.password
        });
        notify.success(t.accountCreated);
        setIsRegister(false);
      } else {
        const body = new URLSearchParams();
        body.append("username", form.username);
        body.append("password", form.password);
        const tokenRes = await api.post<{ access_token: string; token_type: string }>("/token", body, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
        const meRes = await api.get<UserModel>("/users/me", {
          headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });
        onLoggedIn(tokenRes.data.access_token, meRes.data);
      }
    } catch (error) {
      notify.error(getErrorMessage(error, t.authenticationFailed));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-blue-600 text-white flex items-center justify-center mb-3">
            <Layout size={22} />
          </div>
          <h1 className="text-2xl font-bold">{t.appName}</h1>
          <p className="text-sm text-slate-500 mt-2">{t.enterpriseTagline}</p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-1 grid grid-cols-2 mb-6">
          <button
            className={cn(
              "py-2 rounded-md text-sm",
              !isRegister ? "bg-white dark:bg-slate-600 shadow font-medium" : "text-slate-500"
            )}
            onClick={() => setIsRegister(false)}
          >
            {t.login}
          </button>
          <button
            className={cn(
              "py-2 rounded-md text-sm",
              isRegister ? "bg-white dark:bg-slate-600 shadow font-medium" : "text-slate-500"
            )}
            onClick={() => setIsRegister(true)}
          >
            {t.register}
          </button>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block relative">
            <User size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 pl-9 pr-3 py-2.5"
              placeholder={t.username}
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              required
            />
          </label>
          {isRegister && (
            <label className="block relative">
              <Mail size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="email"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 pl-9 pr-3 py-2.5"
                placeholder={t.email}
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </label>
          )}
          <label className="block relative">
            <Lock size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 pl-9 pr-3 py-2.5"
              placeholder={t.password}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? t.processing : isRegister ? t.register : t.login}
            {!loading && <ArrowRight size={15} />}
          </button>
        </form>
        <p className="text-xs text-slate-400 text-center mt-6">{t.previewMode}</p>
      </div>
    </div>
  );
};
