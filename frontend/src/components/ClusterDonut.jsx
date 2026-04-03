import { useMemo } from "react";
import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip);

const GRAY = "rgba(26,31,46,0.95)";

function diskColors(pct) {
  if (pct == null) return ["#3b82f6", GRAY];
  if (pct >= 90) return ["#f87171", GRAY];
  if (pct >= 80) return ["#facc15", GRAY];
  return ["#3b82f6", GRAY];
}

function heapColors(pct) {
  if (pct == null) return ["#a78bfa", GRAY];
  if (pct >= 90) return ["#f87171", GRAY];
  if (pct >= 80) return ["#facc15", GRAY];
  return ["#a78bfa", GRAY];
}

export default function ClusterDonut({ variant, summary, formatBytes, compact }) {
  const fmt = formatBytes || ((n) => String(n));

  const { data, options, centerMain, centerSub, legendItems } = useMemo(() => {
    const opts = {
      cutout: "72%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => variant === "shards" ? ` ${ctx.label}: ${ctx.raw}` : ` ${ctx.label}: ${fmt(ctx.raw)}` } },
      },
    };

    if (variant === "disk") {
      const used = summary?.diskUsedBytes ?? 0;
      const free = summary?.diskFreeBytes ?? 0;
      const pct = summary?.diskUsedPercent;
      const colors = diskColors(pct);
      return {
        data: { labels: ["Used", "Free"], datasets: [{ data: [used, free], backgroundColor: colors, borderWidth: 0, hoverOffset: 2 }] },
        options: opts,
        centerMain: pct != null ? `${pct}%` : "\u2014",
        centerSub: "used",
        legendItems: [{ color: colors[0], text: `${fmt(used)} used` }, { color: GRAY, text: `${fmt(free)} free` }],
      };
    }

    if (variant === "heap") {
      const used = summary?.heapUsedBytes ?? 0;
      const max = summary?.heapMaxBytes ?? 0;
      const free = Math.max(0, max - used);
      const pct = summary?.heapUsedPercent;
      const colors = heapColors(pct);
      return {
        data: { labels: ["Used", "Free"], datasets: [{ data: max > 0 ? [used, free] : [0, 1], backgroundColor: max > 0 ? colors : [GRAY, GRAY], borderWidth: 0, hoverOffset: 2 }] },
        options: opts,
        centerMain: pct != null ? `${pct}%` : "\u2014",
        centerSub: "used",
        legendItems: [{ color: colors[0], text: `${fmt(used)} used` }, { color: GRAY, text: `${fmt(free)} free` }],
      };
    }

    if (variant === "shards") {
      const primary    = summary?.activePrimaryShards ?? 0;
      const replica    = (summary?.activeShards ?? 0) - primary;
      const unassigned = summary?.unassignedShards ?? 0;
      const relocating = summary?.relocatingShards ?? 0;
      const total      = primary + replica + unassigned + relocating;
      const hasData    = total > 0;
      return {
        data: {
          labels: ["Primary", "Replica", "Unassigned", "Relocating"],
          datasets: [{
            data: hasData ? [primary, Math.max(0, replica), unassigned, relocating] : [0, 0, 0, 1],
            backgroundColor: hasData ? ["#3b82f6", "#6366f1", unassigned > 0 ? "#f87171" : GRAY, relocating > 0 ? "#facc15" : GRAY] : [GRAY, GRAY, GRAY, GRAY],
            borderWidth: 0, hoverOffset: 2,
          }],
        },
        options: opts,
        centerMain: hasData ? String(primary + Math.max(0, replica)) : "\u2014",
        centerSub: "active",
        legendItems: [
          { color: "#3b82f6", text: `${primary} primary` },
          { color: "#6366f1", text: `${Math.max(0, replica)} replica` },
          { color: unassigned > 0 ? "#f87171" : GRAY, text: `${unassigned} unassigned` },
        ],
      };
    }

    return { data: { labels: [], datasets: [] }, options: opts, centerMain: "\u2014", centerSub: "", legendItems: [] };
  }, [variant, summary, fmt]);

  return (
    <div className={`cluster-donut${compact ? " cluster-donut--compact" : ""}`}>
      <div className="cluster-donut-chart-wrap">
        <Doughnut data={data} options={options} />
        <div className="cluster-donut-center" aria-hidden>
          <span className="cluster-donut-center-main">{centerMain}</span>
          {centerSub && <span className="cluster-donut-center-sub">{centerSub}</span>}
        </div>
      </div>
      <ul className="cluster-donut-legend">
        {legendItems.map((item, i) => (
          <li key={i}>
            <span className="cluster-donut-legend-swatch" style={{ background: item.color }} />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
