import { NavLink } from "react-router-dom";
import {
  IconAlerts,
  IconILM,
  IconIndices,
  IconNodes,
  IconOverview,
  IconSettings,
  IconTemplates,
} from "./SidebarIcons.jsx";

function worstStatus(clusters) {
  if (!clusters?.length) return null;
  if (clusters.some((c) => c.status === "red" || c.error)) return "red";
  if (clusters.some((c) => c.status === "yellow")) return "yellow";
  return "green";
}

export default function IconRail({ clusters, toWithCluster }) {
  const overall = worstStatus(clusters);

  const items = [
    { to: "/",           icon: <IconOverview />,  label: "Overview",  exact: true, dot: overall },
    { to: toWithCluster("/nodes"),     icon: <IconNodes />,     label: "Nodes" },
    { to: toWithCluster("/indices"),   icon: <IconIndices />,   label: "Indices" },
    { to: toWithCluster("/ilm"),       icon: <IconILM />,       label: "ILM" },
    { to: toWithCluster("/alerts"),    icon: <IconAlerts />,    label: "Alerts" },
    { to: toWithCluster("/templates"), icon: <IconTemplates />, label: "Templates" },
  ];

  return (
    <nav className="icon-rail" aria-label="Main navigation">
      <div className="rail-logo" aria-hidden>E</div>
      {items.map(({ to, icon, label, exact, dot }) => (
        <NavLink
          key={to}
          end={exact}
          to={to}
          className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}
          title={label}
          aria-label={label}
        >
          {icon}
          {dot && <span className={`rail-status-dot rail-status-dot--${dot}`} aria-hidden />}
        </NavLink>
      ))}
      <div className="rail-spacer" />
      <NavLink
        to="/settings"
        className={({ isActive }) => `rail-item${isActive ? " active" : ""}`}
        title="Settings"
        aria-label="Settings"
      >
        <IconSettings />
      </NavLink>
    </nav>
  );
}
