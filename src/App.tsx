import * as React from "react";
import { Activity, ChevronLeft, ChevronRight, Database, Gauge, Milestone, PanelLeftClose, PanelLeftOpen, RadioReceiver, Route, Settings2, Wifi } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LiveInputsPanel } from "@/features/inputs/LiveInputsPanel";
import { TelemetrySidePanel } from "@/features/dashboard/telemetryVisuals";
import { CornerPanel } from "@/features/dashboard/TuningBehaviorPanel";
import { StraightsPanel } from "@/features/analysis/StraightsPanel";
import { CarCatalogPage } from "@/features/cars/CarCatalogPage";
import { RunSidebar } from "@/features/runs/RunSidebar";
import { TrackMapPanel } from "@/features/map/TrackMapPanel";
import { useLiveTelemetry } from "@/hooks/useLiveTelemetry";
import { useRuns } from "@/hooks/useRuns";
import { cn } from "@/lib/utils";
import { drivetrainLabel, formatValue } from "@/lib/format";
import {
  fetchRunPath,
  fetchRunSampleWindow,
  fetchRunSectionSamples,
  fetchRunSections,
  queryCars
} from "@/services/api";
import type {
  AppPage,
  AppState,
  CarCatalogItem,
  DashboardTab,
  PathSample,
  RunSampleWindow,
  RunSectionType,
  RunSummary,
  RunTelemetrySet,
  Telemetry
} from "@/types/telemetry";

const RUN_SAMPLE_WINDOW_SIZE = 3000;
const SECTION_PAGE_SIZE = 8;
const EMPTY_SAMPLE_WINDOW: RunSampleWindow = { start: 0, total: 0, samples: [] };

