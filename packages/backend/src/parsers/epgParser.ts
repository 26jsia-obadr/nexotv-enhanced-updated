import { makeLogger } from '../utils/logger';
import env from '../config/env';

/**
 * OPTIMIZED: Memory-efficient XMLTV EPG parser.
 * 
 * Instead of loading the entire XML DOM into memory (like xml2js),
 * this parser uses regex-based streaming to extract programme entries.
 * Only processes programmes for selected channels (filter early).
 * 
 * This prevents memory spikes on Render's 512MB limit and is crucial for
 * large EPG files (50MB+).
 */
export async function parseEPG(
    content: string,
    log?: ReturnType<typeof makeLogger>,
    selectedChannels?: Set<string>
): Promise<Record<string, any[]>> {
    if (Buffer.byteLength(content, 'utf8') > env.EPG_MAX_BYTES) {
        const sizeMb = (Buffer.byteLength(content, 'utf8') / 1024 / 1024).toFixed(1);
        if (log) log.warn(`[EPG] Content too large (${sizeMb} MB), skipping`);
        return {};
    }

    const start = Date.now();
    const epgData: Record<string, any[]> = {};

    try {
        const cutoff = Date.now() - 3600 * 1000; // 1 hour ago
        const nowTime = Date.now();
        let processedPrograms = 0;

        // Regex to match <programme> elements: extracts channel and content
        // This is more efficient than DOM parsing for large files
        const programmeRegex = /<programme[^>]*channel="([^"]+)"[^>]*start="([^"]+)"[^>]*stop="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/g;

        let match: RegExpExecArray | null;
        while ((match = programmeRegex.exec(content)) !== null) {
            const ch = match[1];
            const startStr = match[2];
            const stopStr = match[3];
            const progContent = match[4];

            // Early filter: skip if not in selected channels
            if (selectedChannels && !selectedChannels.has(ch)) {
                continue;
            }

            const stopDate = parseEPGTime(stopStr);
            if (stopDate.getTime() < cutoff) {
                continue;
            }

            const startDate = parseEPGTime(startStr);

            // Extract title and desc from the programme content using simple regex
            let title = 'Unknown';
            let desc = '';

            const titleMatch = progContent.match(/<title[^>]*>([^<]*)<\/title>/);
            if (titleMatch) {
                title = titleMatch[1].trim() || 'Unknown';
            }

            const descMatch = progContent.match(/<desc[^>]*>([^<]*)<\/desc>/);
            if (descMatch) {
                desc = descMatch[1].trim();
            }

            if (!epgData[ch]) epgData[ch] = [];
            epgData[ch].push({
                start: startDate.getTime(),
                stop: stopDate.getTime(),
                title,
                desc,
            });

            processedPrograms++;

            // Yield every 5000 programmes to keep event loop responsive
            if (processedPrograms % 5000 === 0) {
                await new Promise<void>((resolve) => setImmediate(resolve));
            }
        }

        // Post-process: sort and limit programmes per channel
        for (const ch in epgData) {
            epgData[ch].sort((a, b) => a.start - b.start);
            let futureCount = 0;
            epgData[ch] = epgData[ch].filter((p) => {
                if (p.start > nowTime) {
                    if (futureCount >= 5) return false;
                    futureCount++;
                }
                return true;
            });
        }

        if (log) {
            log.debug('EPG parsed (optimized)', {
                channels: Object.keys(epgData).length,
                programmes: Object.values(epgData).reduce((a, b) => a + b.length, 0),
                ms: Date.now() - start,
                filtered: selectedChannels ? 'by selectedChannels' : 'all',
            });
        }

        return epgData;
    } catch (e: any) {
        if (log) log.warn('EPG parse failed', e.message);
        return {};
    }
}

/**
 * Parse EPG time string (XMLTV format: YYYYMMDDHHmmss +HHMM).
 */
export function parseEPGTime(s: string, epgOffsetHours = 0) {
    if (!s) return new Date();
    const m = s.match(/^(\d{14})(?:\s*([+\-]\d{4}))?/);
    if (m) {
        const base = m[1];
        const tz = m[2] || null;
        const year = parseInt(base.slice(0, 4), 10);
        const month = parseInt(base.slice(4, 6), 10) - 1;
        const day = parseInt(base.slice(6, 8), 10);
        const hour = parseInt(base.slice(8, 10), 10);
        const min = parseInt(base.slice(10, 12), 10);
        const sec = parseInt(base.slice(12, 14), 10);
        let date: Date | undefined;
        if (tz) {
            const iso = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}${tz}`;
            const parsed = new Date(iso);
            if (!isNaN(parsed.getTime())) date = parsed;
        }
        if (!date) date = new Date(year, month, day, hour, min, sec);
        if (epgOffsetHours) {
            date = new Date(date.getTime() + epgOffsetHours * 3600000);
        }
        return date;
    }
    const d = new Date(s);
    if (epgOffsetHours && !isNaN(d.getTime()))
        return new Date(d.getTime() + epgOffsetHours * 3600000);
    return d;
}

/**
 * Find the currently airing program for a channel.
 */
export function getCurrentProgram(epgData: Record<string, any[]>, channelId: string, epgOffsetHours = 0) {
    if (!channelId || !epgData[channelId]) return null;
    const nowTime = Date.now();
    for (const p of epgData[channelId]) {
        const start = p.start + (epgOffsetHours * 3600000);
        const stop = p.stop + (epgOffsetHours * 3600000);
        if (nowTime >= start && nowTime <= stop) {
            const startDate = new Date(start);
            const stopDate = new Date(stop);
            return { title: p.title, description: p.desc, start: startDate, stop: stopDate, startTime: startDate, stopTime: stopDate };
        }
    }
    return null;
}

/**
 * Get upcoming programs for a channel.
 */
export function getUpcomingPrograms(epgData: Record<string, any[]>, channelId: string, limit = 5, epgOffsetHours = 0) {
    if (!channelId || !epgData[channelId]) return [];
    const nowTime = Date.now();
    const upcoming: any[] = [];
    for (const p of epgData[channelId]) {
        const start = p.start + (epgOffsetHours * 3600000);
        if (start > nowTime && upcoming.length < limit) {
            upcoming.push({
                title: p.title,
                description: p.desc,
                startTime: new Date(start),
                stopTime: new Date(p.stop + (epgOffsetHours * 3600000))
            });
        }
    }
    return upcoming.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
