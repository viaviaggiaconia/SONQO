/* SONQO — single app entry (UI + storage + background + vase + PWA) */

/* ==================== Service Worker ==================== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

/* ==================== Stato & UI refs ==================== */
const els = {
  bgRoot: document.getElementById('bg-root'),
  themeBtn: document.getElementById('themeBtn'),
  thoughtInput: document.getElementById('thoughtInput'),
  saveBtn: document.getElementById('saveBtn'),
  countLbl: document.getElementById('countLbl'),
  vaseCanvas: document.getElementById('vaseCanvas'),
  vaseWrap: document.getElementById('vase-wrap'),
};

const THEMES = [
  { key:'oceano',   accent:'#4fb3ff' },
  { key:'bosco',    accent:'#64d48a' },
  { key:'montagna', accent:'#9fb8ff' },
  { key:'deserto',  accent:'#f8c27a' },
  { key:'citta',    accent:'#9ae0ff' }
];

let currentThemeIndex = 0;
let currentTheme = THEMES[currentThemeIndex].key;

/* ==================== Background Manager ==================== */
class BackgroundManager {
  // Preferenza: AI video -> AI img -> asset locali
  // Locali attesi: /backgrounds/<tema>.webm|.mp4|.avif|.webp|.jpg|.png
  constructor(rootEl){ this.root = rootEl; this.currentEl = null; }

  async setTheme(theme){
    const media = await this.resolveBestSource(theme);
    await this.crossfadeTo(media);
    // accento UI
    const t = THEMES.find(t=>t.key===theme) || THEMES[0];
    document.documentElement.style.setProperty('--accent', t.accent);
  }

  async resolveBestSource(theme){
    // Hook futuri per IA (ritornano null per ora):
    const aiVid = await this.tryAIVideo(theme); if (aiVid) return aiVid;
    const aiImg = await this.tryAIImage(theme); if (aiImg) return aiImg;

    // Fallback locale
    const base = `./backgrounds/${theme}`;
    const candidates = [
      { type:'video', url:`${base}.webm` },
      { type:'video', url:`${base}.mp4`  },
      { type:'image', url:`${base}.avif` },
      { type:'image', url:`${base}.webp` },
      { type:'image', url:`${base}.jpg`  },
      { type:'image', url:`${base}.png`  },
    ];
    for (const c of candidates) {
      if (await this.headExists(c.url)) return c;
    }
    // Ultimo fallback: gradiente
    return { type:'image', url:this.makeFallbackDataURL(theme) };
  }

  async headExists(url){
    try{ const r = await fetch(url, { method:'HEAD', cache:'no-store' }); return r.ok; }
    catch{ return false; }
  }

  async crossfadeTo(media){
    const el = media.type === 'video' ? this.makeVideo(media.url) : this.makeImg(media.url);
    el.style.opacity = '0';
    this.root.appendChild(el);
    requestAnimationFrame(()=>{ el.classList.add('active'); });
    const prev = this.currentEl;
    if (prev){
      prev.classList.remove('active');
      setTimeout(()=> prev.remove(), 650);
    }
    this.currentEl = el;
  }

  makeVideo(url){
    const v = document.createElement('video');
    v.src = url; v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
    v.setAttribute('preload','metadata');
    v.addEventListener('error',()=>console.warn('Video background failed',url));
    return v;
  }
  makeImg(url){
    const i = document.createElement('img');
    i.src = url; i.alt = ''; i.decoding = 'async'; i.loading = 'eager';
    i.addEventListener('error',()=>console.warn('Image background failed',url));
    return i;
  }

  async tryAIVideo(){ return null; } // integrare in Phase 2
  async tryAIImage(){ return null; }  // integrare in Phase 2

