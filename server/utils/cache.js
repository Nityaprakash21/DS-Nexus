// Lightweight, High-Performance In-Memory Cache with TTL
// Reduces repetitive MongoDB queries for static/semi-static data (Holidays, Departments, Settings)

class MemoryCache {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlSeconds = 300) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  delete(key) {
    return this.store.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }

  // Fetch from cache or compute and cache result
  async getOrSet(key, fetcherFn, ttlSeconds = 300) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    const fresh = await fetcherFn();
    if (fresh !== undefined && fresh !== null) {
      this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }
}

export const cache = new MemoryCache();
export default cache;
