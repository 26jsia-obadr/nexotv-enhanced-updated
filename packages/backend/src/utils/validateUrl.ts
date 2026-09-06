import dns from 'dns';
import { isPrivateIp } from '../middleware/ssrf';

/**
 * Validates that a URL targets a public host (not RFC1918 or loopback).
 * Performs both literal IP checks and DNS resolution.
 * Throws if the host is private or cannot be resolved.
 */
export async function validatePublicUrl(url: string): Promise<void> {
    if (!url) return;

    let u: URL;
    try {
        u = new URL(url);
    } catch {
        throw new Error(`Invalid URL: ${url}`);
    }

    if (!['http:', 'https:'].includes(u.protocol)) {
        throw new Error(`Only HTTP(S) URLs are allowed`);
    }

    const host = u.hostname;

    // Direct literal check — covers cases like 127.0.0.1 or 10.0.0.1 in URL
    if (isPrivateIp(host)) {
        throw new Error(`Blocked host: ${host}`);
    }

    // Check every DNS answer so a dual-stack or multi-address host cannot hide
    // a private address behind a public first result.
    try {
        const resolved = await dns.promises.lookup(host, { all: true });
        const addresses = Array.isArray(resolved) ? resolved : [resolved];
        for (const { address } of addresses) {
            if (isPrivateIp(address)) {
                throw new Error(`Blocked host: ${host} resolves to private IP ${address}`);
            }
        }
    } catch (e: any) {
        if (e.message?.startsWith('Blocked host')) throw e;
        throw new Error(`Cannot resolve host: ${host}`);
    }
}
