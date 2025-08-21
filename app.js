// app.js — PWA boot + optional IndexedDB utilities
import { openDB, savePhrase, listPhrases } from './db.js';

// PWA install flow
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstall');
  if (btn) btn.disabled = false;
  setPwaState('App installabile', true);
});

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}
function setPwaState(msg, ok){
  const tag = document.getElementById('pwaState');
  if (!tag) return;
  tag.textContent = msg;
  tag.classList.toggle('ok', !!ok);
  tag.classList.toggle('ko', !ok);
}

async function registerSW(){
  if (!('serviceWorker' in navigator)) {
    setPwaState('SW non supportato', false);
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    setPwaState('SW registrato', true);
    // update flow
    if (reg.waiting) setPwaState('Aggiornamento disponibile', true);
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW?.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          setPwaState('Aggiornamento pronto (riapri l’app)', true);
        }
      });
    });
  } catch (e) {
    console.error('SW register error', e);
    setPwaState('SW errore', false);
  }
}

// Optional: wire generic install button if present
const bi = document.getElementById('btnInstall');
if (bi) {
  bi.disabled = true;
  bi.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setPwaState(`Install: ${outcome}`, outcome === 'accepted');
    deferredPrompt = null;
    bi.disabled = true;
  });
}

// Minimal demo using IndexedDB (non intrusivo: usa #inlineInput e aggiorna #count se esistono)
let currentEmail = localStorage.getItem('sonqo.email') || 'anon@local';
function q(id){ return document.getElementById(id); }

async function boot(){
  try { await openDB(); } catch {}
  await registerSW();
  if (isStandalone()) setPwaState('Modalità standalone', true);

  const input = q('inlineInput');
  const save = q('saveInline');
  const countEl = q('count');
  const jarEl = q('jar');

  async function refresh(){
    if (!countEl) return;
    const list = await listPhrases(currentEmail).catch(()=>[]);
    countEl.textContent = String(list.length);
    // (non tocco la UI esistente)
  }

  if (save && input) {
    save.addEventListener('click', async () => {
      const t = (input.value||'').trim();
      if (!t) return;
      try {
        await savePhrase(currentEmail, t);
        input.value='';
        await refresh();
      } catch(e){ console.warn(e); }
    });
  }

  await refresh();
}
boot();
