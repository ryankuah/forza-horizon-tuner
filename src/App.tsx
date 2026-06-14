import * as React from "react";
import { Check, CheckCircle2, Gamepad2, Gauge, Milestone, MonitorDot, Radio, Route, Settings2, Wifi } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveInputsPanel } from "@/features/inputs/LiveInputsPanel";
import { TrackMapPanel } from "@/features/map/TrackMapPanel";
import { TelemetrySidePanel } from "@/features/dashboard/telemetryVisuals";
import { CornerPanel } from "@/features/dashboard/TuningBehaviorPanel";
import { StraightsPanel } from "@/features/analysis/StraightsPanel";
import { CarCatalogPage } from "@/features/cars/CarCatalogPage";
import { RunSidebar } from "@/features/runs/RunSidebar";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useRuns } from "@/hooks/useRuns";
import { useTelemetryPlayback } from "@/hooks/useTelemetryPlayback";
import { cn } from "@/lib/utils";
import { fetchRunDetail, queryCars } from "@/services/api";
import type { AppState, CarCatalogItem, CarSessionSummary, DashboardTab, RunDetail, RunSelection, RunSummary, RunTelemetrySet, Telemetry } from "@/types/telemetry";

const EMPTY_TELEMETRY_SAMPLES: Telemetry[] = [];

function buildHistoricalState(liveState: AppState, detail: RunDetail | null, telemetry: Telemetry | null): AppState {
  const run = detail?.run;
  return {
    ...liveState,
    connected: false,
    packets: run?.packetCount ?? 0,
    badPackets: run?.badPacketCount ?? 0,
    lastPacketAt: run?.lastPacketAt ?? null,
    lastSource: run?.lastSource ?? "stored run",
    telemetry,
    summary: detail?.summary ?? null,
    runId: run?.id
  };
}

function sampleAtIndex(samples: Telemetry[], index: number | null, fallback?: Telemetry | null) {
  if (index === null) return fallback ?? null;
  return samples[index] ?? fallback ?? null;
}

