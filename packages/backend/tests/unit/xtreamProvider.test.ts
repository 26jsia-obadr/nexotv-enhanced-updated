import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('../../src/utils/validateUrl', () => ({ validatePublicUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/utils/publicFetch', () => ({ fetchPublicUrl: vi.fn() }));
vi.mock('../../src/config/env', () => ({ default: {
  EPG_ENABLED: false,
  FETCH_TIMEOUT_MS: 1000,
  EPG_FETCH_TIMEOUT_MS: 1000,
  EPG_UPDATE_INTERVAL_MS: 3600000,
  EPG_MAX_BYTES: 1000000,
} }));

import { fetchData, safeIsoDate } from '../../src/providers/xtreamProvider';
import { fetchPublicUrl } from '../../src/utils/publicFetch';

// Regression guard: a bad episode date used to throw RangeError in
// new Date(x).toISOString(), which made the whole series meta return null
// ("Aucune métadonnée n'a été trouvée").
describe('safeIsoDate', () => {
  it('returns null for empty / zero / unusable values', () => {
    expect(safeIsoDate(null)).toBeNull();
    expect(safeIsoDate('')).toBeNull();
    expect(safeIsoDate('0000-00-00')).toBeNull();
    expect(safeIsoDate('0000-00-00 00:00:00')).toBeNull();
    expect(safeIsoDate('not-a-date')).toBeNull();
  });

  it('parses ISO-ish date strings', () => {
    expect(safeIsoDate('2021-05-04')).toBe(new Date('2021-05-04').toISOString());
  });

  it('parses unix seconds and milliseconds', () => {
    expect(safeIsoDate('1600000000')).toBe(new Date(1600000000 * 1000).toISOString());
    expect(safeIsoDate(1600000000)).toBe(new Date(1600000000 * 1000).toISOString());
    expect(safeIsoDate('1600000000000')).toBe(new Date(1600000000000).toISOString());
  });

  it('never throws on garbage input', () => {
    expect(() => safeIsoDate({} as any)).not.toThrow();
    expect(() => safeIsoDate([] as any)).not.toThrow();
  });
});

describe('fetchData', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refreshes selected VOD when live streams return 304', async () => {
    vi.mocked(fetchPublicUrl)
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ category_id: '1', category_name: 'Movies' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ stream_id: '7', name: 'Film', category_id: '1' }])));

    const addon = {
      config: {
        xtreamUrl: 'https://iptv.example', xtreamUsername: 'user', xtreamPassword: 'pass',
        selectedCategories: ['Movies'], categoryTypes: { Movies: 'movie' }, enableEpg: false,
      },
      idPrefix: 'abc123',
      xtreamEtag: 'etag',
      channels: [{ id: 'live-1', name: 'Live', type: 'tv' }, { id: 'old-movie', type: 'movie' }],
      epgData: {},
      log: { debug: vi.fn(), warn: vi.fn() },
    };

    await fetchData(addon);

    expect(addon.channels.map((channel: any) => channel.name)).toEqual(['Live', 'Film']);
    expect(addon.channels).toHaveLength(2);
    expect(addon.channels[0].id).toBe('live-1');
  });
});
