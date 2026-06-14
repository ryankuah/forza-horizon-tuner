import * as React from "react";
import { fetchCarSessions, fetchRunDetail } from "@/services/api";
import type { CarSessionSummary, RunDetail, RunSelection } from "@/types/telemetry";

export function useRuns() {
  const [carSessions, setCarSessions] = React.useState<CarSessionSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = React.useState<RunSelection>("live");
  const [runDetail, setRunDetail] = React.useState<RunDetail | null>(null);
  const [isRunStreaming, setIsRunStreaming] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadCarSessions = async () => {
      const nextCarSessions = await fetchCarSessions();
      if (!cancelled) setCarSessions(nextCarSessions);
    };

    loadCarSessions();
    const interval = window.setInterval(loadCarSessions, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (selectedRunId === "live") {
      setRunDetail(null);
      setIsRunStreaming(false);
      return;
    }

    let cancelled = false;
    setRunDetail(null);
    setIsRunStreaming(true);

    fetchRunDetail(selectedRunId)
      .then((detail) => {
        if (!cancelled) setRunDetail(detail);
      })
      .catch((error) => {
        console.warn(`Run load failed: ${error instanceof Error ? error.message : String(error)}`);
        if (!cancelled) setRunDetail(null);
      })
      .finally(() => {
        if (!cancelled) setIsRunStreaming(false);
      });

    return () => {
      cancelled = true;
      setIsRunStreaming(false);
    };
  }, [selectedRunId]);

  return {
    carSessions,
    setCarSessions,
    selectedRunId,
    setSelectedRunId,
    runDetail,
    isRunStreaming
  };
}
