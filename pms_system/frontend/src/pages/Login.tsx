import React, { useState } from "react";
import api from "../lib/api";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router-dom";
import { Layout, ArrowRight, User, Lock, Mail } from "lucide-react";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [formData, setFormData] = useState({ username: "", password: "", email: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await api.post("/users/", formData);
        alert("Account created! Please login.");
        setIsRegister(false);
      } else {
        const params = new URLSearchParams();
        params.append("username", formData.username);
        params.append("password", formData.password);
        const { data } = await api.post("/token", params, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        const userRes = await api.get("/users/me", { headers: { Authorization: `Bearer ${data.access_token}` } });
        login(data.access_token, userRes.data);
        navigate("/");
      }
    } catch (err: any) { alert("Action failed."); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl border border-white/50">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30"><Layout className="text-white" size={24} /></div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">MPTV System</h1>
          <p className="text-gray-500 mt-2 text-sm">Enterprise Project Management</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg mb-6">
          <button onClick={() => setIsRegister(false)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isRegister ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Login</button>
          <button onClick={() => setIsRegister(true)} className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isRegister ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Register</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative"><User className="absolute left-3 top-3 text-gray-400" size={18} /><input type="text" placeholder="Username" required className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
          {isRegister && <div className="relative animate-in fade-in slide-in-from-top-2"><Mail className="absolute left-3 top-3 text-gray-400" size={18} /><input type="email" placeholder="Email" required className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>}
          <div className="relative"><Lock className="absolute left-3 top-3 text-gray-400" size={18} /><input type="password" placeholder="Password" required className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} /></div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-70">{loading ? "Processing..." : (isRegister ? "Create Account" : "Sign In")}</button>
        </form>
      </div>
    </div>
  );
}