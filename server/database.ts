import fs from "node:fs";
import path from "node:path";
import BetterSqliteDatabase from "better-sqlite3";
import type {
  PathSample,
  RunSampleWindow,
  RunSection,
  RunSectionPage,
  RunSectionSamples,
  RunsPage,
  RunSummary,
  RunType,
  Summary,
  Telemetry
} from "../src/types/telemetry";
import { TelemetryWindow } from "./tuning";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "telemetry.sqlite");
const TELEMETRY_SCHEMA_VERSION = 3;
const RAW_SCHEMA_VERSION = 1;
const DEFAULT_RUN_LIMIT = 50;
const MAX_RUN_LIMIT = 200;
const DEFAULT_SAMPLE_LIMIT = 3000;
const MAX_SAMPLE_LIMIT = 20000;
const DEFAULT_SECTION_LIMIT = 8;
const MAX_SECTION_LIMIT = 32;
const MIN_PATH_STEP_METERS = 1.5;
const MIN_SECTION_POINTS = 8;
const MIN_SECTION_DISTANCE_METERS = 50;

const TELEMETRY_PACKET_FIELDS = [
  "IsRaceOn",
  "TimestampMS",
  "EngineMaxRpm",
  "EngineIdleRpm",
  "CurrentEngineRpm",
  "AccelerationX",
  "AccelerationY",
  "AccelerationZ",
  "VelocityX",
  "VelocityY",
  "VelocityZ",
  "AngularVelocityX",
  "AngularVelocityY",
  "AngularVelocityZ",
  "Yaw",
  "Pitch",
  "Roll",
  "NormalizedSuspensionTravelFrontLeft",
  "NormalizedSuspensionTravelFrontRight",
  "NormalizedSuspensionTravelRearLeft",
  "NormalizedSuspensionTravelRearRight",
  "TireSlipRatioFrontLeft",
  "TireSlipRatioFrontRight",
  "TireSlipRatioRearLeft",
  "TireSlipRatioRearRight",
  "WheelRotationSpeedFrontLeft",
  "WheelRotationSpeedFrontRight",
  "WheelRotationSpeedRearLeft",
  "WheelRotationSpeedRearRight",
  "WheelOnRumbleStripFrontLeft",
  "WheelOnRumbleStripFrontRight",
  "WheelOnRumbleStripRearLeft",
  "WheelOnRumbleStripRearRight",
  "WheelInPuddleFrontLeft",
  "WheelInPuddleFrontRight",
  "WheelInPuddleRearLeft",
  "WheelInPuddleRearRight",
  "SurfaceRumbleFrontLeft",
  "SurfaceRumbleFrontRight",
  "SurfaceRumbleRearLeft",
  "SurfaceRumbleRearRight",
  "TireSlipAngleFrontLeft",
  "TireSlipAngleFrontRight",
  "TireSlipAngleRearLeft",
  "TireSlipAngleRearRight",
  "TireCombinedSlipFrontLeft",
  "TireCombinedSlipFrontRight",
  "TireCombinedSlipRearLeft",
  "TireCombinedSlipRearRight",
  "SuspensionTravelMetersFrontLeft",
  "SuspensionTravelMetersFrontRight",
  "SuspensionTravelMetersRearLeft",
  "SuspensionTravelMetersRearRight",
  "SmashableVelDiff",
  "SmashableMass",
  "PositionX",
  "PositionY",
  "PositionZ",
  "Speed",
  "Power",
  "Torque",
  "TireTempFrontLeft",
  "TireTempFrontRight",
  "TireTempRearLeft",
  "TireTempRearRight",
  "Boost",
  "Fuel",
  "DistanceTraveled",
  "BestLap",
  "LastLap",
  "CurrentLap",
  "CurrentRaceTime",
  "LapNumber",
  "RacePosition",
  "Accel",
  "Brake",
  "Clutch",
  "HandBrake",
  "Gear",
  "Steer",
  "NormalizedDrivingLine",
  "NormalizedAIBrakeDifference",
  "speedKmh",
  "speedMph",
  "powerHp",
  "torqueNm",
  "throttlePct",
  "brakePct",
  "steerPct",
  "frontSlip",
  "rearSlip",
  "slipBalance",
  "frontTemp",
  "rearTemp",
  "tempBalance",
  "suspensionAvgFront",
  "suspensionAvgRear"
] as const satisfies readonly Exclude<keyof Telemetry, "receivedAt">[];

