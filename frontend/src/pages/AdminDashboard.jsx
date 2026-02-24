import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

const AdminDashboard = ({ auth, initialView = "dashboard" }) => {
  const [organizers, setOrganizers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState(initialView);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newOrg, setNewOrg] = useState({
    name: "",
    category: "",
    description: "",
    contactEmail: "",
    password: "",
  });
  const [createdCredentials, setCreatedCredentials] = useState(null);

  const load = async () => {
    setError("");
    try {
      const orgResponse = await apiRequest({ path: "/api/admin/organizers", token: auth.token });
      setOrganizers(orgResponse.organizers || []);
    } catch (err) {
      setError((prev) => `${prev ? `${prev} | ` : ""}organizers load failed: ${err.message}`);
      setOrganizers([]);
    }

    try {
      const reqResponse = await apiRequest({ path: "/api/admin/password-reset-requests", token: auth.token });
      setRequests(reqResponse.requests || []);
    } catch (err) {
      setError((prev) => `${prev ? `${prev} | ` : ""}reset requests load failed: ${err.message}`);
      setRequests([]);
    }
  };

  useEffect(() => {
    setView(initialView);
    setShowCreateForm(false);
  }, [initialView]);

  useEffect(() => {
    load();
  }, []);

  const toggleOrganizer = async (id) => {
    try {
      await apiRequest({
        path: `/api/admin/organizer/${id}/toggle-active`,
        method: "PATCH",
        token: auth.token,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteOrganizer = async (id, name) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete ${name}? This will remove related events and tickets.`);
    if (!confirmed) return;

    try {
      await apiRequest({
        path: `/api/admin/organizer/${id}/permanent`,
        method: "DELETE",
        token: auth.token,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const resolveReset = async (id, action) => {
    try {
      setMessage("");
      const response = await apiRequest({
        path: `/api/admin/password-reset-requests/${id}`,
        method: "PATCH",
        token: auth.token,
        body: {
          action,
          note: "admin review from dashboard",
        },
      });
      if (response.generatedPassword) {
        setMessage(`New organizer password: ${response.generatedPassword}`);
      } else {
        setMessage(response.message);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const createOrganizer = async (event) => {
    event.preventDefault();
    try {
      setMessage("");
      const response = await apiRequest({
        path: "/api/admin/create-organizer",
        method: "POST",
        token: auth.token,
        body: newOrg,
      });
      setNewOrg({
        name: "",
        category: "",
        description: "",
        contactEmail: "",
        password: "",
      });
      setShowCreateForm(false);
      await load();
      const creds = {
        name: response.organizer?.name || newOrg.name,
        email: response.generatedContactEmail || response.organizer?.contactEmail,
        password: response.generatedPassword,
      };
      setCreatedCredentials(creds);
      setMessage(`Organizer created: ${creds.name}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="page admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="tabs admin-tabs">
        {["dashboard", "manage", "reset"].map((item) => (
          <button key={item} type="button" className={view === item ? "tab-btn tab-btn-active" : "tab-btn"} onClick={() => setView(item)}>
            {item === "dashboard" ? "Dashboard" : item === "manage" ? "Manage Clubs/Organizers" : "Password Reset Requests"}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      {view === "dashboard" && (
        <section className="card">
          <h3>Overview</h3>
          <div className="stats-grid admin-stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Organizers</div>
              <div className="stat-value">{organizers.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Active Organizers</div>
              <div className="stat-value">{organizers.filter((item) => item.isActive).length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pending Reset Requests</div>
              <div className="stat-value">{requests.filter((item) => item.status === "Pending").length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Disabled Organizers</div>
              <div className="stat-value">{organizers.filter((item) => !item.isActive).length}</div>
            </div>
          </div>

          <div className="grid admin-overview-grid">
            <section className="inline-box admin-overview-card">
              <h3>Recent Organizers</h3>
              {organizers.slice(0, 5).map((org) => (
                <p key={org._id} className="event-meta">
                  {org.name} | {org.category} | {org.isActive ? "Active" : "Disabled"}
                </p>
              ))}
            </section>
            <section className="inline-box admin-overview-card">
              <h3>Pending Reset Actions</h3>
              {requests.filter((item) => item.status === "Pending").slice(0, 5).map((reqItem) => (
                <p key={reqItem._id} className="event-meta">
                  {reqItem.organizer?.name || "Organizer"}: {reqItem.reason}
                </p>
              ))}
            </section>
            <section className="inline-box admin-overview-card">
              <h3>Quick Actions</h3>
              <div className="action-row">
                <button type="button" onClick={() => setView("manage")}>
                  Open Organizer Management
                </button>
                <button type="button" className="subtle-btn" onClick={() => setView("reset")}>
                  Review Reset Requests
                </button>
              </div>
            </section>
          </div>
        </section>
      )}

      {view === "manage" && (
        <section className="card">
          <div className="page-head compact">
            <h3>Clubs / Organizers</h3>
            <button type="button" onClick={() => setShowCreateForm((prev) => !prev)}>
              {showCreateForm ? "Hide Create Organizer" : "Create Organizer"}
            </button>
          </div>

          {showCreateForm && (
            <form className="form separated" onSubmit={createOrganizer}>
              <label>
                Organizer Name
                <input value={newOrg.name} onChange={(e) => setNewOrg((prev) => ({ ...prev, name: e.target.value }))} required />
              </label>
              <label>
                Category
                <select value={newOrg.category} onChange={(e) => setNewOrg((prev) => ({ ...prev, category: e.target.value }))} required>
                  <option value="">Select category</option>
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Sports">Sports</option>
                </select>
              </label>
              <label>
                Description
                <input value={newOrg.description} onChange={(e) => setNewOrg((prev) => ({ ...prev, description: e.target.value }))} required />
              </label>
              <label>
                Login Email (optional, auto-generated if empty)
                <input type="email" value={newOrg.contactEmail} onChange={(e) => setNewOrg((prev) => ({ ...prev, contactEmail: e.target.value }))} />
              </label>
              <label>
                Password (optional, auto-generated if empty)
                <input type="text" value={newOrg.password} onChange={(e) => setNewOrg((prev) => ({ ...prev, password: e.target.value }))} />
              </label>
              <button type="submit">Create Organizer</button>
            </form>
          )}

          {organizers.length === 0 ? (
            <div className="empty-note">No organizers found.</div>
          ) : (
            <div className="table-wrap separated">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Password</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizers.map((organizer) => (
                    <tr key={organizer._id}>
                      <td>{organizer.name}</td>
                      <td>{organizer.contactEmail}</td>
                      <td>{organizer.adminVisiblePassword || "N/A"}</td>
                      <td>{organizer.category}</td>
                      <td>{organizer.isActive ? "Active" : "Disabled"}</td>
                      <td>
                        <div className="row">
                          <button
                            type="button"
                            className={organizer.isActive ? "danger-btn" : "success-btn"}
                            onClick={() => toggleOrganizer(organizer._id)}
                          >
                            {organizer.isActive ? "Disable" : "Enable"}
                          </button>
                          <button type="button" className="danger-btn" onClick={() => deleteOrganizer(organizer._id, organizer.name)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {view === "reset" && (
        <section className="card">
          <h3>Password Reset Requests</h3>
          {requests.length === 0 ? (
            <div className="empty-note">No password reset requests found.</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Organizer</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request._id}>
                      <td>{request.organizer?.name}</td>
                      <td>{request.status}</td>
                      <td>{request.reason}</td>
                      <td>
                        {request.status === "Pending" ? (
                          <div className="row">
                            <button type="button" onClick={() => resolveReset(request._id, "approve")}>
                              Approve
                            </button>
                            <button type="button" className="danger-btn" onClick={() => resolveReset(request._id, "reject")}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {createdCredentials ? (
        <div className="scanner-modal-overlay" onClick={() => setCreatedCredentials(null)}>
          <div className="scanner-result-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Organizer Created Successfully</h3>
            <p className="muted">Share these credentials with the organizer. They should use these exact details to login.</p>
            <p>
              <strong>Name:</strong> {createdCredentials.name}
            </p>
            <p>
              <strong>Email:</strong> {createdCredentials.email}
            </p>
            <p>
              <strong>Password:</strong> {createdCredentials.password}
            </p>
            <button type="button" onClick={() => setCreatedCredentials(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default AdminDashboard;
