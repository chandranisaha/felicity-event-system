const Event = require("../models/Event");
const Ticket = require("../models/Ticket");
const Participant = require("../models/Participant");
const Organizer = require("../models/Organizer");
const mongoose = require("mongoose");
const { attachDisplayStatus } = require("../utils/eventStatus");
const { buildQrPayload, generateQrCodeDataUrl } = require("../utils/qrService");
const { sendTicketEmail } = require("../utils/emailService");

const allowedFieldTypes = ["text", "dropdown", "checkbox", "file"];
const safeFieldsAfterRegistration = new Set(["description", "registrationDeadline", "endDate", "tags", "status", "manualEventStatus"]);

const parseDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const validateDateOrder = (deadlineDate, start, end) => {
  if (!deadlineDate || !start || !end) {
    return "invalid date format";
  }
  if (end < start) {
    return "end date must be after start date";
  }
  if (deadlineDate > start) {
    return "registration deadline must be before or equal to start date";
  }
  return null;
};

const normalizeFormFields = (formFields = []) => {
  return formFields
    .map((field) => ({
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      options: field.type === "dropdown" ? field.options.map((opt) => String(opt).trim()).filter(Boolean) : [],
      order: field.order,
    }))
    .sort((a, b) => a.order - b.order);
};

const normalizeMerchandiseConfig = (config = {}) => {
  const sizeMap = {
    ONE_SIZE: ["One Size"],
    S_XL: ["S", "M", "L", "XL"],
    XS_XXL: ["XS", "S", "M", "L", "XL", "XXL"],
    S_XXL: ["S", "M", "L", "XL", "XXL"],
  };

  const variants = Array.isArray(config.variants)
    ? config.variants.map((variant) => ({
        name: String(variant.name || "").trim(),
        sizeMode: ["ONE_SIZE", "S_XL", "XS_XXL", "S_XXL", "CUSTOM"].includes(String(variant.sizeMode || ""))
          ? String(variant.sizeMode)
          : "ONE_SIZE",
        sizes: Array.isArray(variant.sizes)
          ? variant.sizes.map((item) => String(item).trim()).filter(Boolean)
          : [],
        colors: Array.isArray(variant.colors)
          ? variant.colors.map((item) => String(item).trim()).filter(Boolean)
          : String(variant.color || "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
        stock: Number(variant.stock),
        remainingStock:
          variant.remainingStock !== undefined && variant.remainingStock !== null ? Number(variant.remainingStock) : Number(variant.stock),
      }))
    : [];

  const normalizedVariants = variants.map((variant) => {
    const sizes =
      variant.sizeMode === "CUSTOM"
        ? variant.sizes
        : sizeMap[variant.sizeMode] || ["One Size"];
    return {
      ...variant,
      sizes,
      colors: variant.colors.length ? variant.colors : ["Default"],
    };
  });

  return {
    variants: normalizedVariants,
    purchaseLimitPerUser: config.purchaseLimitPerUser !== undefined ? Number(config.purchaseLimitPerUser) : 1,
    allowCancellation: Boolean(config.allowCancellation),
  };
};

const validateFormFields = (eventType, formFields) => {
  if (eventType !== "Normal") {
    if (Array.isArray(formFields) && formFields.length > 0) {
      return "formFields are allowed only for Normal events";
    }
    return null;
  }

  if (formFields === undefined) {
    return null;
  }

  if (!Array.isArray(formFields)) {
    return "formFields must be an array";
  }

  const seenLabels = new Set();
  const seenOrders = new Set();

  for (const field of formFields) {
    if (!field || typeof field !== "object") {
      return "each form field must be an object";
    }
    const label = typeof field.label === "string" ? field.label.trim() : "";
    if (!label) {
      return "form field label is required";
    }
    if (seenLabels.has(label.toLowerCase())) {
      return "form field labels must be unique";
    }
    seenLabels.add(label.toLowerCase());

    if (!allowedFieldTypes.includes(field.type)) {
      return "form field type is invalid";
    }
    if (typeof field.required !== "boolean") {
      return "form field required must be true or false";
    }
    if (!Number.isInteger(field.order) || field.order < 0) {
      return "form field order must be a non-negative integer";
    }
    if (seenOrders.has(field.order)) {
      return "form field order must be unique";
    }
    seenOrders.add(field.order);

    if (field.type === "dropdown") {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        return "dropdown field must have options";
      }
      const cleaned = field.options.map((opt) => String(opt).trim()).filter(Boolean);
      if (cleaned.length === 0) {
        return "dropdown field options cannot be empty";
      }
    } else if (field.options && field.options.length > 0) {
      return "options are allowed only for dropdown fields";
    }
  }

  return null;
};

