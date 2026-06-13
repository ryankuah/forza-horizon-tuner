import * as React from "react";
import { Car, Check, ChevronDown, ChevronRight, Clock, PanelLeftClose, PanelLeftOpen, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { drivetrainLabel, shortSessionId } from "@/lib/format";
import type { RunSelection, RunSummary, SessionSummary, SessionWithRuns, Telemetry } from "@/types/telemetry";

function formatSessionTime(value: number | null | undefined) {
  if (!value) return "No packets";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatCar(run: Pick<RunSummary, "carOrdinal" | "carClass" | "carPerformanceIndex" | "drivetrainType">) {
  const carId = run.carOrdinal === null || run.carOrdinal === undefined ? "Unknown car" : `Car ${run.carOrdinal}`;
  const classLabel = run.carClass === null || run.carClass === undefined ? null : `Class ${run.carClass}`;
  const piLabel = run.carPerformanceIndex === null || run.carPerformanceIndex === undefined ? null : `PI ${run.carPerformanceIndex}`;
  const drivetrain = run.drivetrainType === null || run.drivetrainType === undefined ? null : drivetrainLabel(run.drivetrainType);
  return [carId, classLabel, piLabel, drivetrain].filter(Boolean).join(" / ");
}

function formatDuration(item: Pick<SessionSummary | RunSummary, "startedAt" | "endedAt" | "lastPacketAt">) {
  const start = item.startedAt;
  const end = item.endedAt ?? item.lastPacketAt;
  if (!end || end <= start) return "Open";

  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function splitReasonLabel(reason: string | null | undefined) {
  if (reason === "car_change") return "Car change";
  if (reason === "afk") return "AFK";
  if (reason === "telemetry_reset") return "Reset";
  if (reason === "udp_reconnect") return "Reconnect";
  if (reason === "legacy") return "Legacy";
  return "Run";
}

export function SessionHeader({
  sessions,
  selectedRunId,
  canSelectLive,
  liveSessionId,
  liveRunId,
  liveTelemetry,
  livePackets,
  liveBadPackets,
  liveLastPacketAt,
  isCollapsed,
  onCollapsedChange,
  onRunChange
}: {
  sessions: SessionWithRuns[];
  selectedRunId: RunSelection;
  canSelectLive: boolean;
  liveSessionId?: string;
  liveRunId?: string;
  liveTelemetry?: Telemetry | null;
  livePackets?: number;
  liveBadPackets?: number;
  liveLastPacketAt?: number | null;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  onRunChange: (runId: RunSelection) => void;
}) {
  const selectedValue = canSelectLive
    ? selectedRunId
    : selectedRunId === "live"
      ? sessions[0]?.runs[0]?.id ?? "__none"
      : selectedRunId;

  function selectRun(runId: RunSelection | "__none") {
    if (runId === "__none") return;
    onRunChange(runId);
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-white/10 bg-[#242424] text-[#e7e7e7] transition-[width] duration-200 ease-out",
        isCollapsed ? "w-[68px]" : "w-[316px]"
      )}
      aria-label="Sessions"
    >
      <div className="flex h-[62px] shrink-0 items-center justify-end px-3 [-webkit-app-region:drag]">
        {!isCollapsed ? (
          <Button
            className="text-[#b6b6b6] hover:bg-white/10 hover:text-white [-webkit-app-region:no-drag]"
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => onCollapsedChange(true)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={18} />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isCollapsed ? (
          <CollapsedSessions
            sessions={sessions}
            selectedValue={selectedValue}
            canSelectLive={canSelectLive}
            onExpand={() => onCollapsedChange(false)}
            onRunChange={selectRun}
          />
        ) : (
          <ExpandedSessions
            sessions={sessions}
            selectedValue={selectedValue}
            canSelectLive={canSelectLive}
            liveSessionId={liveSessionId}
            liveRunId={liveRunId}
            liveTelemetry={liveTelemetry}
            livePackets={livePackets}
            liveBadPackets={liveBadPackets}
            liveLastPacketAt={liveLastPacketAt}
            onRunChange={selectRun}
          />
        )}
      </div>
    </aside>
  );
}

function ExpandedSessions({
  sessions,
  selectedValue,
  canSelectLive,
  liveSessionId,
  liveRunId,
  liveTelemetry,
  livePackets,
  liveBadPackets,
  liveLastPacketAt,
  onRunChange
}: {
  sessions: SessionWithRuns[];
  selectedValue: RunSelection | "__none";
  canSelectLive: boolean;
  liveSessionId?: string;
  liveRunId?: string;
  liveTelemetry?: Telemetry | null;
  livePackets?: number;
  liveBadPackets?: number;
  liveLastPacketAt?: number | null;
  onRunChange: (runId: RunSelection | "__none") => void;
}) {
  const [expandedSessionIds, setExpandedSessionIds] = React.useState<Set<string>>(() => new Set(sessions.slice(0, 2).map(({ session }) => session.id)));

  React.useEffect(() => {
    setExpandedSessionIds((current) => {
      const next = new Set(current);
      for (const group of sessions) {
        if (group.runs.some((run) => run.id === selectedValue)) next.add(group.session.id);
      }
      if (next.size === 0 && sessions[0]) next.add(sessions[0].session.id);
      return next;
    });
  }, [selectedValue, sessions]);

  function toggleSession(sessionId: string) {
    setExpandedSessionIds((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  return (
    <div className="grid gap-5">
      {canSelectLive ? (
        <div className="grid gap-1">
          <div className="px-3 pb-1 text-xs font-medium text-[#8e8e8e]">Live</div>
          <button
            className={cn(
              "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
              selectedValue === "live" ? "bg-white/10 text-white" : "text-[#d0d0d0]"
            )}
            type="button"
            onClick={() => onRunChange("live")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Radio size={15} />
                <span className="truncate">Live telemetry</span>
              </div>
              {selectedValue === "live" ? <Check size={15} /> : <Badge className="h-5 bg-[#4cc38a]/15 text-[#70e0a6]">Live</Badge>}
            </div>
            <div className="mt-1 truncate pl-6 text-xs text-[#8f8f8f]">
              {liveRunId ? `Run ${shortSessionId(liveRunId)}` : "Waiting for run"}
              {liveSessionId ? ` / Session ${shortSessionId(liveSessionId)}` : ""}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 pl-6 text-xs text-[#8f8f8f]">
              <span>{(livePackets ?? 0).toLocaleString()} pkt</span>
              <span>{(liveBadPackets ?? 0).toLocaleString()} bad</span>
              <span className="truncate">{formatSessionTime(liveLastPacketAt)}</span>
            </div>
            <div className="mt-1 truncate pl-6 text-xs text-[#8f8f8f]">
              {liveTelemetry
                ? formatCar({
                  carOrdinal: liveTelemetry.CarOrdinal,
                  carClass: liveTelemetry.CarClass,
                  carPerformanceIndex: liveTelemetry.CarPerformanceIndex,
                  drivetrainType: liveTelemetry.DrivetrainType
                })
                : "No car telemetry"}
            </div>
          </button>
        </div>
      ) : null}

      <div className="grid gap-1">
        <div className="px-3 pb-1 text-xs font-medium text-[#8e8e8e]">Sessions</div>
        {sessions.map(({ session, runs }) => {
          const isExpanded = expandedSessionIds.has(session.id);
          const selectedInside = runs.some((run) => run.id === selectedValue);
          return (
            <div key={session.id} className="grid gap-1">
              <button
                className={cn(
                  "w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/8",
                  selectedInside ? "bg-white/[0.07] text-white" : "text-[#d0d0d0]"
                )}
                type="button"
                onClick={() => toggleSession(session.id)}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <span className="truncate text-sm font-medium">{formatSessionTime(session.startedAt)}</span>
                  </div>
                  <Badge className="h-5 bg-white/8 text-[#bdbdbd]">{runs.length}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-3 pl-6 text-xs text-[#8f8f8f]">
                  <span>{session.packetCount.toLocaleString()} pkt</span>
                  <span>{formatDuration(session)}</span>
                  <span>{session.badPacketCount.toLocaleString()} bad</span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-6 text-xs text-[#8f8f8f]">
                  <Clock size={13} />
                  <span className="truncate">{shortSessionId(session.id)}</span>
                </div>
              </button>

              {isExpanded ? (
                <div className="grid gap-1 pl-4">
                  {runs.map((run, index) => (
                    <RunButton
                      key={run.id}
                      run={run}
                      index={runs.length - index}
                      isSelected={selectedValue === run.id}
                      onSelect={() => onRunChange(run.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}

        {!canSelectLive && sessions.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[#8f8f8f]">No saved sessions yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function RunButton({
  run,
  index,
  isSelected,
  onSelect
}: {
  run: RunSummary;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={cn(
        "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
        isSelected ? "bg-white/10 text-white" : "text-[#d0d0d0]"
      )}
      type="button"
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-sm font-medium">Run {index}</div>
        {isSelected ? <Check size={15} /> : <span className="text-xs text-[#8f8f8f]">{splitReasonLabel(run.splitReason)}</span>}
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[#8f8f8f]">
        <Car size={13} />
        <span className="truncate">{formatCar(run)}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-[#8f8f8f]">
        <span>{run.packetCount.toLocaleString()} pkt</span>
        <span>{formatDuration(run)}</span>
        <span>{run.badPacketCount.toLocaleString()} bad</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-[#8f8f8f]">
        <Clock size={13} />
        <span className="truncate">{shortSessionId(run.id)}</span>
      </div>
    </button>
  );
}

function CollapsedSessions({
  sessions,
  selectedValue,
  canSelectLive,
  onExpand,
  onRunChange
}: {
  sessions: SessionWithRuns[];
  selectedValue: RunSelection | "__none";
  canSelectLive: boolean;
  onExpand: () => void;
  onRunChange: (runId: RunSelection | "__none") => void;
}) {
  const visibleRuns = sessions.flatMap(({ runs }) => runs).slice(0, 10);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        className="size-10 text-[#b6b6b6] hover:bg-white/10 hover:text-white"
        variant="ghost"
        size="icon"
        type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
      >
        <PanelLeftOpen size={17} />
      </Button>
      {canSelectLive ? (
        <button
          className={cn(
            "flex size-10 items-center justify-center rounded-lg transition hover:bg-white/8",
            selectedValue === "live" ? "bg-white/10 text-white" : "text-[#bdbdbd]"
          )}
          type="button"
          onClick={() => onRunChange("live")}
          aria-label="Live telemetry"
        >
          <Radio size={17} />
        </button>
      ) : null}
      {visibleRuns.map((run) => (
        <button
          key={run.id}
          className={cn(
            "flex size-10 items-center justify-center rounded-lg text-xs font-medium transition hover:bg-white/8",
            selectedValue === run.id ? "bg-white/10 text-white" : "text-[#bdbdbd]"
          )}
          type="button"
          onClick={() => onRunChange(run.id)}
          aria-label={`Run ${shortSessionId(run.id)}`}
        >
          {new Date(run.startedAt).getDate()}
        </button>
      ))}
    </div>
  );
}
