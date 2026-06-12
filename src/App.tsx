import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveInputsPanel } from "@/features/inputs/LiveInputsPanel";
import { buildPathFromTelemetry } from "@/features/map/pathSamples";
import { TrackMapPanel } from "@/features/map/TrackMapPanel";
import { TelemetrySidePanel } from "@/features/dashboard/telemetryVisuals";
import { SessionHeader } from "@/features/session/SessionHeader";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSessions } from "@/hooks/useSessions";
import type { AppState, RightPanelTab, SessionSelection, SessionDetail, Telemetry } from "@/types/telemetry";

const PLAYBACK_FALLBACK_SAMPLE_MS = 16;
const PLAYBACK_MAX_PACKET_GAP_MS = 100;
const EMPTY_TELEMETRY_SAMPLES: Telemetry[] = [];
const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;

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

function sampleDeltaMs(samples: Telemetry[], index: number) {
  if (index <= 0) return 0;

  const sample = samples[index];
  const previous = samples[index - 1];
  if (!sample || !previous) return PLAYBACK_FALLBACK_SAMPLE_MS;

  const receivedDelta = sample.receivedAt !== undefined && previous.receivedAt !== undefined
    ? sample.receivedAt - previous.receivedAt
    : NaN;
  const timestampDelta = sample.TimestampMS - previous.TimestampMS;
  const delta = Number.isFinite(receivedDelta) && receivedDelta > 0
    ? receivedDelta
    : timestampDelta;

  if (!Number.isFinite(delta) || delta <= 0) return PLAYBACK_FALLBACK_SAMPLE_MS;
  return Math.min(delta, PLAYBACK_MAX_PACKET_GAP_MS);
}

function buildPlaybackTimeline(samples: Telemetry[]) {
  const timeline = new Array<number>(samples.length);
  let currentTime = 0;

  for (let index = 0; index < samples.length; index += 1) {
    if (index > 0) currentTime += sampleDeltaMs(samples, index);
    timeline[index] = currentTime;
  }

  return timeline;
}

function playbackIndexForTime(timeline: number[], targetTime: number, startIndex: number) {
  let low = Math.max(0, startIndex);
  let high = timeline.length - 1;
  let result = high;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if ((timeline[mid] ?? 0) >= targetTime) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return result;
}

function formatPlaybackLabel(timeline: number[], index: number | null) {
  if (timeline.length < 2) return "0:00 / 0:00";

  const currentIndex = Math.min(Math.max(index ?? 0, 0), timeline.length - 1);
  const totalMs = timeline[timeline.length - 1] ?? 0;
  const currentMs = timeline[currentIndex] ?? 0;

  return `${formatPlaybackTime(currentMs)} / ${formatPlaybackTime(totalMs)}`;
}

function formatPlaybackTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function pathIndexForSampleIndex(path: { sampleIndex: number }[], sampleIndex: number | null) {
  if (sampleIndex === null || path.length === 0) return null;

  let low = 0;
  let high = path.length - 1;
  let result = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (path[mid].sampleIndex <= sampleIndex) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}

function sampleAtIndex(samples: Telemetry[], index: number | null, fallback?: Telemetry | null) {
  if (index === null) return fallback ?? null;
  return samples[index] ?? fallback ?? null;
}