const validateMerchandiseConfig = (eventType, merchandiseConfig) => {
  if (eventType !== "Merchandise") {
    if (merchandiseConfig && Array.isArray(merchandiseConfig.variants) && merchandiseConfig.variants.length > 0) {
      return "merchandiseConfig is allowed only for Merchandise events";
    }
    return null;
  }

  if (!merchandiseConfig || !Array.isArray(merchandiseConfig.variants) || merchandiseConfig.variants.length === 0) {
    return "Merchandise events require at least one variant";
  }

  for (const variant of merchandiseConfig.variants) {
    if (!variant.name) {
      return "each variant must have a name";
    }
    if (!["ONE_SIZE", "S_XL", "XS_XXL", "S_XXL", "CUSTOM"].includes(variant.sizeMode)) {
      return "variant sizeMode is invalid";
    }
    if (!Array.isArray(variant.sizes) || variant.sizes.length === 0) {
      return "each variant must have at least one selectable size";
    }
    if (!Array.isArray(variant.colors) || variant.colors.length === 0) {
      return "each variant must have at least one selectable color";
    }
    if (!Number.isInteger(variant.stock) || variant.stock < 0) {
      return "variant stock must be a non-negative integer";
    }
    if (!Number.isInteger(variant.remainingStock) || variant.remainingStock < 0) {
      return "variant remainingStock must be a non-negative integer";
    }
    if (variant.remainingStock > variant.stock) {
      return "variant remainingStock cannot exceed stock";
    }
  }

  if (!Number.isInteger(merchandiseConfig.purchaseLimitPerUser) || merchandiseConfig.purchaseLimitPerUser < 1) {
    return "purchaseLimitPerUser must be at least 1";
  }

  return null;
};

const validateFormResponses = (event, incomingResponses) => {
  const responses = incomingResponses || {};

  if (event.eventType === "Merchandise") {
    if (responses && Object.keys(responses).length > 0) {
      return { error: "form responses are not supported for Merchandise events" };
    }
    return { mappedResponses: [] };
  }

  const fields = Array.isArray(event.formFields) ? event.formFields : [];
  const fieldMap = new Map(fields.map((field) => [field.label, field]));

  if (typeof responses !== "object" || Array.isArray(responses)) {
    return { error: "formResponses must be an object with label-value pairs" };
  }

  const unexpected = Object.keys(responses).filter((key) => !fieldMap.has(key));
  if (unexpected.length > 0) {
    return { error: `unexpected form fields: ${unexpected.join(", ")}` };
  }

  for (const field of fields) {
    const value = responses[field.label];
    const hasValue = value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");

    if (field.required && !hasValue) {
      return { error: `required field missing: ${field.label}` };
    }
    if (!hasValue) {
      continue;
    }

    if (field.type === "dropdown") {
      if (typeof value !== "string") {
        return { error: `dropdown value must be a string for: ${field.label}` };
      }
      if (!field.options.includes(value)) {
        return { error: `invalid dropdown option for: ${field.label}` };
      }
    }

    if (field.type === "checkbox" && typeof value !== "boolean") {
      return { error: `checkbox value must be boolean for: ${field.label}` };
    }

    if ((field.type === "text" || field.type === "file") && typeof value !== "string") {
      return { error: `${field.type} value must be string for: ${field.label}` };
    }
  }

  const mappedResponses = fields
    .filter((field) => Object.prototype.hasOwnProperty.call(responses, field.label))
    .map((field) => ({
      label: field.label,
      value: responses[field.label],
    }));

  return { mappedResponses };
};