const INTEGER_PACKET_FIELDS = new Set<keyof Telemetry>([
  "IsRaceOn",
  "TimestampMS",
  "WheelOnRumbleStripFrontLeft",
  "WheelOnRumbleStripFrontRight",
  "WheelOnRumbleStripRearLeft",
  "WheelOnRumbleStripRearRight",
  "WheelInPuddleFrontLeft",
  "WheelInPuddleFrontRight",
  "WheelInPuddleRearLeft",
  "WheelInPuddleRearRight",
  "LapNumber",
  "RacePosition",
  "Accel",
  "Brake",
  "Clutch",
  "HandBrake",
  "Gear",
  "Steer",
  "NormalizedDrivingLine",
  "NormalizedAIBrakeDifference"
]);

type PacketField = typeof TELEMETRY_PACKET_FIELDS[number];

type RawPacketInput = {
  receivedAt: number;
  source: string | null;
  rawPacket: Buffer;
};

type StartRunInput = {
  id: string;
  startedAt: number;
  splitReason: string;
  runType: RunType;
  telemetry: Telemetry;
  source: string;
};

type ValidPacketInput = {
  runId: string;
  receivedAt: number;
  source: string | null;
  telemetry: Telemetry;
};

type ListRunsQuery = {
  cursor?: string | null;
  direction?: "next" | "previous";
  limit?: number;
};

type SampleWindowQuery = {
  runId: string;
  start?: number;
  limit?: number;
};

type SectionPageQuery = {
  runId: string;
  type: "corner" | "straight";
  page?: number;
  limit?: number;
};

type SectionSampleQuery = {
  runId: string;
  sectionId: string;
};

type RunRow = {
  id: string;
  status: "active" | "completed";
  runType: RunType;
  startedAt: number;
  lastPacketAt: number | null;
  endedAt: number | null;
  packetCount: number;
  lastSource: string | null;
  splitReason: string | null;
  endReason: string | null;
  carOrdinal: number | null;
  carClass: number | null;
  carPerformanceIndex: number | null;
  drivetrainType: number | null;
  numCylinders: number | null;
  carGroup: number | null;
  pathJson: string | null;
  pathPointCount: number;
  summaryJson: string | null;
};

type RunSectionRow = {
  id: string;
  runId: string;
  type: "corner" | "straight";
  sectionIndex: number;
  sampleStart: number;
  sampleEnd: number;
  distanceMeters: number;
  durationMs: number;
  metricsJson: string | null;
  previewPathJson: string | null;
};

type StoredPathSample = Omit<PathSample, "telemetry">;