export function App() {
  const { state, path: livePath, samples: liveSamples, handleState } = useLiveTelemetry();
  const { runsPage, selectedRunId, setSelectedRunId, isRunsLoading, runsError, loadNextPage } = useRuns(state.completedRunsVersion ?? 0);
  const [activePage, setActivePage] = React.useState<AppPage>("live");
  const [isSidebarHidden, setIsSidebarHidden] = React.useState(false);
  const [isTogglingUdpListening, setIsTogglingUdpListening] = React.useState(false);
  const [dashboardTab, setDashboardTab] = React.useState<DashboardTab>("car");
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

  const carCatalogByOrdinal = React.useMemo(() => {
    const carsByOrdinal = new Map<number, CarCatalogItem>();
    for (const car of carCatalog) {
      if (car.carOrdinal !== null) carsByOrdinal.set(car.carOrdinal, car);
    }
    return carsByOrdinal;
  }, [carCatalog]);

  async function handleToggleUdpListening() {
    setIsTogglingUdpListening(true);
    try {
      handleState(await window.telemetryApp.setUdpListening(!state.udpListening));
    } finally {
      setIsTogglingUdpListening(false);
    }
  }

  function handleSelectRun(runId: string) {
    setSelectedRunId(runId);
    setActivePage("runs");
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-[#171717] text-foreground">
        <AppHeader
          activePage={activePage}
          isSidebarHidden={isSidebarHidden}
          onToggleSidebar={() => setIsSidebarHidden((current) => !current)}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {!isSidebarHidden ? (
            <RunSidebar
              activePage={activePage}
              runs={runsPage.runs}
              selectedRunId={selectedRunId}
              carCatalogByOrdinal={carCatalogByOrdinal}
              isRunsLoading={isRunsLoading}
              runsError={runsError}
              canLoadNext={runsPage.hasNextPage}
              onPageChange={setActivePage}
              onSelectRun={handleSelectRun}
              onLoadNext={loadNextPage}
            />
          ) : null}

          <main className="flex min-w-0 flex-1 flex-col bg-[#171717]">
            {activePage === "live" ? (
              <LivePage
                state={state}
                livePath={livePath}
                liveSamples={liveSamples}
                isTogglingUdpListening={isTogglingUdpListening}
                onToggleUdpListening={handleToggleUdpListening}
              />
            ) : activePage === "cars" ? (
              <CarCatalogPage />
            ) : (
              <RunsPage
                runs={runsPage.runs}
                selectedRunId={selectedRunId}
                carCatalogByOrdinal={carCatalogByOrdinal}
                dashboardTab={dashboardTab}
                onDashboardTabChange={setDashboardTab}
              />
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}

function AppHeader({
  activePage,
  isSidebarHidden,
  onToggleSidebar
}: {
  activePage: AppPage;
  isSidebarHidden: boolean;
  onToggleSidebar: () => void;
}) {
  const title = activePage === "live" ? "Live" : activePage === "runs" ? "Runs" : "Cars";

  return (
    <header className="relative flex h-[52px] shrink-0 items-center border-b border-white/10 bg-[#171717] [-webkit-app-region:drag]">
      <div className="flex min-w-0 items-center gap-3 pl-[78px] pr-4">
        <button
          className="flex size-[22px] items-center justify-center rounded-md text-[#aeb5b1] transition hover:bg-white/10 hover:text-white [-webkit-app-region:no-drag]"
          type="button"
          onClick={onToggleSidebar}
          aria-label={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
          title={isSidebarHidden ? "Show sidebar" : "Hide sidebar"}
        >
          {isSidebarHidden ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
        <div className="truncate text-sm font-semibold text-[#f2f2f2]">{title}</div>
      </div>
    </header>
  );
}

function LivePage({
  state,
  livePath,
  liveSamples,
  isTogglingUdpListening,
  onToggleUdpListening
}: {
  state: AppState;
  livePath: PathSample[];
  liveSamples: Telemetry[];
  isTogglingUdpListening: boolean;
  onToggleUdpListening: () => void;
}) {
  const telemetry = state.telemetry;
  const hasActiveTelemetry = Boolean(telemetry && telemetry.IsRaceOn === 1);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <LiveStatusPanel
        state={state}
        isTogglingUdpListening={isTogglingUdpListening}
        onToggleUdpListening={onToggleUdpListening}
      />

      {!hasActiveTelemetry ? (
        <LiveSetupPanel state={state} />
      ) : (
        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
          <section className="grid min-h-0 min-w-0 grid-rows-[minmax(0,7fr)_minmax(190px,3fr)] gap-4">
            <TrackMapPanel path={livePath} scrubbingEnabled={false} />
            <LiveInputsPanel telemetry={telemetry} samples={liveSamples.slice(-1)} mode="live" />
          </section>
          <TelemetrySidePanel
            telemetry={telemetry}
            samples={[]}
            sampleOffset={0}
            currentSampleIndex={null}
            mode="live"
            showModeToggle={false}
            onModeChange={() => undefined}
          />
        </section>
      )}
    </section>
  );
}

function LiveStatusPanel({
  state,
  isTogglingUdpListening,
  onToggleUdpListening
}: {
  state: AppState;
  isTogglingUdpListening: boolean;
  onToggleUdpListening: () => void;
}) {
  const listenerLabel = state.udpListening ? "Listening" : "Paused";
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9aa39f]">
        <span className={cn("font-medium", state.connected ? "text-[#70e0a6]" : state.udpListening ? "text-[#d4c27e]" : "text-[#9aa39f]")}>
          {state.connected ? "Receiving driving data" : state.udpListening ? "Waiting for packets" : "UDP listener paused"}
        </span>
        <span>{listenerLabel} on UDP {state.udpPort}</span>
        <span>{state.packets.toLocaleString()} parsed packets / {state.badPackets.toLocaleString()} bad</span>
        <span className="truncate">{state.lastSource ?? "No source yet"}</span>
      </div>

      <Button
        className={cn(
          "h-9 border-white/10 px-3",
          state.udpListening
            ? "bg-[#4cc38a]/15 text-[#70e0a6] hover:bg-[#4cc38a]/20 hover:text-[#8af0b8]"
            : "bg-white/[0.04] text-[#cfcfcf] hover:bg-white/10 hover:text-white"
        )}
        variant="outline"
        type="button"
        disabled={isTogglingUdpListening}
        onClick={onToggleUdpListening}
        aria-pressed={state.udpListening}
      >
        <RadioReceiver size={15} />
        <span>{state.udpListening ? "Stop listening" : "Listen on UDP"}</span>
      </Button>
    </section>
  );
}

function LiveSetupPanel({ state }: { state: AppState }) {
  const primaryIp = state.localIps[0] ?? "your Mac's LAN IP";
  return (
    <section className="grid min-h-0 flex-1 place-items-center overflow-auto">
      <div className="grid w-full max-w-4xl gap-7 py-8">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#8f9a95]">
            <Settings2 size={15} />
            Setup
          </div>
          <h2 className="m-0 max-w-3xl text-3xl font-semibold leading-tight text-[#f2f2f2]">
            Configure Forza Data Out, then start the UDP listener.
          </h2>
          <p className="m-0 max-w-2xl text-sm leading-6 text-[#a9b3ae]">
            The live dashboard appears when the app receives an active driving packet. Menu packets are ignored by the parsed telemetry database.
          </p>
        </div>

        <div className="grid gap-4 border-y border-white/10 py-5 lg:grid-cols-3">
          <SetupStep icon={<Gauge size={17} />} title="Enable Data Out" detail="In Forza settings, enable Data Out from HUD and Gameplay." />
          <SetupStep icon={<Wifi size={17} />} title="Point to this Mac" detail={`Use IP ${primaryIp} and UDP port ${state.udpPort}.`} />
          <SetupStep icon={<Activity size={17} />} title="Start driving" detail="Only in-race packets become parsed run data; raw UDP packets are backed up separately." />
        </div>

        <div className="grid gap-2 text-sm text-[#9aa39f]">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-[#7f8984]">Local IPs</span>
          <div className="flex flex-wrap gap-2">
            {(state.localIps.length ? state.localIps : [primaryIp]).map((ip) => (
              <span key={ip} className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-xs text-[#d9e0dc]">{ip}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SetupStep({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[#9be7bd]">
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="m-0 text-sm font-semibold text-[#e9efec]">{title}</h3>
        <p className="m-0 mt-1 text-sm leading-5 text-[#9aa39f]">{detail}</p>
      </div>
    </div>
  );
}

function RunsPage({
  runs,
  selectedRunId,
  carCatalogByOrdinal,
  dashboardTab,
  onDashboardTabChange
}: {
  runs: RunSummary[];
  selectedRunId: string | null;
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  dashboardTab: DashboardTab;
  onDashboardTabChange: (tab: DashboardTab) => void;
}) {
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  return (
    <section className="min-h-0 flex-1 overflow-hidden">
      {selectedRun ? (
        <RunDashboard
          run={selectedRun}
          carCatalogByOrdinal={carCatalogByOrdinal}
          dashboardTab={dashboardTab}
          onDashboardTabChange={onDashboardTabChange}
        />
      ) : (
        <div className="grid h-full place-items-center p-6 text-center">
          <div>
            <Database className="mx-auto mb-3 text-[#8f9a95]" size={26} />
            <h2 className="m-0 text-lg font-semibold text-[#f2f2f2]">No completed runs yet.</h2>
            <p className="m-0 mt-2 max-w-sm text-sm leading-6 text-[#9aa39f]">Completed runs appear in the sidebar after an active drive ends, splits, or the UDP listener is stopped.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function RunDashboard({
  run,
  carCatalogByOrdinal,
  dashboardTab,
  onDashboardTabChange
}: {
  run: RunSummary;
  carCatalogByOrdinal: Map<number, CarCatalogItem>;
  dashboardTab: DashboardTab;
  onDashboardTabChange: (tab: DashboardTab) => void;
}) {
  const runWindow = useRunSampleWindow(run);
  const samples = runWindow.sampleWindow.samples;
  const telemetry = samples.at(-1) ?? null;
  const currentSampleIndex = samples.length ? runWindow.sampleWindow.start + samples.length - 1 : null;

  return (
    <Tabs value={dashboardTab} onValueChange={(value) => onDashboardTabChange(value as DashboardTab)} className="h-full min-h-0 flex-1 gap-0 overflow-hidden">
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
          <div className="ml-auto min-w-0 text-right">
            <div className="truncate text-sm font-medium text-[#f1f5f3]">{formatCar(run, carCatalogByOrdinal)}</div>
            <div className="text-xs text-[#8e9994]">
              {run.packetCount.toLocaleString()} samples / {run.pathPointCount.toLocaleString()} path points
            </div>
          </div>
        </div>
      </div>

      <TabsContent value="car" className="m-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        <RunCarTab
          run={run}
          telemetry={telemetry}
          sampleWindow={runWindow.sampleWindow}
          currentSampleIndex={currentSampleIndex}
        />
      </TabsContent>
      <TabsContent value="corner" className="m-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        <PagedRunSectionsPanel runId={run.id} type="corner" />
      </TabsContent>
      <TabsContent value="straights" className="m-0 min-h-0 min-w-0 flex-1 overflow-hidden">
        <PagedRunSectionsPanel runId={run.id} type="straight" />
      </TabsContent>
    </Tabs>
  );
}

function RunCarTab({
  run,
  telemetry,
  sampleWindow,
  currentSampleIndex
}: {
  run: RunSummary;
  telemetry: Telemetry | null;
  sampleWindow: RunSampleWindow;
  currentSampleIndex: number | null;
}) {
  const runPath = useRunPath(run.id);
  const [graphHoverIndex, setGraphHoverIndex] = React.useState<number | null>(null);

  return (
    <section className="grid h-full min-h-0 gap-4 overflow-hidden p-4 lg:grid-cols-2">
      <section className="grid h-full min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(170px,190px)] gap-4 overflow-hidden">
        <TrackMapPanel path={runPath.path} />
        <LiveInputsPanel
          telemetry={telemetry}
          samples={sampleWindow.samples}
          mode="graph"
          currentSampleIndex={currentSampleIndex}
          sampleOffset={sampleWindow.start}
          hoverSampleIndex={graphHoverIndex}
          onGraphHoverIndex={setGraphHoverIndex}
        />
      </section>

      <TelemetrySidePanel
        telemetry={telemetry}
        samples={sampleWindow.samples}
        sampleOffset={sampleWindow.start}
        currentSampleIndex={currentSampleIndex}
        mode="graph"
        showModeToggle={false}
        onModeChange={() => undefined}
        hoverSampleIndex={graphHoverIndex}
        onGraphHoverIndex={setGraphHoverIndex}
      />
      {runPath.error ? <span className="sr-only">Run path failed to load: {runPath.error}</span> : null}
      <span className="sr-only">{run.id}</span>
    </section>
  );
}

function useRunPath(runId: string) {
  const [path, setPath] = React.useState<PathSample[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setPath([]);
    setError(null);

    fetchRunPath(runId)
      .then((nextPath) => {
        if (!cancelled) setPath(nextPath);
      })
      .catch((caught) => {
        if (!cancelled) {
          setPath([]);
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  return { path, error };
}

function PagedRunSectionsPanel({ runId, type }: { runId: string; type: RunSectionType }) {
  const [sampleSets, setSampleSets] = React.useState<RunTelemetrySet[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSections() {
      setIsLoading(true);
      setError(null);
      setSampleSets([]);

      try {
        const nextSampleSets: RunTelemetrySet[] = [];
        let page = 0;
        let total = Infinity;

        while (!cancelled && page * SECTION_PAGE_SIZE < total) {
          const sectionPage = await fetchRunSections({ runId, type, page, limit: SECTION_PAGE_SIZE });
          total = sectionPage.total;
          const sectionSamples = await Promise.all(sectionPage.sections.map(async (section) => {
            const result = await fetchRunSectionSamples({ runId, sectionId: section.id });
            return {
              runId: section.id,
              label: "",
              samples: result?.samples ?? []
            };
          }));
          nextSampleSets.push(...sectionSamples.filter((set) => set.samples.length > 0));
          if (!cancelled) setSampleSets([...nextSampleSets]);
          page += 1;
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSections();

    return () => {
      cancelled = true;
    };
  }, [runId, type]);

  if (sampleSets.length === 0 && isLoading) {
    return (
      <section className="h-full min-h-0 p-4">
        <div className="border-b border-white/[0.08] py-4 text-sm leading-5 text-[#b5bfb9]">
          Loading {type === "corner" ? "cornering" : "straight"} sections...
        </div>
      </section>
    );
  }

  if (error && sampleSets.length === 0) {
    return (
      <section className="h-full min-h-0 p-4">
        <div className="border-b border-white/[0.08] py-4 text-sm leading-5 text-red-200">{error}</div>
      </section>
    );
  }

  return (
    <section className="h-full min-h-0 p-4">
      {type === "corner" ? (
        <CornerPanel samples={[]} sampleSets={sampleSets} />
      ) : (
        <StraightsPanel samples={[]} sampleSets={sampleSets} />
      )}
    </section>
  );
}

function useRunSampleWindow(run: RunSummary) {
  const defaultStart = Math.max(0, run.packetCount - RUN_SAMPLE_WINDOW_SIZE);
  const [windowStart, setWindowStart] = React.useState(defaultStart);
  const [sampleWindow, setSampleWindow] = React.useState<RunSampleWindow>(EMPTY_SAMPLE_WINDOW);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setWindowStart(Math.max(0, run.packetCount - RUN_SAMPLE_WINDOW_SIZE));
    setSampleWindow(EMPTY_SAMPLE_WINDOW);
  }, [run.id, run.packetCount]);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRunSampleWindow({
      runId: run.id,
      start: windowStart,
      limit: RUN_SAMPLE_WINDOW_SIZE
    })
      .then((nextWindow) => {
        if (!cancelled) setSampleWindow(nextWindow);
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
          setSampleWindow(EMPTY_SAMPLE_WINDOW);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [run.id, windowStart]);

  return {
    sampleWindow,
    isLoading,
    error
  };
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

function formatCar(
  run: Pick<RunSummary, "carOrdinal" | "carClass" | "carPerformanceIndex" | "drivetrainType">,
  carCatalogByOrdinal: Map<number, CarCatalogItem>
) {
  const catalogCar = run.carOrdinal === null || run.carOrdinal === undefined
    ? null
    : carCatalogByOrdinal.get(run.carOrdinal) ?? null;
  const carName = catalogCar?.carName ?? "Unknown car";
  const className = carClassLabel(run.carClass) ?? catalogCar?.carClass ?? null;
  const piLabel = run.carPerformanceIndex === null || run.carPerformanceIndex === undefined ? null : `PI ${run.carPerformanceIndex}`;
  const classLabel = className && run.carPerformanceIndex !== null && run.carPerformanceIndex !== undefined
    ? `${className} ${run.carPerformanceIndex}`
    : className;
  const drivetrain = run.drivetrainType === null || run.drivetrainType === undefined ? null : drivetrainLabel(run.drivetrainType);
  return [carName, classLabel ?? piLabel, drivetrain].filter(Boolean).join(" / ");
}
