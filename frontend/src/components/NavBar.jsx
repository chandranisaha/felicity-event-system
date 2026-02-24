import { Link, useNavigate } from "react-router-dom";

const NavBar = ({ auth, onLogout }) => {
  const navigate = useNavigate();

  const logout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <img src="/logo.png" alt="Felicity Logo" className="brand-logo-placeholder" />
          <span>FELICITY 2026</span>
        </Link>
        <nav className="navlinks">
          <Link to="/">Home</Link>
          {auth?.user?.role !== "participant" && <Link to="/events/browse">Events</Link>}
          {auth?.user?.role === "participant" && <Link to="/events/browse">Browse Events</Link>}
          {!auth?.token && <Link to="/login">Login</Link>}
          {!auth?.token && <Link to="/register">Register</Link>}
          {auth?.user?.role === "participant" && <Link to="/dashboard/participant">Dashboard</Link>}
          {auth?.user?.role === "participant" && <Link to="/clubs">Clubs/Organizers</Link>}
          {auth?.user?.role === "participant" && <Link to="/profile">Profile</Link>}
          {auth?.user?.role === "organizer" && <Link to="/dashboard/organizer">Dashboard</Link>}
          {auth?.user?.role === "organizer" && <Link to="/organizer/create-event">Create Event</Link>}
          {auth?.user?.role === "organizer" && <Link to="/organizer/ongoing-events">Ongoing Events</Link>}
          {auth?.user?.role === "organizer" && <Link to="/organizer/profile">Profile</Link>}
          {auth?.user?.role === "admin" && <Link to="/dashboard/admin">Dashboard</Link>}
          {auth?.user?.role === "admin" && <Link to="/admin/manage-organizers">Manage Clubs/Organizers</Link>}
          {auth?.user?.role === "admin" && <Link to="/admin/password-reset-requests">Password Reset Requests</Link>}
          {auth?.token && (
            <button type="button" className="ghost-btn" onClick={logout}>
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default NavBar;
