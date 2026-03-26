import { useCallback, useEffect, useRef, useState } from "react";
import { useRegisterGlobalRefresh } from "./useGlobalRefresh.js";
import { pushToast } from "./useToasts.js";

export function useClusters() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const firstLoadRef = useRef(true);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/clusters");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
      setData(null);
      if (!firstLoadRef.current) {
        pushToast({ title: "Clusters refresh failed", message: e.message, tone: "error" });
      }
    } finally {
      setLoading(false);
      firstLoadRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  useRegisterGlobalRefresh(() => {
    fetchClusters();
  });

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchClusters();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchClusters]);

  return { data, error, loading, refetch: fetchClusters };
}