export function createTelemetryDatabase(
  dbPath = process.env.TELEMETRY_DB_PATH || DEFAULT_DB_PATH,
  rawDbPath = process.env.TELEMETRY_RAW_DB_PATH || path.join(path.dirname(dbPath), "raw-telemetry.sqlite")
) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(path.dirname(rawDbPath), { recursive: true });

  const sqlite = new BetterSqliteDatabase(dbPath);
  const rawSqlite = new BetterSqliteDatabase(rawDbPath);
  createParsedSchema(sqlite);
  createRawSchema(rawSqlite);

  const recordRawPacketStatement = rawSqlite.prepare(`
    INSERT INTO raw_udp_packets (received_at, source, raw_packet_size, raw_packet)
    VALUES (?, ?, ?, ?)
  `);
  const insertPacketStatement = sqlite.prepare(`
    INSERT INTO telemetry_packets (
      run_id,
      sample_index,
      received_at,
      source,
      ${TELEMETRY_PACKET_FIELDS.map(quoteIdentifier).join(",\n      ")}
    )
    VALUES (
      ?,
      ?,
      ?,
      ?,
      ${TELEMETRY_PACKET_FIELDS.map(() => "?").join(", ")}
    )
  `);

  return {
    path: dbPath,
    rawPath: rawDbPath,

    recordRawPacket({ receivedAt, source, rawPacket }: RawPacketInput) {
      recordRawPacketStatement.run(receivedAt, source, rawPacket.length, rawPacket);
    },

    deleteIncompleteRuns() {
      const rows = sqlite.prepare("SELECT id FROM runs WHERE status <> 'completed' OR packet_count = 0").all() as { id: string }[];
      const cleanup = sqlite.transaction((runIds: string[]) => {
        for (const runId of runIds) {
          sqlite.prepare("DELETE FROM run_sections WHERE run_id = ?").run(runId);
          sqlite.prepare("DELETE FROM telemetry_packets WHERE run_id = ?").run(runId);
          sqlite.prepare("DELETE FROM runs WHERE id = ?").run(runId);
        }
      });
      cleanup(rows.map((row) => row.id));
      return rows.length;
    },

    startRun({ id, startedAt, splitReason, runType, telemetry, source }: StartRunInput) {
      sqlite.prepare(`
        INSERT INTO runs (
          id,
          status,
          run_type,
          started_at,
          last_packet_at,
          packet_count,
          last_source,
          split_reason,
          car_ordinal,
          car_class,
          car_performance_index,
          drivetrain_type,
          num_cylinders,
          car_group
        )
        VALUES (?, 'active', ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        runType,
        startedAt,
        startedAt,
        source,
        splitReason,
        telemetry.CarOrdinal,
        telemetry.CarClass,
        telemetry.CarPerformanceIndex,
        telemetry.DrivetrainType,
        telemetry.NumCylinders,
        telemetry.CarGroup
      );
      return getRunSummary(sqlite, id);
    },

    recordValidPacket({ runId, receivedAt, source, telemetry }: ValidPacketInput) {
      const sampleIndex = getRunPacketCount(sqlite, runId);
      insertPacketStatement.run(
        runId,
        sampleIndex,
        receivedAt,
        source,
        ...TELEMETRY_PACKET_FIELDS.map((field) => numberValue(telemetry[field]))
      );

      sqlite.prepare(`
        UPDATE runs
        SET
          last_packet_at = ?,
          packet_count = packet_count + 1,
          last_source = ?,
          car_ordinal = ?,
          car_class = ?,
          car_performance_index = ?,
          drivetrain_type = ?,
          num_cylinders = ?,
          car_group = ?
        WHERE id = ?
      `).run(
        receivedAt,
        source,
        telemetry.CarOrdinal,
        telemetry.CarClass,
        telemetry.CarPerformanceIndex,
        telemetry.DrivetrainType,
        telemetry.NumCylinders,
        telemetry.CarGroup,
        runId
      );
    },

    finalizeRun(runId: string, endedAt = Date.now(), endReason = "completed") {
      const run = getRunSummary(sqlite, runId);
      if (!run) return null;
      if (run.packetCount <= 0) {
        deleteRun(sqlite, runId);
        return null;
      }

      const finalize = sqlite.transaction(() => {
        const samples = selectTelemetrySamples(sqlite, runId, 0, run.packetCount);
        const pathSamples = buildPathFromSamples(samples);
        const summary = summarizeSamples(samples);
        const sections = buildRunSections(runId, samples, pathSamples);

        sqlite.prepare("DELETE FROM run_sections WHERE run_id = ?").run(runId);
        const insertSection = sqlite.prepare(`
          INSERT INTO run_sections (
            id,
            run_id,
            type,
            section_index,
            sample_start,
            sample_end,
            distance_meters,
            duration_ms,
            metrics_json,
            preview_path_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const section of sections) {
          insertSection.run(
            section.id,
            runId,
            section.type,
            section.index,
            section.sampleStart,
            section.sampleEnd,
            section.distanceMeters,
            section.durationMs,
            JSON.stringify(section.metrics),
            JSON.stringify(section.previewPath)
          );
        }

        sqlite.prepare(`
          UPDATE runs
          SET
            status = 'completed',
            ended_at = ?,
            end_reason = ?,
            path_json = ?,
            path_point_count = ?,
            summary_json = ?
          WHERE id = ?
        `).run(
          endedAt,
          endReason,
          JSON.stringify(stripTelemetryFromPath(pathSamples)),
          pathSamples.length,
          summary ? JSON.stringify(summary) : null,
          runId
        );
      });

      finalize();
      return getRunSummary(sqlite, runId);
    },

    listRunsPage({ cursor = null, direction = "next", limit = DEFAULT_RUN_LIMIT }: ListRunsQuery = {}): RunsPage {
      const clampedLimit = clampLimit(limit, DEFAULT_RUN_LIMIT, MAX_RUN_LIMIT);
      const decodedCursor = decodeRunCursor(cursor);
      const rows = queryRunRows(sqlite, decodedCursor, direction, clampedLimit + 1);
      const pageRows = rows.slice(0, clampedLimit);
      const orderedRows = direction === "previous" ? pageRows.reverse() : pageRows;
      const runs = orderedRows.map(runRowToSummary);
      return {
        runs,
        nextCursor: rows.length > clampedLimit && orderedRows.length > 0 ? encodeRunCursor(orderedRows[orderedRows.length - 1]) : null,
        previousCursor: orderedRows.length > 0 ? encodeRunCursor(orderedRows[0]) : null,
        hasNextPage: rows.length > clampedLimit,
        hasPreviousPage: Boolean(cursor)
      };
    },

    getRunSummary(runId: string) {
      return getRunSummary(sqlite, runId);
    },

    getRunSampleWindow({ runId, start = 0, limit = DEFAULT_SAMPLE_LIMIT }: SampleWindowQuery): RunSampleWindow {
      const run = getRunSummary(sqlite, runId);
      const total = run?.packetCount ?? 0;
      const clampedLimit = clampLimit(limit, DEFAULT_SAMPLE_LIMIT, MAX_SAMPLE_LIMIT);
      const clampedStart = Math.min(Math.max(0, Math.round(start)), Math.max(0, total - clampedLimit));
      return {
        start: clampedStart,
        total,
        samples: run ? selectTelemetrySamples(sqlite, runId, clampedStart, clampedLimit, run) : []
      };
    },

    getRunPath(runId: string): PathSample[] {
      const row = sqlite.prepare("SELECT path_json AS pathJson FROM runs WHERE id = ?").get(runId) as { pathJson?: string | null } | undefined;
      if (!row?.pathJson) return [];
      return (JSON.parse(row.pathJson) as StoredPathSample[]).map((sample) => ({ ...sample, telemetry: null }));
    },

    listRunSections({ runId, type, page = 0, limit = DEFAULT_SECTION_LIMIT }: SectionPageQuery): RunSectionPage {
      const clampedLimit = clampLimit(limit, DEFAULT_SECTION_LIMIT, MAX_SECTION_LIMIT);
      const clampedPage = Math.max(0, Math.round(page));
      const total = (sqlite.prepare(`
        SELECT COUNT(*) AS total
        FROM run_sections
        WHERE run_id = ?
          AND type = ?
      `).get(runId, type) as { total?: number } | undefined)?.total ?? 0;
      const rows = sqlite.prepare(`
        SELECT
          id,
          run_id AS runId,
          type,
          section_index AS sectionIndex,
          sample_start AS sampleStart,
          sample_end AS sampleEnd,
          distance_meters AS distanceMeters,
          duration_ms AS durationMs,
          metrics_json AS metricsJson,
          preview_path_json AS previewPathJson
        FROM run_sections
        WHERE run_id = ?
          AND type = ?
        ORDER BY section_index
        LIMIT ? OFFSET ?
      `).all(runId, type, clampedLimit, clampedPage * clampedLimit) as RunSectionRow[];
      return {
        runId,
        type,
        page: clampedPage,
        limit: clampedLimit,
        total,
        sections: rows.map(sectionRowToSummary)
      };
    },

    getRunSectionSamples({ runId, sectionId }: SectionSampleQuery): RunSectionSamples | null {
      const row = sqlite.prepare(`
        SELECT
          id,
          run_id AS runId,
          type,
          section_index AS sectionIndex,
          sample_start AS sampleStart,
          sample_end AS sampleEnd,
          distance_meters AS distanceMeters,
          duration_ms AS durationMs,
          metrics_json AS metricsJson,
          preview_path_json AS previewPathJson
        FROM run_sections
        WHERE run_id = ?
          AND id = ?
      `).get(runId, sectionId) as RunSectionRow | undefined;
      const run = getRunSummary(sqlite, runId);
      if (!row || !run) return null;
      const start = row.sampleStart;
      const limit = Math.max(0, row.sampleEnd - row.sampleStart);
      return {
        section: sectionRowToSummary(row),
        samples: selectTelemetrySamples(sqlite, runId, start, limit, run)
      };
    },

    close() {
      sqlite.close();
      rawSqlite.close();
    }
  };
}

