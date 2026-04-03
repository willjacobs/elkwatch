import { useRef, useCallback } from "react";

const MAX_POINTS = 20;

export function useNodeHistory() {
  const mapRef = useRef(new Map());

  const appendNodeData = useCallback((clusterName, nodes) => {
    if (!nodes?.length) return;
    for (const node of nodes) {
      if (node.heapUsedPercent == null) continue;
      const key = `${clusterName}:${node.name}`;
      const arr = mapRef.current.get(key) ?? [];
      const next = [...arr, node.heapUsedPercent];
      mapRef.current.set(key, next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next);
    }
  }, []);

  const getHistory = useCallback((clusterName, nodeName) => {
    return mapRef.current.get(`${clusterName}:${nodeName}`) ?? [];
  }, []);

  return { appendNodeData, getHistory };
}
