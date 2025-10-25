import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";

interface DevRouteProps {
  children: ReactNode;
}

export function DevRoute({ children }: DevRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="centered">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user.isDev && !user.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
