import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";

const ClubsPage = ({ auth }) => {
  const [allOrganizers, setAllOrganizers] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [burstByClub, setBurstByClub] = useState({});
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        path: "/api/participants/organizers",
        token: auth.token,
      });
      setAllOrganizers(response.organizers || []);
      const eventsResponse = await apiRequest({
        path: "/api/events/public",
        token: auth.token,
      });
      const publicEvents = eventsResponse.events || [];
      const followedIds = new Set((response.organizers || []).filter((org) => org.isFollowed).map((org) => String(org.id)));
      const top = publicEvents
        .filter((event) => followedIds.has(String(event.organizer?._id || event.organizer?.id || "")))
        .slice(0, 8);
      const generatedUpdates = [];
      if (top.length > 0) {
        top.forEach((event, index) => {
          if (index % 2 === 0) {
            generatedUpdates.push(`${event.organizer?.name || "A club"} has upcoming event "${event.name}" on ${new Date(event.startDate).toLocaleDateString()}.`);
          } else {
            generatedUpdates.push(`${event.organizer?.name || "Club"} is collaborating with Sports Council for "${event.name}".`);
          }
        });
      }
      setUpdates(generatedUpdates);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const organizers = allOrganizers.filter((organizer) => {
    const qValue = q.trim().toLowerCase();
    const categoryPass = !category || String(organizer.category || "").toLowerCase() === category.toLowerCase();
    const searchPass =
      !qValue ||
      String(organizer.name || "").toLowerCase().includes(qValue) ||
      String(organizer.category || "").toLowerCase().includes(qValue) ||
      String(organizer.description || "").toLowerCase().includes(qValue);
    return categoryPass && searchPass;
  });

  const toggleFollow = async (organizer) => {
    try {
      await apiRequest({
        path: `/api/participants/organizers/${organizer.id}/follow`,
        method: organizer.isFollowed ? "DELETE" : "POST",
        token: auth.token,
      });
      if (!organizer.isFollowed) {
        setBurstByClub((prev) => ({ ...prev, [organizer.id]: true }));
        setTimeout(() => {
          setBurstByClub((prev) => ({ ...prev, [organizer.id]: false }));
        }, 1800);
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>Clubs / Organizers</h1>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="portal-layout">
        <aside className="card side-filter">
          <h3>Search</h3>
          <div className="form">
            <label>
              Club or Category
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dance, Hacking, Robotics..." />
            </label>
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All</option>
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
              </select>
            </label>
            <button type="button" className="subtle-btn" onClick={() => { setQ(""); setCategory(""); }}>
              Clear Filters
            </button>
            <p className="event-meta"><strong>Results:</strong> {organizers.length}</p>
          </div>
        </aside>

        <section className="main-column">
          {loading && <p>Loading Organizers...</p>}
          {error && <p className="error">{error}</p>}
          <div className="grid">
            {organizers.map((organizer) => (
              <article className="card club-card" key={organizer.id}>
                {burstByClub[organizer.id] ? <div className="confetti-burst" /> : null}
                <h3>{organizer.name}</h3>
                <p className="event-meta">
                  <strong>Category:</strong> {organizer.category}
                </p>
                <p>{organizer.description}</p>
                <div className="action-row">
                  <Link to={`/clubs/${organizer.id}`} className="link-btn subtle-btn">
                    View Details
                  </Link>
                  <button type="button" className={organizer.isFollowed ? "accent-pink" : "accent-blue"} onClick={() => toggleFollow(organizer)}>
                    {organizer.isFollowed ? "Unfollow" : "Follow"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="card side-notifications">
          <h3>Club Updates</h3>
          <div className="form">
            {updates.length === 0 ? <p className="muted">Follow clubs to receive club-specific updates here.</p> : null}
            {updates.map((item, index) => (
              <div className="notification-item" key={`update-${index}`}>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default ClubsPage;
