import * as React from "react";
import { fetchRunDetail, fetchRunGroups } from "@/services/api";
import type { RunDateGroup, RunDetail, RunSelection } from "@/types/telemetry";

export function useRuns() {
  const [runGroups, setRunGroups] = React.useState<RunDateGroup[]>([]);
  const [selectedRunId, setSelectedRunId] = React.useState<RunSelection>("live");
  const [runDetail, setRunDetail] = React.useState<RunDetail | null>(null);
  const [isRunStreaming, setIsRunStreaming] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const loadRunGroups = async () => {
      const nextRunGroups = await fetchRunGroups();
      if (!cancelled) setRunGroups(nextRunGroups);
    };

    loadRunGroups();
    const interval = window.setInterval(loadRunGroups, 5000);
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
    runGroups,
    setRunGroups,
    selectedRunId,
    setSelectedRunId,
    runDetail,
    isRunStreaming
  };
}
