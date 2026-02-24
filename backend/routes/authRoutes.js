const express = require("express");
const { register, login, casStart, casCallback } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const { isParticipant, isOrganizer, isAdmin } = require("../middleware/roleMiddleware");
const { requireCaptchaForAuth } = require("../middleware/captchaMiddleware");

const router = express.Router();

router.post("/register", requireCaptchaForAuth, register);
router.post("/login", requireCaptchaForAuth, login);
router.get("/cas/start", casStart);
router.get("/cas/callback", casCallback);
router.get("/protected", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "protected route accessed",
    user: req.user,
  });
});
router.get("/participant-only", authMiddleware, isParticipant, (req, res) => {
  res.status(200).json({ message: "participant route accessed", user: req.user });
});
router.get("/organizer-only", authMiddleware, isOrganizer, (req, res) => {
  res.status(200).json({ message: "organizer route accessed", user: req.user });
});
router.get("/admin-only", authMiddleware, isAdmin, (req, res) => {
  res.status(200).json({ message: "admin route accessed", user: req.user });
});

module.exports = router;
