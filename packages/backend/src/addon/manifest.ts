import env from '../config/env';
import { APP_VERSION, PACKAGE_VERSION } from '../utils/version';

export type CatalogMode = 'single' | 'split' | 'custom';
export type MediaType = 'tv' | 'movie' | 'series';

export interface CatalogGroup {
    name: string;
    categories: string[];
}

export interface ManifestOptions {
    catalogName?: string;
    catalogMode?: CatalogMode;
    selectedCategories?: string[];
    catalogGroups?: CatalogGroup[];
    /** Category name → media type. Missing entries default to 'tv'. */
    categoryTypes?: Record<string, MediaType>;
    /**
     * Catalogs kept OUT of the Stremio home board (still browsable in Discover).
     * Keys: 'grp:<index>' (custom), 'cat:<name>' (split), 'type:<tv|movie|series>' (single).
     */
    discoverOnly?: string[];
}

/** Catalog id used in "single" mode for live TV (kept stable for back-compat). */
export const SINGLE_CATALOG_ID = 'iptv_channels';
const MAX_MANIFEST_SIZE = 8192;

/** Deterministic catalog id for the Nth selected category in "split" mode. */
export function catalogIdForIndex(index: number) {
    return `iptv_cat_${index}`;
}

/** Deterministic catalog id for the Nth custom group in "custom" mode. */
export function groupCatalogIdForIndex(index: number) {
    return `iptv_grp_${index}`;
}

function cleanCategories(list: string[] | undefined): string[] {
    return (list || [])
        .map(c => (typeof c === 'string' ? c.trim() : ''))
        .filter(Boolean);
}

function typeOf(name: string, types?: Record<string, MediaType>): MediaType {
    return (types?.[name] as MediaType) || 'tv';
}

/** Dominant media type among a list of categories. */
function dominantType(categories: string[], types?: Record<string, MediaType>): MediaType {
    const tally: Record<MediaType, number> = { tv: 0, movie: 0, series: 0 };
    for (const c of categories) tally[typeOf(c, types)]++;
    if (tally.series >= tally.movie && tally.series > tally.tv) return 'series';
    if (tally.movie >= tally.series && tally.movie > tally.tv) return 'movie';
    return 'tv';
}

/**
 * Extra/genre block.
 * - A **discover-only** catalog gets a REQUIRED genre → Stremio keeps it off the
 *   home board but still shows it in Discover (defaults to "All Channels").
 * - A **home** catalog keeps a non-required genre (only when >1 categories, to
 *   offer an internal filter) so it appears on the board.
 */
function catalogExtra(categories: string[], home: boolean) {
    const genres = ['All Channels', ...categories];
    if (!home) {
        return {
            extra: [
                { name: 'genre', isRequired: true, options: genres },
                { name: 'search', isRequired: false },
                { name: 'skip' }
            ]
        };
    }
    if (categories.length > 1) {
        return {
            extra: [
                { name: 'genre', isRequired: false, options: genres },
                { name: 'search', isRequired: false },
                { name: 'skip' }
            ]
        };
    }
    return { extra: [{ name: 'search', isRequired: false }, { name: 'skip' }] };
}

function buildCatalogs(opts: ManifestOptions) {
    // REFACTORED FOR NUVIO: Always use a SINGLE Live TV catalog with genre-based filtering.
    // This prevents multiple network requests and optimizes for rate-limiting constraints.
    
    const selectedCategories = cleanCategories(opts.selectedCategories);
    const baseName = opts.catalogName || env.ADDON_NAME;
    
    // Build genre options from user's selected categories (not from runtime-loaded channels).
    // If no categories are selected, use empty array (the route will serve all categories from cache).
    const genreOptions = selectedCategories.length > 0
        ? selectedCategories
        : [];
    
    // Create a SINGLE Live TV catalog with selected categories as genre filter options.
    const catalogs = [{
        type: 'tv' as MediaType,
        id: 'nexotv_live_all',
        name: baseName,
        extra: [
            {
                name: 'genre',
                isRequired: false,
                options: genreOptions.length > 0 ? genreOptions : undefined
            },
            { name: 'search', isRequired: false },
            { name: 'skip' }
        ].filter(e => !(e.name === 'genre' && !e.options))  // Remove genre extra if no options
    }];
    
    return catalogs;
}

/**
 * The SDK rejects manifests above 8 KiB. Genre options are useful but optional:
 * when an unusually large selection still exceeds the limit after removing the
 * legacy duplicate `genres` field, keep an "All Channels" entry so the addon
 * remains installable and every selected item stays reachable.
 */
function fitManifestToSdkLimit(manifest: any) {
    if (Buffer.byteLength(JSON.stringify(manifest), 'utf8') <= MAX_MANIFEST_SIZE) return manifest;
    for (const catalog of manifest.catalogs || []) {
        const genre = (catalog.extra || []).find((extra: any) => extra.name === 'genre');
        if (genre?.options?.length > 1) genre.options = ['All Channels'];
    }
    return manifest;
}

export function createManifest(idPrefix?: string, options?: ManifestOptions) {
    const opts = options || {};
    const catalogs = buildCatalogs(opts);
    // Declare every media type the catalogs expose (always include 'tv').
    const types = [...new Set<string>(['tv', ...catalogs.map((c: any) => c.type)])];
    return fitManifestToSdkLimit({
        id: 'community.nexotv.enhanced',
        version: PACKAGE_VERSION,
        name: env.ADDON_NAME,
        description: `${env.ADDON_DESCRIPTION} (${APP_VERSION})`,
        resources: ['catalog', 'stream', 'meta'],
        types,
        catalogs,
        idPrefixes: idPrefix ? [`xc${idPrefix}_`, `io${idPrefix}_`, `m3${idPrefix}_`] : ['xc', 'io', 'm3'],
        behaviorHints: {
            configurable: true,
            configurationRequired: true
        },
        ...(env.ADDON_LOGO_URL ? { logo: env.ADDON_LOGO_URL } : {}),
        ...(env.ADDON_BACKGROUND_URL ? { background: env.ADDON_BACKGROUND_URL } : {}),
    });
}
