import * as React from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRunsPage, queryKeys } from "@/services/api";
import type { RunsPage, RunSummary } from "@/types/telemetry";

const RUNS_PAGE_LIMIT = 50;
const EMPTY_RUNS_PAGE: RunsPage = {
  runs: [],
  nextCursor: null,
  previousCursor: null,
  hasNextPage: false,
  hasPreviousPage: false
};

type PageRequest = {
  cursor: string | null;
  direction: "next";
};

export function useRuns(completedRunsVersion = 0) {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);
  const initialPageParam = React.useMemo<PageRequest>(() => ({ cursor: null, direction: "next" }), []);

  const loadPage = React.useCallback((request: PageRequest) => {
    const query = { cursor: request.cursor, direction: request.direction, limit: RUNS_PAGE_LIMIT };
    return queryClient.ensureQueryData({
      queryKey: queryKeys.runs.page(query),
      queryFn: () => fetchRunsPage(query)
    });
  }, [queryClient]);

  const runsQuery = useInfiniteQuery({
    queryKey: queryKeys.runs.pages(RUNS_PAGE_LIMIT, completedRunsVersion),
    queryFn: ({ pageParam }: { pageParam: PageRequest }) => loadPage(pageParam),
    initialPageParam,
    getNextPageParam: (lastPage) => lastPage.hasNextPage && lastPage.nextCursor
      ? { cursor: lastPage.nextCursor, direction: "next" as const }
      : undefined
  });

  const runsPage = React.useMemo(() => {
    return runsQuery.data?.pages.reduce<RunsPage>((current, page, index) => {
      return mergeRunsPage(current, page, index === 0);
    }, EMPTY_RUNS_PAGE) ?? EMPTY_RUNS_PAGE;
  }, [runsQuery.data]);

  React.useEffect(() => {
    setSelectedRunId((current) => selectValidRun(current, runsPage.runs));
  }, [runsPage.runs]);

  React.useEffect(() => {
    const lastPage = runsQuery.data?.pages.at(-1);
    if (!lastPage?.nextCursor || !lastPage.hasNextPage) return;
    const query = { cursor: lastPage.nextCursor, direction: "next" as const, limit: RUNS_PAGE_LIMIT };
    void queryClient.prefetchQuery({
      queryKey: queryKeys.runs.page(query),
      queryFn: () => fetchRunsPage(query)
    });
  }, [queryClient, runsQuery.data]);

  function loadNextPage() {
    if (runsQuery.isFetchingNextPage || !runsQuery.hasNextPage) return;
    void runsQuery.fetchNextPage();
  }

  return {
    runsPage,
    selectedRunId,
    setSelectedRunId,
    isRunsLoading: runsQuery.isLoading || runsQuery.isFetchingNextPage,
    runsError: runsQuery.error instanceof Error ? runsQuery.error.message : null,
    loadNextPage
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
