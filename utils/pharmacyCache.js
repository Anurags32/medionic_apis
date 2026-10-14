/**
 * Simple in-memory cache with short TTL (in seconds) for high-load reports and dashboard aggregation
 */
class PharmacyCache {
    constructor() {
        this.cache = new Map();
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiry) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    set(key, data, ttlSeconds = 30) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttlSeconds * 1000,
        });
    }

    del(key) {
        this.cache.delete(key);
    }

    clearBranch(branchId) {
        const prefix = `branch:${branchId}:`;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }
}

const reportCache = new PharmacyCache();

module.exports = reportCache;
