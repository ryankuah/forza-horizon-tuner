import * as React from "react";
import { addTelemetryPoint } from "@/features/map/pathSamples";
import type { AppState, PathSample, Telemetry } from "@/types/telemetry";
import { emptyState } from "@/types/telemetry";

const MAX_LIVE_SAMPLES = 8000;

export function useLiveTelemetry() {
  const [state, setState] = React.useState<AppState>(emptyState);
  const [path, setPath] = React.useState<PathSample[]>([]);
  const [samples, setSamples] = React.useState<Telemetry[]>([]);
  const liveSessionIdRef = React.useRef<string | undefined>(undefined);
  const sampleIndexRef = React.useRef(0);

  React.useEffect(() => {
    const handleState = (nextState: AppState) => {
      const sessionChanged = liveSessionIdRef.current && liveSessionIdRef.current !== nextState.sessionId;
      liveSessionIdRef.current = nextState.sessionId;
      if (sessionChanged) sampleIndexRef.current = 0;
      const sampleIndex = sampleIndexRef.current;
      setState(nextState);
      setPath((currentPath) => addTelemetryPoint(sessionChanged ? [] : currentPath, nextState.telemetry, sampleIndex));
      setSamples((currentSamples) => {
        if (!nextState.telemetry) return sessionChanged ? [] : currentSamples;
        const nextSamples = sessionChanged ? [nextState.telemetry] : [...currentSamples, nextState.telemetry];
        return nextSamples.length > MAX_LIVE_SAMPLES
          ? nextSamples.slice(nextSamples.length - MAX_LIVE_SAMPLES)
          : nextSamples;
      });
      if (nextState.telemetry) sampleIndexRef.current += 1;
    };

    window.telemetryApp.getSnapshot().then(handleState).catch(() => undefined);
    return window.telemetryApp.onTelemetryState((_event, nextState) => handleState(nextState));
  }, []);

  return { state, path, setPath, samples, setSamples };
}
