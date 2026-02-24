import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { apiRequest } from "../lib/api";
import SmartImage from "../components/SmartImage";

const EventDetailsPage = ({ auth }) => {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [formResponses, setFormResponses] = useState({});
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discoverEvents, setDiscoverEvents] = useState([]);
  const [discoverTrending, setDiscoverTrending] = useState([]);
  const [trendTab, setTrendTab] = useState("24h");
  const [forumMessages, setForumMessages] = useState([]);
  const [forumText, setForumText] = useState("");
  const [forumImageUrl, setForumImageUrl] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [forumError, setForumError] = useState("");
  const reactionOptions = [
    { emoji: "👍", aliases: ["👍", "like"], title: "Like" },
    { emoji: "🔥", aliases: ["🔥", "fire"], title: "Fire" },
    { emoji: "😂", aliases: ["😂", "laugh"], title: "Laugh" },
    { emoji: "🎉", aliases: ["🎉", "party"], title: "Celebrate" },
    { emoji: "❓", aliases: ["❓", "question"], title: "Question" },
  ];

  const activeTab = searchParams.get("tab") === "forum" ? "forum" : "details";
  const formatEligibility = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "iiit") return "IIIT";
    if (normalized === "non-iiit") return "Non-IIIT";
    if (normalized === "all") return "All";
    return value || "-";
  };

  const loadEvent = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ path: auth?.token ? `/api/events/${eventId}` : `/api/events/public/${eventId}`, token: auth?.token });
      const found = response.event;
      setEvent(found);
      if (found.eventType === "Merchandise") {
        const firstVariant = found.merchandiseConfig?.variants?.[0];
        if (firstVariant) {
          const variantKey = `${firstVariant.name}`;
          setSelectedVariantKey(variantKey);
          const initialSizes = firstVariant.sizes?.length ? firstVariant.sizes : firstVariant.size ? [firstVariant.size] : ["One Size"];
          const initialColors = firstVariant.colors?.length ? firstVariant.colors : firstVariant.color ? [firstVariant.color] : ["Default"];
          setSelectedSize(initialSizes[0] || "");
          setSelectedColor(initialColors[0] || "");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDiscovery = async () => {
    try {
      const response = await apiRequest({
        path: "/api/events/public",
        token: auth?.token,
      });
      setDiscoverEvents(response.events || []);
      setDiscoverTrending(response.trending || []);
    } catch (err) {
      // ignore discovery errors for event page
      setDiscoverEvents([]);
      setDiscoverTrending([]);
    }
  };

  useEffect(() => {
    loadEvent();
    loadDiscovery();
  }, [eventId]);

  useEffect(() => {
    if (!auth?.token) return;

    let activeSocket = null;
    let mounted = true;

    const loadForum = async () => {
      try {
        const response = await apiRequest({
          path: `/api/events/${eventId}/forum/messages`,
          token: auth.token,
        });
        if (mounted) {
          setForumMessages(response.messages || []);
        }
      } catch (error) {
        if (mounted) setForumError(error.message);
      }
    };

    loadForum();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    activeSocket = io(baseUrl);
    activeSocket.emit("forum:join", eventId);
    activeSocket.on("forum:message_created", (message) => setForumMessages((prev) => [...prev, message]));
    activeSocket.on("forum:message_updated", (message) => setForumMessages((prev) => prev.map((item) => (item.id === message.id ? message : item))));
    activeSocket.on("forum:message_deleted", (message) => setForumMessages((prev) => prev.map((item) => (item.id === message.id ? message : item))));

    return () => {
      mounted = false;
      if (activeSocket) {
        activeSocket.emit("forum:leave", eventId);
        activeSocket.disconnect();
      }
    };
  }, [eventId, auth?.token]);

  const sortedFormFields = useMemo(() => {
    if (!event?.formFields) return [];
    return [...event.formFields].sort((a, b) => a.order - b.order);
  }, [event]);

  const merchVariants = event?.merchandiseConfig?.variants || [];
  const hasMerchVariants = merchVariants.length > 0;
  const selectedVariantRecord = merchVariants.find((variant) => variant.name === selectedVariantKey);
  const deadlinePassed = event ? new Date(event.registrationDeadline) < new Date() : false;
  const eventCompleted = event?.effectiveEventStatus === "Completed";
  const outOfStock = event?.eventType === "Merchandise" && selectedVariantRecord ? selectedVariantRecord.remainingStock < Number(quantity) : false;
  const canSubmit =
    !submitting &&
    !deadlinePassed &&
    !eventCompleted &&
    !outOfStock &&
      (event?.eventType !== "Merchandise" ||
      (hasMerchVariants && selectedVariantKey && selectedSize && selectedColor && Number(quantity) >= 1 && paymentProofUrl.trim()));

  const uploadProofImage = (file) =>
    new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        try {
          const maxWidth = 1280;
          const scale = image.width > maxWidth ? maxWidth / image.width : 1;
          const width = Math.max(1, Math.floor(image.width * scale));
          const height = Math.max(1, Math.floor(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("failed to prepare image canvas"));
            return;
          }
          ctx.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("failed to process selected image"));
        }
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("failed to load selected image"));
      };
      image.src = objectUrl;
    });

  const handlePaymentProofUpload = async (eventObj) => {
    const file = eventObj?.target?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSubmitError("payment proof upload must be an image file");
      eventObj.target.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setSubmitError("selected image is too large. choose an image under 8MB.");
      eventObj.target.value = "";
      return;
    }
    setUploadingProof(true);
    try {
      const dataUrl = await uploadProofImage(file);
      if (dataUrl.length > 2_000_000) {
        setSubmitError("compressed image is still too large. use payment proof URL instead.");
        return;
      }
      setPaymentProofUrl(dataUrl);
      setSubmitError("");
    } catch (uploadError) {
      setSubmitError(uploadError.message);
    } finally {
      setUploadingProof(false);
      eventObj.target.value = "";
    }
  };

  const register = async () => {
    if (!auth?.token || auth?.user?.role !== "participant") {
      navigate("/login");
      return;
    }

    if (
      event?.eventType === "Merchandise" &&
      typeof paymentProofUrl === "string" &&
      paymentProofUrl.startsWith("data:image/") &&
      paymentProofUrl.length > 1_500_000
    ) {
      setSubmitError("payment proof image is too large. use a smaller image or paste a public URL.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const payload =
        event.eventType === "Merchandise"
          ? {
              paymentProofUrl,
              merchandiseOrder: {
                variant: selectedVariantRecord?.name,
                size: selectedSize,
                color: selectedColor,
                quantity: Number(quantity),
              },
            }
          : {
              formResponses,
            };

      await apiRequest({
        path: `/api/events/${eventId}/register`,
        method: "POST",
        token: auth.token,
        body: payload,
      });

      navigate("/dashboard/participant");
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const postForumMessage = async () => {
    if (!auth?.token || !forumText.trim()) return;
    try {
      await apiRequest({
        path: `/api/events/${eventId}/forum/messages`,
        method: "POST",
        token: auth.token,
        body: {
          text: forumText.trim(),
          parentMessage: replyTo || undefined,
          isAnnouncement: Boolean(auth?.user?.role === "organizer" && replyTo === ""),
          attachments: forumImageUrl.trim() ? [forumImageUrl.trim()] : [],
        },
      });
      setForumText("");
      setForumImageUrl("");
      setReplyTo("");
    } catch (error) {
      setForumError(error.message);
    }
  };

  const reactToMessage = async (messageId, emoji) => {
    try {
      await apiRequest({
        path: `/api/events/${eventId}/forum/messages/${messageId}/react`,
        method: "PATCH",
        token: auth.token,
        body: { emoji },
      });
    } catch (error) {
      setForumError(error.message);
    }
  };

  const togglePin = async (messageId) => {
    try {
      await apiRequest({
        path: `/api/events/${eventId}/forum/messages/${messageId}/pin`,
        method: "PATCH",
        token: auth.token,
      });
    } catch (error) {
      setForumError(error.message);
    }
  };

  const deleteMessage = async (messageId) => {
    const confirmed = window.confirm("Delete this forum message?");
    if (!confirmed) return;
    try {
      await apiRequest({
        path: `/api/events/${eventId}/forum/messages/${messageId}`,
        method: "DELETE",
        token: auth.token,
      });
    } catch (error) {
      setForumError(error.message);
    }
  };

  const getReactionCount = (message, aliases = []) => {
    if (!Array.isArray(message?.reactions) || aliases.length === 0) return 0;
    return aliases.reduce((sum, alias) => {
      const hit = message.reactions.find((item) => item.emoji === alias);
      return sum + Number(hit?.count || 0);
    }, 0);
  };

  const topLevelMessages = forumMessages.filter((message) => !message.parentMessage);
  const repliesByParent = forumMessages.reduce((acc, message) => {
    if (!message.parentMessage) return acc;
    const key = String(message.parentMessage);
    if (!acc[key]) acc[key] = [];
    acc[key].push(message);
    return acc;
  }, {});

  const trendItems = useMemo(() => {
    if (!event) return [];
    const sameOrganizer = discoverEvents.filter(
      (item) => String(item._id) !== String(event._id) && String(item.organizer?._id || item.organizer?.id || "") === String(event.organizer?._id || "")
    );
    const sameType = discoverEvents.filter((item) => String(item._id) !== String(event._id) && item.eventType === event.eventType);
    if (trendTab === "organizer") return sameOrganizer.slice(0, 5);
    if (trendTab === "type") return sameType.slice(0, 5);
    return discoverTrending.filter((item) => String(item._id) !== String(event._id)).slice(0, 5);
  }, [discoverEvents, discoverTrending, event, trendTab]);

  if (loading) return <main className="page">Loading event...</main>;
  if (error) return <main className="page"><p className="error">{error}</p></main>;

  return (
    <main className="page event-page">
      <div className="page-head event-head">
        <h1>{event.name}</h1>
        <div className="tabs event-tabs">
          <button type="button" className={activeTab === "details" ? "tab-btn tab-btn-active" : "tab-btn"} onClick={() => setSearchParams({})}>
            Event Details
          </button>
          <button type="button" className={activeTab === "forum" ? "tab-btn tab-btn-active" : "tab-btn"} onClick={() => setSearchParams({ tab: "forum" })}>
            Discussion Forum
          </button>
        </div>
      </div>

      <section className="card trend-strip">
        <div className="page-head compact">
          <h3>Trending Events</h3>
          <div className="tabs">
            <button type="button" className={trendTab === "24h" ? "tab-btn tab-btn-active" : "tab-btn"} onClick={() => setTrendTab("24h")}>
              Last 24 Hours
            </button>
            <button
              type="button"
              className={trendTab === "organizer" ? "tab-btn tab-btn-active" : "tab-btn"}
              onClick={() => setTrendTab("organizer")}
            >
              Same Organizer
            </button>
            <button type="button" className={trendTab === "type" ? "tab-btn tab-btn-active" : "tab-btn"} onClick={() => setTrendTab("type")}>
              Same Type
            </button>
          </div>
        </div>
        <div className="trend-list">
          {trendItems.length === 0 ? (
            <p className="muted">No events available in this category.</p>
          ) : (
            trendItems.map((item) => (
              <Link key={item._id} to={`/events/${item._id}`} className="trend-item">
                <span className="trend-title">{item.name}</span>
                <span className="event-meta">{item.organizer?.name || "-"} | {item.eventType}</span>
              </Link>
            ))
          )}
        </div>
      </section>

      {activeTab === "details" && (
        <section className="event-stack">
          <div className="card form event-info-card">
          {event.coverImage ? <SmartImage src={event.coverImage} alt={`${event.name} Cover`} className="event-cover event-cover-large" /> : null}
          <p>{event.description}</p>
          <p className="event-meta"><strong>Organizer:</strong> {event.organizer?.name || "-"}</p>
          <p className="event-meta"><strong>Type:</strong> {event.eventType}</p>
          <p className="event-meta"><strong>Status:</strong> {event.effectiveEventStatus}</p>
          <p className="event-meta"><strong>Eligibility:</strong> {formatEligibility(event.eligibility)}</p>
          <p className="event-meta"><strong>Registration Fee:</strong> INR {event.registrationFee}</p>
          <p className="event-meta"><strong>Registration Limit:</strong> {event.registrationLimit}</p>
          <p className="event-meta"><strong>Registration Deadline:</strong> {new Date(event.registrationDeadline).toLocaleString()}</p>
          <p className="event-meta"><strong>Start:</strong> {new Date(event.startDate).toLocaleString()}</p>
          <p className="event-meta"><strong>End:</strong> {new Date(event.endDate).toLocaleString()}</p>
          {(deadlinePassed || eventCompleted) && (
            <p className="error">{deadlinePassed ? "registration deadline has passed" : "event registration is closed because event is completed"}</p>
          )}

          </div>

          <div className="card form event-action-card">
          {event.eventType === "Normal" && (
            <>
              <h3>Registration Form</h3>
              {sortedFormFields.map((field) => (
                <label key={`${field.label}-${field.order}`}>
                  {field.label} {field.required ? "*" : ""}
                  {field.type === "dropdown" ? (
                    <select
                      value={String(formResponses[field.label] || "")}
                      onChange={(e) => setFormResponses((prev) => ({ ...prev, [field.label]: e.target.value }))}
                    >
                      <option value="">Select</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <input
                      type="checkbox"
                      checked={Boolean(formResponses[field.label])}
                      onChange={(e) => setFormResponses((prev) => ({ ...prev, [field.label]: e.target.checked }))}
                    />
                  ) : (
                    <input
                      value={String(formResponses[field.label] || "")}
                      onChange={(e) => setFormResponses((prev) => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={field.type === "file" ? "paste uploaded file url" : ""}
                    />
                  )}
                </label>
              ))}
            </>
          )}

          {event.eventType === "Merchandise" && (
            <>
              <h3>Merchandise Order</h3>
              {!hasMerchVariants && <div className="empty-note">No merchandise variants configured for this event.</div>}
              <label>
                Item
                <select value={selectedVariantKey} onChange={(e) => {
                  const variant = merchVariants.find((item) => item.name === e.target.value);
                  setSelectedVariantKey(e.target.value);
                  const sizes = variant?.sizes?.length ? variant.sizes : variant?.size ? [variant.size] : ["One Size"];
                  const colors = variant?.colors?.length ? variant.colors : variant?.color ? [variant.color] : ["Default"];
                  setSelectedSize(sizes[0] || "");
                  setSelectedColor(colors[0] || "");
                }} disabled={!hasMerchVariants}>
                  {merchVariants.map((variant) => (
                    <option value={variant.name} key={variant.name}>
                      {variant.name} (stock: {variant.remainingStock})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Size
                <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)} disabled={!selectedVariantRecord}>
                  {(selectedVariantRecord?.sizes?.length ? selectedVariantRecord.sizes : selectedVariantRecord?.size ? [selectedVariantRecord.size] : ["One Size"]).map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
              <label>
                Color
                <select value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} disabled={!selectedVariantRecord}>
                  {(selectedVariantRecord?.colors?.length ? selectedVariantRecord.colors : selectedVariantRecord?.color ? [selectedVariantRecord.color] : ["Default"]).map((color) => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </label>
              <label>
                Quantity
                <input type="number" min={1} max={event.merchandiseConfig?.purchaseLimitPerUser || 1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              {selectedVariantRecord && selectedVariantRecord.remainingStock < Number(quantity) && <p className="error">requested quantity exceeds remaining stock</p>}
              <label>
                Payment Proof URL
                <input value={paymentProofUrl} onChange={(e) => setPaymentProofUrl(e.target.value)} placeholder="https://..." />
              </label>
              <div className="action-row">
                <label className="subtle-btn" style={{ cursor: "pointer" }}>
                  {uploadingProof ? "Uploading..." : "Upload Payment Proof Image"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePaymentProofUpload} />
                </label>
                {paymentProofUrl ? <span className="muted">payment proof attached</span> : null}
              </div>
            </>
          )}

          {submitError && <p className="error">{submitError}</p>}
          <button type="button" onClick={register} disabled={!canSubmit}>
            {submitting ? "Submitting..." : event.eventType === "Merchandise" ? "Purchase / Register" : "Submit Registration"}
          </button>
          </div>
        </section>
      )}

      {activeTab === "forum" && (
        <div className="card form forum-panel">
          <h3>Discussion Forum</h3>
          {forumError && <p className="error">{forumError}</p>}
          <label>
            Message
            <textarea rows={4} value={forumText} onChange={(e) => setForumText(e.target.value)} placeholder="Post update, question, or announcement. Use @all/@everyone or @organizername." />
          </label>
          <label>
            Optional Image URL
            <input value={forumImageUrl} onChange={(e) => setForumImageUrl(e.target.value)} placeholder="https://... (Cloudinary/Drive/public image URL)" />
          </label>
          {replyTo && <p className="muted">Replying to message #{replyTo}</p>}
          <div className="action-row">
            <button type="button" onClick={postForumMessage}>Post Message</button>
            {auth?.user?.role === "organizer" ? (
              <button type="button" className="subtle-btn" onClick={() => setForumText((prev) => `${prev} @all `.trimStart())}>
                Tag @all
              </button>
            ) : (
              <button type="button" className="subtle-btn" onClick={() => setForumText((prev) => `${prev} @organizer `.trimStart())}>
                Tag Organizer
              </button>
            )}
            {replyTo && <button type="button" className="subtle-btn" onClick={() => setReplyTo("")}>Clear Reply</button>}
          </div>
          <div className="action-row">
            {reactionOptions.map((item) => (
              <button
                key={`composer-${item.emoji}`}
                type="button"
                className="subtle-btn"
                title={`Insert ${item.title}`}
                onClick={() => setForumText((prev) => `${prev}${prev ? " " : ""}${item.emoji}`)}
              >
                {item.emoji}
              </button>
            ))}
          </div>
          <div className="forum-thread">
            {topLevelMessages.map((message) => (
              <article className={`forum-message ${message.authorRole === "organizer" ? "forum-message-organizer" : ""}`} key={message.id}>
                <header className="forum-header">
                  <strong>{message.authorName}</strong>
                  {message.authorRole === "organizer" && <span className="status-badge status-ongoing">Organizer</span>}
                  <span className="muted">{new Date(message.createdAt).toLocaleString()}</span>
                  {message.pinned && <span className="status-badge status-ongoing">Pinned</span>}
                </header>
                <p>{message.text}</p>
                {Array.isArray(message.attachments) && message.attachments.length > 0 && (
                  <div className="forum-attachments">
                    {message.attachments.map((url) => (
                      <SmartImage key={url} src={url} alt="Forum Attachment" className="forum-image" />
                    ))}
                  </div>
                )}
                <div className="action-row">
                  <button type="button" className="subtle-btn" onClick={() => setReplyTo(message.id)}>Reply</button>
                  {reactionOptions.map((item) => (
                    <button
                      key={`${message.id}-${item.emoji}`}
                      type="button"
                      className="subtle-btn"
                      title={`React ${item.title}`}
                      onClick={() => reactToMessage(message.id, item.emoji)}
                    >
                      {item.emoji} {getReactionCount(message, item.aliases)}
                    </button>
                  ))}
                  {auth?.user?.role === "organizer" && <button type="button" className="subtle-btn" onClick={() => togglePin(message.id)}>{message.pinned ? "Unpin" : "Pin"}</button>}
                  <button type="button" className="danger-btn" onClick={() => deleteMessage(message.id)}>Delete</button>
                </div>
                {(repliesByParent[message.id] || []).map((reply) => (
                  <div className="forum-reply" key={reply.id}>
                    <p><strong>{reply.authorName}</strong> <span className="muted">{new Date(reply.createdAt).toLocaleString()}</span></p>
                    <p>{reply.text}</p>
                    {Array.isArray(reply.attachments) && reply.attachments.length > 0 && (
                      <div className="forum-attachments">
                        {reply.attachments.map((url) => (
                          <SmartImage key={url} src={url} alt="Forum Attachment" className="forum-image" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </article>
            ))}
            {topLevelMessages.length === 0 && <p className="muted">No messages yet.</p>}
          </div>
        </div>
      )}
    </main>
  );
};

export default EventDetailsPage;

