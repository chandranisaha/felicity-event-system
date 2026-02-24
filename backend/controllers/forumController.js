const mongoose = require("mongoose");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Participant = require("../models/Participant");
const Organizer = require("../models/Organizer");
const ForumMessage = require("../models/ForumMessage");
const ParticipantNotification = require("../models/ParticipantNotification");
const OrganizerNotification = require("../models/OrganizerNotification");

const roomNameForEvent = (eventId) => `event_forum_${eventId}`;

const resolveDisplayName = async ({ role, userId }) => {
  if (role === "participant") {
    const participant = await Participant.findById(userId).select("name");
    return participant?.name || "Participant";
  }
  if (role === "organizer") {
    const organizer = await Organizer.findById(userId).select("name");
    return organizer?.name || "Organizer";
  }
  return "Admin";
};

const canReadForum = async ({ role, userId, event }) => {
  if (!event) return false;
  if (role === "admin") return true;
  if (role === "organizer") {
    return String(event.organizer) === String(userId);
  }

  const registered = await Ticket.exists({
    event: event._id,
    participant: userId,
    status: "Registered",
  });
  return Boolean(registered);
};

const formatMessage = (messageDoc) => {
  const reactions = (messageDoc.reactions || []).map((reaction) => ({
    emoji: reaction.emoji,
    count: (reaction.users || []).length,
    users: (reaction.users || []).map((id) => String(id)),
  }));

  return {
    id: messageDoc._id,
    eventId: messageDoc.event,
    authorRole: messageDoc.authorRole,
    participantAuthor: messageDoc.participantAuthor,
    organizerAuthor: messageDoc.organizerAuthor,
    authorName: messageDoc.authorName,
    text: messageDoc.text,
    parentMessage: messageDoc.parentMessage,
    isAnnouncement: messageDoc.isAnnouncement,
    pinned: messageDoc.pinned,
    isDeleted: messageDoc.isDeleted,
    attachments: Array.isArray(messageDoc.attachments) ? messageDoc.attachments : [],
    reactions,
    createdAt: messageDoc.createdAt,
    updatedAt: messageDoc.updatedAt,
  };
};

const emitForumEvent = (req, eventId, eventName, payload) => {
  const io = req.app.get("io");
  if (!io) return;
  io.to(roomNameForEvent(eventId)).emit(eventName, payload);
};

const joinForumRoom = (socket) => {
  socket.on("forum:join", (eventId) => {
    if (!eventId || !mongoose.isValidObjectId(eventId)) return;
    socket.join(roomNameForEvent(eventId));
  });
  socket.on("forum:leave", (eventId) => {
    if (!eventId || !mongoose.isValidObjectId(eventId)) return;
    socket.leave(roomNameForEvent(eventId));
  });
};

const listForumMessages = async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({ message: "invalid event id" });
    }

    const event = await Event.findById(eventId).select("organizer name");
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    const allowed = await canReadForum({ role: req.user.role, userId: req.user.userId, event });
    if (!allowed) {
      return res.status(403).json({ message: "forum access denied for this event" });
    }

    const messages = await ForumMessage.find({ event: eventId })
      .sort({ pinned: -1, createdAt: 1 })
      .lean();

    return res.status(200).json({
      count: messages.length,
      messages: messages.map(formatMessage),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch forum messages", error: error.message });
  }
};

const postForumMessage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { text, parentMessage, isAnnouncement, attachments } = req.body || {};
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({ message: "invalid event id" });
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text is required" });
    }

    const event = await Event.findById(eventId).select("organizer");
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    const role = req.user.role;
    const userId = req.user.userId;
    const allowed = await canReadForum({ role, userId, event });
    if (!allowed) {
      return res.status(403).json({ message: "forum access denied for this event" });
    }

    if (isAnnouncement && role !== "organizer") {
      return res.status(403).json({ message: "only organizers can post announcements" });
    }

    let parentRef = null;
    if (parentMessage) {
      if (!mongoose.isValidObjectId(parentMessage)) {
        return res.status(400).json({ message: "invalid parent message id" });
      }
      const parent = await ForumMessage.findOne({ _id: parentMessage, event: eventId }).select("_id");
      if (!parent) {
        return res.status(404).json({ message: "parent message not found" });
      }
      parentRef = parent._id;
    }

    const authorName = await resolveDisplayName({ role, userId });
    const attachmentUrls = Array.isArray(attachments)
      ? attachments
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 4)
      : [];

    const messageDoc = await ForumMessage.create({
      event: eventId,
      authorRole: role,
      participantAuthor: role === "participant" ? userId : null,
      organizerAuthor: role === "organizer" ? userId : null,
      authorName,
      text: text.trim(),
      parentMessage: parentRef,
      isAnnouncement: Boolean(isAnnouncement),
      attachments: attachmentUrls,
    });

    const normalizedText = text.trim().toLowerCase();
    const organizerAuthor = await Organizer.findById(event.organizer).select("name _id");
    const organizerHandle = organizerAuthor?.name ? `@${organizerAuthor.name.toLowerCase().replace(/\s+/g, "")}` : "";
    const mentionsEveryone = normalizedText.includes("@all") || normalizedText.includes("@everyone");
    const mentionsOrganizer = normalizedText.includes("@organizer") || (organizerHandle && normalizedText.includes(organizerHandle));

    if (role === "organizer" && (mentionsEveryone || Boolean(isAnnouncement))) {
      const registeredTickets = await Ticket.find({
        event: eventId,
        status: "Registered",
      }).select("participant");
      const participantIds = Array.from(new Set(registeredTickets.map((item) => String(item.participant))));
      if (participantIds.length > 0) {
        const notifications = participantIds.map((participantId) => ({
          participant: participantId,
          event: eventId,
          forumMessage: messageDoc._id,
          title: isAnnouncement ? "New Event Announcement" : "New Forum Message",
          body: `[${event.name}] ${authorName}: ${text.trim().slice(0, 180)}`,
          type: isAnnouncement ? "forum_announcement" : "forum_message",
        }));
        await ParticipantNotification.insertMany(notifications);
      }
    }

    if (role === "participant" && mentionsOrganizer && organizerAuthor) {
      await OrganizerNotification.create({
        organizer: organizerAuthor._id,
        event: eventId,
        forumMessage: messageDoc._id,
        title: "Participant Mentioned You",
        body: `${authorName} mentioned you in ${event.name}`,
      });
    }

    const payload = formatMessage(messageDoc.toObject ? messageDoc.toObject() : messageDoc);
    emitForumEvent(req, eventId, "forum:message_created", payload);

    return res.status(201).json({
      message: "forum message posted",
      forumMessage: payload,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to post forum message", error: error.message });
  }
};

