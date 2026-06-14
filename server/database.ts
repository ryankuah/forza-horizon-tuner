import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import BetterSqliteDatabase from "better-sqlite3";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { CarSessionSummary, PathSample, PowerBandEstimate, RunSampleWindow, RunSummary, Telemetry } from "../src/types/telemetry";
import { carSessions, runs, telemetryPackets } from "./schema";
import { estimatePowerBand } from "./powerBand";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "telemetry.sqlite");
const TELEMETRY_SCHEMA_VERSION = 2;

type ValidPacketInput = {
  runId: string;
  receivedAt: number;
  source: string | null;
  rawPacket?: Buffer | null;
  telemetry: Telemetry;
};

type BadPacketInput = {
  runId: string;
  receivedAt: number;
  source: string | null;
  rawPacket?: Buffer | null;
  error: string;
};

function createSchema(sqlite: BetterSqliteDatabase.Database) {
  const currentVersion = sqlite.pragma("user_version", { simple: true }) as number;
  if (currentVersion !== TELEMETRY_SCHEMA_VERSION) {
    resetTelemetrySchema(sqlite);
  }

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS car_sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      last_packet_at INTEGER,
      ended_at INTEGER,
      run_count INTEGER NOT NULL DEFAULT 0,
      packet_count INTEGER NOT NULL DEFAULT 0,
      bad_packet_count INTEGER NOT NULL DEFAULT 0,
      car_ordinal INTEGER,
      car_class INTEGER,
      car_performance_index INTEGER,
      drivetrain_type INTEGER
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      car_session_id TEXT NOT NULL REFERENCES car_sessions(id) ON DELETE CASCADE,
      started_at INTEGER NOT NULL,
      last_packet_at INTEGER,
      ended_at INTEGER,
      packet_count INTEGER NOT NULL DEFAULT 0,
      bad_packet_count INTEGER NOT NULL DEFAULT 0,
      last_source TEXT,
      split_reason TEXT,
      car_ordinal INTEGER,
      car_class INTEGER,
      car_performance_index INTEGER,
      drivetrain_type INTEGER
    );

    CREATE TABLE IF NOT EXISTS telemetry_packets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      received_at INTEGER NOT NULL,
      source TEXT,
      parse_ok INTEGER NOT NULL,
      raw_packet BLOB,
      raw_packet_size INTEGER NOT NULL,
      telemetry_json TEXT,
      parse_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_packets_run_time
      ON telemetry_packets(run_id, received_at);

    CREATE TABLE IF NOT EXISTS run_path_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      sample_index INTEGER NOT NULL,
      x REAL NOT NULL,
      z REAL NOT NULL,
      speed_kmh REAL NOT NULL,
      at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_run_path_points_run_sample
      ON run_path_points(run_id, sample_index);

    CREATE TABLE IF NOT EXISTS run_power_analysis (
      run_id TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
      packet_count INTEGER NOT NULL,
      analysis_json TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_runs_started_at
      ON runs(started_at);

    CREATE INDEX IF NOT EXISTS idx_car_sessions_started_at
      ON car_sessions(started_at);

    PRAGMA user_version = ${TELEMETRY_SCHEMA_VERSION};
  `);
}

function resetTelemetrySchema(sqlite: BetterSqliteDatabase.Database) {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DROP TABLE IF EXISTS run_power_analysis;
    DROP TABLE IF EXISTS run_path_points;
    DROP TABLE IF EXISTS telemetry_packets;
    DROP TABLE IF EXISTS runs;
    DROP TABLE IF EXISTS car_sessions;
    PRAGMA foreign_keys = ON;
  `);
}

