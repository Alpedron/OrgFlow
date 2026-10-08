import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Wraps a route so only authenticated users can access it.
 * While the auth state is loading, renders nothing (avoids flash).
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  // User is logged in but hasn't completed setup → send to wizard
  if (!user.org?.configured) return <Navigate to="/setup" replace />;

  return children;
}
