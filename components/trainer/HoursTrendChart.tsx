"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyHours } from "@/lib/domain/dashboard-insights";
import { formatHours } from "@/lib/format";

/** Single-series trend — no legend needed, the section title already names it. */
export function HoursTrendChart({ data }: { data: WeeklyHours[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(0, 15, 96, 0.12)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "rgba(0, 15, 96, 0.6)" }}
            axisLine={{ stroke: "rgba(0, 15, 96, 0.15)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "rgba(0, 15, 96, 0.6)" }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "rgba(0, 15, 96, 0.06)" }}
            formatter={(value) => formatHours(Number(value))}
            contentStyle={{
              borderRadius: 6,
              borderColor: "rgba(0, 15, 96, 0.15)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="hours" fill="#833177" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
