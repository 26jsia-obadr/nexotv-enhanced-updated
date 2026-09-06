import { validatePublicUrl } from './validateUrl';

const MAX_REDIRECTS = 5;

/** Fetch a public URL while validating every redirect destination. */
export async function fetchPublicUrl(url: string, options: RequestInit = {}, timeoutMs = 30000) {
    let current = url;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
        await validatePublicUrl(current);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
            response = await fetch(current, { ...options, redirect: 'manual', signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }

        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get('location');
        if (!location) return response;
        if (redirectCount === MAX_REDIRECTS) throw new Error('Too many redirects');
        current = new URL(location, current).toString();
    }
    throw new Error('Too many redirects');
}