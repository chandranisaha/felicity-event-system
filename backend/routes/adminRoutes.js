const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/authMiddleware");
const { isAdmin } = require("../middleware/roleMiddleware");
const {
  createOrganizer,
  getOrganizers,
  toggleOrganizerActive,
  deleteOrganizerPermanently,
  getPasswordResetRequests,
  resolvePasswordResetRequest,
} = require("../controllers/adminController");

router.use(verifyToken, isAdmin);

router.post("/create-organizer", createOrganizer);
router.get("/organizers", getOrganizers);
router.patch("/organizer/:id/toggle-active", toggleOrganizerActive);
router.delete("/organizer/:id/permanent", deleteOrganizerPermanently);
router.get("/password-reset-requests", getPasswordResetRequests);
router.patch("/password-reset-requests/:id", resolvePasswordResetRequest);

module.exports = router;