function sampleAtAbsoluteIndex(samples: Telemetry[], index: number | null, offset: number, fallback?: Telemetry | null) {
  if (index === null) return fallback ?? null;
  return samples[index - offset] ?? fallback ?? null;
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

function findSessionByRunId(carSessions: CarSessionSummary[], runId: string) {
  return carSessions.find((session) => session.runs.some((run) => run.id === runId)) ?? null;
}

function formatSessionCar(
  session: Pick<CarSessionSummary, "carOrdinal" | "carClass" | "carPerformanceIndex" | "drivetrainType"> | null,
  carCatalogByOrdinal: Map<number, CarCatalogItem>
) {
  if (!session) return "Saved telemetry";
  const catalogCar = session.carOrdinal === null || session.carOrdinal === undefined
    ? null
    : carCatalogByOrdinal.get(session.carOrdinal) ?? null;
  const carName = catalogCar?.carName ?? "Unknown car";
  const className = carClassLabel(session.carClass) ?? catalogCar?.carClass ?? null;
  const classLabel = className && session.carPerformanceIndex !== null && session.carPerformanceIndex !== undefined
    ? `${className} ${session.carPerformanceIndex}`
    : className;
  return [carName, classLabel].filter(Boolean).join(" / ");
}

function runLabel(run: RunSummary, sessionRuns: RunSummary[]) {
  const index = sessionRuns.findIndex((item) => item.id === run.id);
  const ordinal = index === -1 ? sessionRuns.length : sessionRuns.length - index;
  return `Run ${ordinal}`;
}

export function App() {
  const { state, path, samples, handleState } = useLiveTelemetry();
  const { carSessions, selectedRunId, setSelectedRunId, runDetail, isRunStreaming } = useRuns();
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [graphHoverIndex, setGraphHoverIndex] = React.useState<number | null>(null);
  const [dashboardTab, setDashboardTab] = React.useState<DashboardTab>("car");
  const [carTelemetryView, setCarTelemetryView] = React.useState<"live" | "graph">("live");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isTogglingUdpListening, setIsTogglingUdpListening] = React.useState(false);
  const [activePage, setActivePage] = React.useState<"runs" | "cars">("runs");
  const [carCatalog, setCarCatalog] = React.useState<CarCatalogItem[]>([]);
  const [selectedCarSessionId, setSelectedCarSessionId] = React.useState<string | null>(null);
  const [enabledRunIds, setEnabledRunIds] = React.useState<Set<string>>(() => new Set());
  const [hasCustomRunFilter, setHasCustomRunFilter] = React.useState(false);
  const [analysisRunDetails, setAnalysisRunDetails] = React.useState<RunDetail[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadCarCatalog() {
      const result = await queryCars({ sortBy: "make", sortDirection: "asc" });
      if (!cancelled) setCarCatalog(result.cars);
    }

    void loadCarCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (state.connected || selectedRunId !== "live") return;
    if (state.telemetry || state.packets > 0 || state.lastPacketAt) return;
    const latestSession = carSessions[0];
    const latestRun = latestSession?.runs[0];
    if (latestSession && latestRun) {
      setSelectedCarSessionId(latestSession.id);
      setEnabledRunIds(new Set(latestSession.runs.map((run) => run.id)));
      setHasCustomRunFilter(false);
      setSelectedRunId(latestRun.id);
    }
  }, [selectedRunId, carSessions, state.connected, state.lastPacketAt, state.packets, state.telemetry, setSelectedRunId]);

  const sampleOffset = selectedRunId === "live" ? 0 : runDetail?.sampleWindow.start ?? 0;
  const historicalPath = runDetail?.path ?? [];
  const displayPath = selectedRunId === "live" ? path : historicalPath;
  const displaySamples = selectedRunId === "live" ? samples : runDetail?.samples ?? EMPTY_TELEMETRY_SAMPLES;
  const playback = useTelemetryPlayback({
    displayPath,
    samples: displaySamples,
    sampleOffset,
    selectedRunId,
    isRunStreaming
  });

  React.useEffect(() => {
    if (hoverIndex !== null && hoverIndex >= displayPath.length) setHoverIndex(null);
  }, [displayPath.length, hoverIndex]);

  const latestPathSample = displayPath[displayPath.length - 1] ?? null;
  const hoverPathSample = hoverIndex === null ? null : displayPath[hoverIndex];
  const hoverSample = selectedRunId === "live"
    ? sampleAtIndex(displaySamples, hoverPathSample?.sampleIndex ?? null, hoverPathSample?.telemetry)
    : sampleAtAbsoluteIndex(displaySamples, hoverPathSample?.sampleIndex ?? null, sampleOffset, hoverPathSample?.telemetry);
  const playheadSample = selectedRunId === "live"
    ? sampleAtIndex(displaySamples, playback.playheadIndex)
    : sampleAtAbsoluteIndex(displaySamples, playback.playheadIndex, sampleOffset);
  const graphHoverSample = selectedRunId === "live"
    ? sampleAtIndex(displaySamples, graphHoverIndex)
    : sampleAtAbsoluteIndex(displaySamples, graphHoverIndex, sampleOffset);
  const currentSampleIndex = playback.playheadIndex ?? latestPathSample?.sampleIndex ?? (displaySamples.length ? displaySamples.length - 1 : null);
  const telemetry = hoverSample
    ?? graphHoverSample
    ?? playheadSample
    ?? latestPathSample?.telemetry
    ?? (selectedRunId === "live" ? state.telemetry : runDetail?.samples.at(-1) ?? null);
  const displayState = selectedRunId === "live" ? state : buildHistoricalState(state, runDetail, telemetry);
  const carCatalogByOrdinal = React.useMemo(() => {
    const carsByOrdinal = new Map<number, CarCatalogItem>();
    for (const car of carCatalog) {
      if (car.carOrdinal !== null) carsByOrdinal.set(car.carOrdinal, car);
    }
    return carsByOrdinal;
  }, [carCatalog]);
  const selectedCarSession = React.useMemo(() => {
    if (selectedRunId === "live") return null;
    return selectedCarSessionId
      ? carSessions.find((session) => session.id === selectedCarSessionId) ?? findSessionByRunId(carSessions, selectedRunId)
      : findSessionByRunId(carSessions, selectedRunId);
  }, [selectedCarSessionId, selectedRunId, carSessions]);
  const allSessionRunIds = React.useMemo(
    () => new Set(selectedCarSession?.runs.map((run) => run.id) ?? []),
    [selectedCarSession]
  );
  const effectiveEnabledRunIds = hasCustomRunFilter ? enabledRunIds : allSessionRunIds;
  const enabledSessionRuns = React.useMemo(() => {
    if (!selectedCarSession) return [];
    return selectedCarSession.runs.filter((run) => effectiveEnabledRunIds.has(run.id));
  }, [effectiveEnabledRunIds, selectedCarSession]);
  const analysisRunIds = React.useMemo(
    () => selectedRunId === "live" ? [] : enabledSessionRuns.map((run) => run.id),
    [enabledSessionRuns, selectedRunId]
  );
  const analysisRunIdsKey = analysisRunIds.join("|");
  const analysisSampleSets = React.useMemo<RunTelemetrySet[]>(() => {
    if (!selectedCarSession) return [];
    return analysisRunDetails.map((detail) => ({
      runId: detail.run.id,
      label: runLabel(detail.run, selectedCarSession.runs),
      samples: detail.samples
    }));
  }, [analysisRunDetails, selectedCarSession]);
  const selectedSessionLabel = formatSessionCar(selectedCarSession, carCatalogByOrdinal);
  const selectedRunLabel = selectedRunId === "live"
    ? "Live telemetry"
    : runDetail?.run
      ? `Run ${new Date(runDetail.run.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
      : "Saved run";
  const shouldShowFirstRunSetup = selectedRunId === "live"
    && !state.connected
    && !state.telemetry
    && carSessions.length === 0;

  React.useEffect(() => {
    if (selectedRunId === "live") {
      if (selectedCarSessionId !== null) setSelectedCarSessionId(null);
      return;
    }

    const session = selectedCarSession;
    if (!session) return;

    if (selectedCarSessionId !== session.id) setSelectedCarSessionId(session.id);

    const sessionRunIds = new Set(session.runs.map((run) => run.id));
    if (!sessionRunIds.has(selectedRunId)) {
      const fallbackRun = session.runs.find((run) => effectiveEnabledRunIds.has(run.id)) ?? session.runs[0];
      if (fallbackRun) setSelectedRunId(fallbackRun.id);
    }

    if (!hasCustomRunFilter) return;

    setEnabledRunIds((current) => {
      const next = new Set(Array.from(current).filter((runId) => sessionRunIds.has(runId)));
      return next.size > 0 ? next : sessionRunIds;
    });
  }, [effectiveEnabledRunIds, hasCustomRunFilter, selectedCarSession, selectedCarSessionId, selectedRunId, setSelectedRunId]);

  React.useEffect(() => {
    if (selectedRunId === "live" || analysisRunIds.length === 0) {
      setAnalysisRunDetails([]);
      setIsAnalysisLoading(false);
      return;
    }

    let cancelled = false;
    setIsAnalysisLoading(true);

    Promise.all(analysisRunIds.map(async (runId) => {
      if (runDetail?.run.id === runId) return runDetail;
      return fetchRunDetail(runId);
    }))
      .then((details) => {
        if (cancelled) return;
        const detailsById = new Map(
          details
            .filter((detail): detail is RunDetail => Boolean(detail))
            .map((detail) => [detail.run.id, detail])
        );
        setAnalysisRunDetails(analysisRunIds.map((runId) => detailsById.get(runId)).filter((detail): detail is RunDetail => Boolean(detail)));
      })
      .catch((error) => {
        console.warn(`Session run load failed: ${error instanceof Error ? error.message : String(error)}`);
        if (!cancelled) setAnalysisRunDetails([]);
      })
      .finally(() => {
        if (!cancelled) setIsAnalysisLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [analysisRunIds, analysisRunIdsKey, runDetail, selectedRunId]);

  function handleRunChange(runId: RunSelection) {
    if (runId === "live") {
      setSelectedCarSessionId(null);
      setEnabledRunIds(new Set());
      setHasCustomRunFilter(false);
    } else {
      const session = findSessionByRunId(carSessions, runId);
      if (session) {
        const isSameSession = selectedCarSessionId === session.id;
        setSelectedCarSessionId(session.id);
        if (!isSameSession) {
          setEnabledRunIds(new Set(session.runs.map((run) => run.id)));
          setHasCustomRunFilter(false);
        } else if (hasCustomRunFilter && !enabledRunIds.has(runId)) {
          setEnabledRunIds((current) => new Set([...current, runId]));
        }
      }
    }
    setSelectedRunId(runId);
    setActivePage("runs");
    setHoverIndex(null);
    setGraphHoverIndex(null);
    playback.resetPlayback();
  }

  function handleCarSessionChange(sessionId: string) {
    const session = carSessions.find((item) => item.id === sessionId);
    const firstRun = session?.runs[0];
    if (!session || !firstRun) return;

    setSelectedCarSessionId(session.id);
    setEnabledRunIds(new Set(session.runs.map((run) => run.id)));
    setHasCustomRunFilter(false);
    setSelectedRunId(firstRun.id);
    setActivePage("runs");
    setHoverIndex(null);
    setGraphHoverIndex(null);
    playback.resetPlayback();
  }

  function handleRunToggle(runId: string) {
    if (!selectedCarSession) return;

    const sessionRunIds = selectedCarSession.runs.map((run) => run.id);
    const nextEnabled = hasCustomRunFilter
      ? new Set(enabledRunIds)
      : new Set(sessionRunIds);

    if (nextEnabled.has(runId)) {
      if (nextEnabled.size <= 1) return;
      nextEnabled.delete(runId);
    } else {
      nextEnabled.add(runId);
    }

    const allEnabled = sessionRunIds.every((id) => nextEnabled.has(id));
    setEnabledRunIds(nextEnabled);
    setHasCustomRunFilter(!allEnabled);

    if (selectedRunId !== "live" && !nextEnabled.has(selectedRunId)) {
      const fallbackRun = selectedCarSession.runs.find((run) => nextEnabled.has(run.id));
      if (fallbackRun) {
        setSelectedRunId(fallbackRun.id);
        setHoverIndex(null);
        setGraphHoverIndex(null);
        playback.resetPlayback();
      }
    }
  }

  function handleScrubPathIndex(index: number | null) {
    setHoverIndex(null);
    setGraphHoverIndex(null);
    playback.scrubPathIndex(index);
  }

  async function handleToggleUdpListening() {
    setIsTogglingUdpListening(true);
    try {
      handleState(await window.telemetryApp.setUdpListening(!state.udpListening));
    } finally {
      setIsTogglingUdpListening(false);
    }
  }

  return (
    <TooltipProvider>
      <div
        className="flex h-screen overflow-hidden bg-[#171717] text-foreground"
        onPointerMove={(event) => {
          if (!(event.target as Element).closest("[data-path-surface]")) setHoverIndex(null);
        }}
      >
        <RunSidebar
          carSessions={carSessions}
          carCatalogByOrdinal={carCatalogByOrdinal}
          activePage={activePage}
          selectedRunId={selectedRunId}
          selectedCarSessionId={selectedCarSessionId}
          enabledRunIds={effectiveEnabledRunIds}
          hasCustomRunFilter={hasCustomRunFilter}
          canSelectLive={state.connected}
          liveRunId={state.runId}
          liveTelemetry={state.telemetry}
          livePackets={state.packets}
          liveBadPackets={state.badPackets}
          liveLastPacketAt={state.lastPacketAt}
          statusLabel={selectedRunLabel}
          statusConnected={displayState.connected}
          statusPackets={displayState.packets}
          statusUdpPort={displayState.udpPort}
          udpListening={state.udpListening}
          isTogglingUdpListening={isTogglingUdpListening}
          statusRunId={displayState.runId}
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          onPageChange={setActivePage}
          onCarSessionChange={handleCarSessionChange}
          onRunChange={handleRunChange}
          onRunToggle={handleRunToggle}
          onToggleUdpListening={handleToggleUdpListening}
        />

        <main className="flex min-w-0 flex-1 flex-col bg-[#171717]">
          {activePage === "cars" ? (
            <CarCatalogPage />
          ) : shouldShowFirstRunSetup ? (
            <FirstRunSetupPanel state={state} />
          ) : (
            <Tabs
              value={dashboardTab}
              onValueChange={(value) => setDashboardTab(value as DashboardTab)}
              className="min-h-0 flex-1 gap-0"
            >
              <div className="shrink-0 border-b border-white/10">
                <div className="flex items-center gap-4 px-4 py-3">
                  <TabsList className="shrink-0">
                    <TabsTrigger value="car" className="gap-2 px-3">
                      <Gauge size={16} />
                      Car
                    </TabsTrigger>
                    <TabsTrigger value="corner" className="gap-2 px-3">
                      <Route size={16} />
                      Corner
                    </TabsTrigger>
                    <TabsTrigger value="straights" className="gap-2 px-3">
                      <Milestone size={16} />
                      Straights
                    </TabsTrigger>
                  </TabsList>
                  {selectedCarSession ? (
                    <div className="ml-auto min-w-0 text-right">
                      <div className="truncate text-sm font-medium text-[#f1f5f3]">{selectedSessionLabel}</div>
                      <div className="text-xs text-[#8e9994]">
                        {enabledSessionRuns.length}/{selectedCarSession.runs.length} runs enabled{isAnalysisLoading ? " / loading" : ""}
                      </div>
                    </div>
                  ) : null}
                </div>
                {selectedCarSession ? (
                  <RunToggleStrip
                    runs={selectedCarSession.runs}
                    selectedRunId={selectedRunId}
                    enabledRunIds={effectiveEnabledRunIds}
                    onRunChange={handleRunChange}
                    onRunToggle={handleRunToggle}
                  />
                ) : null}
              </div>

              <TabsContent value="car" className="m-0 min-h-0 min-w-0 flex-1">
                <section className="grid h-full min-h-0 gap-4 p-4 lg:grid-cols-2">
                  <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,7fr)_minmax(190px,3fr)] gap-4">
                    <TrackMapPanel
                      path={displayPath}
                      hoverIndex={hoverIndex}
                      hoverTelemetry={hoverSample}
                      playheadPathIndex={playback.playheadPathIndex}
                      playheadTelemetry={playheadSample}
                      isPlaying={playback.isPlaying}
                      canPlayTelemetry={playback.canPlayTelemetry}
                      playbackLabel={playback.playbackLabel}
                      playbackSpeed={playback.playbackSpeed}
                      canDecreasePlaybackSpeed={playback.canDecreasePlaybackSpeed}
                      canIncreasePlaybackSpeed={playback.canIncreasePlaybackSpeed}
                      canReturnToLive={playback.canReturnToLive}
                      onHoverIndex={setHoverIndex}
                      onScrubPathIndex={handleScrubPathIndex}
                      onTogglePlayback={playback.togglePlayback}
                      onDecreasePlaybackSpeed={playback.decreasePlaybackSpeed}
                      onIncreasePlaybackSpeed={playback.increasePlaybackSpeed}
                      onReturnToLive={playback.returnToLive}
                    />
                    <LiveInputsPanel
                      telemetry={telemetry}
                      samples={displaySamples}
                      mode={carTelemetryView}
                      currentSampleIndex={currentSampleIndex}
                      hoverSampleIndex={graphHoverIndex}
                      sampleOffset={sampleOffset}
                      powerBand={selectedRunId === "live" ? null : runDetail?.powerBand ?? null}
                      onGraphHoverIndex={setGraphHoverIndex}
                    />
                  </section>

                  <TelemetrySidePanel
                    telemetry={telemetry}
                    samples={displaySamples}
                    sampleOffset={sampleOffset}
                    currentSampleIndex={currentSampleIndex}
                    hoverSampleIndex={graphHoverIndex}
                    mode={carTelemetryView}
                    onModeChange={setCarTelemetryView}
                    onGraphHoverIndex={setGraphHoverIndex}
                  />
                </section>
              </TabsContent>

              <TabsContent value="corner" className="m-0 min-h-0 min-w-0 flex-1">
                <section className="h-full min-h-0 p-4">
                  <CornerPanel samples={displaySamples} sampleSets={selectedRunId === "live" ? undefined : analysisSampleSets} />
                </section>
              </TabsContent>

              <TabsContent value="straights" className="m-0 min-h-0 min-w-0 flex-1">
                <section className="h-full min-h-0 p-4">
                  <StraightsPanel samples={displaySamples} sampleSets={selectedRunId === "live" ? undefined : analysisSampleSets} />
                </section>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}

function RunToggleStrip({
  runs,
  selectedRunId,
  enabledRunIds,
  onRunChange,
  onRunToggle
}: {
  runs: RunSummary[];
  selectedRunId: RunSelection;
  enabledRunIds: Set<string>;
  onRunChange: (runId: RunSelection) => void;
  onRunToggle: (runId: string) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto border-t border-white/[0.06] px-4 py-2">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#7f8984]">Session runs</span>
      {runs.map((run) => {
        const label = runLabel(run, runs);
        const isActive = selectedRunId === run.id;
        const isEnabled = enabledRunIds.has(run.id);
        return (
          <div
            key={run.id}
            className={cn(
              "grid shrink-0 grid-cols-[minmax(4.5rem,1fr)_1.85rem] overflow-hidden rounded-md border text-xs transition",
              isActive ? "border-white/18 bg-white/10 text-white" : isEnabled ? "border-white/10 bg-white/[0.04] text-[#d5ddda]" : "border-white/[0.06] text-[#858f8a]"
            )}
          >
            <button
              className="min-w-0 px-2.5 py-1.5 text-left"
              type="button"
              onClick={() => onRunChange(run.id)}
              aria-current={isActive ? "true" : undefined}
            >
              <span className="block truncate font-medium">{label}</span>
              <span className="block truncate text-[10px] text-[#8e9994]">{new Date(run.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
            </button>
            <button
              className={cn(
                "grid place-items-center border-l border-white/[0.06] transition hover:bg-white/10 hover:text-white",
                isEnabled && "text-[#70e0a6]"
              )}
              type="button"
              onClick={() => onRunToggle(run.id)}
              aria-pressed={isEnabled}
              aria-label={isEnabled ? `Disable ${label} from analysis` : `Enable ${label} for analysis`}
              title={isEnabled ? "Included in analysis" : "Excluded from analysis"}
            >
              {isEnabled ? <Check size={13} /> : <span className="h-2.5 w-2.5 rounded-sm border border-current" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function FirstRunSetupPanel({ state }: { state: AppState }) {
  const primaryIp = state.localIps[0] ?? "your Mac's LAN IP";
  const ipOptions = state.localIps.length ? state.localIps : [primaryIp];
  const setupSteps = [
    {
      icon: <Gamepad2 size={18} />,
      title: "Open Forza telemetry settings",
      detail: "In Forza Horizon, go to Settings > HUD and Gameplay."
    },
    {
      icon: <Settings2 size={18} />,
      title: "Enable Data Out",
      detail: "Set Data Out to On, then enter this device's IP address and UDP port."
    },
    {
      icon: <Radio size={18} />,
      title: "Start driving",
      detail: "The dashboard appears as soon as the first valid telemetry packet arrives."
    }
  ];

  return (
    <section className="min-h-0 flex-1 overflow-auto px-5 py-5">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-8 py-8">
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#8f9a95]">
            <MonitorDot size={16} />
            First setup
          </div>
          <div className="grid gap-2">
            <h1 className="m-0 max-w-3xl text-3xl font-semibold leading-tight text-[#f2f2f2]">
              Configure Forza Data Out to begin recording telemetry.
            </h1>
            <p className="m-0 max-w-2xl text-sm leading-6 text-[#a9b3ae]">
              No live packet or saved run is available yet. Point the game at this device and the app will switch to the telemetry dashboard automatically.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
          <section className="grid gap-3 border-y border-white/10 py-5">
            {setupSteps.map((step, index) => (
              <div key={step.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[#9be7bd]">
                  {step.icon}
                </div>
                <div className="min-w-0 border-b border-white/[0.07] pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#69736f]">{String(index + 1).padStart(2, "0")}</span>
                    <h2 className="m-0 text-sm font-semibold text-[#e9efec]">{step.title}</h2>
                  </div>
                  <p className="m-0 mt-1 text-sm leading-5 text-[#9aa39f]">{step.detail}</p>
                </div>
              </div>
            ))}
          </section>

          <aside className="grid content-start gap-4 border border-white/10 bg-white/[0.03] p-4">
            <SetupValue icon={<Wifi size={17} />} label="Data Out IP Address" value={primaryIp} />
            <SetupValue icon={<Radio size={17} />} label="Data Out IP Port" value={state.udpPort} />
            <div className="grid gap-2 border-t border-white/10 pt-4">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-[#7f8984]">Local IP options</div>
              <div className="flex flex-wrap gap-2">
                {ipOptions.map((ip) => (
                  <span key={ip} className="rounded-md border border-white/10 bg-[#101010] px-2 py-1 font-mono text-xs text-[#dbe5df]">
                    {ip}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <div className="grid gap-3 border-t border-white/10 pt-5 text-sm text-[#a9b3ae] md:grid-cols-3">
          {[
            "Use the Mac and console or PC on the same network.",
            "Allow local network or firewall prompts for the app.",
            "Avoid UDP ports 5200-5300 because Forza reserves that range."
          ].map((item) => (
            <div key={item} className="flex min-w-0 gap-2">
              <CheckCircle2 className="mt-0.5 shrink-0 text-[#9be7bd]" size={16} />
              <span className="leading-5">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SetupValue({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-[#7f8984]">
        {icon}
        {label}
      </div>
      <div className="font-mono text-xl font-semibold text-[#f0f4f2]">{value}</div>
    </div>
  );
}
