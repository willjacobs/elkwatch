export default function SortableTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}) {
  const active = activeKey === sortKey;
  return (
    <th scope="col">
      <button
        type="button"
        className={`th-sort${active ? " th-sort-active" : ""}`}
        onClick={() => onSort(sortKey)}
      >
        <span className="th-sort-label">{label}</span>
        {active && (
          <span className="th-sort-indicator" aria-hidden>
            {dir === "asc" ? " ▲" : " ▼"}
          </span>
        )}
      </button>
    </th>
  );
}
