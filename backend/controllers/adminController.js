const bcrypt = require("bcryptjs");
const Organizer = require("../models/Organizer");
const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const OrganizerPasswordResetRequest = require("../models/OrganizerPasswordResetRequest");

const generatePassword = () => {
  return Math.random().toString(36).slice(-8);
};

const slugify = (value) => {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const addPasswordResetHistoryEntry = async (organizerId, entry) => {
  const organizer = await Organizer.findById(organizerId);
  if (!organizer) {
    return;
  }

  organizer.passwordResetHistory.push(entry);
  await organizer.save();
};

const createOrganizer = async (req, res) => {
  try {
    const { name, category, description, contactEmail, password } = req.body;

    if (!name || !category || !description) {
      return res.status(400).json({ message: "name, category and description are required" });
    }

    const generatedEmail = `${slugify(name)}-iiit@clubs.iiit.ac.in`;
    const finalContactEmail = String(contactEmail || generatedEmail).toLowerCase().trim();

    const existingOrganizer = await Organizer.findOne({ contactEmail: finalContactEmail });
    if (existingOrganizer) {
      return res.status(409).json({ message: "organizer already exists" });
    }

    const generatedPassword = String(password || generatePassword());
    if (generatedPassword.length < 6) {
      return res.status(400).json({ message: "organizer password must be at least 6 characters" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(generatedPassword, salt);

    const organizer = await Organizer.create({
      name,
      category,
      description,
      contactEmail: finalContactEmail,
      password: hashedPassword,
      adminVisiblePassword: generatedPassword,
      role: "organizer",
    });

    return res.status(201).json({
      message: "organizer created successfully",
      organizer: {
        id: organizer._id,
        name: organizer.name,
        category: organizer.category,
        description: organizer.description,
        contactEmail: organizer.contactEmail,
        role: organizer.role,
        isActive: organizer.isActive,
        createdAt: organizer.createdAt,
      },
      generatedContactEmail: finalContactEmail,
      generatedPassword,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to create organizer", error: error.message });
  }
};

const getOrganizers = async (req, res) => {
  try {
    const organizers = await Organizer.find().sort({ isActive: -1, name: 1 }).select("-password");
    return res.status(200).json({ count: organizers.length, organizers });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizers", error: error.message });
  }
};

const toggleOrganizerActive = async (req, res) => {
  try {
    const { id } = req.params;

    const organizerRecord = await Organizer.findById(id);
    if (!organizerRecord) {
      return res.status(404).json({ message: "organizer not found" });
    }
    const nextState = !organizerRecord.isActive;
    const organizer = await Organizer.findByIdAndUpdate(id, { isActive: nextState }, { new: true }).select("-password");
    if (!organizer) {
      return res.status(404).json({ message: "organizer not found" });
    }

    return res.status(200).json({ message: nextState ? "organizer enabled successfully" : "organizer disabled successfully", organizer });
  } catch (error) {
    return res.status(500).json({ message: "failed to toggle organizer state", error: error.message });
  }
};

const deleteOrganizerPermanently = async (req, res) => {
  try {
    const { id } = req.params;

    const organizer = await Organizer.findById(id);
    if (!organizer) {
      return res.status(404).json({ message: "organizer not found" });
    }

    const events = await Event.find({ organizer: id }).select("_id");
    const eventIds = events.map((event) => event._id);

    if (eventIds.length > 0) {
      await Ticket.deleteMany({ event: { $in: eventIds } });
      await Event.deleteMany({ organizer: id });
    }
    await OrganizerPasswordResetRequest.deleteMany({ organizer: id });

    await Organizer.findByIdAndDelete(id);

    return res.status(200).json({
      message: "organizer deleted permanently",
      deletedOrganizerId: id,
      deletedEvents: eventIds.length,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to delete organizer", error: error.message });
  }
};

const getPasswordResetRequests = async (req, res) => {
  try {
    const status = typeof req.query?.status === "string" ? req.query.status.trim() : "";
    const filter = {};
    if (status) {
      if (!["Pending", "Approved", "Rejected"].includes(status)) {
        return res.status(400).json({ message: "invalid status filter" });
      }
      filter.status = status;
    }

    const requests = await OrganizerPasswordResetRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("organizer", "name contactEmail category isActive")
      .populate("resolvedBy", "name email");

    return res.status(200).json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch password reset requests", error: error.message });
  }
};

const resolvePasswordResetRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    const action = typeof req.body?.action === "string" ? req.body.action.trim().toLowerCase() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be approve or reject" });
    }

    const requestDoc = await OrganizerPasswordResetRequest.findById(id);
    if (!requestDoc) {
      return res.status(404).json({ message: "password reset request not found" });
    }
    if (requestDoc.status !== "Pending") {
      return res.status(409).json({ message: "request is already resolved" });
    }

    const resolvedStatus = action === "approve" ? "Approved" : "Rejected";
    requestDoc.status = resolvedStatus;
    requestDoc.resolvedBy = adminId;
    requestDoc.resolvedAt = new Date();
    requestDoc.adminDecisionNote = note;

    let generatedPassword = null;
    if (action === "approve") {
      const organizer = await Organizer.findById(requestDoc.organizer);
      if (!organizer) {
        return res.status(404).json({ message: "organizer not found for this request" });
      }

      generatedPassword = generatePassword();
      const salt = await bcrypt.genSalt(10);
      organizer.password = await bcrypt.hash(generatedPassword, salt);
      organizer.adminVisiblePassword = generatedPassword;
      await organizer.save();
    }

    await requestDoc.save();

    await addPasswordResetHistoryEntry(requestDoc.organizer, {
      requestedAt: requestDoc.createdAt,
      resolvedAt: requestDoc.resolvedAt,
      status: requestDoc.status,
      reason: requestDoc.reason,
      resolvedBy: requestDoc.resolvedBy,
      requestId: requestDoc._id,
      note,
    });

    return res.status(200).json({
      message: `password reset request ${resolvedStatus.toLowerCase()}`,
      request: requestDoc,
      generatedPassword,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to resolve password reset request", error: error.message });
  }
};

module.exports = {
  createOrganizer,
  getOrganizers,
  toggleOrganizerActive,
  deleteOrganizerPermanently,
  getPasswordResetRequests,
  resolvePasswordResetRequest,
};