const togglePinForumMessage = async (req, res) => {
  try {
    const { eventId, messageId } = req.params;
    const organizerId = req.user.userId;
    if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "invalid id" });
    }

    const event = await Event.findById(eventId).select("organizer");
    if (!event) return res.status(404).json({ message: "event not found" });
    if (String(event.organizer) !== String(organizerId)) {
      return res.status(403).json({ message: "only event organizer can pin messages" });
    }

    const messageDoc = await ForumMessage.findOne({ _id: messageId, event: eventId });
    if (!messageDoc) return res.status(404).json({ message: "forum message not found" });

    messageDoc.pinned = !messageDoc.pinned;
    await messageDoc.save();

    const payload = formatMessage(messageDoc.toObject ? messageDoc.toObject() : messageDoc);
    emitForumEvent(req, eventId, "forum:message_updated", payload);

    return res.status(200).json({
      message: messageDoc.pinned ? "message pinned" : "message unpinned",
      forumMessage: payload,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to pin message", error: error.message });
  }
};

const deleteForumMessage = async (req, res) => {
  try {
    const { eventId, messageId } = req.params;
    const { role, userId } = req.user;
    if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "invalid id" });
    }

    const event = await Event.findById(eventId).select("organizer");
    if (!event) return res.status(404).json({ message: "event not found" });

    const messageDoc = await ForumMessage.findOne({ _id: messageId, event: eventId });
    if (!messageDoc) return res.status(404).json({ message: "forum message not found" });

    const canDeleteAsOrganizer = role === "organizer" && String(event.organizer) === String(userId);
    const canDeleteOwn =
      (role === "participant" && String(messageDoc.participantAuthor) === String(userId)) ||
      (role === "organizer" && String(messageDoc.organizerAuthor) === String(userId));
    const canDeleteAsAdmin = role === "admin";

    if (!canDeleteAsOrganizer && !canDeleteOwn && !canDeleteAsAdmin) {
      return res.status(403).json({ message: "you cannot delete this message" });
    }

    messageDoc.isDeleted = true;
    messageDoc.deletedAt = new Date();
    messageDoc.text = "[deleted]";
    messageDoc.pinned = false;
    await messageDoc.save();

    const payload = formatMessage(messageDoc.toObject ? messageDoc.toObject() : messageDoc);
    emitForumEvent(req, eventId, "forum:message_deleted", payload);

    return res.status(200).json({ message: "forum message deleted", forumMessage: payload });
  } catch (error) {
    return res.status(500).json({ message: "failed to delete forum message", error: error.message });
  }
};

const reactForumMessage = async (req, res) => {
  try {
    const { eventId, messageId } = req.params;
    const { emoji } = req.body || {};
    const { role, userId } = req.user;
    if (!mongoose.isValidObjectId(eventId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "invalid id" });
    }
    if (typeof emoji !== "string" || !emoji.trim()) {
      return res.status(400).json({ message: "emoji is required" });
    }

    const event = await Event.findById(eventId).select("organizer");
    if (!event) return res.status(404).json({ message: "event not found" });
    const allowed = await canReadForum({ role, userId, event });
    if (!allowed) {
      return res.status(403).json({ message: "forum access denied for this event" });
    }

    const messageDoc = await ForumMessage.findOne({ _id: messageId, event: eventId });
    if (!messageDoc) return res.status(404).json({ message: "forum message not found" });
    if (messageDoc.isDeleted) return res.status(400).json({ message: "cannot react to deleted message" });

    const reactionEmoji = emoji.trim();
    const existing = messageDoc.reactions.find((item) => item.emoji === reactionEmoji);
    if (!existing) {
      messageDoc.reactions.push({ emoji: reactionEmoji, users: [userId] });
    } else {
      const hasReacted = existing.users.some((id) => String(id) === String(userId));
      if (hasReacted) {
        existing.users = existing.users.filter((id) => String(id) !== String(userId));
      } else {
        existing.users.push(userId);
      }
      if (existing.users.length === 0) {
        messageDoc.reactions = messageDoc.reactions.filter((item) => item.emoji !== reactionEmoji);
      }
    }

    await messageDoc.save();

    const payload = formatMessage(messageDoc.toObject ? messageDoc.toObject() : messageDoc);
    emitForumEvent(req, eventId, "forum:message_updated", payload);

    return res.status(200).json({ message: "reaction updated", forumMessage: payload });
  } catch (error) {
    return res.status(500).json({ message: "failed to update reaction", error: error.message });
  }
};

module.exports = {
  joinForumRoom,
  listForumMessages,
  postForumMessage,
  togglePinForumMessage,
  deleteForumMessage,
  reactForumMessage,
};
