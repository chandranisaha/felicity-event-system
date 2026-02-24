const crypto = require("crypto");
const QRCode = require("qrcode");

const signPayload = (payload) => {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update(payload).digest("hex");
};

const buildQrPayload = ({ ticketId, eventId, participantId }) => {
  const base = JSON.stringify({ ticketId, eventId, participantId });
  const signature = signPayload(base);
  return JSON.stringify({ ticketId, eventId, participantId, signature });
};

const parseQrPayload = (qrPayload) => {
  try {
    const parsed = typeof qrPayload === "string" ? JSON.parse(qrPayload) : qrPayload;
    if (!parsed || !parsed.ticketId || !parsed.signature) {
      return { error: "invalid qr payload format" };
    }

    const base = JSON.stringify({
      ticketId: parsed.ticketId,
      eventId: parsed.eventId,
      participantId: parsed.participantId,
    });
    const expectedSignature = signPayload(base);
    if (expectedSignature !== parsed.signature) {
      return { error: "invalid qr payload signature" };
    }

    return {
      ticketId: parsed.ticketId,
      eventId: parsed.eventId,
      participantId: parsed.participantId,
    };
  } catch (error) {
    return { error: "invalid qr payload" };
  }
};

const generateQrCodeDataUrl = async (payload) => {
  return QRCode.toDataURL(payload, { width: 300, margin: 1 });
};

module.exports = {
  buildQrPayload,
  parseQrPayload,
  generateQrCodeDataUrl,
};