const validateMerchandiseOrder = (event, incomingOrder) => {
  if (event.eventType !== "Merchandise") {
    if (incomingOrder && Object.keys(incomingOrder).length > 0) {
      return { error: "merchandiseOrder is supported only for Merchandise events" };
    }
    return { order: { variant: "", quantity: 0 } };
  }

  if (!incomingOrder || typeof incomingOrder !== "object") {
    return { error: "merchandiseOrder is required for Merchandise events" };
  }

  const variantName = String(incomingOrder.variant || "").trim();
  const selectedSize = String(incomingOrder.size || "").trim();
  const selectedColor = String(incomingOrder.color || "").trim();
  const quantity = Number(incomingOrder.quantity);
  if (!variantName || !Number.isInteger(quantity) || quantity < 1) {
    return { error: "merchandiseOrder must include valid variant and quantity" };
  }

  const variant = event.merchandiseConfig.variants.find((item) => item.name === variantName);
  if (!variant) {
    return { error: "selected merchandise variant does not exist" };
  }
  const allowedSizes =
    Array.isArray(variant.sizes) && variant.sizes.length
      ? variant.sizes
      : variant.size
        ? [String(variant.size)]
        : ["One Size"];
  const allowedColors =
    Array.isArray(variant.colors) && variant.colors.length
      ? variant.colors
      : variant.color
        ? [String(variant.color)]
        : ["Default"];

  if (!selectedSize || !allowedSizes.includes(selectedSize)) {
    return { error: "selected size is invalid for this variant" };
  }
  if (!selectedColor || !allowedColors.includes(selectedColor)) {
    return { error: "selected color is invalid for this variant" };
  }

  if (quantity > event.merchandiseConfig.purchaseLimitPerUser) {
    return { error: "quantity exceeds purchase limit per user" };
  }

  if (quantity > variant.remainingStock) {
    return { error: "insufficient stock for selected variant" };
  }

  return {
    order: {
      variant: variantName,
      size: selectedSize,
      color: selectedColor,
      quantity,
    },
    variant,
  };
};

const isValidHttpUrl = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
};

const isValidImageProofInput = (value) => {
  if (typeof value !== "string" || !value.trim()) return false;
  const trimmed = value.trim();
  if (isValidHttpUrl(trimmed)) return true;
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed);
};

const postEventToDiscordWebhook = async ({ webhookUrl, event }) => {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `new event published: ${event.name}`,
        embeds: [
          {
            title: event.name,
            description: event.description,
            fields: [
              { name: "type", value: event.eventType, inline: true },
              { name: "status", value: event.status, inline: true },
              { name: "eligibility", value: event.eligibility, inline: true },
            ],
          },
        ],
      }),
    });
  } catch (error) {
    // ignore webhook errors to avoid blocking event create
  }
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const tokenizedMatchScore = (text, query) => {
  if (!query) return 0;
  const normalizedText = String(text || "").toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (normalizedText.includes(normalizedQuery)) return 3;
  const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const part of queryParts) {
    if (normalizedText.includes(part)) {
      score += 1;
    }
  }
  return score;
};

