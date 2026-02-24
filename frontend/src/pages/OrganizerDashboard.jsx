import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { apiRequest } from "../lib/api";
import SmartImage from "../components/SmartImage";

const OrganizerDashboard = ({ auth }) => {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventAnalytics, setEventAnalytics] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [eventTab, setEventTab] = useState("All");
  const [error, setError] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [resetReason, setResetReason] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanPayload, setScanPayload] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [organizerNotifications, setOrganizerNotifications] = useState([]);
  const [organizerUnreadCount, setOrganizerUnreadCount] = useState(0);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editMessage, setEditMessage] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPendingOrder, setSelectedPendingOrder] = useState(null);
  const [selectedParticipantResponses, setSelectedParticipantResponses] = useState(null);
  const [editSuccessNotice, setEditSuccessNotice] = useState(null);
  const [orderActionInFlight, setOrderActionInFlight] = useState({});

  const qrScannerRef = useRef(null);
  const imageScanInputRef = useRef(null);
  const selectedEvent = useMemo(() => events.find((event) => event._id === selectedEventId), [events, selectedEventId]);

  const loadEvents = async () => {
    try {
      const response = await apiRequest({ path: "/api/events/my-events", token: auth.token });
      const loaded = response.events || [];
      setEvents(loaded);
      if (!selectedEventId && loaded.length > 0) setSelectedEventId(loaded[0]._id);
      if (!loaded.length) setSelectedEventId("");
      if (loaded.length > 0 && !editingEvent) {
        const first = loaded[0];
        setEditingEvent({
          _id: first._id,
          name: first.name || "",
          description: first.description || "",
          eligibility: first.eligibility || "all",
          registrationDeadline: first.registrationDeadline ? new Date(first.registrationDeadline).toISOString().slice(0, 16) : "",
          endDate: first.endDate ? new Date(first.endDate).toISOString().slice(0, 16) : "",
          registrationLimit: first.registrationLimit ?? 100,
          registrationFee: first.registrationFee ?? 0,
          status: first.status || "Draft",
          tags: Array.isArray(first.tags) ? first.tags.join(", ") : "",
          coverImage: first.coverImage || "",
        });
      }
    } catch (err) {
      setError(`Events Load Failed: ${err.message}`);
    }
  };

  const loadOrganizerNotifications = async () => {
    try {
      const response = await apiRequest({ path: "/api/organizers/notifications", token: auth.token });
      setOrganizerNotifications(response.notifications || []);
      setOrganizerUnreadCount(response.unreadCount || 0);
    } catch (err) {
      setError(`Notification Load Failed: ${err.message}`);
    }
  };

  const loadEventData = async (eventId) => {
    if (!eventId) {
      setEventAnalytics(null);
      setPendingOrders([]);
      return;
    }
    try {
      const analytics = await apiRequest({ path: `/api/organizers/events/${eventId}/analytics`, token: auth.token });
      setEventAnalytics(analytics);
    } catch (err) {
      setError(`Analytics Load Failed: ${err.message}`);
      setEventAnalytics(null);
    }
    const event = events.find((item) => item._id === eventId);
    if (event?.eventType === "Merchandise") {
      try {
        const pending = await apiRequest({ path: `/api/organizers/events/${eventId}/pending-orders`, token: auth.token });
        setPendingOrders(pending.orders || []);
      } catch (err) {
        setError(`Pending Orders Load Failed: ${err.message}`);
        setPendingOrders([]);
      }
    } else {
      setPendingOrders([]);
    }
  };

  useEffect(() => {
    loadEvents();
    loadOrganizerNotifications();
    const timerId = setInterval(loadOrganizerNotifications, 30000);
    return () => {
      clearInterval(timerId);
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {});
        qrScannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    loadEventData(selectedEventId);
  }, [selectedEventId, events.length]);

  const markOrganizerNotificationRead = async (notificationId) => {
    try {
      await apiRequest({ path: `/api/organizers/notifications/${notificationId}/read`, method: "PATCH", token: auth.token });
      await loadOrganizerNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const markAllOrganizerNotificationsRead = async () => {
    try {
      await apiRequest({ path: "/api/organizers/notifications/read-all", method: "PATCH", token: auth.token });
      await loadOrganizerNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteOrganizerNotification = async (notificationId) => {
    try {
      await apiRequest({
        path: `/api/organizers/notifications/${notificationId}`,
        method: "DELETE",
        token: auth.token,
      });
      await loadOrganizerNotifications();
    } catch (err) {
      setError(err.message);
    }
  };

  const reviewOrder = async (id, action) => {
    const key = `${id}:${action}`;
    if (orderActionInFlight[key]) return;
    setOrderActionInFlight((prev) => ({ ...prev, [key]: true }));
    try {
      await apiRequest({
        path: `/api/organizers/orders/${id}/${action}`,
        method: "POST",
        token: auth.token,
        body: action === "reject" ? { reason: "Reviewed by Organizer" } : undefined,
      });
      await loadEventData(selectedEventId);
    } catch (err) {
      const message = String(err.message || "");
      if (message.toLowerCase().includes("409") || message.toLowerCase().includes("already")) {
        setError("Order was already processed. The list has been refreshed.");
        await loadEventData(selectedEventId);
      } else {
        setError(err.message);
      }
    } finally {
      setOrderActionInFlight((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const saveEventEdit = async (nextStatus) => {
    if (!editingEvent?._id) return;
    const registrationsExist = Number(eventAnalytics?.totalRegistrations || 0) > 0;
    const targetStatus = nextStatus || editingEvent.status || "Draft";
    const body = registrationsExist
      ? {
          description: editingEvent.description,
          registrationDeadline: editingEvent.registrationDeadline,
          endDate: editingEvent.endDate,
          tags: String(editingEvent.tags || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          status: targetStatus,
        }
      : {
          name: editingEvent.name,
          description: editingEvent.description,
          eligibility: editingEvent.eligibility,
          registrationDeadline: editingEvent.registrationDeadline,
          endDate: editingEvent.endDate,
          registrationLimit: Number(editingEvent.registrationLimit),
          registrationFee: Number(editingEvent.registrationFee),
          status: targetStatus,
          tags: String(editingEvent.tags || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          coverImage: editingEvent.coverImage,
        };

    try {
      const response = await apiRequest({
        path: `/api/events/${editingEvent._id}`,
        method: "PATCH",
        token: auth.token,
        body,
      });
      await loadEvents();
      await loadEventData(editingEvent._id);
      setEditModalOpen(false);
      setEditMessage("");
      setEditSuccessNotice({
        title: targetStatus === "Published" ? "Event Published" : "Draft Saved",
        message: response.message || (targetStatus === "Published" ? "Event published successfully." : "Changes saved to draft."),
      });
    } catch (err) {
      setEditMessage(err.message);
    }
  };

  const requestReset = async () => {
    try {
      const response = await apiRequest({
        path: "/api/organizers/password-reset/request",
        method: "POST",
        token: auth.token,
        body: { reason: resetReason },
      });
      setResetMessage(response.message);
      setResetReason("");
    } catch (err) {
      setResetMessage(err.message);
    }
  };

  const exportAttendance = async () => {
    if (!selectedEventId) return;
    try {
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${base}/api/organizers/events/${selectedEventId}/attendance/export`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!response.ok) throw new Error("Failed to Export CSV");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${selectedEventId}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const scanWithPayload = async (qrPayload) => {
    if (!qrPayload) return;
    try {
      const response = await apiRequest({
        path: "/api/organizers/attendance/scan",
        method: "POST",
        token: auth.token,
        body: { qrPayload },
      });
      const ticketId = response.ticket?.ticketId || "";
      setScanResult({
        type: "success",
        title: "Attendance Marked",
        message: `Ticket ${ticketId} has been marked successfully.`,
      });
      setScanPayload("");
      await loadEventData(selectedEventId);
      setTimeout(() => {
        setScanResult(null);
      }, 1800);
    } catch (err) {
      const duplicate = String(err.message || "").toLowerCase().includes("already marked");
      const rawMessage = String(err.message || "Unable to scan QR code.");
      const formattedMessage = rawMessage ? `${rawMessage.charAt(0).toUpperCase()}${rawMessage.slice(1)}` : "Unable to scan QR code.";
      setScanResult({
        type: duplicate ? "warning" : "error",
        title: duplicate ? "Duplicate Scan" : "Scan Failed",
        message: formattedMessage,
      });
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      await qrScannerRef.current.stop().catch(() => {});
      await qrScannerRef.current.clear().catch(() => {});
      qrScannerRef.current = null;
    }
  };

  const openCameraScanner = async () => {
    setScannerOpen(true);
    setScanMessage("");
    setTimeout(async () => {
      try {
        await stopScanner();
        const scanner = new Html5Qrcode("organizer-qr-reader-modal");
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText) => {
            await scanWithPayload(decodedText);
            await stopScanner();
            setScannerOpen(false);
          },
          () => {}
        );
      } catch (err) {
        setScanMessage(`Camera Start Failed: ${err.message}`);
      }
    }, 120);
  };

  const closeScannerModal = () => {
    setScannerOpen(false);
    stopScanner();
  };

  const handleFileScan = async (file) => {
    try {
      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode("organizer-qr-reader-modal");
      }
      const payload = await qrScannerRef.current.scanFile(file, true);
      await scanWithPayload(payload);
      await stopScanner();
      setScannerOpen(false);
    } catch (err) {
      setScanMessage(err.message);
    }
  };

  const filteredParticipants = (eventAnalytics?.participants || []).filter((participant) => {
    const search = participantSearch.trim().toLowerCase();
    const searchPass =
      !search ||
      String(participant.name || "").toLowerCase().includes(search) ||
      String(participant.email || "").toLowerCase().includes(search) ||
      String(participant.ticketId || "").toLowerCase().includes(search);
    if (!searchPass) return false;
    if (attendanceFilter === "all") return true;
    if (attendanceFilter === "attended") return participant.attended;
    return !participant.attended;
  });

  const totalRevenue = (eventAnalytics?.participants || []).reduce((sum, participant) => {
    if (participant.status !== "Registered") return sum;
    return sum + Number(selectedEvent?.registrationFee || 0);
  }, 0);

  const filteredEvents = useMemo(() => {
    if (eventTab === "Draft") return events.filter((event) => event.status === "Draft");
    if (eventTab === "Published") return events.filter((event) => event.status === "Published");
    return events;
  }, [events, eventTab]);

  const openEditForEvent = (event) => {
    setEditingEvent({
      _id: event._id,
      name: event.name || "",
      description: event.description || "",
      eligibility: event.eligibility || "all",
      registrationDeadline: event.registrationDeadline ? new Date(event.registrationDeadline).toISOString().slice(0, 16) : "",
      endDate: event.endDate ? new Date(event.endDate).toISOString().slice(0, 16) : "",
      registrationLimit: event.registrationLimit ?? 100,
      registrationFee: event.registrationFee ?? 0,
      status: event.status || "Draft",
      tags: Array.isArray(event.tags) ? event.tags.join(", ") : "",
      coverImage: event.coverImage || "",
    });
    setEditMessage("");
    setEditModalOpen(true);
  };

  useEffect(() => {
    if (!selectedEventId) return;
    const selected = events.find((event) => event._id === selectedEventId);
    if (!selected) return;
    setEditingEvent({
      _id: selected._id,
      name: selected.name || "",
      description: selected.description || "",
      eligibility: selected.eligibility || "all",
      registrationDeadline: selected.registrationDeadline ? new Date(selected.registrationDeadline).toISOString().slice(0, 16) : "",
      endDate: selected.endDate ? new Date(selected.endDate).toISOString().slice(0, 16) : "",
      registrationLimit: selected.registrationLimit ?? 100,
      registrationFee: selected.registrationFee ?? 0,
      status: selected.status || "Draft",
      tags: Array.isArray(selected.tags) ? selected.tags.join(", ") : "",
      coverImage: selected.coverImage || "",
    });
    setEditMessage("");
  }, [selectedEventId, events]);

  return (
    <main className="page">
      <div className="page-head">
        <h1>Organizer Dashboard</h1>
        <Link className="link-btn" to="/organizer/create-event">
          Create Event
        </Link>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="portal-layout">
        <aside className="card side-filter">
          <h3>Event Controls</h3>
          <label>
            Selected Event
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
              <option value="">Select Event</option>
              {events.map((event) => (
                <option key={event._id} value={event._id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search Participant
            <input value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} placeholder="Name, Email, Ticket" />
          </label>
          <label>
            Attendance Filter
            <select value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="attended">Attended</option>
              <option value="not_attended">Not Attended</option>
            </select>
          </label>
          <button
            type="button"
            className="subtle-btn"
            onClick={() => {
              setParticipantSearch("");
              setAttendanceFilter("all");
            }}
          >
            Clear Filters
          </button>
          <button type="button" onClick={exportAttendance}>
            Export Attendance CSV
          </button>
        </aside>

        <section className="main-column">
          <section className="card">
            <h3>Your Events</h3>
            <div className="tabs">
              {["All", "Draft", "Published"].map((value) => (
                <button key={value} type="button" className={eventTab === value ? "tab-btn tab-btn-active" : "tab-btn"} onClick={() => setEventTab(value)}>
                  {value}
                </button>
              ))}
            </div>
            {events.length === 0 ? (
              <div className="empty-note">No events created yet.</div>
            ) : (
              <div className="table-wrap">
                <table className="data-table organizer-events-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Effective Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event._id}>
                        <td>
                          <Link to={`/events/${event._id}`}>{event.name}</Link>
                        </td>
                        <td>{event.eventType}</td>
                        <td>{event.effectiveEventStatus}</td>
                        <td>
                          <button type="button" className="ghost-btn" onClick={() => openEditForEvent(event)}>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Forums</h3>
            <div className="action-row">
              {events.map((event) => (
                <Link key={event._id} className="link-btn forum-btn" to={`/events/${event._id}?tab=forum`}>
                  {event.name} Forum
                </Link>
              ))}
            </div>
          </section>

          {eventAnalytics ? (
            <section className="card">
              <h3>Event Analytics</h3>
              <p className="event-meta">
                <strong>Overview:</strong> {selectedEvent?.name} | {selectedEvent?.eventType} | {selectedEvent?.status}
              </p>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Registrations</div>
                  <div className="stat-value">{eventAnalytics.totalRegistrations}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Attended</div>
                  <div className="stat-value">{eventAnalytics.totalAttended}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Not Attended</div>
                  <div className="stat-value">{eventAnalytics.notAttended}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Revenue</div>
                  <div className="stat-value">INR {totalRevenue}</div>
                </div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Participant</th>
                      <th>Email</th>
                      <th>Ticket</th>
                      <th>Status</th>
                      <th>Attendance</th>
                      <th>Form Responses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => (
                      <tr key={participant.ticketId || participant.participantId}>
                        <td>{participant.name}</td>
                        <td>{participant.email}</td>
                        <td>{participant.ticketId || "-"}</td>
                        <td>{participant.status}</td>
                        <td>{participant.attended ? "Attended" : "Not Attended"}</td>
                        <td>
                          {Array.isArray(participant.formResponses) && participant.formResponses.length > 0 ? (
                            <button
                              type="button"
                              className="subtle-btn"
                              onClick={() => setSelectedParticipantResponses({
                                participantName: participant.name,
                                ticketId: participant.ticketId,
                                responses: participant.formResponses || [],
                              })}
                            >
                              View Responses
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="card form">
            <h3>Attendance Marker</h3>
            <p className="muted">Use camera scan first. If camera is unavailable, use image upload or payload fallback.</p>
            <div className="row">
              <button type="button" onClick={openCameraScanner}>
                Scan with Camera
              </button>
              <button type="button" onClick={() => imageScanInputRef.current?.click()}>
                Scan from Image
              </button>
              <input
                ref={imageScanInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setScannerOpen(true);
                    setTimeout(() => handleFileScan(file), 120);
                  }
                  e.target.value = "";
                }}
              />
            </div>
            <label>
              Manual Payload (Fallback)
              <textarea rows={3} value={scanPayload} onChange={(e) => setScanPayload(e.target.value)} placeholder="Paste QR payload here" />
            </label>
            <button type="button" className="ghost-btn" onClick={() => scanWithPayload(scanPayload)}>
              Mark Attendance by Payload
            </button>
            {scanMessage ? <p className="muted">{scanMessage}</p> : null}
          </section>

          {pendingOrders.length > 0 ? (
            <section className="card">
              <h3>Pending Merchandise Orders</h3>
              {pendingOrders.map((order) => (
                <div className="inline-box" key={order.ticketDbId}>
                  <p>
                    {order.participant?.name} ({order.participant?.email}) - {order.merchandiseOrder?.variant} x{order.merchandiseOrder?.quantity}
                  </p>
                  <p>Proof URL: {order.payment?.proofUrl}</p>
                  <div className="row">
                    <button type="button" onClick={() => reviewOrder(order.ticketDbId, "approve")}>
                      {orderActionInFlight[`${order.ticketDbId}:approve`] ? "Approving..." : "Approve"}
                    </button>
                    <button type="button" className="danger-btn" onClick={() => reviewOrder(order.ticketDbId, "reject")}>
                      {orderActionInFlight[`${order.ticketDbId}:reject`] ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ) : null}

          <section className="card form">
            <h3>Password Reset Request</h3>
            <label>
              Reason
              <input value={resetReason} onChange={(e) => setResetReason(e.target.value)} />
            </label>
            <button type="button" onClick={requestReset}>
              Submit Reset Request
            </button>
            {resetMessage ? <p className="muted">{resetMessage}</p> : null}
          </section>
        </section>

        <aside className="card side-notifications">
          <div className="page-head compact">
            <h3 className="side-title">Notifications {organizerUnreadCount ? `(${organizerUnreadCount})` : ""}</h3>
            <button type="button" className="ghost-btn" onClick={markAllOrganizerNotificationsRead}>
              Mark All Read
            </button>
          </div>
          <div className="form">
            {pendingOrders.length > 0 ? (
              <>
                <h3 className="side-title">Pending Merchandise Requests</h3>
                {pendingOrders.map((order) => (
                  <article key={order.ticketDbId} className="notification-item unread">
                    <p>
                      <strong>{order.participant?.name || "Participant"}</strong> requested {order.merchandiseOrder?.variant} x
                      {order.merchandiseOrder?.quantity}
                    </p>
                    <p className="event-meta">{order.participant?.email || "-"}</p>
                    <div className="action-row">
                      <button type="button" className="subtle-btn" onClick={() => setSelectedPendingOrder(order)}>
                        View
                      </button>
                      <button type="button" className="success-btn" onClick={() => reviewOrder(order.ticketDbId, "approve")}>
                        {orderActionInFlight[`${order.ticketDbId}:approve`] ? "Approving..." : "Approve"}
                      </button>
                      <button type="button" className="danger-btn" onClick={() => reviewOrder(order.ticketDbId, "reject")}>
                        {orderActionInFlight[`${order.ticketDbId}:reject`] ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </article>
                ))}
              </>
            ) : null}
            {organizerNotifications.length === 0 ? <div className="empty-note">No notifications yet.</div> : null}
            {organizerNotifications.slice(0, 30).map((notification) => (
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
                    <Link className="link-btn forum-btn" to={`/events/${notification.event.id}?tab=forum`}>
                      Open
                    </Link>
                  ) : null}
                  {!notification.read ? (
                    <button type="button" className="ghost-btn" onClick={() => markOrganizerNotificationRead(notification.id)}>
                      Read
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="icon-btn danger-btn"
                    onClick={() => deleteOrganizerNotification(notification.id)}
                    title="Delete Notification"
                  >
                    🗑
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      {scannerOpen ? (
        <div className="scanner-modal-overlay" onClick={closeScannerModal}>
          <div className="scanner-modal" onClick={(e) => e.stopPropagation()}>
            <div className="page-head compact">
              <h3>QR Camera Scanner</h3>
              <button type="button" className="ghost-btn" onClick={closeScannerModal}>
                Close
              </button>
            </div>
            <div id="organizer-qr-reader-modal" className="qr-reader" />
            {scanMessage ? <p className="muted">{scanMessage}</p> : null}
          </div>
        </div>
      ) : null}

      {scanResult ? (
        <div className="scanner-modal-overlay" onClick={() => setScanResult(null)}>
          <div className="scanner-result-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{scanResult.title}</h3>
            <p className={scanResult.type === "success" ? "success-text" : scanResult.type === "warning" ? "warning-text" : "error"}>
              {scanResult.message}
            </p>
            <button type="button" onClick={() => setScanResult(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {editModalOpen && editingEvent ? (
        <div className="scanner-modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="scanner-result-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="page-head compact">
              <h3>Edit Event</h3>
              <button type="button" className="ghost-btn" onClick={() => setEditModalOpen(false)}>
                Close
              </button>
            </div>
            <p className="muted">
              {Number(eventAnalytics?.totalRegistrations || 0) > 0
                ? "Registrations exist. Only safe fields are editable."
                : "Draft mode: free edits allowed."}
            </p>
            <div className="form">
              <label>
                Event Name
                <input
                  value={editingEvent.name}
                  disabled={Number(eventAnalytics?.totalRegistrations || 0) > 0}
                  onChange={(e) => setEditingEvent((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Description
                <textarea rows={3} value={editingEvent.description} onChange={(e) => setEditingEvent((prev) => ({ ...prev, description: e.target.value }))} />
              </label>
              <div className="row">
                <label>
                  Eligibility
                  <select
                    value={editingEvent.eligibility}
                    disabled={Number(eventAnalytics?.totalRegistrations || 0) > 0}
                    onChange={(e) => setEditingEvent((prev) => ({ ...prev, eligibility: e.target.value }))}
                  >
                    <option value="all">All</option>
                    <option value="iiit">IIIT</option>
                    <option value="non-iiit">Non-IIIT</option>
                  </select>
                </label>
                <label>
                  Registration Limit
                  <input
                    type="number"
                    min={1}
                    value={editingEvent.registrationLimit}
                    disabled={Number(eventAnalytics?.totalRegistrations || 0) > 0}
                    onChange={(e) => setEditingEvent((prev) => ({ ...prev, registrationLimit: e.target.value }))}
                  />
                </label>
              </div>
              <div className="row">
                <label>
                  Registration Fee
                  <input
                    type="number"
                    min={0}
                    value={editingEvent.registrationFee}
                    disabled={Number(eventAnalytics?.totalRegistrations || 0) > 0}
                    onChange={(e) => setEditingEvent((prev) => ({ ...prev, registrationFee: e.target.value }))}
                  />
                </label>
              </div>
              <div className="row">
                <label>
                  Registration Deadline
                  <input
                    type="datetime-local"
                    value={editingEvent.registrationDeadline}
                    onChange={(e) => setEditingEvent((prev) => ({ ...prev, registrationDeadline: e.target.value }))}
                  />
                </label>
                <label>
                  End Date
                  <input
                    type="datetime-local"
                    value={editingEvent.endDate}
                    onChange={(e) => setEditingEvent((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </label>
              </div>
              <label>
                Tags (comma separated)
                <input value={editingEvent.tags} onChange={(e) => setEditingEvent((prev) => ({ ...prev, tags: e.target.value }))} />
              </label>
              <label>
                Cover Image URL
                <input
                  value={editingEvent.coverImage}
                  disabled={Number(eventAnalytics?.totalRegistrations || 0) > 0}
                  onChange={(e) => setEditingEvent((prev) => ({ ...prev, coverImage: e.target.value }))}
                />
              </label>
              <div className="action-row">
                <button type="button" className="subtle-btn" onClick={() => saveEventEdit("Draft")}>
                  Save Changes to Draft
                </button>
                <button type="button" onClick={() => saveEventEdit("Published")}>
                  Publish Event
                </button>
              </div>
              {editMessage ? <p className={editMessage.toLowerCase().includes("failed") ? "error" : "success-text"}>{editMessage}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedPendingOrder ? (
        <div className="scanner-modal-overlay" onClick={() => setSelectedPendingOrder(null)}>
          <div className="scanner-result-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="page-head compact">
              <h3>Merchandise Approval Request</h3>
              <button type="button" className="ghost-btn" onClick={() => setSelectedPendingOrder(null)}>
                Close
              </button>
            </div>
            <p>
              <strong>Participant:</strong> {selectedPendingOrder.participant?.name || "-"}
            </p>
            <p>
              <strong>Email:</strong> {selectedPendingOrder.participant?.email || "-"}
            </p>
            <p>
              <strong>Variant:</strong> {selectedPendingOrder.merchandiseOrder?.variant || "-"}
            </p>
            <p>
              <strong>Quantity:</strong> {selectedPendingOrder.merchandiseOrder?.quantity || 0}
            </p>
            <p>
              <strong>Payment Status:</strong> {selectedPendingOrder.payment?.status || "Pending"}
            </p>
            <p>
              <strong>Proof URL:</strong> {selectedPendingOrder.payment?.proofUrl || "-"}
            </p>
            {selectedPendingOrder.payment?.proofUrl ? (
              <SmartImage src={selectedPendingOrder.payment.proofUrl} alt="Payment proof" className="proof-image" />
            ) : null}
            <div className="row">
              <button
                type="button"
                className="success-btn"
                disabled={!!orderActionInFlight[`${selectedPendingOrder.ticketDbId}:approve`]}
                onClick={async () => {
                  await reviewOrder(selectedPendingOrder.ticketDbId, "approve");
                  setSelectedPendingOrder(null);
                }}
              >
                {orderActionInFlight[`${selectedPendingOrder.ticketDbId}:approve`] ? "Approving..." : "Approve"}
              </button>
              <button
                type="button"
                className="danger-btn"
                disabled={!!orderActionInFlight[`${selectedPendingOrder.ticketDbId}:reject`]}
                onClick={async () => {
                  await reviewOrder(selectedPendingOrder.ticketDbId, "reject");
                  setSelectedPendingOrder(null);
                }}
              >
                {orderActionInFlight[`${selectedPendingOrder.ticketDbId}:reject`] ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedParticipantResponses ? (
        <div className="scanner-modal-overlay" onClick={() => setSelectedParticipantResponses(null)}>
          <div className="scanner-result-modal large" onClick={(e) => e.stopPropagation()}>
            <div className="page-head compact">
              <h3>Form Responses</h3>
              <button type="button" className="ghost-btn" onClick={() => setSelectedParticipantResponses(null)}>
                Close
              </button>
            </div>
            <p className="event-meta">
              <strong>Participant:</strong> {selectedParticipantResponses.participantName || "-"}
            </p>
            <p className="event-meta">
              <strong>Ticket:</strong> {selectedParticipantResponses.ticketId || "-"}
            </p>
            {selectedParticipantResponses.responses.length === 0 ? (
              <div className="empty-note">No form responses available.</div>
            ) : (
              <div className="form">
                {selectedParticipantResponses.responses.map((item, index) => (
                  <div className="inline-box" key={`${item.label}-${index}`}>
                    <p className="event-meta"><strong>{item.label}</strong></p>
                    <p>{String(item.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {editSuccessNotice ? (
        <div className="scanner-modal-overlay" onClick={() => setEditSuccessNotice(null)}>
          <div className="scanner-result-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editSuccessNotice.title}</h3>
            <p className="success-text">{editSuccessNotice.message}</p>
            <button type="button" onClick={() => setEditSuccessNotice(null)}>
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default OrganizerDashboard;

