import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import BetterSqliteDatabase from "better-sqlite3";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { RunSummary, SessionSummary, SessionWithRuns, Telemetry } from "../src/types/telemetry";
import { runs, sessions, telemetryPackets } from "./schema";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "telemetry.sqlite");

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

function tableExists(sqlite: BetterSqliteDatabase.Database, name: string) {
  return Boolean(sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function tableColumns(sqlite: BetterSqliteDatabase.Database, name: string) {
  return new Set((sqlite.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]).map((column) => column.name));
}

function createSchema(sqlite: BetterSqliteDatabase.Database) {
  if (tableExists(sqlite, "sessions") && !tableExists(sqlite, "runs")) {
    const columns = tableColumns(sqlite, "sessions");
    if (columns.has("car_ordinal")) {
      sqlite.exec("ALTER TABLE sessions RENAME TO runs;");
    }
  }

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      last_packet_at INTEGER,
      ended_at INTEGER,
      packet_count INTEGER NOT NULL DEFAULT 0,
      bad_packet_count INTEGER NOT NULL DEFAULT 0,
      run_count INTEGER NOT NULL DEFAULT 0,
      last_source TEXT
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
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
      session_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      received_at INTEGER NOT NULL,
      source TEXT,
      parse_ok INTEGER NOT NULL,
      raw_packet BLOB,
      raw_packet_size INTEGER NOT NULL,
      telemetry_json TEXT,
      parse_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_telemetry_packets_session_time
      ON telemetry_packets(session_id, received_at);

    CREATE INDEX IF NOT EXISTS idx_runs_session_time
      ON runs(session_id, started_at);
  `);

  const runColumns = tableColumns(sqlite, "runs");
  if (!runColumns.has("session_id")) sqlite.exec("ALTER TABLE runs ADD COLUMN session_id TEXT;");
  if (!runColumns.has("split_reason")) sqlite.exec("ALTER TABLE runs ADD COLUMN split_reason TEXT;");

  sqlite.exec(`
    INSERT OR IGNORE INTO sessions (
      id,
      started_at,
      last_packet_at,
      ended_at,
      packet_count,
      bad_packet_count,
      run_count,
      last_source
    )
    SELECT
      id,
      started_at,
      last_packet_at,
      ended_at,
      packet_count,
      bad_packet_count,
      1,
      last_source
    FROM runs
    WHERE session_id IS NULL;

    UPDATE runs
    SET session_id = id,
        split_reason = COALESCE(split_reason, 'legacy')
    WHERE session_id IS NULL;
  `);

  migrateTelemetryPacketsToRunReferences(sqlite);
}

function migrateTelemetryPacketsToRunReferences(sqlite: BetterSqliteDatabase.Database) {
  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_list(telemetry_packets)").all() as { table: string; from: string }[];
  const alreadyReferencesRuns = foreignKeys.some((foreignKey) => foreignKey.from === "session_id" && foreignKey.table === "runs");
  if (alreadyReferencesRuns) return;

  sqlite.exec(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS telemetry_packets_run_refs;

    CREATE TABLE telemetry_packets_run_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      received_at INTEGER NOT NULL,
      source TEXT,
      parse_ok INTEGER NOT NULL,
      raw_packet BLOB,
      raw_packet_size INTEGER NOT NULL,
      telemetry_json TEXT,
      parse_error TEXT
    );

    INSERT INTO telemetry_packets_run_refs (
      id,
      session_id,
      received_at,
      source,
      parse_ok,
      raw_packet,
      raw_packet_size,
      telemetry_json,
      parse_error
    )
    SELECT
      packet.id,
      COALESCE(
        matching_run.id,
        (
          SELECT fallback_run.id
          FROM runs fallback_run
          WHERE fallback_run.session_id = packet.session_id
          ORDER BY fallback_run.started_at
          LIMIT 1
        )
      ),
      packet.received_at,
      packet.source,
      packet.parse_ok,
      packet.raw_packet,
      packet.raw_packet_size,
      packet.telemetry_json,
      packet.parse_error
    FROM telemetry_packets packet
    LEFT JOIN runs matching_run ON matching_run.id = packet.session_id
    WHERE COALESCE(
      matching_run.id,
      (
        SELECT fallback_run.id
        FROM runs fallback_run
        WHERE fallback_run.session_id = packet.session_id
        ORDER BY fallback_run.started_at
        LIMIT 1
      )
    ) IS NOT NULL;

    DROP TABLE telemetry_packets;
    ALTER TABLE telemetry_packets_run_refs RENAME TO telemetry_packets;

    CREATE INDEX IF NOT EXISTS idx_telemetry_packets_session_time
      ON telemetry_packets(session_id, received_at);

    PRAGMA foreign_keys = ON;
  `);
}

