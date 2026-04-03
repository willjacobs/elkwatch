# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- SQLite-backed alert history (`better-sqlite3`), persisted across backend restarts; optional `GET /api/alerts?limit=`.

### Changed
- Docker Compose mounts a named volume for `/app/data` (alert database).

## [0.1.0] - 2026-03-27

### Added
- Initial public release of Elkwatch.
- Cluster overview, nodes dashboard, indices browser, ILM monitor, alerts, and templates pages.
- ILM policy dry-run editor with structural diff and affected-index preview.
- Global refresh controls and auto-refresh interval.
- Theme support (dark/charcoal/light) and active-cluster floating control panel.
- Prometheus metrics endpoint and health endpoint.
- Docker Compose and local development docs.

### Changed
- UI/UX improvements for responsiveness and dashboard navigation drilldowns.
- Faster cluster and ILM data loading with lightweight backend caching.

### Fixed
- ILM dry-run diff clarity (leaf-level paths, optional `_meta` inclusion).

