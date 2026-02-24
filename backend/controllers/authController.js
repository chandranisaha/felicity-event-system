const jwt = require("jsonwebtoken");
const https = require("https");
const Participant = require("../models/Participant");
const Organizer = require("../models/Organizer");
const Admin = require("../models/Admin");
const { getKey, checkLoginAllowed, recordFailedAttempt, recordSuccessfulLogin } = require("../utils/loginRateLimiter");

const modelByRole = {
  participant: Participant,
  organizer: Organizer,
  admin: Admin,
};

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      email: user.email || user.contactEmail,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

const buildBackendBaseUrl = (req) => {
  if (process.env.BACKEND_BASE_URL) {
    return process.env.BACKEND_BASE_URL.replace(/\/$/, "");
  }
  return `${req.protocol}://${req.get("host")}`;
};

const buildFrontendBaseUrl = () => {
  return String(process.env.FRONTEND_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
};

const getTextFromUrl = (url) => {
  return new Promise((resolve, reject) => {
    const allowInsecure = String(process.env.CAS_ALLOW_INSECURE_TLS || "false").toLowerCase() === "true";
    const agent = new https.Agent({
      rejectUnauthorized: !allowInsecure,
      keepAlive: false,
    });
    const request = https.get(
      url,
      {
        agent,
        headers: {
          "User-Agent": "Felicity-CAS-Client/1.0",
          Accept: "application/xml,text/xml,*/*",
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`cas validate http ${response.statusCode}`));
            return;
          }
          resolve(body);
        });
      }
    );
    request.on("error", (error) => reject(error));
    request.end();
  });
};

const extractCasField = (xml, tagName) => {
  const withPrefix = new RegExp(`<cas:${tagName}>([^<]+)<\\/cas:${tagName}>`, "i");
  const withoutPrefix = new RegExp(`<${tagName}>([^<]+)<\\/${tagName}>`, "i");
  const match = xml.match(withPrefix) || xml.match(withoutPrefix);
  return (match?.[1] || "").trim();
};

const isIiitEmail = (value) => {
  if (!value || !value.includes("@")) {
    return false;
  }
  const domain = value.split("@")[1].toLowerCase();
  return domain.endsWith("iiit.ac.in");
};

const isValidContact = (value) => {
  if (!value) return true;
  const normalized = String(value).replace(/[\s()-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(normalized);
};

const register = async (req, res) => {
  try {
    const {
      name,
      firstName,
      lastName,
      email,
      contactEmail,
      password,
      role,
      category,
      description,
      institutionCategory,
      participantType,
      college,
      contact,
      interests,
      casVerified,
    } = req.body;
    const roleKey = role ? role.toLowerCase() : "";
    const loginIdentifier = roleKey === "organizer" ? contactEmail || email : email;
    let normalizedInstitutionCategory = "";

    if (!loginIdentifier || !password || !role) {
      return res.status(400).json({ message: "all fields are required" });
    }

    if (roleKey !== "participant") {
      return res.status(403).json({
        message: "self registration is allowed only for participants. organizers are created by admin and admin has no ui registration",
      });
    }

    const UserModel = modelByRole[roleKey];

    if (!UserModel) {
      return res.status(400).json({ message: "invalid role" });
    }

    const existingQuery =
      roleKey === "organizer"
        ? { contactEmail: loginIdentifier.toLowerCase() }
        : { email: loginIdentifier.toLowerCase() };
    const existingUser = await UserModel.findOne(existingQuery);
    if (existingUser) {
      return res.status(409).json({ message: "user already exists" });
    }

    let userPayload = {};

    normalizedInstitutionCategory = institutionCategory === "IIIT" ? "IIIT" : institutionCategory === "Non-IIIT" ? "Non-IIIT" : "";
    if (!normalizedInstitutionCategory) {
      return res.status(400).json({ message: "institutionCategory must be IIIT or Non-IIIT" });
    }
    if (normalizedInstitutionCategory === "IIIT" && !isIiitEmail(loginIdentifier)) {
      return res.status(400).json({ message: "iiit participants must use an iiit.ac.in email" });
    }

    const normalizedFirstName = String(firstName || (typeof name === "string" ? name.split(" ").slice(0, -1).join(" ") || name : "")).trim();
    const normalizedLastName = String(lastName || "").trim();
    if (!normalizedFirstName) {
      return res.status(400).json({ message: "firstName is required for participant registration" });
    }

    const normalizedContact = String(contact || "").trim();
    const normalizedCollege = String(college || "").trim();
    if (normalizedContact && !isValidContact(normalizedContact)) {
      return res.status(400).json({ message: "contact number must be 7 to 15 digits (optional + allowed)" });
    }
    if (normalizedInstitutionCategory !== "IIIT" && !normalizedCollege) {
      return res.status(400).json({ message: "college is required for non-iiit participant registration" });
    }

    userPayload = {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      name: `${normalizedFirstName} ${normalizedLastName}`.trim() || normalizedFirstName,
      email: loginIdentifier,
      password,
      role: roleKey,
      institutionCategory: normalizedInstitutionCategory,
      participantType: participantType || "Student",
      contact: normalizedContact,
      college: normalizedInstitutionCategory === "IIIT" ? normalizedCollege || "IIIT Hyderabad" : normalizedCollege,
      interests: Array.isArray(interests) ? interests : [],
      casVerified: Boolean(casVerified),
      onboardingCompleted: false,
    };

    const user = await UserModel.create(userPayload);

    const token = createToken(user);

    return res.status(201).json({
      message: "registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || user.contactEmail,
        role: user.role,
        onboardingCompleted: user.role === "participant" ? Boolean(user.onboardingCompleted) : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "registration failed", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, contactEmail, password, role } = req.body;
    const roleKey = role ? role.toLowerCase() : "";
    const loginIdentifier = roleKey === "organizer" ? contactEmail || email : email;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

    if (!loginIdentifier || !password || !role) {
      return res.status(400).json({ message: "email, password and role are required" });
    }

    const rateLimitKey = getKey({
      identifier: loginIdentifier,
      role: roleKey,
      ip,
    });
    const rateLimitCheck = checkLoginAllowed(rateLimitKey);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        message: "too many failed login attempts. try again later",
        retryAfterMs: rateLimitCheck.retryAfterMs,
      });
    }

    const UserModel = modelByRole[roleKey];

    if (!UserModel) {
      return res.status(400).json({ message: "invalid role" });
    }

    const loginQuery =
      roleKey === "organizer"
        ? { contactEmail: loginIdentifier.toLowerCase() }
        : { email: loginIdentifier.toLowerCase() };
    const user = await UserModel.findOne(loginQuery);
    if (!user) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ message: "invalid credentials" });
    }

    if (roleKey === "organizer" && !user.isActive) {
      return res.status(403).json({ message: "organizer disabled" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ message: "invalid credentials" });
    }

    recordSuccessfulLogin(rateLimitKey);
    const token = createToken(user);

    return res.status(200).json({
      message: "login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email || user.contactEmail,
        role: user.role,
        onboardingCompleted: user.role === "participant" ? Boolean(user.onboardingCompleted) : undefined,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "login failed", error: error.message });
  }
};

