const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const { isParticipant } = require("../middleware/roleMiddleware");
const {
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
} = require("../controllers/participantController");

const router = express.Router();

router.get("/my-events", verifyToken, isParticipant, getMyEvents);
router.get("/profile", verifyToken, isParticipant, getProfile);
router.patch("/profile", verifyToken, isParticipant, updateProfile);
router.post("/profile/change-password", verifyToken, isParticipant, changePassword);
router.get("/onboarding/options", verifyToken, isParticipant, getOnboardingOptions);
router.post("/onboarding/complete", verifyToken, isParticipant, completeOnboarding);
router.get("/organizers", verifyToken, isParticipant, listOrganizers);
router.get("/organizers/:organizerId", verifyToken, isParticipant, getOrganizerDetailForParticipant);
router.post("/organizers/:organizerId/follow", verifyToken, isParticipant, followOrganizer);
router.delete("/organizers/:organizerId/follow", verifyToken, isParticipant, unfollowOrganizer);
router.get("/notifications", verifyToken, isParticipant, getNotifications);
router.patch("/notifications/:notificationId/read", verifyToken, isParticipant, markNotificationRead);
router.patch("/notifications/read-all", verifyToken, isParticipant, markAllNotificationsRead);
router.delete("/notifications/:notificationId", verifyToken, isParticipant, deleteNotification);

module.exports = router;
