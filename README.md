<h1 align="center">NexoTV-Enhanced</h1>

<p align="center">
  <strong>Stremio IPTV addon — <em>live TV channels</em> first, plus Movies &amp; Series catalogs,
  multi-source, category selection, authentication and saved configurations.</strong>
</p>

> **The core stays IPTV: live TV channels.** The addon streams your live channels (Xtream,
> M3U/M3U+, IPTV-org, Stalker/Ministra) in Stremio; Movies & Series catalogs (Xtream, Stalker) come
> **on top**.

<p align="center">
  <a href="https://upandclear.org/2026/06/24/nexotv-enhanced/">
    <img src="https://img.shields.io/badge/Article-upandclear.org-blue?style=for-the-badge" alt="Article">
  </a>
</p>

> Overview, install guide and screenshots: **[upandclear.org — NexoTV Enhanced](https://upandclear.org/2026/06/24/nexotv-enhanced/)**

> **Easy installation: [step-by-step guide](INSTALLATION-FACILE.md).**

---

## Project origin (attribution)

This repository is an **enhanced fork** of **[joaosavi/nexotv](https://github.com/joaosavi/nexotv)**,
created by [@joaosavi](https://github.com/joaosavi) and distributed under the **MIT** license.

All credit for the original addon (architecture, Xtream / M3U / IPTV-org providers, EPG, cache,
SSRF protection, etc.) goes to its author. This repository **keeps the MIT license** and adds
features on top of the upstream code.

- Upstream source: https://github.com/joaosavi/nexotv
- Full original documentation (detailed deployment, all env vars, EPG…):
  **[README.upstream.md](README.upstream.md)**

---

## What this version adds

| Area | Addition |
|---|---|
| **Live TV** | Xtream, M3U, IPTV-org and Stalker live channels in Stremio. |
| **Movies and Series** | Playable catalogs with metadata and on-demand episodes. |
| **Multi-source** | Multiple sources with de-duplication and stream selection. |
| **Security** | Encrypted configuration tokens, optional web UI password and SSRF protection. |
| **Catalogs** | Single, split and custom catalog layouts with home/discover selection. |

The addon remains backward-compatible when no category selection is configured.

## Public mode or private mode

Use `CONFIG_SECRET` for public deployments. Add `WEBUI_PASSWORD` to protect the web UI and enable
shared saved configurations and statistics. Keep the persistent `data/` directory because it stores
the SQLite database used by short manifest URLs.

---

## Screenshots

![Configuration](screenshots/1.png)

---

## Features in detail

### Categories and catalogs

Open `/configure`, enter a provider, load and select categories, choose a catalog layout, then install
the addon in Stremio.

### Hide individual channels

In every provider (Xtream, M3U, IPTV-org, Stalker and multi-source), the **Channels** section lets
you exclude individual live TV channels without removing their whole category:

1. Click **Load channels** after entering the provider settings.
2. Search for a channel or filter the list by category, then **untick** the channels to hide.
   **Hide filtered** and **Show filtered** apply the choice to every filtered result.
3. Install or reconfigure the addon to store the selection in its configuration.

Hidden channels no longer appear in Stremio catalogs, and their playback routes are unavailable as
well. The selection is specific to each configuration and is retained when it is saved or
reconfigured.

### Movies & Series (Xtream)

Selecting a **Movies** or **Series** category in Xtream creates a typed Stremio catalog:

- **Movies** → `movie` type, direct file playback (`/movie/USER/PASS/id.ext`).
- **Series** → `series` type: the detail page shows **seasons + episodes**, loaded on open via
  `get_series_info` (no mass prefetch), each episode playable.

The catalog type follows the category type: *split* → one catalog per category (of the right type);
*custom* → one catalog per group (dominant type); *single* → one catalog **per type**
(TV / Movies / Series). On **M3U**, movies (`/movie/`) become `movie` catalogs; series stay flat
(an M3U carries no season/episode structure).

> In Stremio/Nuvio, catalogs are grouped **by type**: a Movies catalog appears under
> *Discover → Movies*, a Series catalog under *Discover → Series*.

### Stalker / Ministra (live TV + movies + series)

**Stalker** tab (and a **Stalker** option in multi-source): enter the **portal URL** and **MAC
address**, click **Load categories**, then select and build catalogs like any other provider. The
webui labels each category's **type** (TV / Movies / Series).

- **Handshake + token** authentication (MAC), `/c/portal.php` path auto-detected.
- TV categories = **ITV genres**; **Movie** = portal **VOD**; **Series** = `type=series`; lists
  paginated via `get_ordered_list`.
- **Stalker movies and series are playable**: synopsis + `tmdb_id` come from the portal, enriched
  via **TMDB** (key entered in the webui) with a fallback to portal data.
- **Series**: seasons and episodes fetched via `movie_id`; each episode is resolved on play via
  `create_link&type=vod` with the season's `cmd` + the episode number.
- Stalker stream URLs are **dynamic**, so they are resolved **on play** via `create_link`
  (TV `type=itv`, movies/episodes `type=vod`; ephemeral play token).
- In multi-source, **Stalker movies and series de-duplicate** with Xtream/M3U ones sharing the same
  title (several sources → one entry, multiple links; episodes merged by season/number).

### TMDB enrichment (movies & series)

Enter a **TMDB API key** in the webui (*Metadata (TMDB)* section) to fetch **rich metadata**
(poster, synopsis, genres, cast, rating) on Movie & Series detail pages.

- Prefers the panel's **`tmdb_id`** (exact match); otherwise **TMDB search by title + year**.
- **Always falls back**: if TMDB finds nothing (messy naming, content not on TMDB…), the **provider
  data is kept** → nothing is lost.
- Configurable language (FR/EN). TMDB responses are cached (~7 days).
- Optional: without a key, behaviour is unchanged (provider metadata).

> The key can also be set globally on the server via `TMDB_API_KEY` (the webui key takes priority).

### Authentication (single password)

- Enabled only when **`WEBUI_PASSWORD`** is set (otherwise the UI is open — backward-compatible).
- Protects the configuration page and its endpoints (`/encrypt`, `/api/prefetch`).
- **Addon/stream endpoints stay public** (Stremio/Nuvio cannot authenticate).
- Session via a **signed HMAC cookie** (HttpOnly, SameSite=Lax, Secure behind HTTPS), 30-day default
  (`WEBUI_SESSION_TTL_MS`), constant-time password comparison, rate-limited `/api/login`.
- **Log out** button in the header (next to the EN/FR switch) when signed in.
- Without `WEBUI_PASSWORD`, the configurator stays public while every endpoint exposing shared data
  or plaintext credentials is disabled server-side.

### Statistics (viewing & feeds)

**Statistics** panel in the webui (behind auth):

- **Viewing (output)**: every stream-list request (`/stream`) is logged — **time, title, type,
  requester IP**, **source** and **Stalker portal MAC** used. An **"active (10 min)"** counter +
  history. Stored in SQLite (capped at 2000 entries / 30 days), clearable.
  > Limitation: the addon returns **direct URLs** (the player streams from the provider), so it only
  > sees a media being **opened** — not the real **watch duration**.
- **Incoming feeds**: per saved configuration, the **number of groups** (categories) **TV / Movies /
  Series** and total items, computed from cache (no forced re-fetch).

### Saved configurations (server-side)

- **Save configuration** button in each provider → stores the current config under a name.
- **Saved configurations** panel: a **correct provider badge** (Xtream / M3U / Stalker / Multi…),
  **Load** (fetches the server-decrypted config and restores the form) / **Delete**.
- Available only in **private mode**, when `WEBUI_PASSWORD` is set.
- Stored in **SQLite** (`data/`, persisted via the Docker volume) and **encrypted at rest** with
  `CONFIG_SECRET`. Everyone who knows the password shares them; there are no separate accounts.
- In **public mode**, save controls and the list are hidden, and direct API calls receive `403`.
- **Reconfigure from Stremio**: reopening the config via Stremio's *Configure* button restores the
  form even when the token is encrypted/compressed (server-side decode, behind auth).

### Multi-source (mixing + de-duplication)

**Multi-source** tab: add several named sources (Xtream / M3U / Stalker), load and select categories
**per source**, then pick the layout (combined by type / one catalog per category / custom) and the
**playback behaviour**.

- **Mixing**: all selected channels from the sources are merged into the catalogs.
- **Movies/Series de-duplication**: identical titles (after normalization: lowercase, no accents,
  no `HD/4K/1080p/MULTI/VF…` tags) are grouped into **one item** offering **one stream per source**,
  across all source types (Xtream / M3U / Stalker). **TV channels** are not merged (listed per
  source, suffixed with the source name).
- **Series**: episodes merged by (season, episode) across sources (Xtream and Stalker).
- **Playback** (`streamSelection`, set in the webui):
  - **Offer the choice** → Stremio lists one stream per source (IPTV1 / IPTVPerso…);
  - **Play the first available** → only the priority source's stream (source order).
- **Limitations**: no EPG in multi-source for now; on M3U, series stay flat (no season/episode tree),
  only M3U movies are de-duplicated.

> Single-source configs are unchanged and fully supported.

---

## Feed & catalog refresh

Data is fetched on demand then cached; catalogs always reflect the current channel list.

- **Auto-refresh** in the background every **4 h** (`UPDATE_INTERVAL_MS`) while the instance is
  active (circuit breaker after 3 failures). **Configurable per config in the webui** ("Auto-refresh"
  field, 1–720 h) — overrides the global value for that config.
- **Bootstrap**: the 1st catalog request after a (re)build forces a fresh fetch (unless <2 min).
- **Conditional requests** ETag / `If-Modified-Since` → `304 Not Modified` = no re-processing.
- **SQLite disk cache ~24 h** (`CACHE_TTL_MS`, `M3U_CACHE_TTL_MS`, `IPTV_ORG_CACHE_TTL_MS`),
  **RAM evicted after 5 min** of inactivity (`DATA_MEMORY_TTL_MS`).
- **EPG** refreshed every **8 h** (`EPG_UPDATE_INTERVAL_MS`).
- **Xtream VOD + series list**: fetched in the same call as live (same cadence). **Episodes** are
  loaded on demand each time a detail page is opened (always fresh).
- **Non-blocking install**: the manifest is served **immediately** and data is fetched in the
  **background** → no install timeout, even on a large panel or a heavy EPG.

The catalog **structure** (which catalogs, their types) is fixed by the token: it only changes by
**reconfiguring**.

---

## Deployment on Render (Web Service)

The repository includes a Render Blueprint in [`render.yaml`](render.yaml). It creates the Docker
web service, uses the Dockerfile start command, generates `CONFIG_SECRET`, configures `/health`, and
adds the persistent `/app/data` disk automatically.

1. In the Render dashboard, select **New +** → **Blueprint**.
2. Connect `https://github.com/nexnuvm/nexotv-enhanced-updated` and select the `main` branch.
3. Review the plan and disk, then click **Apply**. The Blueprint uses Render's **Starter** plan
  because persistent disks are not available on the Free plan.
4. Once deployed, open the Render URL and go to `/configure`.

Do not set `PORT` or a Docker command manually. Render injects `PORT`, and the Dockerfile already
starts `node packages/backend/dist/server.js`. `CONFIG_SECRET` is generated by Render and retained
as a secret environment variable. `WEBUI_PASSWORD` is optional. For a public instance, keep
`ALLOW_LOCAL_URLS=false`.

`WEBUI_PASSWORD` is optional. For a public instance, keep `ALLOW_LOCAL_URLS=false`.

### Key environment variables

| Variable | Role | Default |
|---|---|---|
| `ADDON_NAME` | Name shown in Stremio/Nuvio | `NexoTV-Enhanced` |
| `CONFIG_SECRET` | Encrypts tokens and saves; **required for public instances** (≥16 chars) | *(none)* |
| `WEBUI_PASSWORD` | Enables shared private mode: protected webui, saved configs and statistics | *(public mode)* |
| `WEBUI_SESSION_TTL_MS` | Session lifetime | `2592000000` (30 d) |
| `TMDB_API_KEY` | **Global** TMDB fallback key (the webui key takes priority) | *(none)* |
| `TMDB_LANGUAGE` | Default TMDB language | `fr-FR` |
| `EPG_ENABLED` | Set to `false` to **disable EPG everywhere** (whatever each config's setting) | `true` |
| `UPDATE_INTERVAL_MS` | Channel auto-refresh interval | `14400000` (4 h) |
| `EPG_UPDATE_INTERVAL_MS` | EPG refresh interval | `28800000` (8 h) |
| `CACHE_TTL_MS` | Disk cache TTL | `86400000` (24 h) |
| `ALLOW_LOCAL_URLS` | Allows private URLs for local testing only | `false` |

> See [`.env.example`](.env.example) for the full list of environment variables.

---

## Quick start (dev)

```bash
pnpm install
pnpm dev        # backend (port 7000) + frontend (Vite) in parallel
```

Tests and checks:

```bash
pnpm --filter backend exec vitest run      # backend tests
pnpm --filter @nexotv/frontend build       # typecheck (vue-tsc) + build
```

---

## Technical notes

- **Dynamic manifest** ([`manifest.ts`](packages/backend/src/addon/manifest.ts)): `single` →
  `iptv_channels` (+ `iptv_movies` / `iptv_series` depending on types); `split` → `iptv_cat_<n>`;
  `custom` → `iptv_grp_<n>`. `types[]` computed dynamically.
- **Config fields**: `selectedCategories`, `catalogMode` (`single|split|custom`),
  `catalogGroups`, `categoryTypes`, `sources`, `streamSelection`.
- **Catalog/stream/meta resolution**: [`M3UEPGAddon.ts`](packages/backend/src/addon/M3UEPGAddon.ts)
  (`resolveCatalog`, `itemsForCatalog`, `parseId`, `buildSeriesMeta`).
- **Short manifest URL**: compressed/encrypted configuration in SQLite with a persistent opaque
  reference via [`configTokenStore.ts`](packages/backend/src/utils/configTokenStore.ts). Legacy
  self-contained tokens remain supported by [`cryptoConfig.ts`](packages/backend/src/utils/cryptoConfig.ts).
- **Auth**: [`webauth.ts`](packages/backend/src/utils/webauth.ts) — **Config store**:
  [`configStore.ts`](packages/backend/src/utils/configStore.ts).
- **Frontend** (Vue 3): [`CategorySelector.vue`](packages/frontend/src/components/CategorySelector.vue),
  [`MultiSourceConfig.vue`](packages/frontend/src/components/MultiSourceConfig.vue),
  [`SavedConfigs.vue`](packages/frontend/src/components/SavedConfigs.vue),
  [`LoginGate.vue`](packages/frontend/src/components/LoginGate.vue).

---

## License

MIT — see [LICENSE](LICENSE). The original copyright of
[@joaosavi](https://github.com/joaosavi) is preserved; this fork's additions are released under the
same license.
