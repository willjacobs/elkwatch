const { Client } = require("@elastic/elasticsearch");

const clients = new Map();

function buildClientOptions(cluster) {
  const opts = { node: cluster.url };
  const auth = cluster.auth || { type: "none" };
  if (auth.type === "basic") {
    opts.auth = {
      username: auth.username,
      password: auth.password,
    };
  } else if (auth.type === "api_key") {
    opts.auth = { apiKey: auth.key };
  }
  return opts;
}

function getClient(cluster) {
  const name = cluster.name;
  if (!clients.has(name)) {
    clients.set(name, new Client(buildClientOptions(cluster)));
  }
  return clients.get(name);
}

function clearClients() {
  clients.clear();
}

module.exports = { getClient, clearClients };
