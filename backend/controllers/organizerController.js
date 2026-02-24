const mongoose = require("mongoose");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Participant = require("../models/Participant");
const Organizer = require("../models/Organizer");
const OrganizerPasswordResetRequest = require("../models/OrganizerPasswordResetRequest");
const OrganizerNotification = require("../models/OrganizerNotification");
const { parseQrPayload, buildQrPayload, generateQrCodeDataUrl } = require("../utils/qrService");
const { sendTicketEmail } = require("../utils/emailService");

const escapeCsv = (value) => {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const ensureOrganizerEvent = async (eventId, organizerId) => {
  return Event.findOne({ _id: eventId, organizer: organizerId });
};

const normalizeFormResponses = (formResponses) => {
  if (Array.isArray(formResponses)) return formResponses;
  if (formResponses && typeof formResponses === "object") {
    return Object.entries(formResponses).map(([label, value]) => ({ label, value }));
  }
  return [];
};

const markAttendanceInternal = async ({ ticket, organizerId, source, note = "" }) => {
  const previousAttended = Boolean(ticket.attended);
  ticket.attended = true;
  ticket.attendanceTime = new Date();
  ticket.scannedBy = organizerId;
  ticket.attendanceAudit.push({
    actorId: organizerId,
    source,
    previousAttended,
    nextAttended: true,
    note: note || "",
    changedAt: new Date(),
  });
  await ticket.save();
};

const getEventAnalytics = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.userId;

    const event = await ensureOrganizerEvent(eventId, organizerId);
    if (!event) {
      return res.status(404).json({ message: "event not found for this organizer" });
    }

    const tickets = await Ticket.find({ event: eventId, status: { $in: ["Registered", "Pending", "Rejected", "Cancelled"] } })
      .sort({ createdAt: -1 })
      .populate("participant", "name email");

    const registeredTickets = tickets.filter((ticket) => ticket.status === "Registered");
    const attendedTickets = registeredTickets.filter((ticket) => ticket.attended);
    const totalRegistrations = registeredTickets.length;
    const totalAttended = attendedTickets.length;
    const notAttended = Math.max(totalRegistrations - totalAttended, 0);
    const attendancePercentage = totalRegistrations === 0 ? 0 : Number(((totalAttended / totalRegistrations) * 100).toFixed(2));

    return res.status(200).json({
      event: {
        id: event._id,
        name: event.name,
        status: event.status,
      },
      totalTickets: tickets.length,
      totalRegistrations,
      totalAttended,
      notAttended,
      attendancePercentage,
      participants: tickets.map((ticket) => ({
        participantId: ticket.participant?._id,
        name: ticket.participant?.name,
        email: ticket.participant?.email,
        ticketId: ticket.ticketId,
        status: ticket.status,
        payment: ticket.payment,
        attended: ticket.attended,
        attendanceTime: ticket.attendanceTime,
        scannedBy: ticket.scannedBy,
        teamName: ticket.teamName || "",
        formResponses: normalizeFormResponses(ticket.formResponses),
        merchandiseOrder: ticket.merchandiseOrder,
        registeredAt: ticket.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch event analytics", error: error.message });
  }
};

const getOrganizerAnalytics = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const events = await Event.find({ organizer: organizerId }).select("name status startDate endDate");

    const analytics = await Promise.all(
      events.map(async (event) => {
        const totalRegistrations = await Ticket.countDocuments({ event: event._id, status: "Registered" });
        const totalAttended = await Ticket.countDocuments({ event: event._id, status: "Registered", attended: true });
        const notAttended = Math.max(totalRegistrations - totalAttended, 0);
        const attendancePercentage = totalRegistrations === 0 ? 0 : Number(((totalAttended / totalRegistrations) * 100).toFixed(2));

        return {
          eventId: event._id,
          name: event.name,
          status: event.status,
          startDate: event.startDate,
          endDate: event.endDate,
          totalRegistrations,
          totalAttended,
          notAttended,
          attendancePercentage,
        };
      })
    );

    return res.status(200).json({
      count: analytics.length,
      analytics,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizer analytics", error: error.message });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const organizerId = req.user.userId;

    const ticket = await Ticket.findOne({ ticketId }).populate("event", "organizer name");
    if (!ticket) {
      return res.status(404).json({ message: "ticket not found" });
    }

    if (!ticket.event || String(ticket.event.organizer) !== String(organizerId)) {
      return res.status(403).json({ message: "you cannot mark attendance for this ticket" });
    }

    if (ticket.status !== "Registered") {
      return res.status(400).json({ message: "attendance allowed only for registered tickets" });
    }

    if (ticket.attended) {
      return res.status(409).json({ message: "attendance already marked" });
    }

    await markAttendanceInternal({ ticket, organizerId, source: "manual_mark" });

    return res.status(200).json({
      message: "attendance marked successfully",
      ticket: {
        ticketId: ticket.ticketId,
        attended: ticket.attended,
        attendanceTime: ticket.attendanceTime,
        scannedBy: ticket.scannedBy,
        eventId: ticket.event._id,
        eventName: ticket.event.name,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to mark attendance", error: error.message });
  }
};

const scanAttendanceByQr = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const { qrPayload } = req.body;

    if (!qrPayload) {
      return res.status(400).json({ message: "qrPayload is required" });
    }

    const parsed = parseQrPayload(qrPayload);
    if (parsed.error) {
      return res.status(400).json({ message: parsed.error });
    }

    const ticket = await Ticket.findOne({ ticketId: parsed.ticketId }).populate("event", "organizer name _id");
    if (!ticket) {
      return res.status(404).json({ message: "ticket not found" });
    }

    if (parsed.eventId && String(parsed.eventId) !== String(ticket.event?._id)) {
      return res.status(400).json({ message: "qr payload event mismatch" });
    }

    if (!ticket.event || String(ticket.event.organizer) !== String(organizerId)) {
      return res.status(403).json({ message: "you cannot mark attendance for this ticket" });
    }

    if (ticket.status !== "Registered") {
      return res.status(400).json({ message: "attendance allowed only for registered tickets" });
    }

    if (ticket.attended) {
      return res.status(409).json({ message: "attendance already marked" });
    }

    await markAttendanceInternal({ ticket, organizerId, source: "scan_qr" });

    return res.status(200).json({
      message: "attendance marked successfully",
      ticket: {
        ticketId: ticket.ticketId,
        attended: ticket.attended,
        attendanceTime: ticket.attendanceTime,
        scannedBy: ticket.scannedBy,
        eventId: ticket.event._id,
        eventName: ticket.event.name,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to scan attendance", error: error.message });
  }
};

const overrideAttendance = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const organizerId = req.user.userId;
    const { attended, note } = req.body;

    if (typeof attended !== "boolean") {
      return res.status(400).json({ message: "attended boolean is required" });
    }

    const ticket = await Ticket.findOne({ ticketId }).populate("event", "organizer name");
    if (!ticket) {
      return res.status(404).json({ message: "ticket not found" });
    }

    if (!ticket.event || String(ticket.event.organizer) !== String(organizerId)) {
      return res.status(403).json({ message: "you cannot override attendance for this ticket" });
    }

    if (ticket.status !== "Registered") {
      return res.status(400).json({ message: "attendance override allowed only for registered tickets" });
    }

    if (ticket.attended === attended) {
      return res.status(400).json({ message: "attendance is already set to the requested value" });
    }

    const previousAttended = Boolean(ticket.attended);
    ticket.attended = attended;
    if (attended) {
      ticket.attendanceTime = new Date();
      ticket.scannedBy = organizerId;
    } else {
      ticket.attendanceTime = null;
      ticket.scannedBy = null;
    }

    ticket.attendanceAudit.push({
      actorId: organizerId,
      source: "manual_override",
      previousAttended,
      nextAttended: attended,
      note: typeof note === "string" ? note.trim() : "",
      changedAt: new Date(),
    });

    await ticket.save();

    return res.status(200).json({
      message: "attendance override applied",
      ticket: {
        ticketId: ticket.ticketId,
        attended: ticket.attended,
        attendanceTime: ticket.attendanceTime,
        scannedBy: ticket.scannedBy,
        auditCount: ticket.attendanceAudit.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to override attendance", error: error.message });
  }
};

const exportAttendanceCsv = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.userId;

    const event = await ensureOrganizerEvent(eventId, organizerId);
    if (!event) {
      return res.status(404).json({ message: "event not found for this organizer" });
    }

    const tickets = await Ticket.find({ event: eventId, status: { $in: ["Registered", "Pending", "Rejected", "Cancelled"] } })
      .sort({ createdAt: 1 })
      .populate("participant", "name email");

    const lines = [
      ["participant_name", "participant_email", "ticket_id", "ticket_status", "attendance_status", "attendance_time"].join(","),
      ...tickets.map((ticket) =>
        [
          escapeCsv(ticket.participant?.name || ""),
          escapeCsv(ticket.participant?.email || ""),
          escapeCsv(ticket.ticketId || ""),
          escapeCsv(ticket.status),
          escapeCsv(ticket.attended ? "Attended" : "Not Attended"),
          escapeCsv(ticket.attendanceTime ? new Date(ticket.attendanceTime).toISOString() : ""),
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${eventId}.csv"`);
    return res.status(200).send(lines.join("\n"));
  } catch (error) {
    return res.status(500).json({ message: "failed to export attendance csv", error: error.message });
  }
};

const getPendingMerchandiseOrders = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.userId;

    const event = await ensureOrganizerEvent(eventId, organizerId);
    if (!event) {
      return res.status(404).json({ message: "event not found for this organizer" });
    }
    if (event.eventType !== "Merchandise") {
      return res.status(400).json({ message: "pending orders are available only for merchandise events" });
    }

    const pendingOrders = await Ticket.find({ event: eventId, status: "Pending", "payment.status": "Pending" })
      .sort({ createdAt: 1 })
      .populate("participant", "name email");

    return res.status(200).json({
      count: pendingOrders.length,
      orders: pendingOrders.map((ticket) => ({
        ticketDbId: ticket._id,
        status: ticket.status,
        payment: ticket.payment,
        merchandiseOrder: ticket.merchandiseOrder,
        participant: {
          id: ticket.participant?._id,
          name: ticket.participant?.name,
          email: ticket.participant?.email,
        },
        createdAt: ticket.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch pending merchandise orders", error: error.message });
  }
};

const approveMerchandiseOrder = async (req, res) => {
  const { ticketId } = req.params;
  const organizerId = req.user.userId;
  if (!mongoose.isValidObjectId(ticketId)) {
    return res.status(400).json({ message: "invalid order id" });
  }

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const ticket = await Ticket.findById(ticketId).session(session);
      if (!ticket) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(404).json({ message: "order not found" });
      }

      const event = await Event.findById(ticket.event).session(session);
      if (!event || String(event.organizer) !== String(organizerId)) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(403).json({ message: "you cannot approve this order" });
      }
      if (event.eventType !== "Merchandise") {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({ message: "order approval is only for merchandise events" });
      }

      if (ticket.status !== "Pending" || ticket.payment?.status !== "Pending") {
        if (ticket.status === "Registered" && ticket.payment?.status === "Approved") {
          await session.abortTransaction();
          await session.endSession();
          return res.status(200).json({
            message: "order already approved",
            ticket: {
              id: ticket._id,
              ticketId: ticket.ticketId,
              status: ticket.status,
              payment: ticket.payment,
              qrPayload: ticket.qrPayload,
              qrCode: ticket.qrCode,
            },
            email: { sent: false, warning: "email not re-sent for already approved order" },
          });
        }
        await session.abortTransaction();
        await session.endSession();
        return res.status(409).json({ message: "order is not pending" });
      }

      const selectedVariant = event.merchandiseConfig.variants.find((item) => item.name === ticket.merchandiseOrder?.variant);
      if (!selectedVariant) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({ message: "order variant no longer exists" });
      }

      if (ticket.merchandiseOrder.quantity > selectedVariant.remainingStock) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(409).json({ message: "insufficient stock to approve this order" });
      }

      selectedVariant.remainingStock -= ticket.merchandiseOrder.quantity;
      await event.save({ session });

      ticket.status = "Registered";
      ticket.payment.status = "Approved";
      ticket.payment.reviewedBy = organizerId;
      ticket.payment.reviewedAt = new Date();
      ticket.payment.rejectionReason = "";

      const qrPayload = buildQrPayload({
        ticketId: ticket.ticketId,
        eventId: String(event._id),
        participantId: String(ticket.participant),
      });
      const qrCode = await generateQrCodeDataUrl(qrPayload);
      ticket.qrPayload = qrPayload;
      ticket.qrCode = qrCode;
      await ticket.save({ session });

      const participant = await Participant.findById(ticket.participant).select("name email").session(session);

      await session.commitTransaction();
      await session.endSession();

      let emailResult = { sent: false };
      try {
        emailResult = await sendTicketEmail({
          to: participant.email,
          participantName: participant.name,
          event,
          ticketId: ticket.ticketId,
          qrCode,
        });
      } catch (emailError) {
        emailResult = {
          sent: false,
          warning: `order approved but email failed: ${emailError.message}`,
        };
      }

      return res.status(200).json({
        message: "merchandise order approved",
        ticket: {
          id: ticket._id,
          ticketId: ticket.ticketId,
          status: ticket.status,
          payment: ticket.payment,
          qrPayload: ticket.qrPayload,
          qrCode: ticket.qrCode,
        },
        email: emailResult,
      });
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();

      const isWriteConflict = error?.code === 112 || String(error.message || "").toLowerCase().includes("write conflict");
      if (isWriteConflict && attempt < maxRetries) {
        continue;
      }
      if (isWriteConflict) {
        return res.status(409).json({
          message: "approval temporarily conflicted with another update, please retry",
          error: error.message,
        });
      }

      return res.status(500).json({ message: "failed to approve order", error: error.message });
    }
  }

  return res.status(409).json({ message: "approval temporarily conflicted with another update, please retry" });
};

const rejectMerchandiseOrder = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const organizerId = req.user.userId;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!mongoose.isValidObjectId(ticketId)) {
      return res.status(400).json({ message: "invalid order id" });
    }

    const ticket = await Ticket.findById(ticketId).populate("event", "organizer eventType");
    if (!ticket) {
      return res.status(404).json({ message: "order not found" });
    }
    if (!ticket.event || String(ticket.event.organizer) !== String(organizerId)) {
      return res.status(403).json({ message: "you cannot reject this order" });
    }
    if (ticket.event.eventType !== "Merchandise") {
      return res.status(400).json({ message: "order rejection is only for merchandise events" });
    }
    if (ticket.status !== "Pending" || ticket.payment?.status !== "Pending") {
      return res.status(409).json({ message: "order is not pending" });
    }

    ticket.status = "Rejected";
    ticket.payment.status = "Rejected";
    ticket.payment.reviewedBy = organizerId;
    ticket.payment.reviewedAt = new Date();
    ticket.payment.rejectionReason = reason;
    await ticket.save();

    return res.status(200).json({
      message: "merchandise order rejected",
      ticket: {
        id: ticket._id,
        status: ticket.status,
        payment: ticket.payment,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to reject order", error: error.message });
  }
};

const requestOrganizerPasswordReset = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    if (!reason || reason.length < 5) {
      return res.status(400).json({ message: "reason is required and must be at least 5 characters" });
    }

    const pendingRequest = await OrganizerPasswordResetRequest.findOne({
      organizer: organizerId,
      status: "Pending",
    });
    if (pendingRequest) {
      return res.status(409).json({ message: "a password reset request is already pending" });
    }

    const requestDoc = await OrganizerPasswordResetRequest.create({
      organizer: organizerId,
      reason,
      status: "Pending",
    });

    return res.status(201).json({
      message: "password reset request submitted",
      request: {
        id: requestDoc._id,
        organizer: requestDoc.organizer,
        reason: requestDoc.reason,
        status: requestDoc.status,
        createdAt: requestDoc.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to submit password reset request", error: error.message });
  }
};

const getOrganizerProfile = async (req, res) => {
  try {
    const organizer = await Organizer.findById(req.user.userId)
      .select("name category description contactEmail contactNumber discordWebhookUrl isActive createdAt");
    if (!organizer) {
      return res.status(404).json({ message: "organizer not found" });
    }
    return res.status(200).json({ organizer });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizer profile", error: error.message });
  }
};

const updateOrganizerProfile = async (req, res) => {
  try {
    const { name, category, description, contactNumber, discordWebhookUrl } = req.body;
    const updates = {};
    if (typeof name === "string" && name.trim()) updates.name = name.trim();
    if (typeof category === "string" && category.trim()) updates.category = category.trim();
    if (typeof description === "string" && description.trim()) updates.description = description.trim();
    if (typeof contactNumber === "string") updates.contactNumber = contactNumber.trim();
    if (typeof discordWebhookUrl === "string") updates.discordWebhookUrl = discordWebhookUrl.trim();

    if (updates.discordWebhookUrl) {
      try {
        const parsed = new URL(updates.discordWebhookUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return res.status(400).json({ message: "discordWebhookUrl must be http or https" });
        }
      } catch (error) {
        return res.status(400).json({ message: "discordWebhookUrl is invalid" });
      }
    }

    const organizer = await Organizer.findByIdAndUpdate(req.user.userId, updates, { new: true })
      .select("name category description contactEmail contactNumber discordWebhookUrl isActive createdAt");
    if (!organizer) {
      return res.status(404).json({ message: "organizer not found" });
    }
    return res.status(200).json({ message: "organizer profile updated", organizer });
  } catch (error) {
    return res.status(500).json({ message: "failed to update organizer profile", error: error.message });
  }
};

const getOrganizerNotifications = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const notifications = await OrganizerNotification.find({ organizer: organizerId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("event", "name")
      .populate("forumMessage", "text");
    const unreadCount = await OrganizerNotification.countDocuments({ organizer: organizerId, read: false });

    return res.status(200).json({
      unreadCount,
      notifications: notifications.map((item) => ({
        id: item._id,
        title: item.title,
        body: item.body,
        read: item.read,
        event: item.event ? { id: item.event._id, name: item.event.name } : null,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizer notifications", error: error.message });
  }
};

const markOrganizerNotificationRead = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const { notificationId } = req.params;
    const notification = await OrganizerNotification.findOneAndUpdate(
      { _id: notificationId, organizer: organizerId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: "notification not found" });
    }
    return res.status(200).json({ message: "notification marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "failed to mark organizer notification", error: error.message });
  }
};

const markAllOrganizerNotificationsRead = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    await OrganizerNotification.updateMany({ organizer: organizerId, read: false }, { read: true });
    return res.status(200).json({ message: "all organizer notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "failed to mark organizer notifications", error: error.message });
  }
};

const deleteOrganizerNotification = async (req, res) => {
  try {
    const organizerId = req.user.userId;
    const { notificationId } = req.params;
    const deleted = await OrganizerNotification.findOneAndDelete({
      _id: notificationId,
      organizer: organizerId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "notification not found" });
    }
    return res.status(200).json({ message: "notification deleted" });
  } catch (error) {
    return res.status(500).json({ message: "failed to delete organizer notification", error: error.message });
  }
};

module.exports = {
  getEventAnalytics,
  getOrganizerAnalytics,
  markAttendance,
  scanAttendanceByQr,
  overrideAttendance,
  exportAttendanceCsv,
  getPendingMerchandiseOrders,
  approveMerchandiseOrder,
  rejectMerchandiseOrder,
  requestOrganizerPasswordReset,
  getOrganizerProfile,
  updateOrganizerProfile,
  getOrganizerNotifications,
  markOrganizerNotificationRead,
  markAllOrganizerNotificationsRead,
  deleteOrganizerNotification,
};