const casStart = async (req, res) => {
  try {
    if (String(process.env.CAS_ENABLED || "false").toLowerCase() !== "true") {
      const frontend = buildFrontendBaseUrl();
      return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent("CAS login is disabled")}`);
    }
    const casLoginUrl = String(process.env.CAS_LOGIN_URL || "https://login.iiit.ac.in/cas/login").trim();
    const service = `${buildBackendBaseUrl(req)}/api/auth/cas/callback`;
    const loginUrl = `${casLoginUrl}${casLoginUrl.includes("?") ? "&" : "?"}service=${encodeURIComponent(service)}`;
    return res.redirect(loginUrl);
  } catch (error) {
    const frontend = buildFrontendBaseUrl();
    return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent(error.message)}`);
  }
};

const casCallback = async (req, res) => {
  const frontend = buildFrontendBaseUrl();
  try {
    if (String(process.env.CAS_ENABLED || "false").toLowerCase() !== "true") {
      return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent("CAS login is disabled")}`);
    }
    const ticket = String(req.query?.ticket || "");
    if (!ticket) {
      return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent("Missing CAS ticket")}`);
    }

    const service = `${buildBackendBaseUrl(req)}/api/auth/cas/callback`;
    const primaryValidateBase = String(process.env.CAS_VALIDATE_BASE_URL || "https://login-new.iiit.ac.in/cas").replace(/\/$/, "");
    const fallbackValidateBase = String(process.env.CAS_FALLBACK_VALIDATE_BASE_URL || "https://login.iiit.ac.in/cas").replace(/\/$/, "");
    const validateUrls = [
      `${primaryValidateBase}/serviceValidate?service=${encodeURIComponent(service)}&ticket=${encodeURIComponent(ticket)}`,
      `${fallbackValidateBase}/serviceValidate?service=${encodeURIComponent(service)}&ticket=${encodeURIComponent(ticket)}`,
    ];

    let xml = "";
    let lastError = null;
    for (const validateUrl of validateUrls) {
      try {
        xml = await getTextFromUrl(validateUrl);
        if (xml.includes("authenticationSuccess")) {
          break;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (!xml || !xml.includes("authenticationSuccess")) {
      const reason = lastError ? `CAS validation failed: ${lastError.message}` : "CAS validation failed";
      return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent(reason)}`);
    }

    const uid = extractCasField(xml, "user");
    const casEmail = extractCasField(xml, "mail");
    const email = (casEmail || (uid.includes("@") ? uid : `${uid}@iiit.ac.in`)).toLowerCase();
    if (!email.endsWith("iiit.ac.in")) {
      return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent("CAS account is not an iiit.ac.in account")}`);
    }

    const normalizedName = uid.replace(/[._-]+/g, " ").trim() || "IIIT Participant";
    const nameParts = normalizedName.split(/\s+/).filter(Boolean);
    const firstName = (nameParts[0] || "IIIT").slice(0, 40);
    const lastName = (nameParts.slice(1).join(" ") || "Participant").slice(0, 40);

    let participant = await Participant.findOne({ email });
    if (!participant) {
      const seedPassword = `cas-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      participant = await Participant.create({
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        email,
        password: seedPassword,
        role: "participant",
        institutionCategory: "IIIT",
        participantType: "Student",
        contact: "NA",
        college: "IIIT Hyderabad",
        interests: [],
        casVerified: true,
        onboardingCompleted: false,
      });
    } else if (!participant.casVerified) {
      participant.casVerified = true;
      participant.institutionCategory = "IIIT";
      if (!participant.college) participant.college = "IIIT Hyderabad";
      if (!participant.contact) participant.contact = "NA";
      await participant.save();
    }

    const token = createToken(participant);
    const query = new URLSearchParams({
      status: "success",
      token,
      id: String(participant._id),
      role: "participant",
      name: participant.name || `${participant.firstName} ${participant.lastName}`.trim(),
      email: participant.email,
      onboardingCompleted: participant.onboardingCompleted ? "true" : "false",
    });
    return res.redirect(`${frontend}/auth/cas/callback?${query.toString()}`);
  } catch (error) {
    return res.redirect(`${frontend}/auth/cas/failure?reason=${encodeURIComponent(error.message)}`);
  }
};

module.exports = {
  register,
  login,
  casStart,
  casCallback,
};
