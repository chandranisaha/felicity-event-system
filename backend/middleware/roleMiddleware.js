const isParticipant = (req, res, next) => {
  if (req.user.role !== "participant") {
    return res.status(403).json({ message: "participant access only" });
  }

  next();
};

const isOrganizer = (req, res, next) => {
  if (req.user.role !== "organizer") {
    return res.status(403).json({ message: "organizer access only" });
  }

  next();
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "admin access only" });
  }

  next();
};

module.exports = {
  isParticipant,
  isOrganizer,
  isAdmin,
};
