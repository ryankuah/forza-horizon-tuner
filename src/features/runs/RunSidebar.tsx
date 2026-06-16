import * as React from "react";
import { Car, Database, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { drivetrainLabel, shortRunId } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppPage, CarCatalogItem, RunSummary } from "@/types/telemetry";

const navItems: { page: AppPage; label: string; icon: React.ReactNode }[] = [
  { page: "live", label: "Live", icon: <Radio size={18} /> },
  { page: "cars", label: "Cars", icon: <Car size={18} /> }
];

export function RunSidebar({
  activePage,
  runs,
  selectedRunId,
  carCatalogByOrdinal,
  isRunsLoading,
  runsError,
  canLoadNext,
  onPageChange,
  onSelectRun,
  onLoadNext
}: {
  activePage: AppPage;
  runs: RunSummary[];
  selectedRunId: string | null;
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  isRunsLoading: boolean;
  runsError: string | null;
  canLoadNext: boolean;
  onPageChange: (page: AppPage) => void;
  onSelectRun: (runId: string) => void;
  onLoadNext: () => void;
}) {
  return (
    <aside
      className="flex h-full w-[336px] shrink-0 flex-col border-r border-white/10 bg-[#242424] py-3 text-[#e7e7e7]"
      aria-label="Navigation"
    >
      <nav className="grid gap-1 px-2" aria-label="Primary pages">
        {navItems.map((item) => {
          const isActive = activePage === item.page;
          return (
            <button
              key={item.page}
              className={cn(
                "flex h-10 items-center justify-start gap-3 rounded-lg px-3 text-sm font-medium transition",
                isActive
                  ? "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  : "text-[#b8b8b8] hover:bg-white/8 hover:text-[#ededed]"
              )}
              type="button"
              onClick={() => onPageChange(item.page)}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <RunSidebarList
        runs={runs}
        selectedRunId={selectedRunId}
        carCatalogByOrdinal={carCatalogByOrdinal}
        isLoading={isRunsLoading}
        error={runsError}
        canLoadNext={canLoadNext}
        onSelectRun={onSelectRun}
        onLoadNext={onLoadNext}
      />
    </aside>
  );
}

function RunSidebarList({
  runs,
  selectedRunId,
  carCatalogByOrdinal,
  isLoading,
  error,
  canLoadNext,
  onSelectRun,
  onLoadNext
}: {
  runs: RunSummary[];
  selectedRunId: string | null;
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  isLoading: boolean;
  error: string | null;
  canLoadNext: boolean;
  onSelectRun: (runId: string) => void;
  onLoadNext: () => void;
}) {
  function handleScroll(event: React.UIEvent<HTMLDivElement>) {
    if (isLoading || !canLoadNext) return;
    const target = event.currentTarget;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom < 180) onLoadNext();
  }

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-white/10">
      <div className="shrink-0 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#8f9a95]">
              <Database size={15} />
              Completed runs
            </div>
            <div className="mt-1 text-sm text-[#9aa39f]">{runs.length.toLocaleString()} loaded</div>
          </div>
          {isLoading ? <Badge className="bg-white/8 text-[#bfc7c3]">Loading</Badge> : null}
        </div>
        {error ? <div className="mt-2 rounded-md border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs text-red-200">{error}</div> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 pb-2" onScroll={handleScroll}>
        {runs.length > 0 ? (
          <div className="grid gap-1">
            {runs.map((run) => (
              <button
                key={run.id}
                className={cn(
                  "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
                  selectedRunId === run.id ? "bg-white/10 text-white" : "text-[#d0d0d0]"
                )}
                type="button"
                onClick={() => onSelectRun(run.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{formatRunTime(run.startedAt)}</span>
                  <Badge className={cn("h-5", run.runType === "event" ? "bg-[#59a7ff]/15 text-[#86b7ff]" : "bg-[#63da97]/15 text-[#70e0a6]")}>{run.runType}</Badge>
                </div>
                <div className="mt-1 truncate text-xs text-[#8f8f8f]">{formatCar(run, carCatalogByOrdinal)}</div>
                <div className="mt-2 flex items-center gap-3 text-xs text-[#8f8f8f]">
                  <span>{run.packetCount.toLocaleString()} pkt</span>
                  <span>{formatDuration(run)}</span>
                  <span>{shortRunId(run.id)}</span>
                </div>
              </button>
            ))}
          </div>
        ) : !isLoading ? (
          <div className="px-3 py-4 text-sm leading-6 text-[#9aa39f]">Completed runs appear here after an active drive ends, splits, or the UDP listener is stopped.</div>
        ) : null}
        {runs.length > 0 && isLoading ? (
          <div className="px-3 py-3 text-xs font-medium text-[#9aa39f]">Loading older runs...</div>
        ) : null}
        {runs.length > 0 && !isLoading && !canLoadNext ? (
          <div className="px-3 py-3 text-xs font-medium text-[#7f8984]">End of completed runs</div>
        ) : null}
      </div>
    </div>
  );
}

function formatRunTime(value: number | null | undefined) {
  if (!value) return "No packets";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDuration(run: Pick<RunSummary, "startedAt" | "endedAt" | "lastPacketAt">) {
  const end = run.endedAt ?? run.lastPacketAt;
  if (!end || end <= run.startedAt) return "Open";
  const totalSeconds = Math.round((end - run.startedAt) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function carClassLabel(value: number | null | undefined) {
  if (value === 0) return "D";
  if (value === 1) return "C";
  if (value === 2) return "B";
  if (value === 3) return "A";
  if (value === 4) return "S1";
  if (value === 5) return "S2";
  if (value === 6) return "X";
  return null;
}

function formatCar(
  run: Pick<RunSummary, "carOrdinal" | "carClass" | "carPerformanceIndex" | "drivetrainType">,
  carCatalogByOrdinal: Map<number, CarCatalogItem>
) {
  const catalogCar = run.carOrdinal === null || run.carOrdinal === undefined
    ? null
    : carCatalogByOrdinal.get(run.carOrdinal) ?? null;
  const carName = catalogCar?.carName ?? "Unknown car";
  const className = carClassLabel(run.carClass) ?? catalogCar?.carClass ?? null;
  const piLabel = run.carPerformanceIndex === null || run.carPerformanceIndex === undefined ? null : `PI ${run.carPerformanceIndex}`;
  const classLabel = className && run.carPerformanceIndex !== null && run.carPerformanceIndex !== undefined
    ? `${className} ${run.carPerformanceIndex}`
    : className;
  const drivetrain = run.drivetrainType === null || run.drivetrainType === undefined ? null : drivetrainLabel(run.drivetrainType);
  return [carName, classLabel ?? piLabel, drivetrain].filter(Boolean).join(" / ");
}
