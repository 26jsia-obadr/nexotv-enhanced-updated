# NexoTV-Enhanced

A Stremio IPTV addon focused on live TV first, but expanded with movies, series, multi-source merging, catalog filtering, TMDB enrichment, saved configurations, and private web UI support.

> The core experience remains IPTV: live channels are the main focus. Movies and series catalogs are layered on top for richer browsing and playback.

<p align="center">
  <a href="https://upandclear.org/2026/06/24/nexotv-enhanced/">
    <img src="https://img.shields.io/badge/Article-upandclear.org-blue?style=for-the-badge" alt="Article preview">
  </a>
</p>

- Overview and install notes: [upandclear.org — NexoTV Enhanced](https://upandclear.org/2026/06/24/nexotv-enhanced/)
- Easy setup guide: [INSTALLATION-FACILE.md](INSTALLATION-FACILE.md)

---

## Project origin

This repository is an enhanced fork of [joaosavi/nexotv](https://github.com/joaosavi/nexotv), maintained by [@joaosavi](https://github.com/joaosavi) and distributed under the MIT license.

This fork keeps the original architecture and extends it with modern IPTV features for real-world deployments:

- Xtream, M3U, IPTV-org, and Stalker source support
- multi-source config merging and de-duplication
- category and channel filtering
- TMDB metadata enrichment
- private mode and encrypted saved configs
- cached refresh logic, statistics, and server-side config management

- Upstream repo: https://github.com/joaosavi/nexotv
- Upstream docs: [README.upstream.md](README.upstream.md)

---

## What this version adds

This version is much more than a simple IPTV bridge. It includes a full web configuration flow and catalog system built around the provider data.

### Main features

- Live TV support for Xtream, M3U/M3U+, IPTV-org, and Stalker/Ministra
- Single live-TV catalog with internal genre filtering instead of one row per category
- Movies and series catalogs for compatible providers
- Multi-source configurations with per-source category selection
- Channel-level hide/show controls in each provider config
- Single, split, and custom catalog layouts
- TMDB poster/synopsis/genre/rating enrichment
- Optional password-protected private mode
- Encrypted server-side saved configurations
- Viewing statistics and feed summaries
- Automatic cache refresh and EPG refresh logic

---

## Screenshots

![Configuration](screenshots/1.png)

---

## Features in detail

### Live TV

The addon supports the following live sources in Stremio:

- Xtream
- M3U / M3U+
- IPTV-org
- Stalker / Ministra
- Multi-source combinations of the above

The config flow lets you select categories, filter channels, and build installable catalogs without exposing all content at once.

### Categories and catalog layouts

The web config lets you:

- add a provider and credentials
- load categories from that source
- choose the specific categories to expose
- choose a catalog layout:
  - single
  - split
  - custom
- install or reconfigure the addon in Stremio

The live-TV flow now favors a single catalog with selected categories exposed as internal genre filters instead of creating one Stremio catalog row per category. This keeps the manifest compact while still letting users filter by category inside the catalog. Catalog structure is still defined by the configuration token and only changes after a reconfiguration.

### Hide individual channels

Each supported provider allows you to hide channels individually without removing the whole category.

1. Load the provider data.
2. Filter or search the channel list.
3. Untick the channels you want hidden.
4. Save or reinstall the config.

Hidden channels no longer appear in Stremio catalogs and their playback routes are unavailable.

### Movies and series

For Xtream and Stalker sources, the addon can create typed movie and series catalogs.

- Movies are exposed as `movie` catalogs
- Series are exposed as `series` catalogs with seasons and episodes
- Episode data loads on demand or on play depending on the provider
- M3U movies are supported as flat movie catalogs; M3U series do not have a season/episode tree

This keeps Stremio/Nuvio browsing aligned with the expected movie and series catalog model.

### Stalker / Ministra support

The Stalker integration includes:

- portal URL + MAC-based authentication
- automatic `/c/portal.php` detection
- live TV, VOD, and series catalog loading
- paginated lists
- dynamic stream resolution at playback time
- TMDB enrichment with provider metadata fallback

Stalker streams are resolved on demand because their URLs are dynamically generated.

### TMDB enrichment

The web UI includes a TMDB section. When a key is entered, the addon enriches movie and series metadata with:

- posters
- synopsis
- genres
- cast / credits
- ratings

The addon prefers the provider's `tmdb_id` when available, otherwise it searches by title + year. If TMDB metadata is missing or not useful, the original provider metadata is preserved.

### Multi-source mode

The multi-source configuration merges multiple named sources into a single catalog set.

Key features:

- combine Xtream, M3U, and Stalker sources
- merge selected channels across sources
- de-duplicate movies and series by normalized title
- merge series episodes by season and episode number where possible
- choose playback behavior:
  - offer the choice between streams
  - play the first available source automatically

TV channels remain source-specific rather than being merged together as a single shared channel.

### Private mode and authentication

The web UI can run in public or private mode.

- Public mode: no login required
- Private mode: enabled when `WEBUI_PASSWORD` is configured

Private mode adds:

- protected access to config pages and shared data
- saved configuration storage on the server
- statistics access
- secure cookie-based session handling
- constant-time password comparison

Addon and stream endpoints remain public so Stremio/Nuvio can still fetch the manifest and media without logging in.

### Saved configurations

Saved configs are available in private mode and stored encrypted in the SQLite database in the data directory.

This supports:

- saving a config under a custom name
- loading a saved config back into the form
- deleting saved entries
- provider-specific labeling for Xtream, M3U, Stalker, and multi-source setups
- reconfiguration from the Stremio UI with server-side decryption support

### Statistics and feed visibility

When enabled, the stats panel tracks:

- viewing activity and stream requests
- source and requester information
- Stalker portal usage when relevant
- feed size summaries by catalog type

This gives administrators visibility into which feeds and sources are actively being used.

---

## Refresh, caching, and performance

The addon is designed for real-world IPTV workloads and keeps catalog data responsive.

- automatic background refresh every 4 hours by default
- per-config refresh override available in the UI
- conditional requests using ETag / If-Modified-Since
- SQLite disk cache for provider data
- in-memory cache eviction after inactivity
- EPG refresh on an 8-hour cadence
- non-blocking install flow so the manifest is served immediately while data loads in the background

This reduces install time and avoids blocking the Stremio setup flow.

---

## Deployment

### Render

The repo includes a Render Blueprint in [render.yaml](render.yaml). It:

- creates the Docker web service
- uses the Dockerfile startup command
- generates `CONFIG_SECRET`
- configures `/health`
- adds a persistent `/app/data` disk

1. In Render, select New + → Blueprint.
2. Connect this repository and choose the main branch.
3. Review the plan and disk settings.
4. Apply the blueprint and open the generated URL.
5. Visit `/configure` to create or update the addon config.

Important notes:

- Do not set `PORT` manually; Render injects it.
- Keep `ALLOW_LOCAL_URLS=false` for public deployments.
- `WEBUI_PASSWORD` is optional but recommended for protected shared configs.

### Key environment variables

| Variable | Role | Default |
|---|---|---|
| `ADDON_NAME` | Name shown in Stremio/Nuvio | `NexoTV-Enhanced` |
| `CONFIG_SECRET` | Encrypts tokens and saved configs; required for public instances | none |
| `WEBUI_PASSWORD` | Enables private mode and protects the web UI | public mode |
| `WEBUI_SESSION_TTL_MS` | Session lifetime | `2592000000` (30 days) |
| `TMDB_API_KEY` | Global TMDB fallback | none |
| `TMDB_LANGUAGE` | Default TMDB language | `fr-FR` |
| `EPG_ENABLED` | Disable EPG globally if needed | `true` |
| `UPDATE_INTERVAL_MS` | Auto-refresh interval | `14400000` (4 h) |
| `EPG_UPDATE_INTERVAL_MS` | EPG refresh interval | `28800000` (8 h) |
| `CACHE_TTL_MS` | Cache lifetime | `86400000` (24 h) |
| `ALLOW_LOCAL_URLS` | Allows local/private test URLs | `false` |

See [.env.example](.env.example) for the complete list of supported variables.

---

## Quick start

### Development

```bash
pnpm install
pnpm dev
pnpm check
```

Useful commands:

```bash
pnpm --filter backend exec vitest run
pnpm --filter @nexotv/frontend build
```

This project is a pnpm monorepo with a backend service and a Vue-based frontend UI.

---

## Technical notes

- Dynamic manifest generation: [packages/backend/src/addon/manifest.ts](packages/backend/src/addon/manifest.ts)
- Catalog and stream resolution: [packages/backend/src/addon/M3UEPGAddon.ts](packages/backend/src/addon/M3UEPGAddon.ts)
- Short manifest token handling: [packages/backend/src/utils/configTokenStore.ts](packages/backend/src/utils/configTokenStore.ts)
- Authentication and secure sessions: [packages/backend/src/utils/webauth.ts](packages/backend/src/utils/webauth.ts)
- Saved config persistence: [packages/backend/src/utils/configStore.ts](packages/backend/src/utils/configStore.ts)
- Frontend config UI: [packages/frontend/src/components](packages/frontend/src/components)

---

## License

MIT — see [LICENSE](LICENSE). The project keeps the original upstream copyright and releases this fork under the same license.
