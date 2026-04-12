const STORAGE_PREFIX = 'acs_';

export const LocalStorage = {
  save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn(`Failed to save ${key}:`, e);
    }
  },

  load<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  remove(key: string): void {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  },

  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  },

  listKeys(): string[] {
    return Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .map(k => k.slice(STORAGE_PREFIX.length));
  },
};
