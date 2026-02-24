const verifyCaptchaToken = async (token, remoteIp) => {
  const provider = (process.env.CAPTCHA_PROVIDER || "").toLowerCase();

  if (provider === "turnstile") {
    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (!secret) {
      throw new Error("captcha provider is configured but secret key is missing");
    }

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: remoteIp || "",
      }),
    });
    return response.json();
  }

  if (provider === "recaptcha") {
    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
      throw new Error("captcha provider is configured but secret key is missing");
    }

    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: remoteIp || "",
      }),
    });
    return response.json();
  }

  throw new Error("unsupported captcha provider");
};

const requireCaptchaForAuth = async (req, res, next) => {
  try {
    const enforce = String(process.env.CAPTCHA_ENFORCE || "false").toLowerCase() === "true";
    const provider = (process.env.CAPTCHA_PROVIDER || "").toLowerCase();

    if (!enforce || !provider) {
      return next();
    }

    if (!["turnstile", "recaptcha"].includes(provider)) {
      return res.status(500).json({ message: "captcha provider is invalid in server config" });
    }

    if (provider === "turnstile" && !process.env.TURNSTILE_SECRET_KEY) {
      return res.status(500).json({ message: "captcha is enabled but turnstile secret is missing" });
    }

    if (provider === "recaptcha" && !process.env.RECAPTCHA_SECRET_KEY) {
      return res.status(500).json({ message: "captcha is enabled but recaptcha secret is missing" });
    }

    const captchaToken = req.body?.captchaToken;
    if (!captchaToken || typeof captchaToken !== "string") {
      return res.status(400).json({ message: "captcha token is required" });
    }

    const remoteIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    const verification = await verifyCaptchaToken(captchaToken, remoteIp);

    if (!verification?.success) {
      return res.status(400).json({
        message: "captcha verification failed",
        details: verification?.["error-codes"] || [],
      });
    }

    return next();
  } catch (error) {
    return res.status(502).json({ message: "captcha verification error", error: error.message });
  }
};

module.exports = {
  requireCaptchaForAuth,
};
