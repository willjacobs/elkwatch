# CLAUDE.md

This file provides context for AI assistants (Claude, Copilot, etc.) working in this codebase.

---

## Project Overview

Elkwatch is a self-hosted Elasticsearch health dashboard. It is a full-stack Node.js/React app packaged as a Docker Compose stack. The backend proxies calls to one or more Elasticsearch clusters and runs a scheduled alert checker. The frontend is a React SPA served by nginx.

---

## Repo Structure

```
elkwatch/
├── backend/
│   └── src/
│       ├── index.js                  # Express entry point
│       ├── config/
│       │   └── loader.js             # Reads config.yml at startup
│       ├── routes/
│       │   ├── clusters.js           # GET /api/clusters
│       │   ├── indices.js            # GET /api/indices/:clusterName
│       │   ├── ilm.js                # GET /api/ilm/:clusterName
│       │   ├── alerts.js             # GET /api/alerts
│       │   ├── nodes.js              # GET /api/nodes/:clusterName
│       │   └── templates.js          # GET /api/templates/:clusterName
│       ├── metrics.js               # Prometheus register for GET /metrics
│       └── services/
│           ├── esClient.js           # ES client factory (cached per cluster)
│           └── alertScheduler.js     # node-cron alert checks + Slack webhooks
├── frontend/
│   └── src/
│       ├── App.jsx                   # Router + sidebar layout
│       ├── main.jsx                  # React entry point
│       ├── index.css                 # Global styles + CSS variables
│       ├── pages/
│       │   ├── Overview.jsx          # Cluster health cards
│       │   ├── Indices.jsx           # Index browser table
│       │   ├── ILM.jsx               # ILM phase/status table
│       │   ├── Alerts.jsx            # Alert history list
│       │   ├── Nodes.jsx             # Per-node disk / heap
│       │   └── Templates.jsx         # Composable index templates
│       └── hooks/
│           └── useCluster.js         # useClusters() fetch hook
├── config.yml                        # Runtime config (not committed)
├── config.yml.example                # Committed template
└── docker-compose.yml
```

---

## Key Conventions

### Config is runtime, not build-time
`config.yml` is mounted as a read-only volume into the backend container. It is **never baked into the image**. Changes to `config.yml` require a backend service restart (`docker-compose restart backend`), not a rebuild.

### Elasticsearch client is a singleton per cluster
`esClient.js` caches one `@elastic/elasticsearch` `Client` instance per cluster name. Do not create new clients in route handlers — always call `getClient(clusterConfig)`.

### Cluster config flows through `req.config`
The loaded config object is attached to every request via middleware in `index.js`. Routes access it via `req.config.clusters`. Do not read `config.yml` again in routes.

### Frontend API calls go through `/api`
In development, Vite proxies `/api` to `localhost:3001`. In production, nginx proxies `/api` to the `backend` container. All `fetch()` calls in the frontend use relative paths (`/api/...`).

### CSS variables for theming
All colors are defined as CSS variables in `index.css`. Do not hardcode hex values in component styles. The current theme variables are:

```css
--bg         /* Page background */
--surface    /* Card/sidebar background */
--border     /* Dividers */
--text        /* Primary text */
--muted       /* Secondary/label text */
--green       /* Cluster status: green */
--yellow      /* Cluster status: yellow */
--red         /* Cluster status: red / errors */
--accent      /* Links, active nav, highlights */
```

---

## Common Tasks

### Add a new API route

1. Create `backend/src/routes/yourRoute.js`
2. Export an Express router
3. Mount it in `backend/src/index.js`:
   ```js
   const yourRoute = require("./routes/yourRoute");
   app.use("/api/your-path", yourRoute);
   ```

### Add a new frontend page

1. Create `frontend/src/pages/YourPage.jsx`
2. Add a `<Route>` in `App.jsx`
3. Add a `<NavLink>` in the sidebar in `App.jsx`

### Add a new alert rule type

1. Add a check function in `alertScheduler.js` following the pattern of `checkDiskUsage` / `checkIlmErrors`
2. Add a `rule.type` dispatch case in `runChecks()`
3. Document the new type in `config.yml.example` and `README.md`

### Changing the alert check interval

The scheduler runs every 5 minutes. To change it, edit the cron expression in `alertScheduler.js`:

```js
cron.schedule("*/5 * * * *", () => runChecks(config));
```

---

## Elasticsearch API Notes

- All ES calls use the official `@elastic/elasticsearch` v8 client
- ILM explain: `client.ilm.explainLifecycle({ index: "*" })` — returns all managed indices
- ILM policies: `client.ilm.getLifecycle()` — returns policy definitions
- Index stats: `client.cat.indices({ format: "json", h: "..." })` — use `h` to limit fields
- Cluster health: `client.cluster.health()` — fast, use for status polling
- Cluster stats: `client.cluster.stats()` — heavier, includes fs/node data

Avoid `_all` or `*` wildcard calls that could be expensive on large clusters. Prefer `cat` APIs for listing.

---

## What's Intentionally Out of Scope

- **Authentication on the Elkwatch UI itself** — currently no login wall; it's designed to run inside a private network. See roadmap in README.
- **Writing to Elasticsearch** — Elkwatch is read-only by design. It will never modify indices, policies, or cluster settings.
- **Real-time streaming** — the frontend polls on page load and page focus. No WebSockets.
- **Multi-user / RBAC** — single-tenant, single config file.
