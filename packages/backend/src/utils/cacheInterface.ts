/**
 * Common interface for cache implementations (LRU, SQLite, etc.)
 * This allows swapping cache backends without changing consumer code.
 */
export interface ICache {
    /**
     * Get a value by key. Returns undefined if not found or expired.
     */
    get(key: string): any | undefined;

    /**
     * Set a key-value pair. Optionally specify TTL in milliseconds.
     */
    set(key: string, value: any, ttlMs?: number): void;

    /**
     * Check if a key exists and is not expired.
     */
    has(key: string): boolean;

    /**
     * Delete a specific key.
     */
    delete(key: string): void;

    /**
     * Clear all entries from the cache.
     */
    clear(): void;

    /**
     * Get the current size of the cache (entries, not bytes).
     * For lazy-evicted caches, this may include expired entries.
     */
    getSize(): number;
}