function createParsedSchema(sqlite: BetterSqliteDatabase.Database) {
  const currentVersion = sqlite.pragma("user_version", { simple: true }) as number;
  if (currentVersion !== TELEMETRY_SCHEMA_VERSION) {
    resetParsedSchema(sqlite);
  }

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      run_type TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      last_packet_at INTEGER,
      ended_at INTEGER,
      packet_count INTEGER NOT NULL DEFAULT 0,
      last_source TEXT,
      split_reason TEXT,
      end_reason TEXT,
      car_ordinal INTEGER,
      car_class INTEGER,
      car_performance_index INTEGER,
      drivetrain_type INTEGER,
      num_cylinders INTEGER,
      car_group INTEGER,
      path_json TEXT,
      path_point_count INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT
    );

    CREATE TABLE IF NOT EXISTS telemetry_packets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      sample_index INTEGER NOT NULL,
      received_at INTEGER NOT NULL,
      source TEXT,
      ${TELEMETRY_PACKET_FIELDS.map((field) => `${quoteIdentifier(field)} ${INTEGER_PACKET_FIELDS.has(field) ? "INTEGER" : "REAL"} NOT NULL`).join(",\n      ")}
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_packets_run_sample
      ON telemetry_packets(run_id, sample_index);

    CREATE INDEX IF NOT EXISTS idx_telemetry_packets_run_time
      ON telemetry_packets(run_id, received_at);

    CREATE TABLE IF NOT EXISTS run_sections (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      section_index INTEGER NOT NULL,
      sample_start INTEGER NOT NULL,
      sample_end INTEGER NOT NULL,
      distance_meters REAL NOT NULL,
      duration_ms INTEGER NOT NULL,
      metrics_json TEXT,
      preview_path_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_runs_completed_started_at
      ON runs(status, started_at, id);

    CREATE INDEX IF NOT EXISTS idx_run_sections_page
      ON run_sections(run_id, type, section_index);

    PRAGMA user_version = ${TELEMETRY_SCHEMA_VERSION};
  `);
}

function createRawSchema(sqlite: BetterSqliteDatabase.Database) {
  const currentVersion = sqlite.pragma("user_version", { simple: true }) as number;
  if (currentVersion !== RAW_SCHEMA_VERSION) {
    sqlite.exec(`
      DROP TABLE IF EXISTS raw_udp_packets;
      PRAGMA user_version = ${RAW_SCHEMA_VERSION};
    `);
  }

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS raw_udp_packets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at INTEGER NOT NULL,
      source TEXT,
      raw_packet_size INTEGER NOT NULL,
      raw_packet BLOB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_raw_udp_packets_received_at
      ON raw_udp_packets(received_at);
  `);
}

