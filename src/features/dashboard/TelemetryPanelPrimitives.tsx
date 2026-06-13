import * as React from "react";
import type { TelemetryValue } from "@/types/telemetry";
import { formatValue } from "@/lib/format";

export const labelClass = "text-xs font-semibold text-muted-foreground";

export function metricToneClass(tone: "default" | "ok" | "warn" | "alert") {
  return {
    default: "text-[#f5f7f6]",
    ok: "text-[#63da97]",
    warn: "text-[#f3d09b]",
    alert: "text-[#e46645]"
  }[tone];
}

export function TelemetryGroup({
  title,
  icon,
  children,
  className = ""
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid min-w-0 gap-3 ${className}`}>
      <SectionTitle icon={icon} compact>{title}</SectionTitle>
      <div className="grid min-w-0 gap-4">
        {children}
      </div>
    </section>
  );
}

export function DataCell({
  label,
  value,
  suffix = "",
  precision = 0,
  boolean = false
}: {
  label: string;
  value: TelemetryValue;
  suffix?: string;
  precision?: number;
  boolean?: boolean;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-baseline gap-3 border-b border-white/[0.06] py-1.5">
      <dt className={`${labelClass} min-w-0 truncate`}>{label}</dt>
      <dd className="min-w-0 break-words text-right font-bold text-[#f5f7f6]">
        {formatValue(value, { precision, boolean })}{boolean ? "" : suffix}
      </dd>
    </div>
  );
}

export function SectionTitle({
  children,
  icon,
  compact = false
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <h2 className={`${compact ? "mb-0" : "mb-4"} flex items-center gap-2 text-[0.95rem] font-bold text-[#f5f7f6]`}>
      {icon}{children}
    </h2>
  );
}
