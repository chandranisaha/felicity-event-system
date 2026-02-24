import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../lib/api";
import { buildGoogleCalendarUrl, buildOutlookCalendarUrl, downloadEventIcs } from "../lib/calendar";
import SmartImage from "../components/SmartImage";

const ParticipantDashboard = ({ auth }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("All");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("All");
  const [historySearch, setHistorySearch] = useState("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ path: "/api/participants/my-events", token: auth.token });
      setItems(response.items || []);
      const notificationResponse = await apiRequest({ path: "/api/participants/notifications", token: auth.token });
      setNotifications(notificationResponse.notifications || []);
      setUnreadCount(notificationResponse.unreadCount || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const intervalId = setInterval(load, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const cancelMerch = async (eventId, ticketId) => {
    try {
      await apiRequest({
        path: `/api/events/${eventId}/cancel-merchandise`,
        method: "POST",
        token: auth.token,
        body: { ticketId },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      await apiRequest({
        path: `/api/participants/notifications/${notificationId}/read`,
        method: "PATCH",
        token: auth.token,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiRequest({
        path: "/api/participants/notifications/read-all",
        method: "PATCH",
        token: auth.token,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiRequest({
        path: `/api/participants/notifications/${notificationId}`,
        method: "DELETE",
        token: auth.token,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const upcomingEvents = useMemo(
    () =>
      items.filter(
        (item) => item.status === "Registered" && item.event && item.event.effectiveEventStatus !== "Completed" && item.event.effectiveEventStatus !== "Ongoing"
      ),
    [items]
  );

  const history = useMemo(() => {
    return items.filter((item) => {
      const typePass = historyTypeFilter === "All" || item.event?.eventType === historyTypeFilter;
      const statusPass = historyStatusFilter === "All" || item.status === historyStatusFilter || item.event?.effectiveEventStatus === historyStatusFilter;
      const searchValue = historySearch.trim().toLowerCase();
      const searchPass =
        !searchValue ||
        String(item.event?.name || "").toLowerCase().includes(searchValue) ||
        String(item.event?.organizer?.name || "").toLowerCase().includes(searchValue) ||
        String(item.ticketId || "").toLowerCase().includes(searchValue);
      const eventDate = item.event?.startDate ? new Date(item.event.startDate) : null;
      const dateFromPass = !historyDateFrom || (eventDate && eventDate >= new Date(historyDateFrom));
      const dateToPass = !historyDateTo || (eventDate && eventDate <= new Date(`${historyDateTo}T23:59:59`));
      return typePass && statusPass && searchPass && dateFromPass && dateToPass;
    });
  }, [items, historyTypeFilter, historyStatusFilter, historySearch, historyDateFrom, historyDateTo]);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Participant Dashboard</h1>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      {loading && <p>Loading Dashboard...</p>}
      {error && <p className="error">{error}</p>}

      <div className="portal-layout">
        <aside className="card side-filter">
          <h3>Filters</h3>
          <div className="form">
            <label>
              Search
              <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Event, organizer, ticket id" />
            </label>
            <label>
              Event Type
              <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Normal">Normal</option>
                <option value="Merchandise">Merchandise</option>
              </select>
            </label>
            <label>
              Status
              <select value={historyStatusFilter} onChange={(e) => setHistoryStatusFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="Registered">Registered</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Completed">Completed</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Upcoming">Upcoming</option>
              </select>
            </label>
            <label>
              Event Date From
              <input type="date" value={historyDateFrom} onChange={(e) => setHistoryDateFrom(e.target.value)} />
            </label>
            <label>
              Event Date To
              <input type="date" value={historyDateTo} onChange={(e) => setHistoryDateTo(e.target.value)} />
            </label>
            <button
              type="button"
              className="subtle-btn"
              onClick={() => {
                setHistoryTypeFilter("All");
                setHistoryStatusFilter("All");
                setHistorySearch("");
                setHistoryDateFrom("");
                setHistoryDateTo("");
              }}
            >
              Clear Filters
            </button>
          </div>
        </aside>

        <section className="main-column">
          <section className="card">
            <h3>Upcoming Events</h3>
            {upcomingEvents.length === 0 ? (
              <div className="empty-note">No upcoming registered events.</div>
            ) : (
              <div className="table-wrap no-scroll-wrap">
                <table className="data-table participant-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Type</th>
                      <th>Organizer</th>
                      <th>Schedule</th>
                      <th>Forum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.map((item) => (
                      <tr key={`${item.ticketId}-${item.event?._id}`}>
                        <td>
                          <Link to={`/events/${item.event?._id}`}>{item.event?.name}</Link>
                        </td>
                        <td>{item.event?.eventType}</td>
                        <td>{item.event?.organizer?.name || "-"}</td>
                        <td>
                          {new Date(item.event?.startDate).toLocaleString()} - {new Date(item.event?.endDate).toLocaleString()}
                        </td>
                        <td>
                          <Link className="link-btn forum-btn" to={`/events/${item.event?._id}?tab=forum`}>
                            Forum
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Participation History</h3>
            {history.length === 0 ? (
              <div className="empty-note">No records in this category.</div>
            ) : (
              <div className="table-wrap no-scroll-wrap">
                <table className="data-table participant-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Ticket</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item) => (
                      <tr key={`${item.ticketId || item.event?._id}-${item.registeredAt}`}>
                        <td>
                          <Link to={`/events/${item.event?._id}`}>{item.event?.name}</Link>
                        </td>
                        <td>{item.event?.eventType}</td>
                        <td>{item.status}</td>
                        <td>{item.ticketId || "Pending"}</td>
                        <td>
                          <div className="action-row">
                            <Link className="link-btn forum-btn" to={`/events/${item.event?._id}?tab=forum`}>
                              Forum
                            </Link>
                            {item.ticketId ? (
                              <button type="button" className="subtle-btn" onClick={() => setSelectedTicket(item)}>
                                View Ticket
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="grid">
            {items.map((item) => (
              <article key={`${item.ticketId || item.event?._id}-card`} className="card">
                {item.event?.coverImage ? <SmartImage src={item.event.coverImage} alt={`${item.event?.name} Cover`} className="event-cover" /> : null}
                <h3>
                  <Link to={`/events/${item.event?._id}`}>{item.event?.name}</Link>
                </h3>
                <p className="event-meta">
                  <strong>Status:</strong> {item.status}
                </p>
                <div className="action-row card-actions">
                  <Link className="link-btn forum-btn" to={`/events/${item.event?._id}?tab=forum`}>
                    Discussion Forum
                  </Link>
                  {item.ticketId ? (
                    <button type="button" className="ticket-trigger" onClick={() => setSelectedTicket(item)}>
                      Open Ticket
                    </button>
                  ) : null}
                </div>
                {item.status === "Registered" && item.event ? (
                  <div className="action-row card-actions">
                    <button
                      type="button"
                      className="subtle-btn"
                      onClick={() =>
                        downloadEventIcs({
                          title: item.event.name,
                          description: item.event.description,
                          startDate: item.event.startDate,
                          endDate: item.event.endDate,
                          organizerName: item.event.organizer?.name,
                          eventId: item.event._id,
                        })
                      }
                    >
                      Download ICS
                    </button>
                    <a
                      className="link-btn subtle-btn"
                      href={buildGoogleCalendarUrl({
                        title: item.event.name,
                        description: item.event.description,
                        startDate: item.event.startDate,
                        endDate: item.event.endDate,
                        organizerName: item.event.organizer?.name,
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Google Calendar
                    </a>
                    <a
                      className="link-btn subtle-btn"
                      href={buildOutlookCalendarUrl({
                        title: item.event.name,
                        description: item.event.description,
                        startDate: item.event.startDate,
                        endDate: item.event.endDate,
                        organizerName: item.event.organizer?.name,
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Outlook
                    </a>
                  </div>
                ) : null}
                {item.event?.eventType === "Merchandise" && item.event?.merchandiseConfig?.allowCancellation && item.status !== "Cancelled" && (
                  <button type="button" onClick={() => cancelMerch(item.event?._id, item.ticketId)}>
                    Cancel Merchandise Order
                  </button>
                )}
              </article>
            ))}
          </section>
        </section>

        <aside className="card side-notifications">
          <div className="page-head compact">
            <h3>Notifications {unreadCount > 0 ? `(${unreadCount})` : ""}</h3>
            <button type="button" className="ghost-btn" onClick={markAllNotificationsRead}>
              Mark All Read
            </button>
          </div>
          <div className="form">
            {notifications.length === 0 ? <div className="empty-note">No notifications yet.</div> : null}
            {notifications.slice(0, 30).map((notification) => (
              <article key={notification.id} className={`notification-item ${notification.read ? "" : "unread"}`}>
                <p>
                  <strong>{notification.title}</strong>
                </p>
                <p className="event-meta">
                  <strong>Event:</strong> {notification.event?.name || "-"}
                </p>
                <p>{notification.body}</p>
                <div className="row">
                  {notification.event?.id ? (
                    <Link className="ghost-btn" to={`/events/${notification.event.id}?tab=forum`}>
                      Open
                    </Link>
                  ) : null}
                  {!notification.read ? (
                    <button type="button" className="ghost-btn" onClick={() => markNotificationRead(notification.id)}>
                      Read
                    </button>
                  ) : null}
                  <button type="button" className="icon-btn danger-btn" onClick={() => deleteNotification(notification.id)} title="Delete Notification">
                    🗑
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      {selectedTicket ? (
        <div className="ticket-modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="ticket-modal" onClick={(e) => e.stopPropagation()}>
            <div className="page-head compact">
              <h3>{selectedTicket.event?.name}</h3>
              <button type="button" className="ghost-btn" onClick={() => setSelectedTicket(null)}>
                Close
              </button>
            </div>
            <div className="ticket-modal-grid">
              <div className="ticket-details">
                <p className="event-meta">
                  <strong>Ticket ID:</strong> {selectedTicket.ticketId}
                </p>
                <p className="event-meta">
                  <strong>Status:</strong> {selectedTicket.status}
                </p>
                <p className="event-meta">
                  <strong>Attendance:</strong> {selectedTicket.attended ? "Attended" : "Not Attended"}
                </p>
                <p className="event-meta">
                  <strong>Organizer:</strong> {selectedTicket.event?.organizer?.name || "-"}
                </p>
                <p className="event-meta">
                  <strong>Type:</strong> {selectedTicket.event?.eventType}
                </p>
                <p className="event-meta">
                  <strong>Start:</strong> {selectedTicket.event?.startDate ? new Date(selectedTicket.event.startDate).toLocaleString() : "-"}
                </p>
                <p className="event-meta">
                  <strong>End:</strong> {selectedTicket.event?.endDate ? new Date(selectedTicket.event.endDate).toLocaleString() : "-"}
                </p>
                <p className="muted">Show this ticket and QR code at event entry for verification.</p>
              </div>
              <div>
                {selectedTicket.qrCode ? <img src={selectedTicket.qrCode} alt="Ticket QR" className="qr-image ticket-qr-large" /> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default ParticipantDashboard;