const createEvent = async (req, res) => {
  try {
    const {
      name,
      description,
      coverImage,
      eventType,
      eligibility,
      registrationDeadline,
      startDate,
      endDate,
      registrationLimit,
      registrationFee,
      tags,
      status,
      manualEventStatus,
      formFields,
      merchandiseConfig,
    } = req.body;

    if (
      !name ||
      !description ||
      !eventType ||
      !eligibility ||
      !registrationDeadline ||
      !startDate ||
      !endDate ||
      registrationLimit === undefined ||
      registrationFee === undefined
    ) {
      return res.status(400).json({ message: "all required event fields must be provided" });
    }

    const deadlineDate = parseDate(registrationDeadline);
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const dateError = validateDateOrder(deadlineDate, start, end);
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    const formError = validateFormFields(eventType, formFields);
    if (formError) {
      return res.status(400).json({ message: formError });
    }

    const normalizedMerchandise = normalizeMerchandiseConfig(merchandiseConfig);
    const merchError = validateMerchandiseConfig(eventType, normalizedMerchandise);
    if (merchError) {
      return res.status(400).json({ message: merchError });
    }
    if (coverImage && !isValidHttpUrl(coverImage)) {
      return res.status(400).json({ message: "coverImage must be a valid http/https url" });
    }

    const event = await Event.create({
      name,
      description,
      coverImage: typeof coverImage === "string" ? coverImage.trim() : "",
      eventType,
      eligibility,
      registrationDeadline: deadlineDate,
      startDate: start,
      endDate: end,
      registrationLimit,
      registrationFee,
      organizer: req.user.userId,
      tags: Array.isArray(tags) ? tags : [],
      status: status || "Draft",
      manualEventStatus: manualEventStatus || null,
      formFields: eventType === "Normal" ? normalizeFormFields(formFields || []) : [],
      merchandiseConfig: eventType === "Merchandise" ? normalizedMerchandise : undefined,
    });

    if (event.status === "Published") {
      const organizer = await Organizer.findById(req.user.userId).select("discordWebhookUrl");
      if (organizer?.discordWebhookUrl) {
        await postEventToDiscordWebhook({ webhookUrl: organizer.discordWebhookUrl, event });
      }
    }

    return res.status(201).json({
      message: "event created successfully",
      event: attachDisplayStatus(event),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to create event", error: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const organizerId = req.user.userId;
    const event = await Event.findOne({ _id: eventId, organizer: organizerId });
    if (!event) {
      return res.status(404).json({ message: "event not found for this organizer" });
    }
    const previousStatus = event.status;

    const hasTickets = (await Ticket.countDocuments({ event: eventId })) > 0;
    const incomingKeys = Object.keys(req.body || {});

    if (hasTickets) {
      if (incomingKeys.includes("formFields")) {
        return res.status(400).json({ message: "cannot update formFields after first registration" });
      }
      const hasUnsafeField = incomingKeys.some((key) => !safeFieldsAfterRegistration.has(key));
      if (hasUnsafeField) {
        return res.status(400).json({
          message: "only safe fields can be updated after registrations exist",
          allowedFields: Array.from(safeFieldsAfterRegistration),
        });
      }
    }

    const nextEventType = req.body.eventType || event.eventType;
    if (nextEventType !== event.eventType && hasTickets) {
      return res.status(400).json({ message: "eventType cannot be changed after registrations exist" });
    }

    const nextFormFields = req.body.formFields !== undefined ? req.body.formFields : event.formFields;
    const formError = validateFormFields(nextEventType, nextFormFields);
    if (formError) {
      return res.status(400).json({ message: formError });
    }

    const nextMerchandise = req.body.merchandiseConfig !== undefined ? normalizeMerchandiseConfig(req.body.merchandiseConfig) : event.merchandiseConfig;
    const merchError = validateMerchandiseConfig(nextEventType, nextMerchandise);
    if (merchError) {
      return res.status(400).json({ message: merchError });
    }
    if (req.body.coverImage !== undefined && req.body.coverImage && !isValidHttpUrl(req.body.coverImage)) {
      return res.status(400).json({ message: "coverImage must be a valid http/https url" });
    }

    const registrationDeadline = req.body.registrationDeadline ? parseDate(req.body.registrationDeadline) : event.registrationDeadline;
    const startDate = req.body.startDate ? parseDate(req.body.startDate) : event.startDate;
    const endDate = req.body.endDate ? parseDate(req.body.endDate) : event.endDate;
    const dateError = validateDateOrder(registrationDeadline, startDate, endDate);
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    const updateable = [
      "name",
      "description",
      "coverImage",
      "eventType",
      "eligibility",
      "registrationLimit",
      "registrationFee",
      "tags",
      "status",
      "manualEventStatus",
    ];
    for (const key of updateable) {
      if (req.body[key] !== undefined) {
        event[key] = req.body[key];
      }
    }

    event.registrationDeadline = registrationDeadline;
    event.startDate = startDate;
    event.endDate = endDate;
    event.eventType = nextEventType;
    event.formFields = nextEventType === "Normal" ? normalizeFormFields(nextFormFields || []) : [];
    event.merchandiseConfig = nextEventType === "Merchandise" ? nextMerchandise : event.merchandiseConfig;

    await event.save();

    if (previousStatus !== "Published" && event.status === "Published") {
      const organizer = await Organizer.findById(organizerId).select("discordWebhookUrl");
      if (organizer?.discordWebhookUrl) {
        await postEventToDiscordWebhook({ webhookUrl: organizer.discordWebhookUrl, event });
      }
    }

    return res.status(200).json({
      message: "event updated successfully",
      event: attachDisplayStatus(event),
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to update event", error: error.message });
  }
};

const getPublicEvents = async (req, res) => {
  try {
    const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
    const eventType = typeof req.query?.eventType === "string" ? req.query.eventType.trim() : "";
    const eligibility = typeof req.query?.eligibility === "string" ? req.query.eligibility.trim() : "";
    const dateFrom = req.query?.dateFrom ? parseDate(req.query.dateFrom) : null;
    const dateTo = req.query?.dateTo ? parseDate(req.query.dateTo) : null;
    const followedOnly = String(req.query?.followedOnly || "false").toLowerCase() === "true";
    const trendingOnly = String(req.query?.trending || "false").toLowerCase() === "true";

    const events = await Event.find({ status: "Published" }).sort({ startDate: 1 }).populate("organizer", "name contactEmail category");
    let decorated = events.map(attachDisplayStatus);

    if (eventType && ["Normal", "Merchandise"].includes(eventType)) {
      decorated = decorated.filter((event) => event.eventType === eventType);
    }

    if (eligibility) {
      const normalized = eligibility.toLowerCase();
      decorated = decorated.filter((event) => String(event.eligibility || "").toLowerCase() === normalized);
    }

    if (dateFrom) {
      decorated = decorated.filter((event) => new Date(event.startDate) >= dateFrom);
    }
    if (dateTo) {
      decorated = decorated.filter((event) => new Date(event.startDate) <= dateTo);
    }

    if (!req.user || req.user.role !== "participant") {
      if (q) {
        decorated = decorated
          .map((event) => {
            const searchScore = tokenizedMatchScore(event.name, q) + tokenizedMatchScore(event.organizer?.name, q);
            return { ...event, searchScore };
          })
          .filter((event) => event.searchScore > 0)
          .sort((a, b) => b.searchScore - a.searchScore || new Date(a.startDate) - new Date(b.startDate));
      }
      return res.status(200).json({ count: decorated.length, events: decorated, trending: [] });
    }

    const participant = await Participant.findById(req.user.userId).select("interests followedOrganizers");
    if (!participant) {
      return res.status(200).json({ count: decorated.length, events: decorated, trending: [] });
    }

    const interests = new Set((participant.interests || []).map((item) => String(item).toLowerCase()));
    const followed = new Set((participant.followedOrganizers || []).map((id) => String(id)));

    let ranked = decorated
      .map((event) => {
        const tags = Array.isArray(event.tags) ? event.tags.map((tag) => String(tag).toLowerCase()) : [];
        const tagMatches = tags.filter((tag) => interests.has(tag)).length;
        const organizerCategory = String(event.organizer?.category || "").toLowerCase();
        const categoryMatch = interests.has(organizerCategory) ? 1 : 0;
        const followsOrganizer = followed.has(String(event.organizer?._id)) ? 1 : 0;
        const recommendationScore = tagMatches * 2 + categoryMatch + followsOrganizer * 3;
        const searchScore = q ? tokenizedMatchScore(event.name, q) + tokenizedMatchScore(event.organizer?.name, q) : 0;

        return {
          ...event,
          recommendationScore,
          recommended: recommendationScore > 0,
          searchScore,
        };
      })
      .filter((event) => (!q ? true : event.searchScore > 0))
      .filter((event) => (!followedOnly ? true : followed.has(String(event.organizer?._id))))
      .sort((a, b) => {
        if (b.searchScore !== a.searchScore) {
          return b.searchScore - a.searchScore;
        }
        if (b.recommendationScore !== a.recommendationScore) {
          return b.recommendationScore - a.recommendationScore;
        }
        return new Date(a.startDate) - new Date(b.startDate);
      });

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const eventIds = ranked.map((event) => event._id);
    const trendingCounts = await Ticket.aggregate([
      {
        $match: {
          event: { $in: eventIds },
          createdAt: { $gte: dayAgo },
          status: { $in: ["Registered", "Pending"] },
        },
      },
      { $group: { _id: "$event", registrations24h: { $sum: 1 } } },
      { $sort: { registrations24h: -1 } },
      { $limit: 5 },
    ]);
    const trendMap = new Map(trendingCounts.map((item) => [String(item._id), item.registrations24h]));
    const trending = ranked
      .filter((event) => trendMap.has(String(event._id)))
      .map((event) => ({ ...event, registrations24h: trendMap.get(String(event._id)) }))
      .sort((a, b) => b.registrations24h - a.registrations24h)
      .slice(0, 5);

    if (trendingOnly) {
      ranked = trending;
    }

    return res.status(200).json({ count: ranked.length, events: ranked, trending });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch public events", error: error.message });
  }
};

const getPublicEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findOne({ _id: eventId, status: "Published" }).populate("organizer", "name contactEmail category");
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }
    return res.status(200).json({ event: attachDisplayStatus(event) });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch event", error: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).populate("organizer", "name contactEmail category");
    if (!event) {
      return res.status(404).json({ message: "event not found" });
    }

    const role = req.user?.role;
    const userId = req.user?.userId;
    if (event.status === "Published") {
      return res.status(200).json({ event: attachDisplayStatus(event) });
    }
    if (role === "admin") {
      return res.status(200).json({ event: attachDisplayStatus(event) });
    }
    if (role === "organizer" && String(event.organizer?._id || event.organizer) === String(userId)) {
      return res.status(200).json({ event: attachDisplayStatus(event) });
    }
    if (role === "participant") {
      const hasTicket = await Ticket.exists({ participant: userId, event: eventId });
      if (hasTicket) {
        return res.status(200).json({ event: attachDisplayStatus(event) });
      }
    }

    return res.status(403).json({ message: "access denied for this event" });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch event", error: error.message });
  }
};

const getOrganizerEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer: req.user.userId }).sort({ createdAt: -1 }).populate("organizer", "name contactEmail");
    return res.status(200).json({ count: events.length, events: events.map(attachDisplayStatus) });
  } catch (error) {
    return res.status(500).json({ message: "failed to fetch organizer events", error: error.message });
  }
};

