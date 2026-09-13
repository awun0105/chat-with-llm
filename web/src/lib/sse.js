function parseEventBlock(block) {
  const lines = block.split("\n");
  const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
  if (!data) return null;
  return { event, payload: JSON.parse(data) };
}

export async function consumeSSE(response, handler) {
  if (!response.body) throw new Error("Streaming is not supported by this browser.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replaceAll("\r\n", "\n");
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() || "";
    for (const block of blocks) {
      const parsed = parseEventBlock(block);
      if (parsed) handler(parsed.event, parsed.payload);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const parsed = parseEventBlock(buffer);
    if (parsed) handler(parsed.event, parsed.payload);
  }
}

export async function streamChat(url, body, handler) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Chat request failed (${response.status})`);
  }
  let streamError = null;
  await consumeSSE(response, (event, payload) => {
    if (event === "error") streamError = payload.message;
    else handler(event, payload);
  });
  if (streamError) throw new Error(streamError);
}
