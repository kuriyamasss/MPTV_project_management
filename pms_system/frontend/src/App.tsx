import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProjectBoard from "./pages/ProjectBoard";
const ProtectedRoute = ({ children }: { children: JSX.Element }) => { const token = useAuthStore((state) => state.token); if (!token) return <Navigate to="/login" replace />; return children; };
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute><ProjectBoard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
};
export default App;