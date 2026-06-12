import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import BetterSqliteDatabase from "better-sqlite3";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { SessionSummary, Telemetry } from "../src/types/telemetry";
import { sessions, telemetryPackets } from "./schema";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "telemetry.sqlite");

type ValidPacketInput = {
  sessionId: string;
  receivedAt: number;
  source: string | null;
  rawPacket?: Buffer | null;
  telemetry: Telemetry;
};

type BadPacketInput = {
  sessionId: string;
  receivedAt: number;
  source: string | null;
  rawPacket?: Buffer | null;
  error: string;
};

function createSchema(sqlite: BetterSqliteDatabase.Database) {
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
      last_source TEXT,
      car_ordinal INTEGER,
      car_class INTEGER,
      car_performance_index INTEGER,
      drivetrain_type INTEGER
    );

    CREATE TABLE IF NOT EXISTS telemetry_packets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
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
  `);
}

export function createTelemetryDatabase(dbPath = process.env.TELEMETRY_DB_PATH || DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new BetterSqliteDatabase(dbPath);
  createSchema(sqlite);

  const db = drizzle(sqlite, { schema: { sessions, telemetryPackets } });

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

    recordValidPacket({ sessionId, receivedAt, source, rawPacket, telemetry }: ValidPacketInput) {
      db.insert(telemetryPackets).values({
        sessionId,
        receivedAt,
        source,
        parseOk: true,
        rawPacket: rawPacket ?? null,
        rawPacketSize: rawPacket?.length ?? 0,
        telemetryJson: JSON.stringify(telemetry),
        parseError: null
      }).run();

      db.update(sessions)
        .set({
          lastPacketAt: receivedAt,
          packetCount: sql`${sessions.packetCount} + 1`,
          lastSource: source,
          carOrdinal: telemetry.CarOrdinal,
          carClass: telemetry.CarClass,
          carPerformanceIndex: telemetry.CarPerformanceIndex,
          drivetrainType: telemetry.DrivetrainType
        })
        .where(eq(sessions.id, sessionId))
        .run();
    },

    recordBadPacket({ sessionId, receivedAt, source, rawPacket, error }: BadPacketInput) {
      db.insert(telemetryPackets).values({
        sessionId,
        receivedAt,
        source,
        parseOk: false,
        rawPacket: rawPacket ?? null,
        rawPacketSize: rawPacket?.length ?? 0,
        telemetryJson: null,
        parseError: error
      }).run();

      db.update(sessions)
        .set({
          lastPacketAt: receivedAt,
          badPacketCount: sql`${sessions.badPacketCount} + 1`,
          lastSource: source
        })
        .where(eq(sessions.id, sessionId))
        .run();
    },

    listSessions(): SessionSummary[] {
      return db.select()
        .from(sessions)
        .where(sql`${sessions.packetCount} > 0`)
        .orderBy(desc(sessions.startedAt))
        .all();
    },

    getSession(sessionId: string): SessionSummary | null {
      return db.select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .get() ?? null;
    },

    getSamples(sessionId: string, limit = 5000): Telemetry[] {
      return db.select({ telemetryJson: telemetryPackets.telemetryJson })
        .from(telemetryPackets)
        .where(and(
          eq(telemetryPackets.sessionId, sessionId),
          eq(telemetryPackets.parseOk, true),
          sql`${telemetryPackets.telemetryJson} IS NOT NULL`
        ))
        .orderBy(telemetryPackets.receivedAt)
        .limit(limit)
        .all()
        .map((row) => JSON.parse(row.telemetryJson ?? "{}") as Telemetry);
    },

    iterateSampleJson(sessionId: string): Iterable<{ telemetryJson: string }> {
      return sqlite.prepare(`
        SELECT telemetry_json AS telemetryJson
        FROM telemetry_packets
        WHERE session_id = ?
          AND parse_ok = 1
          AND telemetry_json IS NOT NULL
        ORDER BY received_at
      `).iterate(sessionId) as Iterable<{ telemetryJson: string }>;
    },

    deleteEmptySessions() {
      const cleanup = sqlite.transaction(() => {
        const emptySessions = db.select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.packetCount, 0))
          .all();

        if (!emptySessions.length) return 0;

        const emptySessionIds = emptySessions.map((session) => session.id);
        db.delete(telemetryPackets)
          .where(inArray(telemetryPackets.sessionId, emptySessionIds))
          .run();
        db.delete(sessions)
          .where(inArray(sessions.id, emptySessionIds))
          .run();
        return emptySessionIds.length;
      });

      return cleanup();
    }
  };
}
