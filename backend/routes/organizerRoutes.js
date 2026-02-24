const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const { isOrganizer } = require("../middleware/roleMiddleware");
const {
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
} = require("../controllers/organizerController");

const router = express.Router();

router.get("/analytics", verifyToken, isOrganizer, getOrganizerAnalytics);
router.get("/events/:eventId/analytics", verifyToken, isOrganizer, getEventAnalytics);
router.get("/events/:eventId/attendance/export", verifyToken, isOrganizer, exportAttendanceCsv);
router.get("/events/:eventId/pending-orders", verifyToken, isOrganizer, getPendingMerchandiseOrders);
router.patch("/tickets/:ticketId/attendance", verifyToken, isOrganizer, markAttendance);
router.patch("/tickets/:ticketId/attendance/manual", verifyToken, isOrganizer, overrideAttendance);
router.post("/attendance/scan", verifyToken, isOrganizer, scanAttendanceByQr);
router.post("/orders/:ticketId/approve", verifyToken, isOrganizer, approveMerchandiseOrder);
router.post("/orders/:ticketId/reject", verifyToken, isOrganizer, rejectMerchandiseOrder);
router.post("/password-reset/request", verifyToken, isOrganizer, requestOrganizerPasswordReset);
router.get("/profile", verifyToken, isOrganizer, getOrganizerProfile);
router.patch("/profile", verifyToken, isOrganizer, updateOrganizerProfile);
router.get("/notifications", verifyToken, isOrganizer, getOrganizerNotifications);
router.patch("/notifications/:notificationId/read", verifyToken, isOrganizer, markOrganizerNotificationRead);
router.patch("/notifications/read-all", verifyToken, isOrganizer, markAllOrganizerNotificationsRead);
router.delete("/notifications/:notificationId", verifyToken, isOrganizer, deleteOrganizerNotification);

module.exports = router;
