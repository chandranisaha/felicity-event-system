import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

const LoginPage = ({ setAuth }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState("participant");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const routeByRole = {
    participant: "/dashboard/participant",
    organizer: "/dashboard/organizer",
    admin: "/dashboard/admin",
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const body =
        role === "organizer"
          ? { contactEmail: identifier, password, role }
          : { email: identifier, password, role };
      const response = await apiRequest({
        path: "/api/auth/login",
        method: "POST",
        body,
      });
      const auth = { token: response.token, user: response.user };
      setAuth(auth);
      if (response.user.role === "participant" && !response.user.onboardingCompleted) {
        navigate("/onboarding/participant");
      } else {
        navigate(routeByRole[response.user.role] || "/");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page narrow">
      <h1>Login</h1>
      <form className="card form" onSubmit={submit}>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="participant">Participant</option>
            <option value="organizer">Organizer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label>
          {role === "organizer" ? "Contact Email" : "Email"}
          <input placeholder="Enter email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </label>
        <label>
          Password
          <input placeholder="Enter password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Logging In..." : "Login"}
        </button>
      </form>
      <p className="helper-link">
        No account? <Link to="/register">Register</Link>
      </p>
    </main>
  );
};

export default LoginPage;