export function createTelemetryDatabase(dbPath = process.env.TELEMETRY_DB_PATH || DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new BetterSqliteDatabase(dbPath);
  createSchema(sqlite);

  const db = drizzle(sqlite, { schema: { runs, sessions, telemetryPackets } });

  return {
    path: dbPath,

    startSession(startedAt = Date.now(), id: string = randomUUID()) {
      db.insert(sessions).values({
        id,
        startedAt,
        lastPacketAt: startedAt
      }).run();
      return { id, startedAt };
    },

    endSession(sessionId: string, endedAt = Date.now()) {
      db.update(sessions)
        .set({ endedAt })
        .where(and(eq(sessions.id, sessionId), isNull(sessions.endedAt)))
        .run();
    },

    startRun(sessionId: string, startedAt = Date.now(), id: string = randomUUID(), splitReason = "start") {
      db.insert(runs).values({
        id,
        sessionId,
        startedAt,
        lastPacketAt: startedAt,
        splitReason
      }).run();
      db.update(sessions)
        .set({
          lastPacketAt: startedAt,
          runCount: sql`${sessions.runCount} + 1`
        })
        .where(eq(sessions.id, sessionId))
        .run();
      return { id, sessionId, startedAt };
    },

    endRun(runId: string, endedAt = Date.now()) {
      db.update(runs)
        .set({ endedAt })
        .where(and(eq(runs.id, runId), isNull(runs.endedAt)))
        .run();
    },

    recordValidPacket({ runId, receivedAt, source, rawPacket, telemetry }: ValidPacketInput) {
      db.insert(telemetryPackets).values({
        sessionId: runId,
        receivedAt,
        source,
        parseOk: true,
        rawPacket: rawPacket ?? null,
        rawPacketSize: rawPacket?.length ?? 0,
        telemetryJson: JSON.stringify(telemetry),
        parseError: null
      }).run();

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

      db.update(sessions)
        .set({
          lastPacketAt: receivedAt,
          packetCount: sql`${sessions.packetCount} + 1`,
          lastSource: source
        })
        .where(eq(sessions.id, sql`(SELECT session_id FROM runs WHERE id = ${runId})`))
        .run();
    },

    recordBadPacket({ runId, receivedAt, source, rawPacket, error }: BadPacketInput) {
      db.insert(telemetryPackets).values({
        sessionId: runId,
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

      db.update(sessions)
        .set({
          lastPacketAt: receivedAt,
          badPacketCount: sql`${sessions.badPacketCount} + 1`,
          lastSource: source
        })
        .where(eq(sessions.id, sql`(SELECT session_id FROM runs WHERE id = ${runId})`))
        .run();
    },

    listSessions(): SessionWithRuns[] {
      const sessionRows = db.select()
        .from(sessions)
        .where(sql`${sessions.packetCount} > 0`)
        .orderBy(desc(sessions.startedAt))
        .all() as SessionSummary[];

      if (!sessionRows.length) return [];

      const runRows = db.select()
        .from(runs)
        .where(and(
          inArray(runs.sessionId, sessionRows.map((session) => session.id)),
          sql`${runs.packetCount} > 0`
        ))
        .orderBy(desc(runs.startedAt))
        .all() as RunSummary[];

      return sessionRows.map((session) => ({
        session,
        runs: runRows.filter((run) => run.sessionId === session.id)
      })).filter((group) => group.runs.length > 0);
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
          eq(telemetryPackets.sessionId, runId),
          eq(telemetryPackets.parseOk, true),
          sql`${telemetryPackets.telemetryJson} IS NOT NULL`
        ))
        .orderBy(telemetryPackets.receivedAt)
        .limit(limit)
        .all()
        .map((row) => JSON.parse(row.telemetryJson ?? "{}") as Telemetry);
    },

    iterateSampleJson(runId: string): Iterable<{ telemetryJson: string }> {
      return sqlite.prepare(`
        SELECT telemetry_json AS telemetryJson
        FROM telemetry_packets
        WHERE session_id = ?
          AND parse_ok = 1
          AND telemetry_json IS NOT NULL
        ORDER BY received_at
      `).iterate(runId) as Iterable<{ telemetryJson: string }>;
    },

    deleteEmptyRunsAndSessions() {
      const cleanup = sqlite.transaction(() => {
        const emptyRuns = db.select({ id: runs.id })
          .from(runs)
          .where(eq(runs.packetCount, 0))
          .all();

        if (emptyRuns.length) {
          const emptyRunIds = emptyRuns.map((run) => run.id);
          db.delete(telemetryPackets)
            .where(inArray(telemetryPackets.sessionId, emptyRunIds))
            .run();
          db.delete(runs)
            .where(inArray(runs.id, emptyRunIds))
            .run();
        }

        const emptySessions = db.select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.packetCount, 0))
          .all();

        if (emptySessions.length) {
          db.delete(sessions)
            .where(inArray(sessions.id, emptySessions.map((session) => session.id)))
            .run();
        }

        return emptyRuns.length + emptySessions.length;
      });

      return cleanup();
    }
  };
}
