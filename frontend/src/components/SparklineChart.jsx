import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  LineElement, PointElement, LinearScale, CategoryScale, Filler,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Filler);

export default function SparklineChart({ data, color, height = 36 }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    const makeGradient = (c) => {
      const g = c.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, color + "55");
      g.addColorStop(1, color + "00");
      return g;
    };

    if (chartRef.current) {
      chartRef.current.data.labels = data.map((_, i) => i);
      chartRef.current.data.datasets[0].data = data;
      chartRef.current.data.datasets[0].borderColor = color;
      chartRef.current.data.datasets[0].backgroundColor = makeGradient(ctx);
      chartRef.current.update("none");
      return;
    }

    chartRef.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: makeGradient(ctx),
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        animation: false,
        responsive: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0, max: 100 },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [data, color, height]);

  return <canvas ref={canvasRef} width={160} height={height} style={{ display: "block" }} />;
}
