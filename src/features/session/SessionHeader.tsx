import { Car, Check, Clock, PanelLeftClose, PanelLeftOpen, Plus, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { drivetrainLabel, shortSessionId } from "@/lib/format";
import type { SessionSelection, SessionSummary, Telemetry } from "@/types/telemetry";

function formatSessionTime(value: number | null | undefined) {
  if (!value) return "No packets";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatCar(session: Pick<SessionSummary, "carOrdinal" | "carClass" | "carPerformanceIndex" | "drivetrainType">) {
  const carId = session.carOrdinal === null || session.carOrdinal === undefined ? "Unknown car" : `Car ${session.carOrdinal}`;
  const classLabel = session.carClass === null || session.carClass === undefined ? null : `Class ${session.carClass}`;
  const piLabel = session.carPerformanceIndex === null || session.carPerformanceIndex === undefined ? null : `PI ${session.carPerformanceIndex}`;
  const drivetrain = session.drivetrainType === null || session.drivetrainType === undefined ? null : drivetrainLabel(session.drivetrainType);
  return [carId, classLabel, piLabel, drivetrain].filter(Boolean).join(" / ");
}

function formatDuration(session: SessionSummary) {
  const start = session.startedAt;
  const end = session.endedAt ?? session.lastPacketAt;
  if (!end || end <= start) return "Open";

  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function SessionHeader({
  sessions,
  selectedSessionId,
  canSelectLive,
  liveSessionId,
  liveTelemetry,
  livePackets,
  liveBadPackets,
  liveLastPacketAt,
  isCollapsed,
  onCollapsedChange,
  onSessionChange,
  onNewSession
}: {
  sessions: SessionSummary[];
  selectedSessionId: SessionSelection;
  canSelectLive: boolean;
  liveSessionId?: string;
  liveTelemetry?: Telemetry | null;
  livePackets?: number;
  liveBadPackets?: number;
  liveLastPacketAt?: number | null;
  isCollapsed: boolean;
  onCollapsedChange: (isCollapsed: boolean) => void;
  onSessionChange: (sessionId: SessionSelection) => void;
  onNewSession: () => void | Promise<void>;
}) {
  const selectedValue = canSelectLive
    ? selectedSessionId
    : selectedSessionId === "live"
      ? sessions[0]?.id ?? "__none"
      : selectedSessionId;

  function selectSession(sessionId: SessionSelection) {
    if (sessionId === "__none") return;
    onSessionChange(sessionId);
  }

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-white/10 bg-[#242424] text-[#e7e7e7] transition-[width] duration-200 ease-out",
        isCollapsed ? "w-[68px]" : "w-[292px]"
      )}
      aria-label="Sessions"
    >
      <div className="flex h-[62px] shrink-0 items-center justify-end px-3 [-webkit-app-region:drag]">
        <Button
          className="text-[#b6b6b6] hover:bg-white/10 hover:text-white [-webkit-app-region:no-drag]"
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => onCollapsedChange(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {isCollapsed ? (
          <CollapsedSessions
            sessions={sessions}
            selectedValue={selectedValue}
            canSelectLive={canSelectLive}
            onSessionChange={selectSession}
            onNewSession={onNewSession}
          />
        ) : (
          <ExpandedSessions
            sessions={sessions}
            selectedValue={selectedValue}
            canSelectLive={canSelectLive}
            liveSessionId={liveSessionId}
            liveTelemetry={liveTelemetry}
            livePackets={livePackets}
            liveBadPackets={liveBadPackets}
            liveLastPacketAt={liveLastPacketAt}
            onSessionChange={selectSession}
            onNewSession={onNewSession}
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
  liveTelemetry,
  livePackets,
  liveBadPackets,
  liveLastPacketAt,
  onSessionChange,
  onNewSession
}: {
  sessions: SessionSummary[];
  selectedValue: SessionSelection | "__none";
  canSelectLive: boolean;
  liveSessionId?: string;
  liveTelemetry?: Telemetry | null;
  livePackets?: number;
  liveBadPackets?: number;
  liveLastPacketAt?: number | null;
  onSessionChange: (sessionId: SessionSelection) => void;
  onNewSession: () => void | Promise<void>;
}) {
  return (
    <div className="grid gap-5">
      <div className="px-2">
        <Button className="h-9 w-full justify-start gap-2 bg-white/10 text-[#f2f2f2] hover:bg-white/14" type="button" onClick={onNewSession}>
          <Plus size={16} />
          New session
        </Button>
      </div>

      <div className="grid gap-1">
        <div className="px-3 pb-1 text-xs font-medium text-[#8e8e8e]">Telemetry</div>
        {canSelectLive ? (
          <button
            className={cn(
              "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
              selectedValue === "live" ? "bg-white/10 text-white" : "text-[#d0d0d0]"
            )}
            type="button"
            onClick={() => onSessionChange("live")}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Radio size={15} />
                <span className="truncate">Live session</span>
              </div>
              {selectedValue === "live" ? <Check size={15} /> : <Badge className="h-5 bg-[#4cc38a]/15 text-[#70e0a6]">Live</Badge>}
            </div>
            <div className="mt-1 truncate pl-6 text-xs text-[#8f8f8f]">
              {liveSessionId ? shortSessionId(liveSessionId) : "Waiting for telemetry"}
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
        ) : null}
      </div>

      <div className="grid gap-1">
        <div className="px-3 pb-1 text-xs font-medium text-[#8e8e8e]">Sessions</div>
        {sessions.map((session) => {
          const isSelected = selectedValue === session.id;
          return (
            <button
              key={session.id}
              className={cn(
                "w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/8",
                isSelected ? "bg-white/10 text-white" : "text-[#d0d0d0]"
              )}
              type="button"
              onClick={() => onSessionChange(session.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 truncate text-sm font-medium">{formatSessionTime(session.startedAt)}</div>
                {isSelected ? <Check size={15} /> : null}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[#8f8f8f]">
                <Car size={13} />
                <span className="truncate">{formatCar(session)}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-[#8f8f8f]">
                <span>{session.packetCount.toLocaleString()} pkt</span>
                <span>{formatDuration(session)}</span>
                <span>{session.badPacketCount.toLocaleString()} bad</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[#8f8f8f]">
                <Clock size={13} />
                <span className="truncate">{shortSessionId(session.id)}</span>
              </div>
            </button>
          );
        })}

        {!canSelectLive && sessions.length === 0 ? (
          <div className="px-3 py-2 text-sm text-[#8f8f8f]">No saved sessions yet.</div>
        ) : null}
      </div>
    </div>
  );
}

function CollapsedSessions({
  sessions,
  selectedValue,
  canSelectLive,
  onSessionChange,
  onNewSession
}: {
  sessions: SessionSummary[];
  selectedValue: SessionSelection | "__none";
  canSelectLive: boolean;
  onSessionChange: (sessionId: SessionSelection) => void;
  onNewSession: () => void | Promise<void>;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button className="size-10 bg-white/10 text-[#f2f2f2] hover:bg-white/14" size="icon" type="button" onClick={onNewSession} aria-label="New session">
        <Plus size={17} />
      </Button>
      {canSelectLive ? (
        <button
          className={cn(
            "flex size-10 items-center justify-center rounded-lg transition hover:bg-white/8",
            selectedValue === "live" ? "bg-white/10 text-white" : "text-[#bdbdbd]"
          )}
          type="button"
          onClick={() => onSessionChange("live")}
          aria-label="Live session"
        >
          <Radio size={17} />
        </button>
      ) : null}
      {sessions.slice(0, 10).map((session) => (
        <button
          key={session.id}
          className={cn(
            "flex size-10 items-center justify-center rounded-lg text-xs font-medium transition hover:bg-white/8",
            selectedValue === session.id ? "bg-white/10 text-white" : "text-[#bdbdbd]"
          )}
          type="button"
          onClick={() => onSessionChange(session.id)}
          aria-label={`Session ${shortSessionId(session.id)}`}
        >
          {new Date(session.startedAt).getDate()}
        </button>
      ))}
    </div>
  );
}
