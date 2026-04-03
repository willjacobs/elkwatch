/** Keeps `elkwatch.cluster.active` in sync with per-page cluster picks and sidebar. */

export const ACTIVE_CLUSTER_KEY = "elkwatch.cluster.active";

export function persistPageCluster(pageKey, name) {
  try {
    window.localStorage.setItem(`elkwatch.cluster.${pageKey}`, name);
    if (name) {
      window.localStorage.setItem(ACTIVE_CLUSTER_KEY, name);
    }
  } catch {
    // ignore
  }
}

/** Sidebar "active cluster": mirror all page keys so any route defaults consistently. */
export function syncAllClusterKeys(name) {
  const keys = ["indices", "ilm", "nodes", "alerts", "templates"];
  try {
    window.localStorage.setItem(ACTIVE_CLUSTER_KEY, name);
    for (const k of keys) {
      window.localStorage.setItem(`elkwatch.cluster.${k}`, name);
    }
  } catch {
    // ignore
  }
}
