import { useMemo } from "react";
import { ArcElement, Chart as ChartJS, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip);

const GRAY = "rgba(58, 63, 75, 0.95)";

function diskColors(usedPercent) {
  if (usedPercent == null) return ["#5b9fd4", GRAY];
  if (usedPercent >= 90) return ["#f87171", GRAY];
  if (usedPercent >= 80) return ["#facc15", GRAY];
  return ["#5b9fd4", GRAY];
}

function heapColors(usedPercent) {
  if (usedPercent == null) return ["#2dd4bf", GRAY];
  if (usedPercent >= 90) return ["#f87171", GRAY];
  if (usedPercent >= 80) return ["#facc15", GRAY];
  return ["#2dd4bf", GRAY];
}

function shardColors(unassigned) {
  if (unassigned > 0) return ["#4ade80", "#f87171"];
  return ["#4ade80", GRAY];
}

/**
 * Doughnut with HTML center label (not drawn on canvas). cutout 72% per mockup.
 */
export default function ClusterDonut({ variant, summary, formatBytes }) {
  const fmt = formatBytes || ((n) => String(n));

  const { data, options, centerMain, centerSub, legendItems } = useMemo(() => {
    const tooltipLabel = (ctx) => {
      const label = ctx.label || "";
      const v = ctx.raw;
      if (variant === "shards") {
        return ` ${label}: ${v}`;
      }
      return ` ${label}: ${fmt(v)}`;
    };

    const opts = {
      cutout: "72%",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: tooltipLabel,
          },
        },
      },
    };

    if (variant === "disk") {
      const used = summary?.diskUsedBytes ?? 0;
      const free = summary?.diskFreeBytes ?? 0;
      const pct = summary?.diskUsedPercent;
      const colors = diskColors(pct);
      return {
        data: {
          labels: ["Used", "Free"],
          datasets: [
            {
              data: [used, free],
              backgroundColor: colors,
              borderWidth: 0,
              hoverOffset: 2,
            },
          ],
        },
        options: opts,
        centerMain: pct != null ? `${pct}%` : "—",
        centerSub: "used",
        legendItems: [
          { color: colors[0], text: `${fmt(used)} used` },
          { color: GRAY, text: `${fmt(free)} free` },
        ],
      };
    }

    if (variant === "heap") {
      const used = summary?.heapUsedBytes ?? 0;
      const max = summary?.heapMaxBytes ?? 0;
      const free = Math.max(0, max - used);
      const pct = summary?.heapUsedPercent;
      const colors = heapColors(pct);
      return {
        data: {
          labels: ["Used", "Free"],
          datasets: [
            {
              data: max > 0 ? [used, free] : [0, 1],
              backgroundColor: max > 0 ? colors : [GRAY, GRAY],
              borderWidth: 0,
              hoverOffset: 2,
            },
          ],
        },
        options: opts,
        centerMain: pct != null ? `${pct}%` : "—",
        centerSub: "used",
        legendItems: [
          { color: colors[0], text: `${fmt(used)} used` },
          { color: GRAY, text: `${fmt(free)} free` },
        ],
      };
    }

    if (variant === "shards") {
      const active = summary?.activeShards ?? 0;
      const unassigned = summary?.unassignedShards ?? 0;
      const colors = shardColors(unassigned);
      const total = active + unassigned;
      return {
        data: {
          labels: ["Active", "Unassigned"],
          datasets: [
            {
              data: total > 0 ? [active, unassigned] : [0, 1],
              backgroundColor: total > 0 ? colors : [GRAY, GRAY],
              borderWidth: 0,
              hoverOffset: 2,
            },
          ],
        },
        options: opts,
        centerMain: `${total} total`,
        centerSub: "",
        legendItems: [
          { color: "#4ade80", text: `${active} active` },
          {
            color: unassigned > 0 ? "#f87171" : GRAY,
            text: `${unassigned} unassigned`,
          },
        ],
      };
    }

    return {
      data: { labels: [], datasets: [] },
      options: opts,
      centerMain: "—",
      centerSub: "",
      legendItems: [],
    };
  }, [variant, summary, formatBytes]);

  return (
    <div className="cluster-donut">
      <div className="cluster-donut-chart-wrap">
        <Doughnut data={data} options={options} />
        <div className="cluster-donut-center" aria-hidden>
          <span className="cluster-donut-center-main">{centerMain}</span>
          {centerSub ? (
            <span className="cluster-donut-center-sub">{centerSub}</span>
          ) : null}
        </div>
      </div>
      <ul className="cluster-donut-legend">
        {legendItems.map((item, i) => (
          <li key={i}>
            <span
              className="cluster-donut-legend-swatch"
              style={{ background: item.color }}
            />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