  makeFallbackDataURL(theme){
    const map = {
      oceano:['#0a0e1e','#1b4b6c','#2b80a8'],
      bosco:['#0b1a14','#0e3c2a','#176d46'],
      montagna:['#0a0e1e','#2a3b5f','#9fb8ff'],
      deserto:['#20160a','#6b4b20','#f8c27a'],
      citta:['#081018','#143047','#3a6e8d']
    };
    const [a,b,c] = map[theme] || ['#0a0e1e','#1b1b1b','#444'];
    const cvs = document.createElement('canvas');
    cvs.width = 4; cvs.height = 4;
    const g = cvs.getContext('2d');
    const grd = g.createLinearGradient(0,0,4,4);
    grd.addColorStop(0,a); grd.addColorStop(.5,b); grd.addColorStop(1,c);
    g.fillStyle = grd; g.fillRect(0,0,4,4);
    return cvs.toDataURL('image/png');
  }

  setPlayback(active){
    const v = this.root.querySelector('video');
    if (!v) return;
    if (active) v.play().catch(()=>{}); else v.pause();
  }
}
const bg = new BackgroundManager(els.bgRoot);

/* ==================== Vase Engine (particelle “stelline”) ==================== */
class VaseEngine {
  constructor(canvas){
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.particles = [];
    this.maxParticles = 300;
    this.target = 0;
    this.lastT = 0;
    this.accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    this.resizeObserver = new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(els.vaseWrap);
    this.resize();
    this.loop = this.loop.bind(this);
  }
  setAccent(hex){ this.accent = hex; }
  setTargetCount(n){
    this.target = Math.min(this.maxParticles, n);
  }
  resize(){
    const r = els.vaseWrap.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.c.width = Math.floor(r.width * dpr);
    this.c.height = Math.floor(r.height * dpr);
    this.c.style.width = r.width + 'px';
    this.c.style.height = r.height + 'px';
    this.ctx.setTransform(dpr,0,0,dpr,0,0);
    // path dell’area del vaso (in CSS px)
    this.area = new Path2D();
    const w = r.width, h = r.height;
    const neckW = w * 0.45, bodyW = w * 0.8;
    const topY = h * 0.08, neckY = h * 0.18;
    const bellyY = h * 0.65, bottomY = h * 0.90;
    this.area.moveTo((w-neckW)/2, topY);
    this.area.lineTo((w+neckW)/2, topY);
    this.area.bezierCurveTo(w*0.92, neckY,  w*0.88, bellyY,  (w+bodyW)/2, bellyY);
    this.area.bezierCurveTo((w+bodyW)/2, bottomY, (w-bodyW)/2, bottomY, (w-bodyW)/2, bellyY);
    this.area.bezierCurveTo(w*0.12, bellyY, w*0.08, neckY, (w-neckW)/2, topY);
    this.area.closePath();
  }
  spawn(n=1){
    for(let i=0;i<n;i++){
      if(this.particles.length>=this.maxParticles) return;
      const p = this.randomPointInArea();
      const s = 1 + Math.random()*2.2;
      const hue = this.hexToHsl(this.accent).h;
      this.particles.push({
        x:p.x, y:p.y,
        vx: (Math.random()-0.5)*0.35,
        vy: -0.25 - Math.random()*0.35,
        r: s,
        a: 0.55 + Math.random()*0.45,
        tw: Math.random()*Math.PI*2,
        hue
      });
    }
  }
  randomPointInArea(){
    const r = this.c.getBoundingClientRect();
    for(let k=0;k<1000;k++){
      const x = Math.random()*r.width;
      const y = Math.random()*r.height;
      if (this.ctx.isPointInPath(this.area, x, y)) return {x,y};
    }
    return {x:r.width/2, y:r.height*0.8};
  }
  hexToHsl(hex){
    const c = hex.replace('#','');
    const r = parseInt(c.slice(0,2),16)/255;
    const g = parseInt(c.slice(2,4),16)/255;
    const b = parseInt(c.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}
    else{
      const d = max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h=(g-b)/d+(g<b?6:0); break;
        case g: h=(b-r)/d+2; break;
        case b: h=(r-g)/d+4; break;
      }
      h*=60;
    }
    return {h,s,l};
  }
  update(dt){
    const need = this.target - this.particles.length;
    if (need>0) this.spawn(Math.min(6, need));
    if (need<0) this.particles.splice(this.target);

    for(const p of this.particles){
      p.tw += dt*0.006;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.002; // gravità lieve
      if (!this.ctx.isPointInPath(this.area, p.x, p.y)){
        p.vx *= -0.9; p.vy *= -0.7;
      }
    }
  }
  draw(){
    const ctx = this.ctx;
    const w = this.c.width / (window.devicePixelRatio || 1);
    const h = this.c.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);

    ctx.save(); ctx.clip(this.area);

    const g = ctx.createRadialGradient(w*0.5,h*0.85, 10, w*0.5,h*0.75, Math.max(w,h)*0.7);
    g.addColorStop(0,'rgba(255,255,255,0.06)');
    g.addColorStop(1,'rgba(255,255,255,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    for(const p of this.particles){
      const size = p.r * (1 + 0.28*Math.sin(p.tw));
      const grd = ctx.createRadialGradient(p.x,p.y,0.1, p.x,p.y,size*3);
      const hue = p.hue;
      grd.addColorStop(0, `hsla(${hue} 90% 80% / ${0.95*p.a})`);
      grd.addColorStop(0.6, `hsla(${hue} 95% 65% / ${0.35*p.a})`);
      grd.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, size*3, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  loop(t){
    if(!this.running){ this.lastT = t; requestAnimationFrame(this.loop); return; }
    const dt = Math.min(32, t - this.lastT); this.lastT = t;
    this.update(dt); this.draw();
    requestAnimationFrame(this.loop);
  }
  setActive(active){
    this.running = active;
    if (active) requestAnimationFrame(this.loop);
  }
}
const vase = new VaseEngine(els.vaseCanvas);

