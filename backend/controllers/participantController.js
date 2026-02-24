const Ticket = require("../models/Ticket");
const Participant = require("../models/Participant");
const Organizer = require("../models/Organizer");
const Event = require("../models/Event");
const ParticipantNotification = require("../models/ParticipantNotification");
const { attachDisplayStatus, getDynamicEventStatus } = require("../utils/eventStatus");

const onboardingInterestOptions = [
  "Technical",
  "Cultural",
  "Sports",
  "Entrepreneurship",
  "Design",
  "Music",
  "Dance",
  "Photography",
  "Robotics",
  "AI/ML",
  "Gaming",
  "Literature",
];

const isValidContact = (value) => {
  if (!value) return true;
  const normalized = String(value).replace(/[\s()-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(normalized);
};

const getMyEvents = async (req, res) => {
  try {
    const participantId = req.user.userId;

    const tickets = await Ticket.find({ participant: participantId })
      .sort({ createdAt: -1 })
      .populate({
        path: "event",
        select:
          "name description coverImage eventType eligibility registrationDeadline startDate endDate registrationLimit registrationFee tags status manualEventStatus merchandiseConfig organizer",
        populate: {
          path: "organizer",
          select: "name contactEmail category",
        },
      });

    const items = tickets
      .filter((ticket) => ticket.event)
      .map((ticket) => {
        const eventWithStatus = attachDisplayStatus(ticket.event);
        return {
          ticketId: ticket.ticketId,
          teamName: ticket.teamName || "",
          status: ticket.status,
          payment: ticket.payment,
          attended: ticket.attended,
          attendanceTime: ticket.attendanceTime,
          qrCode: ticket.qrCode,
          qrPayload: ticket.qrPayload,
          merchandiseOrder: ticket.merchandiseOrder,
          formResponses: ticket.formResponses || [],
          registeredAt: ticket.createdAt,
          event: eventWithStatus,
        };
      });

    return res.status(200).json({
      count: items.length,
      items,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch participant events", error: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const participant = await Participant.findById(req.user.userId)
      .select("-password")
      .populate("followedOrganizers", "name contactEmail category isActive");

    if (!participant) {
      return res.status(404).json({ message: "participant not found" });
    }

    return res.status(200).json({ participant });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch profile", error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, contact, college, interests, followedOrganizers } = req.body;
    const updates = {};

    if (typeof firstName === "string" && firstName.trim()) {
      updates.firstName = firstName.trim();
    }
    if (typeof lastName === "string" && lastName.trim()) {
      updates.lastName = lastName.trim();
    }
    if (updates.firstName || updates.lastName) {
      const participantSnapshot = await Participant.findById(req.user.userId).select("firstName lastName");
      const computedFirst = updates.firstName || participantSnapshot?.firstName || "";
      const computedLast = updates.lastName || participantSnapshot?.lastName || "";
      updates.name = `${computedFirst} ${computedLast}`.trim();
    }
    if (typeof contact === "string") {
      const normalized = contact.trim();
      if (normalized && !isValidContact(normalized)) {
        return res.status(400).json({ message: "contact number must be 7 to 15 digits (optional + allowed)" });
      }
      updates.contact = normalized;
    }
    if (typeof college === "string" && college.trim()) {
      updates.college = college.trim();
    }
    if (Array.isArray(interests)) {
      updates.interests = interests.map((interest) => String(interest).trim()).filter(Boolean);
    }
    if (Array.isArray(followedOrganizers)) {
      const validOrganizers = await Organizer.find({ _id: { $in: followedOrganizers }, isActive: true }).select("_id");
      updates.followedOrganizers = validOrganizers.map((organizer) => organizer._id);
    }

    const participant = await Participant.findByIdAndUpdate(req.user.userId, updates, { new: true })
      .select("-password")
      .populate("followedOrganizers", "name contactEmail category isActive");

    if (!participant) {
      return res.status(404).json({ message: "participant not found" });
    }

    return res.status(200).json({
      message: "profile updated successfully",
      participant,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to update profile", error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "new password must be at least 6 characters" });
    }

    const participant = await Participant.findById(req.user.userId);
    if (!participant) {
      return res.status(404).json({ message: "participant not found" });
    }

    const ok = await participant.comparePassword(currentPassword);
    if (!ok) {
      return res.status(401).json({ message: "current password is incorrect" });
    }

    participant.password = newPassword;
    await participant.save();

    return res.status(200).json({ message: "password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "failed to change password", error: error.message });
  }
};

const getOnboardingOptions = async (req, res) => {
  try {
    const participant = await Participant.findById(req.user.userId).select("interests followedOrganizers onboardingCompleted");
    if (!participant) {
      return res.status(404).json({ message: "participant not found" });
    }

    const organizers = await Organizer.find({ isActive: true }).select("name category contactEmail");

    return res.status(200).json({
      interestOptions: onboardingInterestOptions,
      organizers: organizers.map((org) => ({
        id: org._id,
        name: org.name,
        category: org.category,
        contactEmail: org.contactEmail,
      })),
      current: {
        interests: participant.interests || [],
        followedOrganizers: (participant.followedOrganizers || []).map((id) => String(id)),
        onboardingCompleted: Boolean(participant.onboardingCompleted),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch onboarding options", error: error.message });
  }
};

const completeOnboarding = async (req, res) => {
  try {
    const skip = Boolean(req.body?.skip);
    const updates = { onboardingCompleted: true };

    if (!skip) {
      if (Array.isArray(req.body?.interests)) {
        const sanitizedInterests = req.body.interests
          .map((item) => String(item).trim())
          .filter((item) => onboardingInterestOptions.includes(item));
        updates.interests = Array.from(new Set(sanitizedInterests));
      }

      if (Array.isArray(req.body?.followedOrganizers)) {
        const validOrganizers = await Organizer.find({
          _id: { $in: req.body.followedOrganizers },
          isActive: true,
        }).select("_id");
        updates.followedOrganizers = validOrganizers.map((item) => item._id);
      }
    }

    const participant = await Participant.findByIdAndUpdate(req.user.userId, updates, { new: true }).select("-password");
    if (!participant) {
      return res.status(404).json({ message: "participant not found" });
    }

    return res.status(200).json({
      message: skip ? "onboarding skipped successfully" : "onboarding completed successfully",
      participant,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to complete onboarding", error: error.message });
  }
};

const listOrganizers = async (req, res) => {
  try {
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    const category = typeof req.query?.category === "string" ? req.query.category.trim() : "";

    const filter = { isActive: true };
    if (category) {
      filter.category = category;
    }

    let organizers = await Organizer.find(filter).select("name category description contactEmail createdAt").sort({ name: 1 });
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      organizers = organizers.filter((org) => regex.test(org.name) || regex.test(org.description) || regex.test(org.category));
    }

    const participant = await Participant.findById(req.user.userId).select("followedOrganizers");
    const followed = new Set((participant?.followedOrganizers || []).map((id) => String(id)));

    return res.status(200).json({
      count: organizers.length,
      organizers: organizers.map((org) => ({
        id: org._id,
        name: org.name,
        category: org.category,
        description: org.description,
        contactEmail: org.contactEmail,
        isFollowed: followed.has(String(org._id)),
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizers", error: error.message });
  }
};

const getOrganizerDetailForParticipant = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const organizer = await Organizer.findOne({ _id: organizerId, isActive: true }).select("name category description contactEmail");
    if (!organizer) {
      return res.status(404).json({ message: "organizer not found" });
    }

    const events = await Event.find({ organizer: organizerId, status: "Published" }).sort({ startDate: 1 });
    const now = new Date();
    const upcoming = [];
    const past = [];

    for (const event of events) {
      const withStatus = attachDisplayStatus(event);
      if (getDynamicEventStatus(event, now) === "Completed") {
        past.push(withStatus);
      } else {
        upcoming.push(withStatus);
      }
    }

    return res.status(200).json({
      organizer: {
        id: organizer._id,
        name: organizer.name,
        category: organizer.category,
        description: organizer.description,
        contactEmail: organizer.contactEmail,
      },
      upcomingEvents: upcoming,
      pastEvents: past,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizer detail", error: error.message });
  }
};

const followOrganizer = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const organizer = await Organizer.findOne({ _id: organizerId, isActive: true }).select("_id");
    if (!organizer) {
      return res.status(404).json({ message: "organizer not found" });
    }

    const participant = await Participant.findByIdAndUpdate(
      req.user.userId,
      { $addToSet: { followedOrganizers: organizer._id } },
      { new: true }
    ).select("followedOrganizers");

    return res.status(200).json({
      message: "organizer followed",
      followedOrganizers: participant.followedOrganizers,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to follow organizer", error: error.message });
  }
};

const unfollowOrganizer = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const participant = await Participant.findByIdAndUpdate(
      req.user.userId,
      { $pull: { followedOrganizers: organizerId } },
      { new: true }
    ).select("followedOrganizers");

    return res.status(200).json({
      message: "organizer unfollowed",
      followedOrganizers: participant.followedOrganizers,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to unfollow organizer", error: error.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const participantId = req.user.userId;
    const notifications = await ParticipantNotification.find({ participant: participantId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("event", "name")
      .populate("forumMessage", "text createdAt");

    const unreadCount = await ParticipantNotification.countDocuments({ participant: participantId, read: false });

    return res.status(200).json({
      unreadCount,
      notifications: notifications.map((item) => ({
        id: item._id,
        title: item.title,
        body: item.body,
        type: item.type,
        read: item.read,
        event: item.event ? { id: item.event._id, name: item.event.name } : null,
        forumMessageId: item.forumMessage?._id || null,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch notifications", error: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const participantId = req.user.userId;
    const { notificationId } = req.params;
    const notification = await ParticipantNotification.findOneAndUpdate(
      { _id: notificationId, participant: participantId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "notification not found" });
    }

    return res.status(200).json({ message: "notification marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "failed to update notification", error: error.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const participantId = req.user.userId;
    await ParticipantNotification.updateMany({ participant: participantId, read: false }, { read: true });
    return res.status(200).json({ message: "all notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "failed to update notifications", error: error.message });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const participantId = req.user.userId;
    const { notificationId } = req.params;
    const deleted = await ParticipantNotification.findOneAndDelete({
      _id: notificationId,
      participant: participantId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "notification not found" });
    }
    return res.status(200).json({ message: "notification deleted" });
  } catch (error) {
    return res.status(500).json({ message: "failed to delete notification", error: error.message });
  }
};

module.exports = {
  getMyEvents,
  getProfile,
  updateProfile,
  changePassword,
  getOnboardingOptions,
  completeOnboarding,
  listOrganizers,
  getOrganizerDetailForParticipant,
  followOrganizer,
  unfollowOrganizer,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
