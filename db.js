// db.js — IndexedDB (pensieri)
const DB_NAME = 'sonqo';
const DB_VER = 1;
let db;

/** Open (and upgrade) the database */
export function openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = req.result;
      // phrases: { id, ownerEmail, text, created }
      if (!d.objectStoreNames.contains('phrases')) {
        const s = d.createObjectStore('phrases', { keyPath: 'id', autoIncrement: true });
        s.createIndex('byOwner', 'ownerEmail', { unique: false });
        s.createIndex('byCreated', 'created', { unique: false });
      }
      // meta: generic key/value store
      if (!d.objectStoreNames.contains('meta')) {
        d.createObjectStore('meta', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode='readonly'){ return db.transaction(store, mode).objectStore(store); }

/** Save a new phrase */
export function savePhrase(ownerEmail, text){
  return new Promise((resolve, reject) => {
    const s = tx('phrases', 'readwrite');
    const req = s.add({ ownerEmail, text, created: Date.now() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** List phrases for an owner, ascending by creation time */
export function listPhrases(ownerEmail){
  return new Promise((resolve, reject) => {
    const s = tx('phrases');
    const idx = s.index('byOwner');
    const out = [];
    const cursorReq = idx.openCursor(IDBKeyRange.only(ownerEmail));
    cursorReq.onsuccess = e => {
      const cur = e.target.result;
      if (!cur) return resolve(out.sort((a,b)=>a.created-b.created));
      out.push(cur.value); cur.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/** Clear all phrases for an owner (utility) */
export function clearPhrases(ownerEmail){
  return new Promise((resolve, reject) => {
    const s = tx('phrases', 'readwrite');
    const idx = s.index('byOwner');
    const cursorReq = idx.openCursor(IDBKeyRange.only(ownerEmail));
    cursorReq.onsuccess = e => {
      const cur = e.target.result;
      if (!cur) return resolve();
      s.delete(cur.primaryKey); cur.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