export function App() {
  const { state, path, setPath, samples, setSamples } = useLiveTelemetry();
  const { sessions, selectedSessionId, setSelectedSessionId, sessionDetail, isSessionStreaming, startNewSession } = useSessions();
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [playheadIndex, setPlayheadIndex] = React.useState<number | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = React.useState(2);
  const [rightPanelTab, setRightPanelTab] = React.useState<RightPanelTab>("car");

  React.useEffect(() => {
    if (state.connected || selectedSessionId !== "live") return;
    if (sessions[0]) setSelectedSessionId(sessions[0].id);
  }, [selectedSessionId, sessions, state.connected, setSelectedSessionId]);

  const historicalPath = React.useMemo(() => buildPathFromTelemetry(sessionDetail?.samples ?? []), [sessionDetail]);
  const displayPath = selectedSessionId === "live" ? path : historicalPath;
  const displaySamples = selectedSessionId === "live" ? samples : sessionDetail?.samples ?? EMPTY_TELEMETRY_SAMPLES;
  const playbackSamples = displaySamples;
  const playbackTimeline = React.useMemo(() => buildPlaybackTimeline(playbackSamples), [playbackSamples]);
  const playbackSpeed = PLAYBACK_SPEEDS[playbackSpeedIndex];
  const playheadPathIndex = React.useMemo(
    () => pathIndexForSampleIndex(displayPath, playheadIndex),
    [displayPath, playheadIndex]
  );

  React.useEffect(() => {
    if (hoverIndex !== null && hoverIndex >= displayPath.length) setHoverIndex(null);
    if (playheadIndex !== null && playheadIndex >= playbackSamples.length) setPlayheadIndex(null);
    if (playbackSamples.length < 2) setIsPlaying(false);
  }, [displayPath.length, hoverIndex, playheadIndex, playbackSamples.length]);

  React.useEffect(() => {
    setIsPlaying(false);
    setPlayheadIndex(null);
  }, [selectedSessionId]);

  React.useEffect(() => {
    if (selectedSessionId === "live" || playheadIndex !== null || playbackSamples.length === 0) return;
    setPlayheadIndex(0);
  }, [selectedSessionId, playheadIndex, playbackSamples.length]);

  React.useEffect(() => {
    if (!isPlaying || playbackSamples.length < 2) return;

    const startIndex = Math.min(Math.max(playheadIndex ?? 0, 0), playbackSamples.length - 1);
    const startTime = playbackTimeline[startIndex] ?? 0;
    let startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const targetTime = startTime + (now - startedAt) * playbackSpeed;
      const nextIndex = playbackIndexForTime(playbackTimeline, targetTime, startIndex);
      setPlayheadIndex(nextIndex);

      if (nextIndex >= playbackSamples.length - 1) {
        if (isSessionStreaming && selectedSessionId !== "live") {
          const bufferedEndTime = playbackTimeline[playbackTimeline.length - 1] ?? startTime;
          startedAt = now - ((bufferedEndTime - startTime) / playbackSpeed);
          frame = window.requestAnimationFrame(tick);
          return;
        }

        setIsPlaying(false);
        return;
      }

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [isPlaying, playbackSamples.length, playbackTimeline, playbackSpeed, isSessionStreaming, selectedSessionId]);

  const latestPathSample = displayPath[displayPath.length - 1] ?? null;
  const hoverPathSample = hoverIndex === null ? null : displayPath[hoverIndex];
  const hoverSample = sampleAtIndex(playbackSamples, hoverPathSample?.sampleIndex ?? null, hoverPathSample?.telemetry);
  const playheadSample = sampleAtIndex(playbackSamples, playheadIndex);
  const telemetry = hoverSample
    ?? playheadSample
    ?? latestPathSample?.telemetry
    ?? (selectedSessionId === "live" ? state.telemetry : sessionDetail?.samples.at(-1) ?? null);
  const displayState = selectedSessionId === "live" ? state : buildHistoricalState(state, sessionDetail, telemetry);
  const canPlayTelemetry = playbackSamples.length > 1;
  const playbackLabel = formatPlaybackLabel(playbackTimeline, playheadIndex);

  function handleSessionChange(sessionId: SessionSelection) {
    setSelectedSessionId(sessionId);
    setHoverIndex(null);
    setPlayheadIndex(null);
    setIsPlaying(false);
  }

  async function handleNewSession() {
    await startNewSession();
    setHoverIndex(null);
    setPlayheadIndex(null);
    setIsPlaying(false);
    setPath([]);
    setSamples([]);
  }

  function handleScrubPathIndex(index: number | null) {
    const sampleIndex = index === null ? null : displayPath[index]?.sampleIndex ?? null;
    if (sampleIndex === null) return;
    setIsPlaying(false);
    setPlayheadIndex(Math.min(sampleIndex, Math.max(playbackSamples.length - 1, 0)));
  }

  function handleTogglePlayback() {
    if (!canPlayTelemetry) return;

    setHoverIndex(null);
    setPlayheadIndex((currentIndex) => {
      if (isPlaying) return currentIndex;
      if (currentIndex === null || currentIndex >= playbackSamples.length - 1) return 0;
      return currentIndex;
    });
    setIsPlaying((current) => !current);
  }

  function handleDecreasePlaybackSpeed() {
    setPlaybackSpeedIndex((current) => Math.max(0, current - 1));
  }

  function handleIncreasePlaybackSpeed() {
    setPlaybackSpeedIndex((current) => Math.min(PLAYBACK_SPEEDS.length - 1, current + 1));
  }

  return (
    <TooltipProvider>
      <main
        className="flex h-screen flex-col gap-4 overflow-hidden bg-background p-4 text-foreground md:p-6"
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
          onSessionChange={handleSessionChange}
          onNewSession={handleNewSession}
        />

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
          <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,7fr)_minmax(190px,3fr)] gap-4">
            <TrackMapPanel
              path={displayPath}
              hoverIndex={hoverIndex}
              playheadPathIndex={playheadPathIndex}
              playheadTelemetry={playheadSample}
              isPlaying={isPlaying}
              canPlayTelemetry={canPlayTelemetry}
              playbackLabel={playbackLabel}
              playbackSpeed={playbackSpeed}
              canDecreasePlaybackSpeed={playbackSpeedIndex > 0}
              canIncreasePlaybackSpeed={playbackSpeedIndex < PLAYBACK_SPEEDS.length - 1}
              onHoverIndex={setHoverIndex}
              onScrubPathIndex={handleScrubPathIndex}
              onTogglePlayback={handleTogglePlayback}
              onDecreasePlaybackSpeed={handleDecreasePlaybackSpeed}
              onIncreasePlaybackSpeed={handleIncreasePlaybackSpeed}
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
    </TooltipProvider>
  );
}
