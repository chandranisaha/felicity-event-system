import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import SmartImage from "../components/SmartImage";

const OrganizerOngoingEventsPage = ({ auth }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ path: "/api/events/my-events", token: auth.token });
      const ongoing = (response.events || []).filter((event) => event.effectiveEventStatus === "Ongoing");
      setEvents(ongoing);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Ongoing Events</h1>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      {loading && <p>Loading ongoing events...</p>}
      {error && <p className="error">{error}</p>}
      {events.length === 0 && !loading ? (
        <div className="empty-note">No ongoing events currently.</div>
      ) : (
        <div className="grid">
          {events.map((event) => (
            <article key={event._id} className="card">
              {event.coverImage ? <SmartImage src={event.coverImage} alt={`${event.name} Cover`} className="event-cover" /> : null}
              <h3>
                <Link to={`/events/${event._id}`}>{event.name}</Link>
              </h3>
              <p className="event-meta">
                <strong>Type:</strong> {event.eventType}
              </p>
              <p className="event-meta">
                <strong>Status:</strong> {event.effectiveEventStatus}
              </p>
              <p className="event-meta">
                <strong>Schedule:</strong> {new Date(event.startDate).toLocaleString()} - {new Date(event.endDate).toLocaleString()}
              </p>
              <Link to={`/events/${event._id}`} className="link-btn subtle-btn">
                Open Event Details
              </Link>
            </article>
          ))}
        </div>
      )}
    </main>
  );
};

export default OrganizerOngoingEventsPage;
