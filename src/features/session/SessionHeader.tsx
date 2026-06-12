import * as React from "react";
import { Car, Check, Clock, History, Menu, Plus, Radio, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  onSessionChange: (sessionId: SessionSelection) => void;
  onNewSession: () => void | Promise<void>;
}) {
  const selectedValue = canSelectLive
    ? selectedSessionId
    : selectedSessionId === "live"
      ? sessions[0]?.id ?? "__none"
      : selectedSessionId;
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  function selectSession(sessionId: SessionSelection) {
    if (sessionId === "__none") return;
    onSessionChange(sessionId);
    setIsOpen(false);
  }

  async function startNewSession() {
    await onNewSession();
    setIsOpen(false);
  }

  return (
    <>
      <Button
        className="fixed left-4 top-4 z-30 size-10 border-border bg-background/90 shadow-sm backdrop-blur md:left-6 md:top-6"
        variant="outline"
        size="icon-lg"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open sessions"
        aria-expanded={isOpen}
      >
        <Menu size={18} />
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-40" role="presentation">
          <button
            className="absolute inset-0 cursor-default bg-background/60 backdrop-blur-[2px]"
            type="button"
            aria-label="Close sessions"
            onClick={() => setIsOpen(false)}
          />

          <aside
            className="absolute left-0 top-0 flex h-full w-full max-w-[390px] flex-col border-r border-border bg-background shadow-xl sm:w-[390px]"
            aria-label="Sessions"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <History size={16} />
                  Sessions
                  {canSelectLive ? <Badge variant="secondary">Live</Badge> : <Badge variant="outline">Saved</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {selectedValue === "live" ? "Viewing live telemetry" : `Viewing ${shortSessionId(selectedValue)}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close sessions"
              >
                <X size={17} />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="grid gap-2">
                {canSelectLive ? (
                  <button
                    className={cn(
                      "grid w-full gap-2 rounded-lg border p-3 text-left transition hover:bg-muted/70",
                      selectedValue === "live" ? "border-foreground bg-muted" : "border-border bg-background"
                    )}
                    type="button"
                    onClick={() => selectSession("live")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Radio size={15} />
                          Live session
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {liveSessionId ? shortSessionId(liveSessionId) : "Waiting for telemetry"}
                        </p>
                      </div>
                      {selectedValue === "live" ? <Check className="mt-0.5 text-foreground" size={16} /> : null}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Car size={14} />
                      <span className="truncate">
                        {liveTelemetry
                          ? formatCar({
                            carOrdinal: liveTelemetry.CarOrdinal,
                            carClass: liveTelemetry.CarClass,
                            carPerformanceIndex: liveTelemetry.CarPerformanceIndex,
                            drivetrainType: liveTelemetry.DrivetrainType
                          })
                          : "Waiting for car telemetry"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold">{(livePackets ?? 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">Packets</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{formatSessionTime(liveLastPacketAt)}</div>
                        <div className="text-muted-foreground">Last packet</div>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold">{(liveBadPackets ?? 0).toLocaleString()}</div>
                        <div className="text-muted-foreground">Bad</div>
                      </div>
                    </div>
                  </button>
                ) : null}

                {sessions.map((session) => {
                  const isSelected = selectedValue === session.id;

                  return (
                    <button
                      key={session.id}
                      className={cn(
                        "grid w-full gap-2 rounded-lg border p-3 text-left transition hover:bg-muted/70",
                        isSelected ? "border-foreground bg-muted" : "border-border bg-background"
                      )}
                      type="button"
                      onClick={() => selectSession(session.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{formatSessionTime(session.startedAt)}</div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{shortSessionId(session.id)}</p>
                        </div>
                        {isSelected ? <Check className="mt-0.5 text-foreground" size={16} /> : null}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Car size={14} />
                        <span className="truncate">{formatCar(session)}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="font-semibold">{session.packetCount.toLocaleString()}</div>
                          <div className="text-muted-foreground">Packets</div>
                        </div>
                        <div>
                          <div className="font-semibold">{formatDuration(session)}</div>
                          <div className="text-muted-foreground">Duration</div>
                        </div>
                        <div>
                          <div className="font-semibold">{session.badPacketCount.toLocaleString()}</div>
                          <div className="text-muted-foreground">Bad</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock size={14} />
                        Last packet {formatSessionTime(session.lastPacketAt)}
                      </div>
                    </button>
                  );
                })}

                {!canSelectLive && sessions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No saved sessions yet.
                  </div>
                ) : null}
              </div>
            </div>

            <Separator />
            <div className="shrink-0 p-3">
              <Button className="h-10 w-full gap-2" type="button" onClick={startNewSession}>
                <Plus size={17} />
                New session
              </Button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
