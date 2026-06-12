import type { SessionDetail, SessionSummary, Summary, Telemetry } from "@/types/telemetry";

const STREAM_BATCH_SIZE = 5000;

export async function fetchSessions() {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/sessions`);
    if (!response.ok) return [];
    const data = await response.json() as { sessions: SessionSummary[] };
    return data.sessions;
  } catch {
    return [];
  }
}


export async function fetchSessionDetail(sessionId: string) {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/sessions/${sessionId}?limit=250000`);
    if (!response.ok) return null;
    return await response.json() as SessionDetail;
  } catch {
    return null;
  }
}


type SessionStreamEvent =
  | { type: "session"; session: SessionSummary }
  | { type: "sample"; telemetry: Telemetry }
  | { type: "done"; sampleCount: number; summary: Summary | null }
  | { type: "error"; error: string };

export async function streamSessionDetail(
  sessionId: string,
  callbacks: {
    signal?: AbortSignal;
    onSession: (session: SessionSummary) => void;
    onSamples: (samples: Telemetry[]) => void;
    onDone: (summary: Summary | null) => void;
  }
) {
  const response = await fetch(`${apiBaseUrl()}/api/sessions/${sessionId}/stream`, {
    signal: callbacks.signal
  });
  if (!response.ok || !response.body) throw new Error("Unable to stream session");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pendingText = "";
  let sampleBatch: Telemetry[] = [];

  const flushSamples = () => {
    if (!sampleBatch.length) return false;
    callbacks.onSamples(sampleBatch);
    sampleBatch = [];
    return true;
  };

  const handleLine = (line: string) => {
    if (!line.trim()) return false;

    const event = JSON.parse(line) as SessionStreamEvent;
    if (event.type === "session") {
      callbacks.onSession(event.session);
      return false;
    }

    if (event.type === "sample") {
      sampleBatch.push(event.telemetry);
      return sampleBatch.length >= STREAM_BATCH_SIZE ? flushSamples() : false;
    }

    if (event.type === "done") {
      flushSamples();
      callbacks.onDone(event.summary);
      return false;
    }

    throw new Error(event.error);
  };

  while (true) {
    const { done, value } = await reader.read();
    pendingText += decoder.decode(value, { stream: !done });

    const lines = pendingText.split("\n");
    pendingText = lines.pop() ?? "";
    for (const line of lines) {
      if (handleLine(line)) await yieldToBrowser();
    }

    if (done) break;
  }

  if (pendingText) handleLine(pendingText);
  flushSamples();
}


function yieldToBrowser() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}


export async function createNewSession() {
  try {
    const response = await fetch(`${apiBaseUrl()}/api/sessions/new`, { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}


function apiBaseUrl() {
  const host = window.location.hostname || "localhost";
  return `http://${host}:3001`;
}
