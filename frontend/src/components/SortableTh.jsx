export default function SortableTh({ label, sortKey, activeKey, dir, onSort, style }) {
  const isActive = activeKey === sortKey;
  const indicator = isActive ? (dir === "asc" ? " \u2191" : " \u2193") : "";
  return (
    <th
      className={`sortable${isActive ? " sort-active" : ""}`}
      onClick={() => onSort(sortKey)}
      style={{ cursor: "pointer", userSelect: "none", ...style }}
    >
      {label}{indicator && <span style={{ color: "var(--clr-accent)", marginLeft: "2px" }}>{indicator}</span>}
    </th>
  );
}
