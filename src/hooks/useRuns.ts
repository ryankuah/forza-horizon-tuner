import * as React from "react";
import { fetchRunsPage, invalidateRunCaches } from "@/services/api";
import type { RunsPage, RunSummary } from "@/types/telemetry";

const EMPTY_RUNS_PAGE: RunsPage = {
  runs: [],
  nextCursor: null,
  previousCursor: null,
  hasNextPage: false,
  hasPreviousPage: false
};

type PageRequest = {
  cursor: string | null;
  direction: "next" | "previous";
};

export function useRuns(completedRunsVersion = 0) {
  const [runsPage, setRunsPage] = React.useState<RunsPage>(EMPTY_RUNS_PAGE);
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const [pageRequest, setPageRequest] = React.useState<PageRequest | null>({ cursor: null, direction: "next" });
  const [isRunsLoading, setIsRunsLoading] = React.useState(false);
  const [runsError, setRunsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    invalidateRunCaches();
    setRunsPage(EMPTY_RUNS_PAGE);
    setPageRequest({ cursor: null, direction: "next" });
  }, [completedRunsVersion]);

  React.useEffect(() => {
    if (!pageRequest) return;
    let cancelled = false;
    setIsRunsLoading(true);
    setRunsError(null);

    fetchRunsPage({
      cursor: pageRequest.cursor,
      direction: pageRequest.direction,
      limit: 50
      })
      .then((page) => {
        if (cancelled) return;
        setRunsPage((current) => {
          const next = mergeRunsPage(current, page, pageRequest.cursor === null);
          setSelectedRunId((selectedRunId) => selectValidRun(selectedRunId, next.runs));
          return next;
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setRunsError(error instanceof Error ? error.message : String(error));
        setRunsPage(EMPTY_RUNS_PAGE);
      })
      .finally(() => {
        if (!cancelled) setIsRunsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageRequest]);

  function loadNextPage() {
    if (isRunsLoading || !runsPage.nextCursor || !runsPage.hasNextPage) return;
    setPageRequest({ cursor: runsPage.nextCursor, direction: "next" });
  }

  function loadPreviousPage() {
    if (isRunsLoading || !runsPage.previousCursor || !runsPage.hasPreviousPage) return;
    setPageRequest({ cursor: runsPage.previousCursor, direction: "previous" });
  }

  return {
    runsPage,
    selectedRunId,
    setSelectedRunId,
    isRunsLoading,
    runsError,
    loadNextPage,
    loadPreviousPage
  };
}

function mergeRunsPage(current: RunsPage, page: RunsPage, replace: boolean): RunsPage {
  if (replace) return page;
  const seen = new Set(current.runs.map((run) => run.id));
  const nextRuns = [...current.runs];
  for (const run of page.runs) {
    if (!seen.has(run.id)) nextRuns.push(run);
  }
  return {
    runs: nextRuns,
    nextCursor: page.nextCursor,
    previousCursor: current.previousCursor ?? page.previousCursor,
    hasNextPage: page.hasNextPage,
    hasPreviousPage: current.hasPreviousPage || page.hasPreviousPage
  };
}

function selectValidRun(current: string | null, runs: RunSummary[]) {
  if (current && runs.some((run) => run.id === current)) return current;
  return runs[0]?.id ?? null;
}