/* ==================== IndexedDB (pensieri) ==================== */
const DB_NAME = 'sonqo-db';
const STORE_THOUGHTS = 'thoughts';
let db;

openDB().then(async ()=>{
  await bg.setTheme(currentTheme);
  vase.setActive(true);
  await refreshCount();
}).catch(console.error);

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e)=>{
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_THOUGHTS)) {
        const os = d.createObjectStore(STORE_THOUGHTS, { keyPath:'id', autoIncrement:true });
        os.createIndex('by_created', 'created_at', { unique:false });
        os.createIndex('by_theme', 'theme', { unique:false });
      }
    };
    req.onsuccess = (e)=>{ db = e.target.result; resolve(); };
    req.onerror = (e)=>reject(e);
  });
}

function addThought(content, theme){
  return new Promise((res, rej)=>{
    const tx = db.transaction(STORE_THOUGHTS,'readwrite');
    tx.objectStore(STORE_THOUGHTS).add({
      content, theme, created_at: Date.now(), updated_at: Date.now()
    });
    tx.oncomplete = ()=>{ res(); };
    tx.onerror = rej;
  });
}

function countThoughts(){
  return new Promise((res, rej)=>{
    const tx = db.transaction(STORE_THOUGHTS,'readonly');
    const req = tx.objectStore(STORE_THOUGHTS).count();
    req.onsuccess = ()=>res(req.result);
    req.onerror = rej;
  });
}

async function refreshCount(){
  if (!db) return;
  const n = await countThoughts();
  els.countLbl.textContent = n;
  vase.setTargetCount(n);
}

/* ==================== UI handlers ==================== */
els.saveBtn.addEventListener('click', onSave);
els.thoughtInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter') onSave(); });

async function onSave(){
  const t = els.thoughtInput.value.trim();
  if (!t) return;
  await addThought(t, currentTheme);
  els.thoughtInput.value = '';
  await refreshCount();
  vase.spawn(8); // feedback immediato
}

els.themeBtn.addEventListener('click', async ()=>{
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  currentTheme = THEMES[currentThemeIndex].key;
  await bg.setTheme(currentTheme);
  const accent = THEMES[currentThemeIndex].accent;
  document.documentElement.style.setProperty('--accent', accent);
  vase.setAccent(accent);
});

/* ==================== Pause in background ==================== */
document.addEventListener('visibilitychange', () => {
  const active = !document.hidden;
  bg.setPlayback(active);
  vase.setActive(active);
});
