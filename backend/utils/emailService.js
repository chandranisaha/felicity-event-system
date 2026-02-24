const nodemailer = require("nodemailer");

const getTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const sendTicketEmail = async ({ to, participantName, event, ticketId, qrCode }) => {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error("email service not configured");
  }

  let qrCid = null;
  let attachments = [];
  const dataUrlMatch =
    typeof qrCode === "string" ? qrCode.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/) : null;
  if (dataUrlMatch) {
    const mimeType = dataUrlMatch[1];
    const base64Data = dataUrlMatch[2];
    const extension = mimeType.includes("png") ? "png" : "img";
    qrCid = `ticket-qr-${ticketId}@felicity.local`;
    attachments = [
      {
        filename: `ticket-${ticketId}.${extension}`,
        content: base64Data,
        encoding: "base64",
        contentType: mimeType,
        cid: qrCid,
      },
    ];
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const html = `
    <h2>Ticket Confirmation</h2>
    <p>Hi ${participantName || "Participant"},</p>
    <p>Your registration is confirmed.</p>
    <ul>
      <li><strong>Event:</strong> ${event.name}</li>
      <li><strong>Start:</strong> ${new Date(event.startDate).toLocaleString()}</li>
      <li><strong>End:</strong> ${new Date(event.endDate).toLocaleString()}</li>
      <li><strong>Ticket ID:</strong> ${ticketId}</li>
    </ul>
    <p>Show this QR at entry.</p>
    ${qrCid ? `<img src="cid:${qrCid}" alt="ticket qr code" />` : `<p>qr unavailable</p>`}
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `Your Ticket for ${event.name}`,
    html,
    attachments,
  });

  return { sent: true };
};

module.exports = {
  sendTicketEmail,
};
