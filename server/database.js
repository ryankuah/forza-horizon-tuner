import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "telemetry.sqlite");

export function createTelemetryDatabase(dbPath = process.env.TELEMETRY_DB_PATH || DEFAULT_DB_PATH) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
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

  const insertSession = db.prepare(`
    INSERT INTO sessions (id, started_at, last_packet_at)
    VALUES (?, ?, ?)
  `);
  const endSession = db.prepare(`
    UPDATE sessions
    SET ended_at = ?
    WHERE id = ? AND ended_at IS NULL
  `);
  const updateValidSession = db.prepare(`
    UPDATE sessions
    SET
      last_packet_at = ?,
      packet_count = packet_count + 1,
      last_source = ?,
      car_ordinal = ?,
      car_class = ?,
      car_performance_index = ?,
      drivetrain_type = ?
    WHERE id = ?
  `);
  const updateBadSession = db.prepare(`
    UPDATE sessions
    SET
      last_packet_at = ?,
      bad_packet_count = bad_packet_count + 1,
      last_source = ?
    WHERE id = ?
  `);
  const insertPacket = db.prepare(`
    INSERT INTO telemetry_packets (
      session_id,
      received_at,
      source,
      parse_ok,
      raw_packet,
      raw_packet_size,
      telemetry_json,
      parse_error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const listSessionsStatement = db.prepare(`
    SELECT
      id,
      started_at AS startedAt,
      last_packet_at AS lastPacketAt,
      ended_at AS endedAt,
      packet_count AS packetCount,
      bad_packet_count AS badPacketCount,
      last_source AS lastSource,
      car_ordinal AS carOrdinal,
      car_class AS carClass,
      car_performance_index AS carPerformanceIndex,
      drivetrain_type AS drivetrainType
    FROM sessions
    WHERE packet_count > 0
    ORDER BY started_at DESC
  `);
  const getSessionStatement = db.prepare(`
    SELECT
      id,
      started_at AS startedAt,
      last_packet_at AS lastPacketAt,
      ended_at AS endedAt,
      packet_count AS packetCount,
      bad_packet_count AS badPacketCount,
      last_source AS lastSource,
      car_ordinal AS carOrdinal,
      car_class AS carClass,
      car_performance_index AS carPerformanceIndex,
      drivetrain_type AS drivetrainType
    FROM sessions
    WHERE id = ?
  `);
  const getSamplesStatement = db.prepare(`
    SELECT telemetry_json AS telemetryJson
    FROM telemetry_packets
    WHERE session_id = ? AND parse_ok = 1 AND telemetry_json IS NOT NULL
    ORDER BY received_at ASC
    LIMIT ?
  `);
  const deletePacketsForEmptySessions = db.prepare(`
    DELETE FROM telemetry_packets
    WHERE session_id IN (
      SELECT id
      FROM sessions
      WHERE packet_count = 0
    )
  `);
  const deleteEmptySessionsStatement = db.prepare(`
    DELETE FROM sessions
    WHERE packet_count = 0
  `);

  return {
    path: dbPath,

    startSession(startedAt = Date.now(), id = randomUUID()) {
      insertSession.run(id, startedAt, startedAt);
      return { id, startedAt };
    },

    endSession(sessionId, endedAt = Date.now()) {
      endSession.run(endedAt, sessionId);
    },

    recordValidPacket({ sessionId, receivedAt, source, rawPacket, telemetry }) {
      insertPacket.run(
        sessionId,
        receivedAt,
        source,
        1,
        rawPacket ?? null,
        rawPacket?.length ?? 0,
        JSON.stringify(telemetry),
        null
      );
      updateValidSession.run(
        receivedAt,
        source,
        telemetry.CarOrdinal,
        telemetry.CarClass,
        telemetry.CarPerformanceIndex,
        telemetry.DrivetrainType,
        sessionId
      );
    },

    recordBadPacket({ sessionId, receivedAt, source, rawPacket, error }) {
      insertPacket.run(
        sessionId,
        receivedAt,
        source,
        0,
        rawPacket ?? null,
        rawPacket?.length ?? 0,
        null,
        error
      );
      updateBadSession.run(receivedAt, source, sessionId);
    },

    listSessions() {
      return listSessionsStatement.all();
    },

    getSession(sessionId) {
      return getSessionStatement.get(sessionId) ?? null;
    },

    getSamples(sessionId, limit = 5000) {
      return getSamplesStatement
        .all(sessionId, limit)
        .map((row) => JSON.parse(row.telemetryJson));
    },

    deleteEmptySessions() {
      db.exec("BEGIN");
      try {
        deletePacketsForEmptySessions.run();
        const result = deleteEmptySessionsStatement.run();
        db.exec("COMMIT");
        return result.changes ?? 0;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
}
