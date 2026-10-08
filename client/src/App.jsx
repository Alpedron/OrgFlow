import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import Setup from "./pages/Setup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import AskOrgFlow from "./pages/AskOrgFlow.jsx";
import Events from "./pages/Events.jsx";
import Tasks from "./pages/Tasks.jsx";
import Resources from "./pages/Resources.jsx";
import PassTheTorch from "./pages/PassTheTorch.jsx";
import Organization from "./pages/Organization.jsx";
import Landing from "./pages/Landing.jsx";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Setup />} />

      {/* Protected app routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="ask" element={<AskOrgFlow />} />
        <Route path="events" element={<Events />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="resources" element={<Resources />} />
        <Route path="pass-the-torch" element={<PassTheTorch />} />
        <Route path="organization" element={<Organization />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
