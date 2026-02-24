import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../lib/api";

const OrganizerDetailPage = ({ auth }) => {
  const { organizerId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        path: `/api/participants/organizers/${organizerId}`,
        token: auth.token,
      });
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [organizerId]);

  if (loading) return <main className="page">Loading organizer...</main>;
  if (error) return <main className="page"><p className="error">{error}</p></main>;

  return (
    <main className="page">
      <section className="card">
        <h1>{data.organizer.name}</h1>
        <p className="event-meta">
          <strong>Category:</strong> {data.organizer.category}
        </p>
        <p>{data.organizer.description}</p>
        <p className="event-meta">
          <strong>Contact Email:</strong> {data.organizer.contactEmail}
        </p>
      </section>

      <section className="card">
        <h3>Upcoming Events</h3>
        {data.upcomingEvents.length === 0 ? (
          <div className="empty-note">No upcoming events.</div>
        ) : (
          <div className="grid">
            {data.upcomingEvents.map((event) => (
              <article className="card" key={event._id}>
                <h3>{event.name}</h3>
                <p className="event-meta">{new Date(event.startDate).toLocaleString()}</p>
                <Link to={`/events/${event._id}`} className="link-btn subtle-btn">
                  View Event
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Past Events</h3>
        {data.pastEvents.length === 0 ? (
          <div className="empty-note">No past events.</div>
        ) : (
          <div className="grid">
            {data.pastEvents.map((event) => (
              <article className="card" key={event._id}>
                <h3>{event.name}</h3>
                <p className="event-meta">{new Date(event.startDate).toLocaleString()}</p>
                <Link to={`/events/${event._id}`} className="link-btn subtle-btn">
                  View Event
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

export default OrganizerDetailPage;
