export const DEFAULT_PROMPT =
  "You are a thoughtful, concise AI assistant. Give accurate, practical answers. State uncertainty clearly and ask a focused question when essential context is missing.";

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the status-based fallback.
    }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  models: () => request("/api/models"),
  sessions: () => request("/api/sessions"),
  session: (id) => request(`/api/sessions/${id}`),
  createSession: (payload) =>
    request("/api/sessions", { method: "POST", body: JSON.stringify(payload) }),
  updateSession: (id, payload) =>
    request(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  changeModel: (id, modelId) =>
    request(`/api/sessions/${id}/model`, {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    }),
};
