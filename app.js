// app.js
import { openDB, savePhrase, listPhrases } from './db.js';

let deferredPrompt = null;

function setPwaState(msg, ok){
  const tag = document.getElementById('pwaState');
  tag.textContent = msg;
  tag.classList.toggle('ok', !!ok);
  tag.classList.toggle('ko', !ok);
}

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
}

async function registerSW(){
  if (!('serviceWorker' in navigator)) { setPwaState('PWA: non supportata', false); return; }
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    setPwaState('PWA: attiva ✓', true);
  } catch (e) {
    setPwaState('PWA: errore SW', false);
    console.warn(e);
  }
}

// Install prompt (Chrome/Android/Desktop)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setPwaState('PWA: pronta (clic su Installa)', true);
  document.getElementById('btnInstall').disabled = false;
});

document.getElementById('btnInstall').addEventListener('click', async ()=>{
  if (!deferredPrompt) {
    if (!isStandalone()) alert('Se non vedi il prompt, usa il menu del browser: Installa app / Aggiungi a Home.');
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (outcome === 'accepted') setPwaState('PWA: installata ✓', true);
});

document.getElementById('btnIOSTip').addEventListener('click', ()=>{
  alert('iOS/iPadOS: apri l’URL in Safari → Condividi → Aggiungi alla Home.\nIl prompt automatico non è supportato su iOS.');
});

// “account” locale
window.currentUser = { name:'Ospite', email:'local@guest' };
document.getElementById('hiName').textContent = window.currentUser.name;
document.getElementById('emailTag').textContent = window.currentUser.email;

// DB UI
const input = document.getElementById('inlineInput');
const saveBtn = document.getElementById('saveInline');
const countEl = document.getElementById('count');

async function refreshCount(){
  const list = await listPhrases(window.currentUser.email);
  countEl.textContent = list.length;
}

saveBtn.addEventListener('click', async ()=>{
  const txt = (input.value||'').trim(); if(!txt) return;
  await savePhrase(txt, window.currentUser.email);
  input.value = '';
  refreshCount();
});
input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') saveBtn.click(); });

// Modal disclaimer
const modal = document.getElementById('modal');
document.getElementById('btnInfo').addEventListener('click', ()=> modal.classList.add('is-open'));
document.getElementById('btnCloseModal').addEventListener('click', ()=> modal.classList.remove('is-open'));
modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.remove('is-open'); });

// Boot
(async function(){
  document.getElementById('btnInstall').disabled = true;
  await openDB();
  await registerSW();
  await refreshCount();
  if (isStandalone()) setPwaState('PWA: modalità standalone', true);
})();
