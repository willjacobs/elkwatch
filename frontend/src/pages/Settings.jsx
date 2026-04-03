import { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { pushToast } from "../hooks/useToasts.js";
import "./Settings.css";

const RULE_TYPES = [
  { value: "disk_usage", label: "Disk Usage" },
  { value: "ilm_error", label: "ILM Error" },
  { value: "ingest_stall", label: "Ingest Stall" },
];

const DEFAULT_CONFIGS = {
  disk_usage: { threshold_percent: 80 },
  ilm_error: {},
  ingest_stall: { index_pattern: "*", threshold_minutes: 60 },
};

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slackUrl, setSlackUrl] = useState("");
  const [slackDirty, setSlackDirty] = useState(false);
  const [slackSaving, setSlackSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/rules");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRules(json.rules);
    } catch (e) {
      pushToast({ title: "Failed to load rules", message: e.message, tone: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSlack = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/slack");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSlackUrl(json.url || "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRules(); fetchSlack(); }, [fetchRules, fetchSlack]);

  const saveSlack = async () => {
    setSlackSaving(true);
    try {
      const res = await fetch("/api/settings/slack", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: slackUrl }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast({ title: "Slack webhook saved", tone: "success" });
      setSlackDirty(false);
      fetchSlack();
    } catch (e) {
      pushToast({ title: "Failed to save", message: e.message, tone: "error" });
    } finally {
      setSlackSaving(false);
    }
  };

  const toggleRule = async (id, enabled) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
    try {
      const res = await fetch(`/api/settings/rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      pushToast({ title: "Toggle failed", message: e.message, tone: "error" });
      fetchRules();
    }
  };

  const deleteRuleById = async (id) => {
    if (!window.confirm("Delete this alert rule?")) return;
    try {
      const res = await fetch(`/api/settings/rules/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast({ title: "Rule deleted", tone: "success" });
      fetchRules();
    } catch (e) {
      pushToast({ title: "Delete failed", message: e.message, tone: "error" });
    }
  };

  const saveRule = async (formData, isNew) => {
    const method = isNew ? "POST" : "PUT";
    const url = isNew ? "/api/settings/rules" : `/api/settings/rules/${formData.id}`;
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          type: formData.type,
          enabled: formData.enabled,
          config: formData.config,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      pushToast({ title: isNew ? "Rule created" : "Rule updated", tone: "success" });
      setEditingId(null);
      setAddingNew(false);
      fetchRules();
    } catch (e) {
      pushToast({ title: "Save failed", message: e.message, tone: "error" });
    }
  };

  if (loading) return <LoadingSpinner label="Loading settings" />;

  return (
    <div>
      <div className="page-toolbar">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Slack Integration</div>
        <div className="settings-slack-card">
          <div className="settings-field-label">Webhook URL</div>
          <div className="settings-input-row">
            <input
              className="settings-input"
              type="text"
              value={slackUrl}
              onChange={(e) => { setSlackUrl(e.target.value); setSlackDirty(true); }}
              placeholder="https://hooks.slack.com/services/..."
            />
            <button
              className="btn btn-primary"
              onClick={saveSlack}
              disabled={!slackDirty || slackSaving}
              style={{ padding: "8px 14px", fontSize: "11px" }}
            >
              {slackSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Alert Rules</div>

        {rules.map((rule) =>
          editingId === rule.id ? (
            <RuleForm
              key={rule.id}
              initial={rule}
              onSave={(data) => saveRule(data, false)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={(enabled) => toggleRule(rule.id, enabled)}
              onEdit={() => { setEditingId(rule.id); setAddingNew(false); }}
              onDelete={() => deleteRuleById(rule.id)}
            />
          )
        )}

        {addingNew ? (
          <RuleForm
            initial={{ name: "", type: "disk_usage", enabled: true, config: DEFAULT_CONFIGS.disk_usage }}
            onSave={(data) => saveRule(data, true)}
            onCancel={() => setAddingNew(false)}
          />
        ) : (
          <button className="settings-add-rule" onClick={() => { setAddingNew(true); setEditingId(null); }}>
            + Add alert rule
          </button>
        )}
      </div>
    </div>
  );
}

function RuleCard({ rule, onToggle, onEdit, onDelete }) {
  return (
    <div className={`settings-rule${rule.enabled ? "" : " disabled"}`}>
      <div className="settings-rule-main">
        <div className="settings-rule-header">
          <span className="settings-rule-name">{rule.name}</span>
          <span className={`settings-rule-type settings-type-${rule.type}`}>{rule.type}</span>
        </div>
        <div className="settings-rule-config">
          {rule.type === "disk_usage" && (
            <div>
              <div className="settings-rule-field-label">Threshold</div>
              <div className="settings-rule-field-value"><strong>{rule.config.threshold_percent ?? 80}%</strong></div>
            </div>
          )}
          {rule.type === "ilm_error" && (
            <div>
              <div className="settings-rule-field-label">Config</div>
              <div className="settings-rule-field-value">No additional parameters</div>
            </div>
          )}
          {rule.type === "ingest_stall" && (
            <>
              <div>
                <div className="settings-rule-field-label">Index pattern</div>
                <div className="settings-rule-field-value"><strong>{rule.config.index_pattern || "*"}</strong></div>
              </div>
              <div>
                <div className="settings-rule-field-label">Stall threshold</div>
                <div className="settings-rule-field-value"><strong>{rule.config.threshold_minutes ?? 60} min</strong></div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="settings-rule-actions">
        <button
          className={`settings-toggle ${rule.enabled ? "on" : "off"}`}
          onClick={() => onToggle(!rule.enabled)}
          title={rule.enabled ? "Disable" : "Enable"}
        >
          <div className="settings-toggle-dot" />
        </button>
        <div className="settings-rule-btns">
          <button className="settings-icon-btn" onClick={onEdit} title="Edit">&#x270E;</button>
          <button className="settings-icon-btn danger" onClick={onDelete} title="Delete">&#x2715;</button>
        </div>
      </div>
    </div>
  );
}

function RuleForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [enabled] = useState(initial.enabled);
  const [config, setConfig] = useState(initial.config);

  const handleTypeChange = (newType) => {
    setType(newType);
    setConfig(DEFAULT_CONFIGS[newType] || {});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { pushToast({ title: "Name is required", tone: "error" }); return; }
    onSave({ id: initial.id, name, type, enabled, config });
  };

  return (
    <form className="settings-form" onSubmit={handleSubmit}>
      <div className="settings-form-row">
        <div className="settings-form-group wide">
          <label>Rule name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., High disk usage" />
        </div>
        <div className="settings-form-group">
          <label>Type</label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            {RULE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {type === "disk_usage" && (
        <div className="settings-form-row">
          <div className="settings-form-group">
            <label>Threshold (%)</label>
            <input
              type="number" min="1" max="100"
              value={config.threshold_percent ?? 80}
              onChange={(e) => setConfig({ ...config, threshold_percent: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      {type === "ingest_stall" && (
        <div className="settings-form-row">
          <div className="settings-form-group wide">
            <label>Index pattern</label>
            <input
              value={config.index_pattern || ""}
              onChange={(e) => setConfig({ ...config, index_pattern: e.target.value })}
              placeholder="*"
            />
          </div>
          <div className="settings-form-group">
            <label>Stall threshold (minutes)</label>
            <input
              type="number" min="1"
              value={config.threshold_minutes ?? 60}
              onChange={(e) => setConfig({ ...config, threshold_minutes: Number(e.target.value) })}
            />
          </div>
        </div>
      )}

      <div className="settings-form-actions">
        <button type="submit" className="btn btn-primary">{initial.id ? "Save changes" : "Create rule"}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
