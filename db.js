// db.js — IndexedDB (pensieri)
const DB_NAME = 'sonqo';
const DB_VER = 2;
let db;

export function openDB(){
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('phrases')) {
        const s = d.createObjectStore('phrases', { keyPath: 'id', autoIncrement: true });
        s.createIndex('byOwner', 'ownerEmail', { unique: false });
      }
      if (!d.objectStoreNames.contains('meta')) {
        d.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => { db = req.result; res(db); };
    req.onerror = () => rej(req.error);
  });
}

function tx(name, mode='readonly'){ return db.transaction(name, mode).objectStore(name); }

export function savePhrase(text, ownerEmail){
  return new Promise((res, rej) => {
    const s = tx('phrases', 'readwrite');
    const now = Date.now();
    const r = s.add({ text, ownerEmail, created: now });
    r.onsuccess = () => res({ id: r.result, text, ownerEmail, created: now });
    r.onerror   = () => rej(r.error);
  });
}

export function listPhrases(ownerEmail){
  return new Promise((res) => {
    const s = tx('phrases');
    const idx = s.index('byOwner');
    const out = [];
    const cur = idx.openCursor(IDBKeyRange.only(ownerEmail));
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return res(out.sort((a,b)=>a.created-b.created));
      out.push(c.value); c.continue();
    };
  });
}
