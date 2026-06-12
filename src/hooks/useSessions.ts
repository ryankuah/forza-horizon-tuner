import * as React from "react";
import { createNewSession, fetchSessionDetail, fetchSessions, streamSessionDetail } from "@/services/api";
import type { SessionDetail, SessionSelection, SessionSummary } from "@/types/telemetry";

export function useSessions() {
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = React.useState<SessionSelection>("live");
  const [sessionDetail, setSessionDetail] = React.useState<SessionDetail | null>(null);
  const [isSessionStreaming, setIsSessionStreaming] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      const nextSessions = await fetchSessions();
      if (!cancelled) setSessions(nextSessions);
    };

    loadSessions();
    const interval = window.setInterval(loadSessions, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (selectedSessionId === "live") {
      setSessionDetail(null);
      setIsSessionStreaming(false);
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;
    setSessionDetail(null);
    setIsSessionStreaming(true);

    streamSessionDetail(selectedSessionId, {
      signal: abortController.signal,
      onSession: (session) => {
        if (!cancelled) setSessionDetail({ session, samples: [], summary: null });
      },
      onSamples: (samples) => {
        if (cancelled) return;
        setSessionDetail((current) => current
          ? { ...current, samples: [...current.samples, ...samples] }
          : null
        );
      },
      onDone: (summary) => {
        if (cancelled) return;
        setSessionDetail((current) => current ? { ...current, summary } : current);
        setIsSessionStreaming(false);
      }
    }).catch(async (error) => {
      if (cancelled || abortController.signal.aborted) return;
      console.warn(`Session stream failed, falling back to bulk session fetch: ${error instanceof Error ? error.message : String(error)}`);
      const detail = await fetchSessionDetail(selectedSessionId);
      if (!cancelled) {
        setSessionDetail(detail);
        setIsSessionStreaming(false);
      }
    });

    return () => {
      cancelled = true;
      abortController.abort();
      setIsSessionStreaming(false);
    };
  }, [selectedSessionId]);

  async function startNewSession() {
    const created = await createNewSession();
    const nextSessions = await fetchSessions();
    setSessions(nextSessions);
    setSelectedSessionId(created ? "live" : nextSessions[0]?.id ?? "live");
    return created;
  }

  return { sessions, setSessions, selectedSessionId, setSelectedSessionId, sessionDetail, isSessionStreaming, startNewSession };
}