const registerForEvent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventId } = req.params;
    const participantId = req.user.userId;
    const event = await Event.findById(eventId).session(session);
    if (!event) {
      await session.abortTransaction();
      return res.status(404).json({ message: "event not found" });
    }

    if (event.status !== "Published") {
      await session.abortTransaction();
      return res.status(400).json({ message: "event is not open for registration" });
    }
    if (new Date() > event.registrationDeadline) {
      await session.abortTransaction();
      return res.status(400).json({ message: "registration deadline has passed" });
    }

    const participantTickets = await Ticket.find({ participant: participantId, event: eventId }).session(session);
    let currentApprovedMerchQuantity = 0;
    if (event.eventType === "Normal") {
      if (participantTickets.some((ticket) => ticket.status === "Registered")) {
        await session.abortTransaction();
        return res.status(409).json({ message: "participant already registered for this event" });
      }
    } else {
      const pendingExists = participantTickets.some((ticket) => ticket.status === "Pending");
      if (pendingExists) {
        await session.abortTransaction();
        return res.status(409).json({ message: "merchandise order is already pending approval" });
      }

      const registeredOrders = participantTickets.filter((ticket) => ticket.status === "Registered");
      const currentApprovedQuantity = registeredOrders.reduce((sum, ticket) => sum + Number(ticket.merchandiseOrder?.quantity || 0), 0);
      const currentTotalOrders = registeredOrders.length;

      if (currentTotalOrders >= event.merchandiseConfig.purchaseLimitPerUser) {
        await session.abortTransaction();
        return res.status(409).json({ message: "purchase limit reached for this event" });
      }

      currentApprovedMerchQuantity = currentApprovedQuantity;
    }

    const currentRegistrations = await Ticket.countDocuments({ event: eventId, status: "Registered" }).session(session);
    if (currentRegistrations >= event.registrationLimit) {
      await session.abortTransaction();
      return res.status(400).json({ message: "registration limit reached" });
    }

    const { mappedResponses, error } = validateFormResponses(event, req.body?.formResponses);
    if (error) {
      await session.abortTransaction();
      return res.status(400).json({ message: error });
    }

    const { order, variant, error: merchError } = validateMerchandiseOrder(event, req.body?.merchandiseOrder);
    if (merchError) {
      await session.abortTransaction();
      return res.status(400).json({ message: merchError });
    }

    let payment = {
      status: "NotRequired",
      proofUrl: "",
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: "",
    };
    let ticketStatus = "Registered";

    if (event.eventType === "Merchandise") {
      if (!variant) {
        await session.abortTransaction();
        return res.status(400).json({ message: "selected merchandise variant does not exist" });
      }

      if (!isValidImageProofInput(req.body?.paymentProofUrl)) {
        await session.abortTransaction();
        return res.status(400).json({ message: "valid paymentProofUrl (http/https URL or image data URL) is required for merchandise order" });
      }

      payment = {
        status: "Pending",
        proofUrl: req.body.paymentProofUrl.trim(),
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: "",
      };
      ticketStatus = "Pending";
    }

    if (event.eventType === "Merchandise" && currentApprovedMerchQuantity + Number(order?.quantity || 0) > event.merchandiseConfig.purchaseLimitPerUser) {
      await session.abortTransaction();
      return res.status(409).json({ message: "quantity exceeds purchase limit per participant for this event" });
    }

    const ticketDocs = await Ticket.create(
      [
        {
          participant: participantId,
          event: eventId,
          status: ticketStatus,
          attended: false,
          formResponses: mappedResponses,
          merchandiseOrder: order,
          payment,
        },
      ],
      { session }
    );
    const ticket = ticketDocs[0];

    let emailResult = { sent: false };
    if (event.eventType !== "Merchandise") {
      const qrPayload = buildQrPayload({
        ticketId: ticket.ticketId,
        eventId: String(event._id),
        participantId: String(participantId),
      });
      const qrCode = await generateQrCodeDataUrl(qrPayload);

      ticket.qrPayload = qrPayload;
      ticket.qrCode = qrCode;
      await ticket.save({ session });

      const participant = await Participant.findById(participantId).select("name email").session(session);
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
          warning: `ticket registered but email failed: ${emailError.message}`,
        };
      }
    }

    await session.commitTransaction();

    return res.status(201).json({
      message: event.eventType === "Merchandise" ? "merchandise order placed and pending approval" : "registration successful",
      ticket: {
        id: ticket._id,
        ticketId: ticket.ticketId,
        qrPayload: ticket.qrPayload,
        qrCode: ticket.qrCode,
        status: ticket.status,
        payment: ticket.payment,
        attended: ticket.attended,
        formResponses: ticket.formResponses,
        merchandiseOrder: ticket.merchandiseOrder,
        event: ticket.event,
        participant: ticket.participant,
        createdAt: ticket.createdAt,
      },
      email: emailResult,
    });
  } catch (error) {
    await session.abortTransaction();

    if (error.code === 11000) {
      return res.status(409).json({ message: "duplicate ticket data detected" });
    }

    return res.status(500).json({ message: "failed to register for event", error: error.message });
  } finally {
    await session.endSession();
  }
};

