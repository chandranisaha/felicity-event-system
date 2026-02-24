const pad = (value) => String(value).padStart(2, "0");

const toIcsDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}${pad(date.getUTCSeconds())}Z`;
};

const toGoogleDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(
    date.getUTCMinutes()
  )}${pad(date.getUTCSeconds())}Z`;
};

const escapeIcs = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

export const downloadEventIcs = ({ title, description, startDate, endDate, organizerName, eventId }) => {
  const uid = `${eventId || Date.now()}@felicity.local`;
  const now = toIcsDate(new Date());
  const start = toIcsDate(startDate);
  const end = toIcsDate(endDate);

  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Felicity Event System//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(`${description || ""}\nOrganizer: ${organizerName || "-"}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(title || "event").replace(/[^a-zA-Z0-9-_]/g, "_")}.ics`;
  link.click();
  URL.revokeObjectURL(url);
};

export const buildGoogleCalendarUrl = ({ title, description, startDate, endDate, organizerName }) => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Event",
    details: `${description || ""}\nOrganizer: ${organizerName || "-"}`,
    dates: `${toGoogleDate(startDate)}/${toGoogleDate(endDate)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const buildOutlookCalendarUrl = ({ title, description, startDate, endDate, organizerName }) => {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title || "Event",
    body: `${description || ""}\nOrganizer: ${organizerName || "-"}`,
    startdt: new Date(startDate).toISOString(),
    enddt: new Date(endDate).toISOString(),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};