export function createTelemetryDatabase(dbPath = process.env.TELEMETRY_DB_PATH || DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new BetterSqliteDatabase(dbPath);
  createSchema(sqlite);

  const db = drizzle(sqlite, { schema: { carSessions, runs, telemetryPackets } });

  return {
    path: dbPath,

    startCarSession(startedAt = Date.now(), id: string = randomUUID()) {
      db.insert(carSessions).values({
        id,
        startedAt,
        lastPacketAt: startedAt
      }).run();
      return { id, startedAt };
    },

    endCarSession(carSessionId: string, endedAt = Date.now()) {
      db.update(carSessions)
        .set({ endedAt })
        .where(and(eq(carSessions.id, carSessionId), isNull(carSessions.endedAt)))
        .run();
    },

    startRun(carSessionId: string, startedAt = Date.now(), id: string = randomUUID(), splitReason = "start") {
      db.insert(runs).values({
        id,
        carSessionId,
        startedAt,
        lastPacketAt: startedAt,
        splitReason
      }).run();
      db.update(carSessions)
        .set({
          runCount: sql`${carSessions.runCount} + 1`,
          lastPacketAt: startedAt
        })
        .where(eq(carSessions.id, carSessionId))
        .run();
      return { id, startedAt };
    },

    endRun(runId: string, endedAt = Date.now()) {
      db.update(runs)
        .set({ endedAt })
        .where(and(eq(runs.id, runId), isNull(runs.endedAt)))
        .run();
    },

    recordValidPacket({ runId, receivedAt, source, rawPacket, telemetry }: ValidPacketInput) {
      const sampleIndex = (sqlite.prepare("SELECT packet_count AS packetCount FROM runs WHERE id = ?").get(runId) as { packetCount?: number } | undefined)?.packetCount ?? 0;

      db.insert(telemetryPackets).values({
        runId,
        receivedAt,
        source,
        parseOk: true,
        rawPacket: rawPacket ?? null,
        rawPacketSize: rawPacket?.length ?? 0,
        telemetryJson: JSON.stringify(telemetry),
        parseError: null
      }).run();

      if (
        telemetry.IsRaceOn === 1
        && Number.isFinite(telemetry.PositionX)
        && Number.isFinite(telemetry.PositionZ)
      ) {
        sqlite.prepare(`
          INSERT INTO run_path_points (run_id, sample_index, x, z, speed_kmh, at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          runId,
          sampleIndex,
          telemetry.PositionX,
          telemetry.PositionZ,
          telemetry.speedKmh || 0,
          telemetry.receivedAt || receivedAt
        );
      }

      db.update(runs)
        .set({
          lastPacketAt: receivedAt,
          packetCount: sql`${runs.packetCount} + 1`,
          lastSource: source,
          carOrdinal: telemetry.CarOrdinal,
          carClass: telemetry.CarClass,
          carPerformanceIndex: telemetry.CarPerformanceIndex,
          drivetrainType: telemetry.DrivetrainType
        })
        .where(eq(runs.id, runId))
        .run();

      const carSessionId = getRunCarSessionId(sqlite, runId);
      if (carSessionId) {
        db.update(carSessions)
          .set({
            lastPacketAt: receivedAt,
            packetCount: sql`${carSessions.packetCount} + 1`,
            carOrdinal: telemetry.CarOrdinal,
            carClass: telemetry.CarClass,
            carPerformanceIndex: telemetry.CarPerformanceIndex,
            drivetrainType: telemetry.DrivetrainType
          })
          .where(eq(carSessions.id, carSessionId))
          .run();
      }
    },

    recordBadPacket({ runId, receivedAt, source, rawPacket, error }: BadPacketInput) {
      db.insert(telemetryPackets).values({
        runId,
        receivedAt,
        source,
        parseOk: false,
        rawPacket: rawPacket ?? null,
        rawPacketSize: rawPacket?.length ?? 0,
        telemetryJson: null,
        parseError: error
      }).run();

      db.update(runs)
        .set({
          lastPacketAt: receivedAt,
          badPacketCount: sql`${runs.badPacketCount} + 1`,
          lastSource: source
        })
        .where(eq(runs.id, runId))
        .run();

      const carSessionId = getRunCarSessionId(sqlite, runId);
      if (carSessionId) {
        db.update(carSessions)
          .set({
            lastPacketAt: receivedAt,
            badPacketCount: sql`${carSessions.badPacketCount} + 1`
          })
          .where(eq(carSessions.id, carSessionId))
          .run();
      }
    },

    listCarSessions(): CarSessionSummary[] {
      const sessionRows = db.select()
        .from(carSessions)
        .where(sql`${carSessions.packetCount} > 0`)
        .orderBy(desc(carSessions.lastPacketAt), desc(carSessions.startedAt))
        .all() as Omit<CarSessionSummary, "runs">[];

      return sessionRows.map((session) => ({
        ...session,
        runs: db.select()
          .from(runs)
          .where(and(eq(runs.carSessionId, session.id), sql`${runs.packetCount} > 0`))
          .orderBy(desc(runs.startedAt))
          .all() as RunSummary[]
      }));
    },

    getRun(runId: string): RunSummary | null {
      return db.select()
        .from(runs)
        .where(eq(runs.id, runId))
        .get() ?? null;
    },

    getSamples(runId: string, limit = 5000): Telemetry[] {
      return db.select({ telemetryJson: telemetryPackets.telemetryJson })
        .from(telemetryPackets)
        .where(and(
          eq(telemetryPackets.runId, runId),
          eq(telemetryPackets.parseOk, true),
          sql`${telemetryPackets.telemetryJson} IS NOT NULL`
        ))
        .orderBy(telemetryPackets.receivedAt)
        .limit(limit)
        .all()
        .map((row) => JSON.parse(row.telemetryJson ?? "{}") as Telemetry);
    },

    getSampleWindow(runId: string, start: number, limit = 3000): RunSampleWindow {
      const total = (sqlite.prepare(`
        SELECT COUNT(*) AS total
        FROM telemetry_packets
        WHERE run_id = ?
          AND parse_ok = 1
          AND telemetry_json IS NOT NULL
      `).get(runId) as { total?: number } | undefined)?.total ?? 0;
      const clampedLimit = Math.min(20000, Math.max(1, Math.round(limit)));
      const clampedStart = Math.min(Math.max(0, Math.round(start)), Math.max(0, total - clampedLimit));
      const rows = sqlite.prepare(`
        SELECT telemetry_json AS telemetryJson
        FROM telemetry_packets
        WHERE run_id = ?
          AND parse_ok = 1
          AND telemetry_json IS NOT NULL
        ORDER BY received_at
        LIMIT ? OFFSET ?
      `).all(runId, clampedLimit, clampedStart) as { telemetryJson: string }[];

      return {
        start: clampedStart,
        total,
        samples: rows.map((row) => JSON.parse(row.telemetryJson) as Telemetry)
      };
    },

    getPathPoints(runId: string): PathSample[] {
      const rows = sqlite.prepare(`
        SELECT sample_index AS sampleIndex, x, z, speed_kmh AS speedKmh, at
        FROM run_path_points
        WHERE run_id = ?
        ORDER BY sample_index
      `).all(runId) as Omit<PathSample, "telemetry">[];

      return rows.map((row) => ({ ...row, telemetry: null }));
    },

    ensurePathPoints(runId: string) {
      const existing = (sqlite.prepare("SELECT COUNT(*) AS total FROM run_path_points WHERE run_id = ?").get(runId) as { total?: number } | undefined)?.total ?? 0;
      if (existing > 0) return;

      const insert = sqlite.prepare(`
        INSERT INTO run_path_points (run_id, sample_index, x, z, speed_kmh, at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const transaction = sqlite.transaction(() => {
        let sampleIndex = 0;
        for (const row of this.iterateSampleJson(runId)) {
          const telemetry = JSON.parse(row.telemetryJson) as Telemetry;
          if (
            telemetry.IsRaceOn === 1
            && Number.isFinite(telemetry.PositionX)
            && Number.isFinite(telemetry.PositionZ)
          ) {
            insert.run(
              runId,
              sampleIndex,
              telemetry.PositionX,
              telemetry.PositionZ,
              telemetry.speedKmh || 0,
              telemetry.receivedAt || Date.now()
            );
          }
          sampleIndex += 1;
        }
      });

      transaction();
    },

    getPowerBand(runId: string): PowerBandEstimate | null {
      const run = this.getRun(runId);
      if (!run) return null;

      const existing = sqlite.prepare(`
        SELECT packet_count AS packetCount, analysis_json AS analysisJson
        FROM run_power_analysis
        WHERE run_id = ?
      `).get(runId) as { packetCount?: number; analysisJson?: string | null } | undefined;

      if (existing && existing.packetCount === run.packetCount) {
        return existing.analysisJson ? JSON.parse(existing.analysisJson) as PowerBandEstimate : null;
      }

      const samples = (function* (rows: Iterable<{ telemetryJson: string }>) {
        for (const row of rows) yield JSON.parse(row.telemetryJson) as Telemetry;
      })(this.iterateSampleJson(runId));
      const estimate = estimatePowerBand(samples);

      sqlite.prepare(`
        INSERT INTO run_power_analysis (run_id, packet_count, analysis_json, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          packet_count = excluded.packet_count,
          analysis_json = excluded.analysis_json,
          updated_at = excluded.updated_at
      `).run(runId, run.packetCount, estimate ? JSON.stringify(estimate) : null, Date.now());

      return estimate;
    },

    iterateSampleJson(runId: string): Iterable<{ telemetryJson: string }> {
      return sqlite.prepare(`
        SELECT telemetry_json AS telemetryJson
        FROM telemetry_packets
        WHERE run_id = ?
          AND parse_ok = 1
          AND telemetry_json IS NOT NULL
        ORDER BY received_at
      `).iterate(runId) as Iterable<{ telemetryJson: string }>;
    },

    deleteEmptyRuns() {
      const cleanup = sqlite.transaction(() => {
        const emptyRuns = db.select({ id: runs.id })
          .from(runs)
          .where(eq(runs.packetCount, 0))
          .all();

        if (emptyRuns.length) {
          const emptyRunIds = emptyRuns.map((run) => run.id);
          db.delete(telemetryPackets)
            .where(inArray(telemetryPackets.runId, emptyRunIds))
            .run();
          db.delete(runs)
            .where(inArray(runs.id, emptyRunIds))
            .run();
        }

        sqlite.prepare(`
          DELETE FROM car_sessions
          WHERE packet_count = 0
            AND id NOT IN (SELECT DISTINCT car_session_id FROM runs)
        `).run();

        return emptyRuns.length;
      });

      return cleanup();
    }
  };
}

function getRunCarSessionId(sqlite: BetterSqliteDatabase.Database, runId: string) {
  return (sqlite.prepare("SELECT car_session_id AS carSessionId FROM runs WHERE id = ?").get(runId) as { carSessionId?: string } | undefined)?.carSessionId ?? null;
}
