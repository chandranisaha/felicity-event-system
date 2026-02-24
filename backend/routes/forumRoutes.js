const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  listForumMessages,
  postForumMessage,
  togglePinForumMessage,
  deleteForumMessage,
  reactForumMessage,
} = require("../controllers/forumController");

const router = express.Router();

router.get("/:eventId/forum/messages", verifyToken, listForumMessages);
router.post("/:eventId/forum/messages", verifyToken, postForumMessage);
router.patch("/:eventId/forum/messages/:messageId/pin", verifyToken, togglePinForumMessage);
router.patch("/:eventId/forum/messages/:messageId/react", verifyToken, reactForumMessage);
router.delete("/:eventId/forum/messages/:messageId", verifyToken, deleteForumMessage);

module.exports = router;