function resetParsedSchema(sqlite: BetterSqliteDatabase.Database) {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS run_power_analysis;
    DROP TABLE IF EXISTS run_path_points;
    DROP TABLE IF EXISTS run_sections;
    DROP TABLE IF EXISTS telemetry_packets;
    DROP TABLE IF EXISTS runs;
    DROP TABLE IF EXISTS car_sessions;
    PRAGMA foreign_keys = ON;
  `);
}

function queryRunRows(
  sqlite: BetterSqliteDatabase.Database,
  cursor: { startedAt: number; id: string } | null,
  direction: "next" | "previous",
  limit: number
) {
  const cursorWhere = cursor
    ? direction === "next"
      ? "AND (started_at < ? OR (started_at = ? AND id < ?))"
      : "AND (started_at > ? OR (started_at = ? AND id > ?))"
    : "";
  const order = direction === "next" ? "DESC" : "ASC";
  const params = cursor
    ? [cursor.startedAt, cursor.startedAt, cursor.id, limit]
    : [limit];

  return sqlite.prepare(`
    SELECT ${runSelectColumns()}
    FROM runs
    WHERE status = 'completed'
      AND packet_count > 0
      ${cursorWhere}
    ORDER BY started_at ${order}, id ${order}
    LIMIT ?
  `).all(...params) as RunRow[];
}

function runSelectColumns() {
  return `
    id,
    status,
    run_type AS runType,
    started_at AS startedAt,
    last_packet_at AS lastPacketAt,
    ended_at AS endedAt,
    packet_count AS packetCount,
    last_source AS lastSource,
    split_reason AS splitReason,
    end_reason AS endReason,
    car_ordinal AS carOrdinal,
    car_class AS carClass,
    car_performance_index AS carPerformanceIndex,
    drivetrain_type AS drivetrainType,
    num_cylinders AS numCylinders,
    car_group AS carGroup,
    path_json AS pathJson,
    path_point_count AS pathPointCount,
    summary_json AS summaryJson
  `;
}

function getRunSummary(sqlite: BetterSqliteDatabase.Database, runId: string): RunSummary | null {
  const row = sqlite.prepare(`
    SELECT ${runSelectColumns()}
    FROM runs
    WHERE id = ?
  `).get(runId) as RunRow | undefined;
  return row ? runRowToSummary(row) : null;
}

function getRunPacketCount(sqlite: BetterSqliteDatabase.Database, runId: string) {
  return (sqlite.prepare("SELECT packet_count AS packetCount FROM runs WHERE id = ?").get(runId) as { packetCount?: number } | undefined)?.packetCount ?? 0;
}

function deleteRun(sqlite: BetterSqliteDatabase.Database, runId: string) {
  sqlite.prepare("DELETE FROM run_sections WHERE run_id = ?").run(runId);
  sqlite.prepare("DELETE FROM telemetry_packets WHERE run_id = ?").run(runId);
  sqlite.prepare("DELETE FROM runs WHERE id = ?").run(runId);
}

function selectTelemetrySamples(
  sqlite: BetterSqliteDatabase.Database,
  runId: string,
  start: number,
  limit: number,
  runSummary = getRunSummary(sqlite, runId)
): Telemetry[] {
  if (!runSummary || limit <= 0) return [];
  const columns = TELEMETRY_PACKET_FIELDS.map((field) => quoteIdentifier(field)).join(", ");
  const rows = sqlite.prepare(`
    SELECT sample_index AS sampleIndex, received_at AS receivedAt, ${columns}
    FROM telemetry_packets
    WHERE run_id = ?
    ORDER BY sample_index
    LIMIT ? OFFSET ?
  `).all(runId, limit, start) as (Record<PacketField | "receivedAt", number> & { sampleIndex: number })[];

  return rows.map((row) => rowToTelemetry(row, runSummary));
}

function rowToTelemetry(row: Record<PacketField | "receivedAt", number>, run: RunSummary): Telemetry {
  const telemetry = {} as Telemetry;
  for (const field of TELEMETRY_PACKET_FIELDS) {
    telemetry[field] = row[field] as never;
  }
  telemetry.CarOrdinal = run.carOrdinal ?? 0;
  telemetry.CarClass = run.carClass ?? 0;
  telemetry.CarPerformanceIndex = run.carPerformanceIndex ?? 0;
  telemetry.DrivetrainType = run.drivetrainType ?? 0;
  telemetry.NumCylinders = run.numCylinders ?? 0;
  telemetry.CarGroup = run.carGroup ?? 0;
  telemetry.receivedAt = row.receivedAt;
  return telemetry;
}

function buildPathFromSamples(samples: Telemetry[]) {
  const pathSamples: PathSample[] = [];
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!Number.isFinite(sample.PositionX) || !Number.isFinite(sample.PositionZ)) continue;
    const point: PathSample = {
      x: sample.PositionX,
      z: sample.PositionZ,
      speedKmh: sample.speedKmh || 0,
      at: sample.receivedAt ?? Date.now(),
      sampleIndex: index,
      telemetry: sample
    };
    const previous = pathSamples[pathSamples.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.z - previous.z) < MIN_PATH_STEP_METERS) continue;
    pathSamples.push(point);
  }
  return pathSamples;
}

function stripTelemetryFromPath(pathSamples: PathSample[]): StoredPathSample[] {
  return pathSamples.map(({ telemetry: _telemetry, ...sample }) => sample);
}

function summarizeSamples(samples: Telemetry[]): Summary | null {
  const runWindow = new TelemetryWindow();
  for (const sample of samples) runWindow.add(sample);
  return runWindow.summary();
}

function buildRunSections(runId: string, samples: Telemetry[], pathSamples: PathSample[]) {
  const cornerRanges = buildCornerRanges(pathSamples);
  const straightRanges = invertRanges(cornerRanges, pathSamples.length);
  return [
    ...cornerRanges.map((range, index) => buildSection(runId, "corner" as const, index, range, pathSamples, samples)),
    ...straightRanges.map((range, index) => buildSection(runId, "straight" as const, index, range, pathSamples, samples))
  ].filter((section): section is NonNullable<typeof section> => Boolean(section));
}

function buildSection(
  runId: string,
  type: "corner" | "straight",
  index: number,
  range: { start: number; end: number },
  pathSamples: PathSample[],
  samples: Telemetry[]
) {
  const points = pathSamples.slice(range.start, range.end);
  if (points.length < MIN_SECTION_POINTS) return null;
  const distanceMeters = pathDistanceMeters(points);
  if (distanceMeters < MIN_SECTION_DISTANCE_METERS) return null;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const sampleStart = firstPoint.sampleIndex;
  const sampleEnd = Math.min(samples.length, lastPoint.sampleIndex + 1);
  const sectionSamples = samples.slice(sampleStart, sampleEnd);
  const durationMs = Math.max(0, (lastPoint.at ?? 0) - (firstPoint.at ?? 0));

  return {
    id: `${runId}:${type}:${index}`,
    type,
    index,
    sampleStart,
    sampleEnd,
    distanceMeters,
    durationMs,
    metrics: sectionMetrics(type, sectionSamples, distanceMeters, durationMs),
    previewPath: downsamplePath(stripTelemetryFromPath(points), 120)
  };
}

function buildCornerRanges(pathSamples: PathSample[]) {
  if (pathSamples.length < MIN_SECTION_POINTS) return [];
  const cornerFlags = pathSamples.map((_sample, index) => Math.abs(turnDegrees(pathSamples, index, 5)) >= 12);
  const ranges = flagsToRanges(cornerFlags);
  return mergeShortGaps(ranges.filter((range) => range.end - range.start >= MIN_SECTION_POINTS), pathSamples);
}

function flagsToRanges(flags: boolean[]) {
  const ranges: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (let index = 0; index < flags.length; index += 1) {
    if (flags[index] && start === null) start = index;
    if ((!flags[index] || index === flags.length - 1) && start !== null) {
      ranges.push({ start, end: flags[index] && index === flags.length - 1 ? index + 1 : index });
      start = null;
    }
  }
  return ranges;
}

function mergeShortGaps(ranges: { start: number; end: number }[], pathSamples: PathSample[]) {
  if (ranges.length < 2) return ranges;
  const merged: { start: number; end: number }[] = [ranges[0]];
  for (const range of ranges.slice(1)) {
    const previous = merged[merged.length - 1];
    const gapDistance = pathDistanceMeters(pathSamples.slice(previous.end, range.start));
    if (gapDistance < 80) {
      previous.end = range.end;
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function invertRanges(ranges: { start: number; end: number }[], total: number) {
  const inverted: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) inverted.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < total) inverted.push({ start: cursor, end: total });
  return inverted.filter((range) => range.end - range.start >= MIN_SECTION_POINTS);
}

function turnDegrees(pathSamples: PathSample[], index: number, step: number) {
  const previous = pathSamples[Math.max(0, index - step)];
  const current = pathSamples[index];
  const next = pathSamples[Math.min(pathSamples.length - 1, index + step)];
  if (!previous || !current || !next || previous === current || next === current) return 0;
  const entryHeading = Math.atan2(current.z - previous.z, current.x - previous.x);
  const exitHeading = Math.atan2(next.z - current.z, next.x - current.x);
  return radiansToDegrees(normalizeRadians(exitHeading - entryHeading));
}

function sectionMetrics(type: "corner" | "straight", samples: Telemetry[], distanceMeters: number, durationMs: number) {
  const speeds = samples.map((sample) => sample.speedKmh).filter(Number.isFinite);
  const throttle = samples.map((sample) => sample.throttlePct).filter(Number.isFinite);
  const brake = samples.map((sample) => sample.brakePct).filter(Number.isFinite);
  const lateralG = samples.map((sample) => Math.abs(sample.AccelerationX / 9.81)).filter(Number.isFinite);
  return {
    type,
    distanceMeters,
    durationSeconds: durationMs / 1000,
    peakSpeedKmh: speeds.length ? Math.max(...speeds) : 0,
    avgSpeedKmh: average(speeds),
    maxThrottlePct: throttle.length ? Math.max(...throttle) : 0,
    maxBrakePct: brake.length ? Math.max(...brake) : 0,
    peakLateralG: lateralG.length ? Math.max(...lateralG) : 0
  };
}

function pathDistanceMeters(pathSamples: Pick<PathSample, "x" | "z">[]) {
  let distance = 0;
  for (let index = 1; index < pathSamples.length; index += 1) {
    distance += Math.hypot(pathSamples[index].x - pathSamples[index - 1].x, pathSamples[index].z - pathSamples[index - 1].z);
  }
  return distance;
}

function downsamplePath(pathSamples: StoredPathSample[], maxPoints: number) {
  if (pathSamples.length <= maxPoints) return pathSamples;
  const stride = Math.ceil(pathSamples.length / maxPoints);
  const sampled = pathSamples.filter((_sample, index) => index % stride === 0);
  const last = pathSamples[pathSamples.length - 1];
  if (sampled.at(-1)?.sampleIndex !== last.sampleIndex) sampled.push(last);
  return sampled;
}

function runRowToSummary(row: RunRow): RunSummary {
  return {
    id: row.id,
    status: row.status,
    runType: row.runType,
    startedAt: row.startedAt,
    lastPacketAt: row.lastPacketAt,
    endedAt: row.endedAt,
    packetCount: row.packetCount,
    lastSource: row.lastSource,
    splitReason: row.splitReason,
    endReason: row.endReason,
    carOrdinal: row.carOrdinal,
    carClass: row.carClass,
    carPerformanceIndex: row.carPerformanceIndex,
    drivetrainType: row.drivetrainType,
    numCylinders: row.numCylinders,
    carGroup: row.carGroup,
    pathPointCount: row.pathPointCount,
    summary: row.summaryJson ? JSON.parse(row.summaryJson) as Summary : null
  };
}

function sectionRowToSummary(row: RunSectionRow): RunSection {
  return {
    id: row.id,
    runId: row.runId,
    type: row.type,
    index: row.sectionIndex,
    sampleStart: row.sampleStart,
    sampleEnd: row.sampleEnd,
    distanceMeters: row.distanceMeters,
    durationMs: row.durationMs,
    metrics: row.metricsJson ? JSON.parse(row.metricsJson) as Record<string, number | string> : {},
    previewPath: row.previewPathJson ? JSON.parse(row.previewPathJson) as StoredPathSample[] : []
  };
}

function encodeRunCursor(row: Pick<RunRow, "startedAt" | "id">) {
  return `${row.startedAt}:${row.id}`;
}

function decodeRunCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  const [startedAtRaw, id] = cursor.split(":");
  const startedAt = Number(startedAtRaw);
  if (!Number.isFinite(startedAt) || !id) return null;
  return { startedAt, id };
}

function clampLimit(value: unknown, defaultValue: number, maxValue: number) {
  const parsed = Number(value || defaultValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(maxValue, Math.max(1, Math.round(parsed)));
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function normalizeRadians(value: number) {
  let result = value;
  while (result <= -Math.PI) result += Math.PI * 2;
  while (result > Math.PI) result -= Math.PI * 2;
  return result;
}

function radiansToDegrees(value: number) {
  return value * 180 / Math.PI;
}
