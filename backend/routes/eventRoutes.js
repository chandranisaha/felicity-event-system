const express = require("express");
const { verifyToken, optionalToken } = require("../middleware/authMiddleware");
const { isOrganizer, isParticipant } = require("../middleware/roleMiddleware");
const {
  createEvent,
  updateEvent,
  getPublicEvents,
  getPublicEventById,
  getEventById,
  getOrganizerEvents,
  registerForEvent,
  cancelMerchandiseRegistration,
} = require("../controllers/eventController");

const router = express.Router();

router.get("/public", optionalToken, getPublicEvents);
router.get("/public/:eventId", optionalToken, getPublicEventById);
router.get("/my-events", verifyToken, isOrganizer, getOrganizerEvents);
router.get("/:eventId", optionalToken, getEventById);
router.post("/", verifyToken, isOrganizer, createEvent);
router.patch("/:eventId", verifyToken, isOrganizer, updateEvent);
router.post("/:eventId/register", verifyToken, isParticipant, registerForEvent);
router.post("/:eventId/cancel-merchandise", verifyToken, isParticipant, cancelMerchandiseRegistration);

module.exports = router;
