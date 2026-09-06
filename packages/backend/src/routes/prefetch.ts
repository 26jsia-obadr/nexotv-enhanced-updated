'use strict';

import { Router } from 'express';
import env from '../config/env';
import { makeLogger } from '../utils/logger';
import { fetchPublicUrl } from '../utils/publicFetch';
import { requireAuth } from '../utils/webauth';

const router = Router();
const log = makeLogger();

const PREFETCH_MAX_BYTES = env.PREFETCH_MAX_BYTES;
const PREFETCH_ENABLED = env.PREFETCH_ENABLED;

router.post('/api/prefetch', requireAuth, async (req, res) => {
    if (!PREFETCH_ENABLED) return res.status(403).json({ error: 'Prefetch disabled by server' });

    const { url, purpose } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'Missing url' });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Only http(s) URLs allowed' });

    try {
        log.debug('Prefetch start', { url, purpose });
        const fetched = await fetchPublicUrl(url, {
            method: 'GET',
            headers: { 'User-Agent': 'NexoTV Prefetch/2.0' }
        }, env.PREFETCH_TIMEOUT_MS);

        if (!fetched.ok) {
            log.debug('Prefetch non-OK', fetched.status, url);
            return res.status(502).json({ error: `Fetch failed (${fetched.status})` });
        }

        const chunks: Buffer[] = [];
        let received = 0;
        let truncated = false;

        if (fetched.body) {
            if (typeof (fetched.body as any).getReader === 'function') {
                const reader = (fetched.body as any).getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    received += value.length;
                    if (received <= PREFETCH_MAX_BYTES) {
                        chunks.push(Buffer.from(value));
                    } else {
                        truncated = true;
                        reader.cancel().catch(() => { });
                        break;
                    }
                }
            } else if (typeof (fetched.body as any).on === 'function') {
                await new Promise<void>((resolve, reject) => {
                    const body = fetched.body as any;
                    const onData = (chunk: Buffer) => {
                        received += chunk.length;
                        if (received <= PREFETCH_MAX_BYTES) {
                            chunks.push(Buffer.from(chunk));
                        } else {
                            truncated = true;
                            body.removeListener('data', onData);
                            if (typeof body.destroy === 'function') {
                                body.destroy();
                            }
                            resolve();
                        }
                    };
                    body.on('data', onData);
                    body.on('end', resolve);
                    body.on('error', reject);
                });
            } else {
                for await (const chunk of fetched.body as any) {
                    received += chunk.length;
                    if (received <= PREFETCH_MAX_BYTES) {
                        chunks.push(Buffer.from(chunk));
                    } else {
                        truncated = true;
                        break;
                    }
                }
            }
        }

        let content = Buffer.concat(chunks).toString('utf8');
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);

        log.debug('Prefetch done', { bytes: received, truncated, returnedBytes: Buffer.byteLength(content) });

        res.json({
            ok: true,
            bytes: received,
            truncated,
            purpose: purpose || null,
            content
        });
    } catch (e: any) {
        log.debug('Prefetch error', e.message);
        if (e.message?.startsWith('Blocked host') || e.message?.startsWith('Cannot resolve host')) {
            return res.status(400).json({ error: e.message });
        }
        res.status(500).json({
            error: 'Prefetch error',
            detail: env.DEBUG ? e.message : undefined
        });
    }
});

export default router;
