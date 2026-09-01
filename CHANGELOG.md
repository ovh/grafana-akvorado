# Changelog

## 2.0.2

### Fixed

- The Limit, IPv4 /x and IPv6 /x boxes no longer refuse to be cleared. They
  rendered `value || <default>`, so deleting the number put the default straight
  back and you could not type a new one. Each box now shows what the query
  holds.

### Changed

- A value the query cannot use gets a warning instead of a silent default. The
  query editor shows the reason under the field (required, not a whole number,
  out of range) and holds the query back until it is fixed. The limit range
  follows the `dimensionsLimit` the Akvorado console reports.
- A dashboard that holds an unreadable value still runs with the default, and
  the panel now carries a warning that names the field and the value it
  ignored.

## 2.0.1

### Fixed

- Queries no longer fail when a dashboard holds `limit`, `truncatev4` or
  `truncatev6` as a JSON number. Since 2.0.0 the backend refused to decode them
  and the panel showed "No data" with `invalid query json: json: cannot
  unmarshal number into Go struct field`. A number and a string now both decode,
  and a value that is neither keeps the default (10, 32 and 128). This covers
  every dashboard saved with 1.0.x, the example dashboard in `provisioning/`
  included.

### Changed

- The filter editor takes its syntax colours from the Grafana theme tokens
  instead of hard-coded hex values, so it follows Grafana in light and in dark
  mode.

## 2.0.0

### Breaking changes

- **Minimum Grafana version is now 12.3.0.** Grafana 13 replaced React 18 with
  React 19, which renamed the internal `__SECRET_INTERNALS` object. The plugin
  now takes `react/jsx-runtime` from Grafana instead of bundling its own copy,
  and only Grafana 12.3.0 and later provide it. Grafana 10 and 11 are no longer
  supported.
- **The AWS SigV4 auth toggle is removed from the data source settings.** It came
  from the original scaffold and does not apply to an Akvorado console. Every
  other authentication method is unchanged.

### Added

- Support for Grafana 13. Verified against Grafana 13.1.3.
- End-to-end tests now run against the declared minimum version (12.3.0) and
  against 13.1.3 on every pull request.
- The release pipeline publishes a build provenance attestation and runs the
  Grafana plugin validator before it creates the release.

### Changed

- The data source settings page uses the supported `@grafana/plugin-ui`
  components. It replaces `DataSourceHttpSettings`, which Grafana deprecated.
- `@grafana/*` packages moved from 10.3.3 to 13.1.3.
- Build tooling regenerated with `@grafana/create-plugin` 7.10.0. This moves the
  build to ESLint 9, TypeScript 5.5 and Node 22.
- Go plugin SDK moved from v0.292.1 to v0.296.4.

### Security

- Pinned patched versions of every dependency that carried a high or critical
  advisory. The dependency tree now reports no high or critical finding, and the
  Grafana plugin validator reports no error.

## 1.0.38

- Added a Go backend so that resource calls and queries run in the Grafana
  backend. Shared (public) dashboards work as a result.

## 1.0.0

Initial release.
