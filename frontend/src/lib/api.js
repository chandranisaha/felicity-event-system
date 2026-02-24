const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const buildHeaders = (token, isJson = true) => {
  const headers = {};
  if (isJson) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
};

export const apiRequest = async ({ path, method = "GET", token, body, isJson = true }) => {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: buildHeaders(token, isJson),
      body: body !== undefined ? (isJson ? JSON.stringify(body) : body) : undefined,
    });
  } catch (error) {
    throw new Error(`failed to connect to backend at ${BASE_URL}. make sure backend is running on port 5000`);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload?.message || "request failed";
    const detail = typeof payload?.error === "string" ? payload.error : "";
    const fullMessage = detail ? `${message}: ${detail}` : message;
    throw new Error(fullMessage);
  }

  return payload;
};
