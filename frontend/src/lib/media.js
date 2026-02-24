const extractGoogleDriveId = (url) => {
  if (!url) return "";
  const value = String(url).trim();
  const fileMatch = value.match(/\/file\/d\/([^/]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];
  const openMatch = value.match(/[?&]id=([^&]+)/i);
  if (openMatch?.[1]) return openMatch[1];
  const ucMatch = value.match(/\/uc\?(.*)/i);
  if (ucMatch?.[1]) {
    const params = new URLSearchParams(ucMatch[1]);
    if (params.get("id")) return params.get("id");
  }
  return "";
};

export const getImageCandidates = (url) => {
  const value = String(url || "").trim();
  if (!value) return [];
  const driveId = extractGoogleDriveId(value);
  if (driveId) {
    return [
      `https://drive.usercontent.google.com/uc?id=${driveId}&export=view`,
      `https://lh3.googleusercontent.com/d/${driveId}=w2000`,
      `https://drive.google.com/thumbnail?id=${driveId}&sz=w2000`,
      `https://drive.google.com/uc?export=view&id=${driveId}`,
      `https://drive.google.com/uc?export=download&id=${driveId}`,
      `https://drive.google.com/uc?id=${driveId}`,
      value,
    ];
  }
  if (/^https?:\/\//i.test(value)) {
    const stripped = value.replace(/^https?:\/\//i, "");
    return [
      value,
      `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`,
      "/logo.png",
    ];
  }
  return [value, "/logo.png"];
};

export const toDisplayImageUrl = (url) => {
  return getImageCandidates(url)[0] || "";
};
