import React from "react";
import { Layout as LayoutIcon, LogOut, User, FolderKanban } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate, useLocation } from "react-router-dom";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col fixed h-full z-20">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="bg-blue-600 p-1.5 rounded-lg mr-3"><LayoutIcon className="text-white w-5 h-5" /></div>
          <span className="font-bold text-lg text-gray-800 tracking-tight">MPTV System</span>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button onClick={() => navigate("/")} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${location.pathname === "/" ? "bg-blue-50 text-blue-700 shadow-sm" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"}`}>
            <FolderKanban size={18} /> My Projects
          </button>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">{user?.username?.[0]?.toUpperCase() || "U"}</div>
            <div className="flex-1 overflow-hidden"><p className="text-sm font-medium text-gray-900 truncate">{user?.username}</p></div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"><LogOut size={16} /> Sign Out</button>
        </div>
      </aside>
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">{children}</main>
    </div>
  );
};