import * as React from "react";
import { addTelemetryPoint } from "@/features/map/pathSamples";
import type { AppState, PathSample, Telemetry } from "@/types/telemetry";
import { emptyState } from "@/types/telemetry";

const MAX_LIVE_SAMPLES = 8000;

export function useLiveTelemetry() {
  const [state, setState] = React.useState<AppState>(emptyState);
  const [path, setPath] = React.useState<PathSample[]>([]);
  const [samples, setSamples] = React.useState<Telemetry[]>([]);
  const liveRunIdRef = React.useRef<string | undefined>(undefined);
  const sampleIndexRef = React.useRef(0);
  const lastPacketAtRef = React.useRef<number | null | undefined>(undefined);

  const handleState = React.useCallback((nextState: AppState) => {
    const runChanged = liveRunIdRef.current && liveRunIdRef.current !== nextState.runId;
    liveRunIdRef.current = nextState.runId;
    if (runChanged) sampleIndexRef.current = 0;
    const sampleIndex = sampleIndexRef.current;
    const hasNewTelemetry = Boolean(nextState.telemetry && (runChanged || lastPacketAtRef.current !== nextState.lastPacketAt));
    setState(nextState);
    setPath((currentPath) => {
      if (runChanged) return hasNewTelemetry ? addTelemetryPoint([], nextState.telemetry, sampleIndex) : [];
      return hasNewTelemetry ? addTelemetryPoint(currentPath, nextState.telemetry, sampleIndex) : currentPath;
    });
    setSamples((currentSamples) => {
      if (!hasNewTelemetry || !nextState.telemetry) return runChanged ? [] : currentSamples;
      const nextSamples = runChanged ? [nextState.telemetry] : [...currentSamples, nextState.telemetry];
      return nextSamples.length > MAX_LIVE_SAMPLES
        ? nextSamples.slice(nextSamples.length - MAX_LIVE_SAMPLES)
        : nextSamples;
    });
    if (hasNewTelemetry) sampleIndexRef.current += 1;
    lastPacketAtRef.current = nextState.lastPacketAt;
  }, []);

  React.useEffect(() => {
    window.telemetryApp.getSnapshot().then(handleState).catch(() => undefined);
    return window.telemetryApp.onTelemetryState((_event, nextState) => handleState(nextState));
  }, [handleState]);

  return { state, path, setPath, samples, setSamples, handleState };
}
