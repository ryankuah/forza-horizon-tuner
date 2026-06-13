import Database from "better-sqlite3";
import fs from "node:fs";
import type {
  CarCatalogItem,
  CarCatalogQuery,
  CarCatalogResult,
  CarCatalogSortDirection,
  CarCatalogSortKey
} from "../src/types/telemetry";

const sortColumns: Record<CarCatalogSortKey, string> = {
  make: "make",
  year: "year",
  carName: "car_name",
  carClass: "car_class",
  pi: "pi",
  carOrdinal: "car_ordinal",
  powerHp: "power_hp",
  weightLb: "weight_lb",
  popularityPercent: "popularity_percent"
};

type CarRow = {
  id: string;
  source_index: number;
  make: string;
  year: number | null;
  car_name: string;
  model: string | null;
  car_type: string | null;
  car_class: string | null;
  pi: number | null;
  country: string | null;
  collection: string | null;
  add_ons: string | null;
  rarity: string | null;
  credits: number | null;
  unlock: string | null;
  popularity_percent: number | null;
  speed: number | null;
  handling: number | null;
  acceleration: number | null;
  launch: number | null;
  braking: number | null;
  offroad: number | null;
  power_hp: number | null;
  torque_lb_ft: number | null;
  weight_lb: number | null;
  front_percent: number | null;
  displacement_liters: number | null;
  drive: number | null;
  car_ordinal: number | null;
  car_ordinal_asset: string | null;
  car_ordinal_internal_path: string | null;
  car_ordinal_match_confidence: string | null;
  icon_url: string | null;
  detail_url: string | null;
  manufacturer_logo_url: string | null;
};

export function createCarCatalog(dbPath: string) {
  const sqlite = fs.existsSync(dbPath) ? new Database(dbPath, { readonly: true, fileMustExist: true }) : null;

  function queryCars(query: CarCatalogQuery = {}): CarCatalogResult {
    if (!sqlite) return { cars: [], total: 0, matched: 0 };

    const search = query.search?.trim() ?? "";
    const sortBy = query.sortBy && query.sortBy in sortColumns ? query.sortBy : "make";
    const sortDirection: CarCatalogSortDirection = query.sortDirection === "desc" ? "desc" : "asc";
    const orderColumn = sortColumns[sortBy];
    const where = search
      ? `WHERE make LIKE @search OR car_name LIKE @search OR model LIKE @search OR car_type LIKE @search OR car_ordinal_asset LIKE @search`
      : "";
    const params = search ? { search: `%${search}%` } : null;
    const total = sqlite.prepare("SELECT COUNT(*) AS count FROM cars").get() as { count: number };
    const matchedStatement = sqlite.prepare(`SELECT COUNT(*) AS count FROM cars ${where}`);
    const rowsStatement = sqlite.prepare(`
      SELECT *
      FROM cars
      ${where}
      ORDER BY ${orderColumn} IS NULL, ${orderColumn} ${sortDirection.toUpperCase()}, make ASC, year ASC, car_name ASC
    `);
    const matched = (params ? matchedStatement.get(params) : matchedStatement.get()) as { count: number };
    const rows = (params ? rowsStatement.all(params) : rowsStatement.all()) as CarRow[];

    return {
      cars: rows.map(mapRow),
      total: total.count,
      matched: matched.count
    };
  }

  function close() {
    sqlite?.close();
  }

  return { queryCars, close };
}

function splitList(value: string | null) {
  if (!value) return [];
  return value.split("|").filter(Boolean);
}

function mapRow(row: CarRow): CarCatalogItem {
  return {
    id: row.id,
    sourceIndex: row.source_index,
    make: row.make,
    year: row.year,
    carName: row.car_name,
    model: row.model,
    carType: row.car_type,
    carClass: row.car_class,
    pi: row.pi,
    country: row.country,
    collection: splitList(row.collection),
    addOns: splitList(row.add_ons),
    rarity: row.rarity,
    credits: row.credits,
    unlock: row.unlock,
    popularityPercent: row.popularity_percent,
    speed: row.speed,
    handling: row.handling,
    acceleration: row.acceleration,
    launch: row.launch,
    braking: row.braking,
    offroad: row.offroad,
    powerHp: row.power_hp,
    torqueLbFt: row.torque_lb_ft,
    weightLb: row.weight_lb,
    frontPercent: row.front_percent,
    displacementLiters: row.displacement_liters,
    drive: row.drive,
    carOrdinal: row.car_ordinal,
    carOrdinalAsset: row.car_ordinal_asset,
    carOrdinalInternalPath: row.car_ordinal_internal_path,
    carOrdinalMatchConfidence: row.car_ordinal_match_confidence,
    iconUrl: row.icon_url,
    detailUrl: row.detail_url,
    manufacturerLogoUrl: row.manufacturer_logo_url
  };
}
