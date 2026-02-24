import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ auth, allowedRoles, children }) => {
  if (!auth?.token || !auth?.user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(auth.user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
