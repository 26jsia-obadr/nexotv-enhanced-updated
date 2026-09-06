import { fetchPublicUrl } from './publicFetch';
import { makeLogger } from './logger';

const log = makeLogger();

/**
 * OPTIMIZATION: Lightweight stream URL validation using HEAD requests.
 * 
 * For HLS/video streams, a HEAD request can quickly determine if a URL is alive
 * without downloading the full content. If the primary link is dead (404, 502, etc.),
 * we can fallback to the next available link.
 * 
 * Timeout is SHORT (2 seconds) to prevent hanging the UI during playback selection.
 */

export interface StreamUrl {
    url: string;
    title?: string;
    behaviorHints?: Record<string, any>;
}

/**
 * Validate a single stream URL with a HEAD request.
 * Returns true if the URL appears to be alive (2xx, 3xx status).
 * Returns false if dead (4xx, 5xx) or timeout.
 * 
 * Does NOT throw — always returns a boolean.
 */
async function isStreamUrlValid(url: string, timeoutMs = 2000): Promise<boolean> {
    if (!url || !url.startsWith('http')) return false;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
        }).catch(() => null);

        clearTimeout(timer);

        if (!response) return false;

        // Accept 2xx (success) and 3xx (redirect). Reject 4xx (not found) and 5xx (server error).
        return response.ok || (response.status >= 300 && response.status < 400);
    } catch (e) {
        // Timeout, network error, or any other issue → treat as invalid
        return false;
    }
}

/**
 * Validate multiple stream URLs and return the first valid one.
 * Falls back through the list until a valid URL is found.
 * 
 * If all URLs are dead or timeouts occur, returns the first URL anyway
 * (so playback can still be attempted).
 * 
 * Validation runs in parallel for speed, but we return as soon as the
 * first valid URL is found.
 */
export async function getValidStreamUrl(
    streams: StreamUrl[],
    options?: { timeoutMs?: number; validateAll?: boolean }
): Promise<StreamUrl | null> {
    if (!streams || streams.length === 0) return null;

    const timeoutMs = options?.timeoutMs ?? 2000;
    const validateAll = options?.validateAll ?? false;

    // Fast path: if only one stream, don't bother validating (just return it)
    if (streams.length === 1) return streams[0];

    // If we want to validate all at once (takes longer but finds the best option)
    if (validateAll) {
        const results = await Promise.all(
            streams.map(async (s) => ({
                stream: s,
                valid: await isStreamUrlValid(s.url, timeoutMs),
            }))
        );
        const valid = results.find((r) => r.valid);
        if (valid) return valid.stream;
        // Fallback to first if none are valid
        return streams[0];
    }

    // Default: return first valid URL (race-style, stops at first success)
    for (const stream of streams) {
        const valid = await isStreamUrlValid(stream.url, timeoutMs);
        if (valid) return stream;
    }

    // Fallback: return the first stream if all are invalid/timed out
    log.debug('All stream URLs appear invalid, returning first as fallback', {
        count: streams.length,
        firstUrl: streams[0]?.url?.slice(0, 50),
    });
    return streams[0];
}

/**
 * Filter a list of streams, removing dead URLs.
 * Returns the original list if all URLs are dead or validation is disabled.
 * 
 * Useful for reducing clutter in the UI (no broken streams shown).
 */
export async function filterValidStreams(
    streams: StreamUrl[],
    timeoutMs = 2000
): Promise<StreamUrl[]> {
    if (!streams || streams.length === 0) return [];
    if (streams.length === 1) return streams; // Don't validate single stream (too risky)

    const results = await Promise.all(
        streams.map(async (s) => ({
            stream: s,
            valid: await isStreamUrlValid(s.url, timeoutMs),
        }))
    );

    const filtered = results.filter((r) => r.valid).map((r) => r.stream);
    if (filtered.length === 0) {
        // All URLs are dead — return originals so user has options
        log.debug('All streams filtered out as invalid, returning all', {
            count: streams.length,
        });
        return streams;
    }

    if (filtered.length < streams.length) {
        log.debug('Filtered invalid streams', {
            total: streams.length,
            valid: filtered.length,
            removed: streams.length - filtered.length,
        });
    }

    return filtered;
}
