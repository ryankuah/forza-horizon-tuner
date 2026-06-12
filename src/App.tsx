import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveInputsPanel } from "@/features/inputs/LiveInputsPanel";
import { buildPathFromTelemetry } from "@/features/map/pathSamples";
import { TrackMapPanel } from "@/features/map/TrackMapPanel";
import { TelemetrySidePanel } from "@/features/dashboard/telemetryVisuals";
import { SessionHeader } from "@/features/session/SessionHeader";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSessions } from "@/hooks/useSessions";
import { useTelemetryPlayback } from "@/hooks/useTelemetryPlayback";
import type { AppState, RightPanelTab, SessionSelection, SessionDetail, Telemetry } from "@/types/telemetry";

const EMPTY_TELEMETRY_SAMPLES: Telemetry[] = [];

function buildHistoricalState(liveState: AppState, detail: SessionDetail | null, telemetry: Telemetry | null): AppState {
  const session = detail?.session;
  return {
    ...liveState,
    connected: false,
    packets: session?.packetCount ?? 0,
    badPackets: session?.badPacketCount ?? 0,
    lastPacketAt: session?.lastPacketAt ?? null,
    lastSource: session?.lastSource ?? "stored session",
    telemetry,
    summary: detail?.summary ?? null,
    sessionId: session?.id
  };
}

function sampleAtIndex(samples: Telemetry[], index: number | null, fallback?: Telemetry | null) {
  if (index === null) return fallback ?? null;
  return samples[index] ?? fallback ?? null;
}

export function App() {
  const { state, path, setPath, samples, setSamples } = useLiveTelemetry();
  const { sessions, selectedSessionId, setSelectedSessionId, sessionDetail, isSessionStreaming, startNewSession } = useSessions();
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [rightPanelTab, setRightPanelTab] = React.useState<RightPanelTab>("car");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (state.connected || selectedSessionId !== "live") return;
    if (sessions[0]) setSelectedSessionId(sessions[0].id);
  }, [selectedSessionId, sessions, state.connected, setSelectedSessionId]);

  const historicalPath = React.useMemo(() => buildPathFromTelemetry(sessionDetail?.samples ?? []), [sessionDetail]);
  const displayPath = selectedSessionId === "live" ? path : historicalPath;
  const displaySamples = selectedSessionId === "live" ? samples : sessionDetail?.samples ?? EMPTY_TELEMETRY_SAMPLES;
  const playback = useTelemetryPlayback({
    displayPath,
    samples: displaySamples,
    selectedSessionId,
    isSessionStreaming
  });

  React.useEffect(() => {
    if (hoverIndex !== null && hoverIndex >= displayPath.length) setHoverIndex(null);
  }, [displayPath.length, hoverIndex]);

  const latestPathSample = displayPath[displayPath.length - 1] ?? null;
  const hoverPathSample = hoverIndex === null ? null : displayPath[hoverIndex];
  const hoverSample = sampleAtIndex(displaySamples, hoverPathSample?.sampleIndex ?? null, hoverPathSample?.telemetry);
  const playheadSample = sampleAtIndex(displaySamples, playback.playheadIndex);
  const telemetry = hoverSample
    ?? playheadSample
    ?? latestPathSample?.telemetry
    ?? (selectedSessionId === "live" ? state.telemetry : sessionDetail?.samples.at(-1) ?? null);
  const displayState = selectedSessionId === "live" ? state : buildHistoricalState(state, sessionDetail, telemetry);
  const selectedSessionLabel = selectedSessionId === "live"
    ? "Live telemetry"
    : sessionDetail?.session
      ? `Session ${new Date(sessionDetail.session.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
      : "Saved session";

  function handleSessionChange(sessionId: SessionSelection) {
    setSelectedSessionId(sessionId);
    setHoverIndex(null);
    playback.resetPlayback();
  }

  async function handleNewSession() {
    await startNewSession();
    setHoverIndex(null);
    playback.resetPlayback();
    setPath([]);
    setSamples([]);
  }

  function handleScrubPathIndex(index: number | null) {
    setHoverIndex(null);
    playback.scrubPathIndex(index);
  }

  return (
    <TooltipProvider>
      <div
        className="flex h-screen overflow-hidden bg-[#171717] text-foreground"
        onPointerMove={(event) => {
          if (!(event.target as Element).closest("[data-path-surface]")) setHoverIndex(null);
        }}
      >
        <SessionHeader
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          canSelectLive={displayState.connected}
          liveSessionId={displayState.sessionId}
          liveTelemetry={state.telemetry}
          livePackets={state.packets}
          liveBadPackets={state.badPackets}
          liveLastPacketAt={state.lastPacketAt}
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          onSessionChange={handleSessionChange}
          onNewSession={handleNewSession}
        />

        <main className="flex min-w-0 flex-1 flex-col bg-[#171717]">
          <header className="flex h-[62px] shrink-0 items-center justify-between border-b border-white/10 px-6 [-webkit-app-region:drag]">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium text-[#ededed]">{selectedSessionLabel}</div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[#8f8f8f]">
                <span>{displayState.connected ? "Connected" : "Idle"}</span>
                <span className="text-[#555]">/</span>
                <span>{displayState.packets.toLocaleString()} packets</span>
                <span className="text-[#555]">/</span>
                <span>UDP {displayState.udpPort}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#8f8f8f]">
              <span>{displayState.sessionId ? displayState.sessionId.slice(0, 8) : "No session"}</span>
            </div>
          </header>

          <section className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-2">
            <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,7fr)_minmax(190px,3fr)] gap-4">
              <TrackMapPanel
                path={displayPath}
                hoverIndex={hoverIndex}
                playheadPathIndex={playback.playheadPathIndex}
                playheadTelemetry={playheadSample}
                isPlaying={playback.isPlaying}
                canPlayTelemetry={playback.canPlayTelemetry}
                playbackLabel={playback.playbackLabel}
                playbackSpeed={playback.playbackSpeed}
                canDecreasePlaybackSpeed={playback.canDecreasePlaybackSpeed}
                canIncreasePlaybackSpeed={playback.canIncreasePlaybackSpeed}
                onHoverIndex={setHoverIndex}
                onScrubPathIndex={handleScrubPathIndex}
                onTogglePlayback={playback.togglePlayback}
                onDecreasePlaybackSpeed={playback.decreasePlaybackSpeed}
                onIncreasePlaybackSpeed={playback.increasePlaybackSpeed}
              />
              <LiveInputsPanel telemetry={telemetry} samples={displaySamples} />
            </section>

            <TelemetrySidePanel
              activeTab={rightPanelTab}
              onTabChange={setRightPanelTab}
              telemetry={telemetry}
              samples={displaySamples}
              state={displayState}
            />
          </section>
        </main>
      </div>
    </TooltipProvider>
  );
}