const cancelMerchandiseRegistration = async (req, res) => {
  try {
    const { eventId } = req.params;
    const participantId = req.user.userId;
    const event = await Event.findById(eventId);
    if (!event || event.eventType !== "Merchandise") {
      return res.status(404).json({ message: "merchandise event not found" });
    }

    if (!event.merchandiseConfig.allowCancellation) {
      return res.status(400).json({ message: "cancellation is not enabled for this merchandise event" });
    }

    const ticketQuery = {
      event: eventId,
      participant: participantId,
      status: { $in: ["Pending", "Registered"] },
    };
    if (typeof req.body?.ticketId === "string" && req.body.ticketId.trim()) {
      ticketQuery.ticketId = req.body.ticketId.trim();
    }

    const ticket = await Ticket.findOne(ticketQuery).sort({ createdAt: -1 });
    if (!ticket) {
      return res.status(404).json({ message: "active merchandise order not found" });
    }

    const { variant, quantity } = ticket.merchandiseOrder || {};
    if (ticket.status === "Registered" && variant && quantity > 0) {
      const variantDoc = event.merchandiseConfig.variants.find(
        (item) => item.name === variant
      );
      if (variantDoc) {
        variantDoc.remainingStock = Math.min(variantDoc.stock, variantDoc.remainingStock + quantity);
        await event.save();
      }
    }

    ticket.status = "Cancelled";
    if (ticket.payment?.status === "Pending" || ticket.payment?.status === "Approved") {
      ticket.payment.status = "Rejected";
      ticket.payment.rejectionReason = "cancelled by participant";
      ticket.payment.reviewedAt = new Date();
      ticket.payment.reviewedBy = null;
    }
    await ticket.save();

    return res.status(200).json({
      message: "merchandise registration cancelled successfully",
      ticketId: ticket.ticketId,
    });
  } catch (error) {
    return res.status(500).json({ message: "failed to cancel merchandise registration", error: error.message });
  }
};

module.exports = {
  createEvent,
  updateEvent,
  getPublicEvents,
  getPublicEventById,
  getEventById,
  getOrganizerEvents,
  registerForEvent,
  cancelMerchandiseRegistration,
};
