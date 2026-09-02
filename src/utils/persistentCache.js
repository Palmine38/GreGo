// Cache IndexedDB partagé, avec expiration.
//
// Les géométries de lignes ne changent pas d'une session à l'autre, mais leur
// résolution coûte plusieurs requêtes réseau par ligne (voir lineShapes.js).
// On les garde donc sur le disque du navigateur plutôt que de tout rejouer à
// chaque ouverture de l'application.
//
// Toutes les fonctions échouent en silence : si IndexedDB est indisponible
// (mode privé, quota plein, navigateur ancien), l'appelant retombe simplement
// sur le chemin réseau.

const DB_NAME = "greGo";
const DB_VERSION = 1;
const STORE = "cache";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function withStore(mode, run) {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** @returns {Promise<{value: any} | null>} `null` si absent ou périmé. */
export async function idbGet(key) {
  const entry = await withStore("readonly", (store) => store.get(key));
  if (!entry || typeof entry.expires !== "number") return null;
  if (Date.now() > entry.expires) {
    void idbDelete(key);
    return null;
  }
  return { value: entry.value };
}

export async function idbSet(key, value, ttlMs) {
  await withStore("readwrite", (store) =>
    store.put({ value, expires: Date.now() + ttlMs }, key),
  );
}

export async function idbDelete(key) {
  await withStore("readwrite", (store) => store.delete(key));
}
