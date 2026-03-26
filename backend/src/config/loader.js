/**
 * Config path: CONFIG_PATH env, or ../config.yml when cwd is backend/ (local dev), else cwd/config.yml.
 */
const fs = require("fs");
const path = require("path");
const YAML = require("yaml");

function resolveConfigPath() {
  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }
  const fromBackend = path.join(process.cwd(), "..", "config.yml");
  if (fs.existsSync(fromBackend)) {
    return fromBackend;
  }
  return path.join(process.cwd(), "config.yml");
}

function loadConfig() {
  const configPath = resolveConfigPath();
  const raw = fs.readFileSync(configPath, "utf8");
  const data = YAML.parse(raw);
  if (!data?.clusters?.length) {
    throw new Error("config must define at least one cluster");
  }
  return data;
}

module.exports = { loadConfig, resolveConfigPath };
