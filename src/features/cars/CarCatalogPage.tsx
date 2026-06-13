import * as React from "react";
import { ArrowDownAZ, ArrowUpAZ, Car, Database, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { queryCars } from "@/services/api";
import { cn } from "@/lib/utils";
import type { CarCatalogItem, CarCatalogResult, CarCatalogSortDirection, CarCatalogSortKey } from "@/types/telemetry";

const sortOptions: { value: CarCatalogSortKey; label: string }[] = [
  { value: "make", label: "Make" },
  { value: "carName", label: "Name" },
  { value: "year", label: "Year" },
  { value: "carClass", label: "Class" },
  { value: "pi", label: "PI" },
  { value: "powerHp", label: "Power" },
  { value: "weightLb", label: "Weight" },
  { value: "popularityPercent", label: "Popularity" }
];

function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString()}${suffix}`;
}

function formatDecimal(value: number | null | undefined, precision = 1) {
  if (value === null || value === undefined) return "—";
  return value.toFixed(precision);
}

export function CarCatalogPage() {
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<CarCatalogSortKey>("make");
  const [sortDirection, setSortDirection] = React.useState<CarCatalogSortDirection>("asc");
  const [result, setResult] = React.useState<CarCatalogResult>({ cars: [], total: 0, matched: 0 });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const nextResult = await queryCars({ search, sortBy, sortDirection });
        if (!cancelled) setResult(nextResult);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, sortBy, sortDirection]);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header className="grid gap-3 border-b border-white/10 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-[#8f9a95]">
            <Database size={15} />
            Car catalog
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(220px,360px)_150px_40px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7f8783]" size={16} />
            <input
              className="h-10 w-full rounded-md border border-white/10 bg-[#101010] pl-9 pr-3 text-sm text-[#ededed] outline-none transition placeholder:text-[#6f7672] focus:border-[#70e0a6]/50"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search make, model, type"
            />
          </label>
          <select
            className="h-10 rounded-md border border-white/10 bg-[#101010] px-3 text-sm text-[#ededed] outline-none focus:border-[#70e0a6]/50"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as CarCatalogSortKey)}
            aria-label="Sort cars by"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <Button
            className="h-10 border-white/10 bg-[#101010] text-[#d8d8d8] hover:bg-white/10 hover:text-white"
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setSortDirection((current) => current === "asc" ? "desc" : "asc")}
            aria-label={sortDirection === "asc" ? "Sort descending" : "Sort ascending"}
            title={sortDirection === "asc" ? "Ascending" : "Descending"}
          >
            {sortDirection === "asc" ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid gap-3 pb-3">
          {result.cars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>

        {!isLoading && !error && result.cars.length === 0 ? (
          <div className="grid min-h-[240px] place-items-center rounded-lg border border-white/10 bg-[#202020] text-sm text-[#8f8f8f]">
            No cars match that search.
          </div>
        ) : null}
        {isLoading ? (
          <div className="sticky bottom-0 rounded-md border border-white/10 bg-[#202020]/95 px-3 py-2 text-xs text-[#8f8f8f]">Loading catalog…</div>
        ) : null}
        {error ? (
          <div className="sticky bottom-0 rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
        ) : null}
      </div>
    </section>
  );
}

function CarCard({ car }: { car: CarCatalogItem }) {
  return (
    <article className="grid min-h-[176px] overflow-hidden rounded-lg border border-white/10 bg-[#202020] text-[#d9ddda] transition hover:border-white/15 hover:bg-[#242424] md:grid-cols-[260px_minmax(0,1fr)]">
      <div className="flex min-h-[176px] items-center justify-center border-b border-white/10 bg-[#141414] p-3 md:border-b-0 md:border-r">
        {car.iconUrl ? (
          <img className="max-h-[152px] w-full object-contain" src={car.iconUrl} alt="" loading="lazy" />
        ) : (
          <Car size={34} className="text-[#7f8783]" />
        )}
      </div>

      <div className="grid min-w-0 gap-4 p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <ClassBadge value={car.carClass} />
              <span className="font-mono text-sm font-semibold text-[#e8ece9]">{formatNumber(car.pi)} PI</span>
              {car.year ? <span className="text-sm text-[#8f9894]">{car.year}</span> : null}
            </div>
            <h2 className="m-0 mt-2 text-xl font-semibold leading-tight text-[#f2f2f2]">{car.carName}</h2>
            <div className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-sm text-[#8f9894]">
              <span>{car.make}</span>
              {car.country ? <span>{car.country}</span> : null}
              {car.carType ? <span>{car.carType}</span> : null}
              {car.rarity ? <span>{car.rarity}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-1 lg:justify-end">
            {car.collection.slice(0, 4).map((item) => (
              <Badge key={item} className="h-5 bg-white/8 text-[#bfc7c3]">{item}</Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatBlock label="Power" value={formatNumber(car.powerHp, " hp")} />
          <StatBlock label="Torque" value={formatNumber(car.torqueLbFt, " lb-ft")} />
          <StatBlock label="Weight" value={formatNumber(car.weightLb, " lb")} />
          <StatBlock label="Displacement" value={car.displacementLiters === null ? "—" : `${formatDecimal(car.displacementLiters)} L`} />
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Meter label="Speed" value={car.speed} />
          <Meter label="Handling" value={car.handling} />
          <Meter label="Accel" value={car.acceleration} />
          <Meter label="Launch" value={car.launch} />
          <Meter label="Braking" value={car.braking} />
          <Meter label="Offroad" value={car.offroad} />
        </div>
      </div>
    </article>
  );
}

function ClassBadge({ value }: { value: string | null }) {
  return (
    <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md bg-white/8 px-2 font-mono text-xs font-semibold text-[#f1f1f1]">
      {value ?? "—"}
    </span>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-[#171717] px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#7f8783]">{label}</div>
      <div className="mt-1 font-mono text-sm text-[#eef2ef]">{value}</div>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number | null }) {
  const percent = value === null ? 0 : Math.max(0, Math.min(100, value * 10));

  return (
    <div className="grid gap-1.5 rounded-md border border-white/[0.08] bg-[#171717] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#7f8783]">{label}</span>
        <span className={cn("font-mono text-sm", value === null ? "text-[#777]" : "text-[#eef2ef]")}>{formatDecimal(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#70e0a6]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
