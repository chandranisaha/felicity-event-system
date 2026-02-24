import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";
import SmartImage from "../components/SmartImage";

const PublicEventsPage = ({ auth }) => {
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    q: "",
    eventType: "",
    eligibility: "",
    dateFrom: "",
    dateTo: "",
    followedOnly: false,
  });
  const [appliedFilters, setAppliedFilters] = useState({
    q: "",
    eventType: "",
    eligibility: "",
    dateFrom: "",
    dateTo: "",
    followedOnly: false,
  });

  const browseMode = auth?.user?.role === "participant";

  const loadEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ path: "/api/events/public", token: auth?.token });
      setAllEvents(response.events || []);
      setTrending(response.trending || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const now = useMemo(() => new Date(), [allEvents.length]);

  const filteredEvents = useMemo(() => {
    const q = String(appliedFilters.q || "").trim().toLowerCase();
    const fromDate = appliedFilters.dateFrom ? new Date(`${appliedFilters.dateFrom}T00:00:00`) : null;
    const toDate = appliedFilters.dateTo ? new Date(`${appliedFilters.dateTo}T23:59:59`) : null;
    return allEvents.filter((event) => {
      if (appliedFilters.eventType && event.eventType !== appliedFilters.eventType) return false;

      if (appliedFilters.eligibility) {
        const eventEligibility = String(event.eligibility || "").toLowerCase();
        const target = String(appliedFilters.eligibility).toLowerCase();
        if (target === "iiit" && !(eventEligibility === "iiit" || eventEligibility === "all")) return false;
        if (target === "non-iiit" && !(eventEligibility === "non-iiit" || eventEligibility === "all")) return false;
        if (target === "all" && eventEligibility !== "all") return false;
      }

      if (fromDate || toDate) {
        const eventStart = new Date(event.startDate);
        if (fromDate && eventStart < fromDate) return false;
        if (toDate && eventStart > toDate) return false;
      }

      if (appliedFilters.followedOnly && !event.recommended) return false;

      if (q) {
        const hay = `${event.name || ""} ${event.organizer?.name || ""} ${event.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [allEvents, appliedFilters]);

  const isRegisterDisabled = (event) => {
    const deadlinePassed = new Date(event.registrationDeadline) < now;
    const completed = event.effectiveEventStatus === "Completed";
    const notPublished = event.status !== "Published";
    return deadlinePassed || completed || notPublished;
  };

  const onRegisterClick = (eventId) => {
    if (!auth?.token || auth?.user?.role !== "participant") {
      navigate("/login");
      return;
    }
    navigate(`/events/${eventId}`);
  };

  const badgeClassByStatus = (status) => {
    if (status === "Ongoing") return "status-badge status-ongoing";
    if (status === "Completed") return "status-badge status-completed";
    return "status-badge status-upcoming";
  };

  return (
    <main className="page">
      <div className="page-head">
        <h1>{browseMode ? "Browse Events" : "Public Events"}</h1>
        <button type="button" onClick={loadEvents}>
          Refresh
        </button>
      </div>

      <div className="two-column-layout">
        <aside className="card side-filter">
          <h3>Filters</h3>
          {browseMode ? (
            <div className="form">
              <label>
                Search Event/Organizer
                <input value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Dance, Hacking, Robotics..." />
              </label>
              <label>
                Event Type
                <select value={filters.eventType} onChange={(e) => setFilters((prev) => ({ ...prev, eventType: e.target.value }))}>
                  <option value="">All</option>
                  <option value="Normal">Normal</option>
                  <option value="Merchandise">Merchandise</option>
                </select>
              </label>
              <label>
                Eligibility
                <select value={filters.eligibility} onChange={(e) => setFilters((prev) => ({ ...prev, eligibility: e.target.value }))}>
                  <option value="">All</option>
                  <option value="all">All</option>
                  <option value="iiit">IIIT</option>
                  <option value="non-iiit">Non-IIIT</option>
                </select>
              </label>
              <label>
                Date From
                <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} />
              </label>
              <label>
                Date To
                <input type="date" value={filters.dateTo} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))} />
              </label>
              <label className="checkbox-inline">
                <input type="checkbox" checked={filters.followedOnly} onChange={(e) => setFilters((prev) => ({ ...prev, followedOnly: e.target.checked }))} />
                Followed Clubs Only
              </label>
              <button type="button" onClick={() => setAppliedFilters(filters)}>
                Apply Filters
              </button>
              <button
                type="button"
                className="subtle-btn"
                onClick={() => {
                  const cleared = {
                    q: "",
                    eventType: "",
                    eligibility: "",
                    dateFrom: "",
                    dateTo: "",
                    followedOnly: false,
                  };
                  setFilters(cleared);
                  setAppliedFilters(cleared);
                }}
              >
                Clear Filters
              </button>
              <p className="event-meta"><strong>Results:</strong> {filteredEvents.length}</p>
            </div>
          ) : (
            <p className="muted">Log in as participant to use personalized filters and recommendations.</p>
          )}
        </aside>

        <section className="main-column">

      {browseMode && trending.length > 0 && (
        <section className="card">
          <h3>Trending (Top 5 / 24h)</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Organizer</th>
                  <th>Registrations (24h)</th>
                </tr>
              </thead>
              <tbody>
                {trending.map((event) => (
                  <tr key={event._id}>
                    <td>
                      <Link to={`/events/${event._id}`}>{event.name}</Link>
                    </td>
                    <td>{event.organizer?.name || "-"}</td>
                    <td>{event.registrations24h || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading && <p>Loading Events...</p>}
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {filteredEvents.map((event) => (
          <article className="card event-card" key={event._id}>
            {event.coverImage ? <SmartImage src={event.coverImage} alt={`${event.name} Cover`} className="event-cover" /> : null}
            <h3>{event.name}</h3>
            <p>{event.description}</p>
            <p className="event-meta">
              <strong>Type:</strong> {event.eventType}
            </p>
            <p className="event-meta">
              <strong>Club:</strong> {event.organizer?.name || "-"}
            </p>
            <p className="event-meta">
              <strong>Status:</strong> <span className={badgeClassByStatus(event.effectiveEventStatus)}>{event.effectiveEventStatus}</span>
            </p>
            {auth?.user?.role === "participant" && event.recommended && (
              <p className="event-meta">
                <strong>Recommended:</strong> Yes
              </p>
            )}
            <p className="event-meta">
              <strong>Start:</strong> {new Date(event.startDate).toLocaleString()}
            </p>
            <p className="event-meta">
              <strong>End:</strong> {new Date(event.endDate).toLocaleString()}
            </p>
            <p className="event-meta">
              <strong>Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}
            </p>
            <div className="action-row">
              <Link to={`/events/${event._id}`} className="link-btn subtle-btn">
                Details
              </Link>
              <button type="button" disabled={isRegisterDisabled(event)} onClick={() => onRegisterClick(event._id)}>
                {event.eventType === "Merchandise" ? "Purchase" : "Register"}
              </button>
            </div>
          </article>
        ))}
      </div>
        </section>
      </div>
    </main>
  );
};

export default PublicEventsPage;
