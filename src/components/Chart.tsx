import type { DaySeries } from "@/lib/queries";
import { formatMoney } from "@/lib/money";

/** Dependency-free SVG bar chart — no chart library, no client JS. */
export function RevenueChart({
  data,
  currency = "INR",
  locale = "en-IN",
}: {
  data: DaySeries[];
  currency?: string;
  locale?: string;
}) {
  const w = 720;
  const h = 210;
  const pad = { l: 8, r: 8, t: 12, b: 26 };
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.max(slot * 0.55, 4);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Revenue for the last 14 days">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + innerH * (1 - f)}
          y2={pad.t + innerH * (1 - f)}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
      ))}
      {data.map((d, i) => {
        const bh = (d.revenue / max) * innerH;
        const x = pad.l + i * slot + (slot - barW) / 2;
        const y = pad.t + innerH - bh;
        return (
          <g key={d.day}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, 1)} rx={3} fill="var(--brand)" opacity={0.92}>
              <title>{`${d.day}: ${formatMoney(d.revenue, currency, locale)} · ${d.orders} orders`}</title>
            </rect>
            {i % 2 === 0 && (
              <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize="9.5" fill="var(--muted)">
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function PaymentDonut({
  data,
  currency = "INR",
  locale = "en-IN",
}: {
  data: { method: string; amount: number }[];
  currency?: string;
  locale?: string;
}) {
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;
  const colors = ["#4f46e5", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e"];
  let offset = 0;
  const r = 54;
  const c = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Payment method mix">
        <g transform="translate(70,70) rotate(-90)">
          {data.map((d, i) => {
            const len = (d.amount / total) * c;
            const el = (
              <circle
                key={d.method}
                r={r}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="16"
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
          <circle r={r - 12} fill="var(--surface)" />
        </g>
      </svg>
      <div style={{ display: "grid", gap: 7, fontSize: 12.5 }}>
        {data.map((d, i) => (
          <div key={d.method} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: colors[i % colors.length] }} />
            <span style={{ textTransform: "capitalize", minWidth: 62 }}>{d.method}</span>
            <span className="muted">{formatMoney(d.amount, currency, locale)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
