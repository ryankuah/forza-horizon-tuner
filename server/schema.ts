import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at").notNull(),
  lastPacketAt: integer("last_packet_at"),
  endedAt: integer("ended_at"),
  packetCount: integer("packet_count").notNull().default(0),
  badPacketCount: integer("bad_packet_count").notNull().default(0),
  lastSource: text("last_source"),
  carOrdinal: integer("car_ordinal"),
  carClass: integer("car_class"),
  carPerformanceIndex: integer("car_performance_index"),
  drivetrainType: integer("drivetrain_type")
});

export const telemetryPackets = sqliteTable(
  "telemetry_packets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: text("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
    receivedAt: integer("received_at").notNull(),
    source: text("source"),
    parseOk: integer("parse_ok", { mode: "boolean" }).notNull(),
    rawPacket: blob("raw_packet", { mode: "buffer" }),
    rawPacketSize: integer("raw_packet_size").notNull(),
    telemetryJson: text("telemetry_json"),
    parseError: text("parse_error")
  },
  (table) => [
    index("idx_telemetry_packets_session_time").on(table.sessionId, table.receivedAt)
  ]
);
