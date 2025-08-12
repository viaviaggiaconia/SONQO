// app.js (senza Import/Export)
import { openDB, savePhrase, listPhrases } from './db.js';

let deferredPrompt = null;

function setPwaState(msg, ok){
  const tag = document.getElementById('pwaState');
  if (!tag) return;
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

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  setPwaState('PWA: pronta (clic su Installa)', true);
  const btn = document.getElementById('btnInstall');
  if (btn) btn.disabled = false;
});

const btnInstall = document.getElementById('btnInstall');
if (btnInstall){
  btnInstall.addEventListener('click', async ()=>{
    if (!deferredPrompt) {
      if (!isStandalone()) alert('Se non vedi il prompt, usa il menu del browser: Installa app / Aggiungi a Home.');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (outcome === 'accepted') setPwaState('PWA: installata ✓', true);
  });
}

const btnIOSTip = document.getElementById('btnIOSTip');
if (btnIOSTip){
  btnIOSTip.addEventListener('click', ()=>{
    alert('iOS/iPadOS: apri l’URL in Safari → Condividi → Aggiungi alla Home.\nIl prompt automatico non è supportato su iOS.');
  });
}

// “account” locale
window.currentUser = { name:'Ospite', email:'local@guest' };
const hiName = document.getElementById('hiName');
const emailTag = document.getElementById('emailTag');
if (hiName) hiName.textContent = window.currentUser.name;
if (emailTag) emailTag.textContent = window.currentUser.email;

// DB UI
const input = document.getElementById('inlineInput');
const saveBtn = document.getElementById('saveInline');
const countEl = document.getElementById('count');

async function refreshCount(){
  if (!countEl) return;
  const list = await listPhrases(window.currentUser.email);
  countEl.textContent = list.length;
}

if (saveBtn && input){
  saveBtn.addEventListener('click', async ()=>{
    const txt = (input.value||'').trim(); if(!txt) return;
    await savePhrase(txt, window.currentUser.email);
    input.value = '';
    refreshCount();
  });
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') saveBtn.click(); });
}

// Modal disclaimer
const modal = document.getElementById('modal');
const btnInfo = document.getElementById('btnInfo');
const btnClose = document.getElementById('btnCloseModal');
if (btnInfo && modal) btnInfo.addEventListener('click', ()=> modal.classList.add('is-open'));
if (btnClose && modal) btnClose.addEventListener('click', ()=> modal.classList.remove('is-open'));
if (modal) modal.addEventListener('click', (e)=>{ if(e.target===modal) modal.classList.remove('is-open'); });

// Boot
(async function(){
  const bi = document.getElementById('btnInstall');
  if (bi) bi.disabled = true;
  await openDB();
  await registerSW();
  await refreshCount();
  if (isStandalone()) setPwaState('PWA: modalità standalone', true);
})();
