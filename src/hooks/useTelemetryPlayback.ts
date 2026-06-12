import * as React from "react";
import type { PathSample, SessionSelection, Telemetry } from "@/types/telemetry";

const PLAYBACK_FALLBACK_SAMPLE_MS = 16;
const PLAYBACK_MAX_PACKET_GAP_MS = 100;
const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4, 8] as const;

type PlaybackOptions = {
  displayPath: PathSample[];
  samples: Telemetry[];
  selectedSessionId: SessionSelection;
  isSessionStreaming: boolean;
};

export function useTelemetryPlayback({
  displayPath,
  samples,
  selectedSessionId,
  isSessionStreaming
}: PlaybackOptions) {
  const [playheadIndex, setPlayheadIndex] = React.useState<number | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackSpeedIndex, setPlaybackSpeedIndex] = React.useState(2);
  const timeline = React.useMemo(() => buildPlaybackTimeline(samples), [samples]);
  const playbackSpeed = PLAYBACK_SPEEDS[playbackSpeedIndex];
  const playheadPathIndex = React.useMemo(
    () => pathIndexForSampleIndex(displayPath, playheadIndex),
    [displayPath, playheadIndex]
  );

  React.useEffect(() => {
    if (playheadIndex !== null && playheadIndex >= samples.length) setPlayheadIndex(null);
    if (samples.length < 2) setIsPlaying(false);
  }, [playheadIndex, samples.length]);

  React.useEffect(() => {
    setIsPlaying(false);
    setPlayheadIndex(null);
  }, [selectedSessionId]);

  React.useEffect(() => {
    if (selectedSessionId === "live" || playheadIndex !== null || samples.length === 0) return;
    setPlayheadIndex(0);
  }, [selectedSessionId, playheadIndex, samples.length]);

  React.useEffect(() => {
    if (!isPlaying || samples.length < 2) return;

    const startIndex = Math.min(Math.max(playheadIndex ?? 0, 0), samples.length - 1);
    const startTime = timeline[startIndex] ?? 0;
    let startedAt = performance.now();
    let frame = 0;

    function tick(now: number) {
      const targetTime = startTime + (now - startedAt) * playbackSpeed;
      const nextIndex = playbackIndexForTime(timeline, targetTime, startIndex);
      setPlayheadIndex(nextIndex);

      if (nextIndex >= samples.length - 1) {
        if (isSessionStreaming && selectedSessionId !== "live") {
          const bufferedEndTime = timeline[timeline.length - 1] ?? startTime;
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
  }, [isPlaying, samples.length, timeline, playbackSpeed, isSessionStreaming, selectedSessionId, playheadIndex]);

  function resetPlayback() {
    setIsPlaying(false);
    setPlayheadIndex(null);
  }

  function scrubPathIndex(index: number | null) {
    const sampleIndex = index === null ? null : displayPath[index]?.sampleIndex ?? null;
    if (sampleIndex === null) return;
    setIsPlaying(false);
    setPlayheadIndex(Math.min(sampleIndex, Math.max(samples.length - 1, 0)));
  }

  function togglePlayback() {
    if (samples.length < 2) return;

    setPlayheadIndex((currentIndex) => {
      if (isPlaying) return currentIndex;
      if (currentIndex === null || currentIndex >= samples.length - 1) return 0;
      return currentIndex;
    });
    setIsPlaying((current) => !current);
  }

  return {
    canDecreasePlaybackSpeed: playbackSpeedIndex > 0,
    canIncreasePlaybackSpeed: playbackSpeedIndex < PLAYBACK_SPEEDS.length - 1,
    canPlayTelemetry: samples.length > 1,
    isPlaying,
    playbackLabel: formatPlaybackLabel(timeline, playheadIndex),
    playbackSpeed,
    playheadIndex,
    playheadPathIndex,
    resetPlayback,
    scrubPathIndex,
    setIsPlaying,
    togglePlayback,
    decreasePlaybackSpeed: () => setPlaybackSpeedIndex((current) => Math.max(0, current - 1)),
    increasePlaybackSpeed: () => setPlaybackSpeedIndex((current) => Math.min(PLAYBACK_SPEEDS.length - 1, current + 1))
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
