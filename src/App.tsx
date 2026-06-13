import * as React from "react";
import { BarChart3, CheckCircle2, Gamepad2, Gauge, LineChart, MonitorDot, Radio, Settings2, Wifi } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LiveInputsPanel } from "@/features/inputs/LiveInputsPanel";
import { buildPathFromTelemetry } from "@/features/map/pathSamples";
import { TrackMapPanel } from "@/features/map/TrackMapPanel";
import { TelemetrySidePanel } from "@/features/dashboard/telemetryVisuals";
import { BehaviorPanel } from "@/features/dashboard/TuningBehaviorPanel";
import { PowertrainAnalysisPanel } from "@/features/analysis/PowertrainAnalysisPanel";
import { CarCatalogPage } from "@/features/cars/CarCatalogPage";
import { SessionHeader } from "@/features/session/SessionHeader";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useSessions } from "@/hooks/useSessions";
import { useTelemetryPlayback } from "@/hooks/useTelemetryPlayback";
import { queryCars } from "@/services/api";
import type { AppState, CarCatalogItem, DashboardTab, RunDetail, RunSelection, Telemetry } from "@/types/telemetry";

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
    sessionId: run?.sessionId,
    runId: run?.id
  };
}

function sampleAtIndex(samples: Telemetry[], index: number | null, fallback?: Telemetry | null) {
  if (index === null) return fallback ?? null;
  return samples[index] ?? fallback ?? null;
}

export function App() {
  const { state, path, samples, handleState } = useLiveTelemetry();
  const { sessions, selectedRunId, setSelectedRunId, runDetail, isRunStreaming } = useSessions();
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const [dashboardTab, setDashboardTab] = React.useState<DashboardTab>("car");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isTogglingUdpListening, setIsTogglingUdpListening] = React.useState(false);
  const [activePage, setActivePage] = React.useState<"sessions" | "cars">("sessions");
  const [carCatalog, setCarCatalog] = React.useState<CarCatalogItem[]>([]);

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
    const latestRun = sessions[0]?.runs[0];
    if (latestRun) setSelectedRunId(latestRun.id);
  }, [selectedRunId, sessions, state.connected, state.lastPacketAt, state.packets, state.telemetry, setSelectedRunId]);

  const historicalPath = React.useMemo(() => buildPathFromTelemetry(runDetail?.samples ?? []), [runDetail]);
  const displayPath = selectedRunId === "live" ? path : historicalPath;
  const displaySamples = selectedRunId === "live" ? samples : runDetail?.samples ?? EMPTY_TELEMETRY_SAMPLES;
  const playback = useTelemetryPlayback({
    displayPath,
    samples: displaySamples,
    selectedSessionId: selectedRunId,
    isSessionStreaming: isRunStreaming
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
    ?? (selectedRunId === "live" ? state.telemetry : runDetail?.samples.at(-1) ?? null);
  const displayState = selectedRunId === "live" ? state : buildHistoricalState(state, runDetail, telemetry);
  const carCatalogByOrdinal = React.useMemo(() => {
    const carsByOrdinal = new Map<number, CarCatalogItem>();
    for (const car of carCatalog) {
      if (car.carOrdinal !== null) carsByOrdinal.set(car.carOrdinal, car);
    }
    return carsByOrdinal;
  }, [carCatalog]);
  const selectedSessionLabel = selectedRunId === "live"
    ? "Live telemetry"
    : runDetail?.run
      ? `Run ${new Date(runDetail.run.startedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
      : "Saved run";
  const shouldShowFirstRunSetup = selectedRunId === "live"
    && !state.connected
    && !state.telemetry
    && sessions.length === 0;

  function handleRunChange(runId: RunSelection) {
    setSelectedRunId(runId);
    setActivePage("sessions");
    setHoverIndex(null);
    playback.resetPlayback();
  }

  function handleScrubPathIndex(index: number | null) {
    setHoverIndex(null);
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
        <SessionHeader
          sessions={sessions}
          carCatalogByOrdinal={carCatalogByOrdinal}
          activePage={activePage}
          selectedRunId={selectedRunId}
          canSelectLive={state.connected}
          liveSessionId={state.sessionId}
          liveRunId={state.runId}
          liveTelemetry={state.telemetry}
          livePackets={state.packets}
          liveBadPackets={state.badPackets}
          liveLastPacketAt={state.lastPacketAt}
          statusLabel={selectedSessionLabel}
          statusConnected={displayState.connected}
          statusPackets={displayState.packets}
          statusUdpPort={displayState.udpPort}
          udpListening={state.udpListening}
          isTogglingUdpListening={isTogglingUdpListening}
          statusRunId={displayState.runId}
          isCollapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          onPageChange={setActivePage}
          onRunChange={handleRunChange}
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
              <div className="flex shrink-0 items-center gap-4 border-b border-white/10 px-4 py-3">
                <TabsList className="shrink-0">
                  <TabsTrigger value="car" className="gap-2 px-3">
                    <Gauge size={16} />
                    Car
                  </TabsTrigger>
                  <TabsTrigger value="behavior" className="gap-2 px-3">
                    <BarChart3 size={16} />
                    Behaviour
                  </TabsTrigger>
                  <TabsTrigger value="analysis" className="gap-2 px-3">
                    <LineChart size={16} />
                    Analysis
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="car" className="m-0 min-h-0 min-w-0 flex-1">
                <section className="grid h-full min-h-0 gap-4 p-4 lg:grid-cols-2">
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
                      canReturnToLive={playback.canReturnToLive}
                      onHoverIndex={setHoverIndex}
                      onScrubPathIndex={handleScrubPathIndex}
                      onTogglePlayback={playback.togglePlayback}
                      onDecreasePlaybackSpeed={playback.decreasePlaybackSpeed}
                      onIncreasePlaybackSpeed={playback.increasePlaybackSpeed}
                      onReturnToLive={playback.returnToLive}
                    />
                    <LiveInputsPanel telemetry={telemetry} samples={displaySamples} />
                  </section>

                  <TelemetrySidePanel telemetry={telemetry} />
                </section>
              </TabsContent>

              <TabsContent value="behavior" className="m-0 min-h-0 min-w-0 flex-1">
                <section className="h-full min-h-0 p-4">
                  <BehaviorPanel samples={displaySamples} />
                </section>
              </TabsContent>

              <TabsContent value="analysis" className="m-0 min-h-0 min-w-0 flex-1">
                <section className="h-full min-h-0 p-4">
                  <PowertrainAnalysisPanel samples={displaySamples} telemetry={telemetry} />
                </section>
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </TooltipProvider>
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
              No live packet or saved session is available yet. Point the game at this device and the app will switch to the telemetry dashboard automatically.
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
