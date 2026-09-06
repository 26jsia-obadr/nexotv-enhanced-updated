import env from '../config/env';
import net from 'net';

export function isPrivateIp(ip: string) {
    if (env.ALLOW_LOCAL_URLS) return false;

    const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
    if (normalized.startsWith('::ffff:')) {
        const mapped = normalized.slice('::ffff:'.length);
        if (net.isIP(mapped) === 4) return isPrivateIp(mapped);
    }

    if (net.isIP(normalized) === 6) {
        return normalized === '::1' || normalized === '::' ||
            normalized.startsWith('fc') || normalized.startsWith('fd') ||
            normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
            normalized.startsWith('fea') || normalized.startsWith('feb');
    }

    return (
        normalized === '127.0.0.1' || normalized === '0.0.0.0' ||
        /^10\./.test(normalized) ||
        /^192\.168\./.test(normalized) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(normalized) ||
        /^169\.254\./.test(normalized)
    );
}
