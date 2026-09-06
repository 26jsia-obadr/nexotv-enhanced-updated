/**
 * Shared provider utilities to eliminate duplication across providers.
 * Used by: xtreamProvider, multiSourceProvider, iptvOrgProvider, m3uProvider
 */

import { fetchPublicUrl } from '../utils/publicFetch';
import env from '../config/env';

/**
 * Fetch JSON from a URL with timeout and error handling.
 * Returns null if fetch fails, response is not ok, or JSON parsing fails.
 */
export async function fetchJson(url: string, timeoutMs: number = env.FETCH_TIMEOUT_MS): Promise<any> {
    const resp = await fetchPublicUrl(url, {}, timeoutMs).catch(() => null);
    if (!resp || !resp.ok) return null;
    try {
        return await resp.json();
    } catch {
        return null;
    }
}

/**
 * Build a category_id → category_name map from a get_*_categories response.
 * Used by Xtream and similar providers.
 */
export function categoryIdMap(arr: any): Record<string, string> {
    const map: Record<string, string> = {};
    if (Array.isArray(arr)) {
        for (const c of arr) {
            if (c && c.category_id != null && c.category_name) {
                map[String(c.category_id)] = String(c.category_name);
            }
        }
    }
    return map;
}

/**
 * Extract selected category names from config (both single/split and custom groups).
 */
export function selectedCategoryNames(config: any): Set<string> {
    const out = new Set<string>();
    for (const c of config.selectedCategories || []) {
        if (typeof c === 'string' && c.trim()) out.add(c.trim());
    }
    for (const g of config.catalogGroups || []) {
        for (const c of g?.categories || []) {
            if (typeof c === 'string' && c.trim()) out.add(c.trim());
        }
    }
    return out;
}

/**
 * Determine media types covered by the selection based on categoryTypes mapping.
 * Used to filter channels by type (tv, movie, series).
 */
export function selectedTypes(config: any): Set<string> {
    const names = selectedCategoryNames(config);
    const types: Record<string, string> = config.categoryTypes || {};
    const out = new Set<string>();
    for (const n of names) out.add(types[n] || 'tv');
    return out;
}

/**
 * Validate and fetch EPG data from a given URL.
 * Returns null if EPG is unavailable or fetch/parse fails.
 */
export async function validateAndFetchEpg(
    epgUrl: string | undefined,
    config: any,
    timeoutMs: number = env.FETCH_TIMEOUT_MS
): Promise<any> {
    if (!epgUrl) return null;
    const epgResp = await fetchPublicUrl(epgUrl, {}, timeoutMs).catch(() => null);
    if (!epgResp || !epgResp.ok) return null;
    try {
        return await epgResp.text();
    } catch {
        return null;
    }
}
