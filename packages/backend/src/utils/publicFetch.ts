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
        } catch (error) {
            clearTimeout(timer);
            throw error;
        }

        if (![301, 302, 303, 307, 308].includes(response.status)) {
            if (!response.body) {
                clearTimeout(timer);
                return response;
            }

            const reader = response.body.getReader();
            const body = new ReadableStream<Uint8Array>({
                async pull(streamController) {
                    try {
                        const result = await reader.read();
                        if (result.done) {
                            clearTimeout(timer);
                            streamController.close();
                        } else {
                            streamController.enqueue(result.value);
                        }
                    } catch (error) {
                        clearTimeout(timer);
                        streamController.error(error);
                    }
                },
                async cancel(reason) {
                    clearTimeout(timer);
                    await reader.cancel(reason);
                },
            });

            return new Response(body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });
        }

        clearTimeout(timer);
        const location = response.headers.get('location');
        if (!location) return response;
        if (redirectCount === MAX_REDIRECTS) throw new Error('Too many redirects');
        current = new URL(location, current).toString();
    }
    throw new Error('Too many redirects');
}