const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const APP = $('#app');
const ASSET = {
  demoVideo: 'assets/birthday-demo.mp4',
  defaultHash: '406591df413920d199e378a01d82e5839a78ceb552312e0460a8ce598b00707e'
};
const STORAGE = { password: 'birthdayAccessHashV1' };

const state = {
  mode: 'LOCKED',
  authenticated: false,
  keyVisible: false,
  keyInserted: false,
  keyRotated: false,
  opening: false,
  phoneOpen: false,
  countdownLocked: false,
  soundOn: false,
  audioPromptShown: false,
  draggingKey: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  uploadUrl: null,
  frozenCountdown: null
};

const refs = {
  days: $('#days'), hours: $('#hours'), minutes: $('#minutes'), seconds: $('#seconds'),
  status: $('#countdownStatus'), caption: $('#countdownCaption'),
  key: $('#key'), keyhole: $('#keyhole'), giftBox: $('#giftBox'), giftLid: $('#giftLid'),
  hint: $('#hintText'), authButton: $('#authButton'), passwordButton: $('#passwordButton'),
  sessionPill: $('#sessionPill'), toast: $('#toastRegion'), musicButton: $('#musicButton'), musicLabel: $('#musicLabel'), musicGlyph: $('#musicGlyph'),
  accessDialog: $('#accessDialog'), accessForm: $('#accessForm'), accessInput: $('#accessInput'), accessError: $('#accessError'), showPassword: $('#showPassword'),
  passwordDialog: $('#passwordDialog'), passwordForm: $('#passwordForm'), currentAccess: $('#currentAccess'), newAccess: $('#newAccess'), passwordError: $('#passwordError'),
  soundPrompt: $('#soundPrompt'), enableSound: $('#enableSound'), ambientParticles: $('#ambientParticles'),
  phoneDialog: $('#phoneDialog'), phoneDevice: $('#phoneDevice'), uploadArea: $('#uploadArea'), videoInput: $('#videoInput'), uploadVideo: $('#uploadVideo'), uploadText: $('#uploadText'),
  video: $('#heroVideo'), placeholder: $('#videoPlaceholder'), playVideo: $('#playVideo'), seek: $('#seekBar'), videoTime: $('#videoTime'), back10: $('#back10'), forward10: $('#forward10'), muteVideo: $('#muteVideo'), speed: $('#speedVideo'), fullscreen: $('#fullscreenVideo')
};

function setState(next) {
  state.mode = next;
  APP.dataset.state = next;
  APP.classList.remove('state-locked','state-ready','state-password','state-shaking','state-open');
  if (next === 'COUNTDOWN_UNLOCKED') APP.classList.add('state-ready');
  if (next === 'PASSWORD_UNLOCKED') APP.classList.add('state-password');
  if (next === 'BOX_OPENING' || next === 'KEY_INSERTED' || next === 'KEY_ROTATING') APP.classList.add('state-shaking');
  if (next === 'PHONE_REVEALED' || next === 'PHONE_VIEWER_OPEN') APP.classList.add('state-open');
  if (next === 'LOCKED') APP.classList.add('state-locked');
}

function toast(message, duration = 2800) {
  const node = document.createElement('div');
  node.className = 'toast'; node.textContent = message; refs.toast.appendChild(node);
  window.setTimeout(() => node.remove(), duration);
}
function hint(message, show = true) { refs.hint.textContent = message; refs.hint.classList.toggle('show', show); }
function lockButtonVisual(open) { refs.authButton.setAttribute('aria-pressed', String(open)); const icon = $('.lock-icon', refs.authButton); icon.classList.toggle('lock-closed', !open); icon.classList.toggle('lock-open', open); icon.querySelector('span').style.background = open ? '#83bda6' : ''; }
function getStoredHash() { return localStorage.getItem(STORAGE.password) || APP.defaultHash || ASSET.defaultHash; }
async function sha256(text) { const data = new TextEncoder().encode(text); const hash = await crypto.subtle.digest('SHA-256', data); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join(''); }

function formatTime(diffMs) {
  const total = Math.max(0, Math.floor(diffMs / 1000));
  return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
}
function nextOct1(now) {
  let y = now.getFullYear();
  const candidate = new Date(y, 9, 1, 0, 0, 0, 0);
  if (now >= candidate) y += 1;
  return new Date(y, 9, 1, 0, 0, 0, 0);
}
function getCountdown(now = new Date()) {
  const startThis = new Date(now.getFullYear(), 9, 1, 0, 0, 0, 0);
  const endThis = new Date(now.getFullYear(), 9, 4, 0, 0, 0, 0);
  if (now >= startThis && now < endThis) return { active: true, remaining: 0, next: endThis };
  return { active: false, remaining: Math.max(0, nextOct1(now) - now), next: nextOct1(now) };
}
function updateCountdown() {
  const c = getCountdown(new Date());
  if (state.authenticated && state.frozenCountdown) {
    const f = state.frozenCountdown;
    refs.days.textContent = String(f.d).padStart(2,'0'); refs.hours.textContent = String(f.h).padStart(2,'0'); refs.minutes.textContent = String(f.m).padStart(2,'0'); refs.seconds.textContent = String(f.s).padStart(2,'0');
    refs.status.textContent = 'Access granted. The countdown is paused.';
    refs.caption.textContent = 'The key is ready whenever you are.';
    refs.sessionPill.querySelector('span:last-child').textContent = 'Access granted · countdown paused';
    return;
  }
  state.countdownLocked = c.active;
  const t = formatTime(c.remaining);
  refs.days.textContent = String(t.d).padStart(2,'0'); refs.hours.textContent = String(t.h).padStart(2,'0'); refs.minutes.textContent = String(t.m).padStart(2,'0'); refs.seconds.textContent = String(t.s).padStart(2,'0');
  if (c.active) {
    refs.status.textContent = 'The birthday unlock window is open!'; refs.caption.textContent = 'The gift is waiting for you…';
    if (!state.authenticated && state.mode === 'LOCKED') activateTimedUnlock();
  } else {
    refs.status.textContent = 'Your birthday is almost here!'; refs.caption.textContent = 'Just a little more patience…';
    if (state.mode === 'COUNTDOWN_UNLOCKED') resetTimedUnlock();
  }
  refs.sessionPill.querySelector('span:last-child').textContent = state.authenticated ? 'Access granted · countdown paused' : (c.active ? 'Unlock window open' : `Locked until October 1`);
}
function activateTimedUnlock() { state.keyVisible = true; updateKeyVisibility(); setState('COUNTDOWN_UNLOCKED'); hint('Drag me to the lock'); sound.playMagic(); toast('The birthday key has appeared.'); }
function resetTimedUnlock() { closePhone(false); state.authenticated = false; state.frozenCountdown = null; refs.giftBox.setAttribute('aria-expanded','false'); state.keyVisible = false; state.keyInserted = false; state.keyRotated = false; state.opening = false; updateKeyVisibility(); lockButtonVisual(false); setState('LOCKED'); hint('', false); toast('The birthday unlock window has closed.', 2200); }

function updateKeyVisibility() { refs.key.classList.toggle('hidden', !state.keyVisible || state.opening); }
function showPasswordButton(show) { refs.passwordButton.classList.toggle('hidden', !show); }
function localPasswordValid(value) { return /^[\s\S]{4,}$/.test(value); }

async function authenticate(value) {
  const hash = await sha256(value);
  return hash === getStoredHash();
}

function showAccessDialog() { refs.accessError.textContent = ''; refs.accessInput.value = ''; refs.accessDialog.showModal(); setTimeout(() => refs.accessInput.focus(), 30); }
function authenticateSuccess() {
  const c = getCountdown(new Date());
  state.frozenCountdown = formatTime(c.remaining);
  state.authenticated = true; state.keyVisible = true; state.keyInserted = false; state.keyRotated = false;
  updateKeyVisibility(); lockButtonVisual(true); showPasswordButton(true); setState('PASSWORD_UNLOCKED');
  refs.sessionPill.querySelector('span:last-child').textContent = 'Access granted · countdown paused'; hint('Drag me to the lock');
  toast('Access granted. The key is ready.'); sound.playUnlock();
}
async function accessSubmit(e) {
  e.preventDefault(); const value = refs.accessInput.value;
  if (!value) { refs.accessError.textContent = 'Please enter an access address.'; return; }
  if (!(await authenticate(value))) { refs.accessError.textContent = 'Incorrect access address. Please try again.'; sound.playError(); return; }
  refs.accessDialog.close(); authenticateSuccess();
}

async function changePasswordSubmit(e) {
  e.preventDefault(); refs.passwordError.textContent = '';
  if (!state.authenticated) { refs.passwordError.textContent = 'Access must be granted first.'; return; }
  const current = refs.currentAccess.value, next = refs.newAccess.value;
  if (!localPasswordValid(next)) { refs.passwordError.textContent = 'The new access address must contain at least 4 characters.'; return; }
  if (!(await authenticate(current))) { refs.passwordError.textContent = 'Current access address is incorrect.'; return; }
  localStorage.setItem(STORAGE.password, await sha256(next)); refs.currentAccess.value = ''; refs.newAccess.value = ''; refs.passwordDialog.close(); toast('Access address updated successfully.'); sound.playClick();
}
function relock() {
  state.authenticated = false; state.frozenCountdown = null; refs.giftBox.setAttribute('aria-expanded','false'); state.keyVisible = false; state.keyInserted = false; state.keyRotated = false; state.opening = false; updateKeyVisibility(); showPasswordButton(false); lockButtonVisual(false); closePhone(false); setState(getCountdown().active ? 'COUNTDOWN_UNLOCKED' : 'LOCKED'); hint(state.countdownLocked ? 'Drag me to the lock' : '', state.countdownLocked); toast('Access lock restored.');
}

function pointToLocal(clientX, clientY) { const r = refs.key.parentElement.getBoundingClientRect(); return { x: clientX - r.left, y: clientY - r.top }; }
function dragStart(ev) {
  if (!state.keyVisible || state.opening) return; state.draggingKey = true; refs.key.setPointerCapture(ev.pointerId);
  const r = refs.key.getBoundingClientRect(); state.dragOffsetX = ev.clientX - r.left; state.dragOffsetY = ev.clientY - r.top; refs.key.style.animation = 'none'; sound.playPickup(); hint('Bring the key close to the keyhole');
}
function dragMove(ev) {
  if (!state.draggingKey) return; const local = pointToLocal(ev.clientX - state.dragOffsetX, ev.clientY - state.dragOffsetY); const maxX = refs.scene.clientWidth - refs.key.offsetWidth/2; const maxY = refs.scene.clientHeight - refs.key.offsetHeight/2; const left = Math.max(-20, Math.min(maxX, local.x - refs.key.offsetWidth/2)); const top = Math.max(90, Math.min(maxY, local.y - refs.key.offsetHeight/2)); refs.key.style.left = `${left}px`; refs.key.style.top = `${top}px`;
  const kh = refs.keyhole.getBoundingClientRect(); const kr = refs.key.getBoundingClientRect(); const dx = (kr.left+kr.width/2)-(kh.left+kh.width/2); const dy = (kr.top+kr.height/2)-(kh.top+kh.height/2); const dist = Math.hypot(dx,dy);
  if (dist < 95) { refs.keyhole.style.filter = 'drop-shadow(0 0 18px rgba(255,214,102,.8))'; hint('Release to insert the key'); } else { refs.keyhole.style.filter = ''; }
}
function dragEnd(ev) {
  if (!state.draggingKey) return; state.draggingKey = false; refs.key.releasePointerCapture?.(ev.pointerId); const kh = refs.keyhole.getBoundingClientRect(); const kr = refs.key.getBoundingClientRect(); const dist = Math.hypot((kr.left+kr.width/2)-(kh.left+kh.width/2),(kr.top+kr.height/2)-(kh.top+kh.height/2)); refs.keyhole.style.filter = '';
  if (dist < 95) insertKey(); else { refs.key.style.animation = ''; hint('Drag me to the lock'); }
}
function insertKey() {
  state.keyInserted = true; setState('KEY_INSERTED'); hint('Key inserted — rotate it'); sound.playInsert();
  const kh = refs.keyhole.getBoundingClientRect(); const scene = refs.scene.getBoundingClientRect(); refs.key.style.left = `${kh.left - scene.left + kh.width/2 - refs.key.offsetWidth/2}px`; refs.key.style.top = `${kh.top - scene.top + kh.height/2 - refs.key.offsetHeight/2}px`; refs.key.style.transition = 'left .35s ease, top .35s ease, transform .35s ease'; refs.key.style.transform = 'translate(0,0) rotate(90deg)';
  setTimeout(()=>hint('Rotate the key 90° to unlock'), 350);
}
function rotateKey() {
  if (!state.keyInserted || state.opening) return; state.keyRotated = true; setState('KEY_ROTATING'); refs.key.style.transform = 'translate(0,0) rotate(0deg)'; hint('Unlocking…'); sound.playTurn(); setTimeout(openBox, 700);
}
function onKeyKeydown(ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (state.keyInserted) rotateKey(); } }
function openBox() {
  if (state.opening || state.mode === 'PHONE_REVEALED' || state.mode === 'PHONE_VIEWER_OPEN') return; state.opening = true; setState('BOX_OPENING'); hint('', false); sound.playOpen();
  setTimeout(()=>{ refs.giftBox.setAttribute('aria-expanded','true'); setState('PHONE_REVEALED'); sound.playReveal(); state.opening = false; state.keyVisible = false; updateKeyVisibility(); toast('The surprise is unlocked! Tap the phone to explore.'); hint('Tap the phone to explore', true); }, 1300);
}
function openPhone() {
  refs.phoneDialog.showModal(); state.phoneOpen = true; setState('PHONE_VIEWER_OPEN'); hint('', false); ensureVideo(); setTimeout(()=>$('#phoneTitle')?.focus(), 30);
}
function closePhone(resetState=true) {
  if (refs.phoneDialog.open) refs.phoneDialog.close(); refs.video.pause(); state.phoneOpen = false; if (resetState && state.mode !== 'LOCKED') setState(state.authenticated ? 'PASSWORD_UNLOCKED' : (state.countdownLocked ? 'COUNTDOWN_UNLOCKED' : 'LOCKED'));
}
function ensureVideo() { if (!refs.video.src) { refs.video.src = ASSET.demoVideo; refs.video.load(); refs.placeholder.classList.remove('hidden'); } }
function toggleVideoPlay() { ensureVideo(); if (refs.video.paused) { refs.video.play().then(()=>refs.placeholder.classList.add('hidden')).catch(()=>toast('Tap the video play button again to start playback.')); } else refs.video.pause(); }
function updateVideoUI() {
  const dur = Number.isFinite(refs.video.duration) ? refs.video.duration : 0; const cur = refs.video.currentTime || 0; refs.seek.value = dur ? String((cur/dur)*100) : '0'; refs.videoTime.textContent = `${fmtVideo(cur)} / ${fmtVideo(dur)}`; refs.playVideo.textContent = refs.video.paused ? '▶' : '❚❚'; refs.muteVideo.textContent = refs.video.muted ? '🔇' : '🔊';
}
function fmtVideo(sec){ if(!Number.isFinite(sec)) return '00:00'; const m=Math.floor(sec/60).toString().padStart(2,'0'); const s=Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}`; }
function uploadVideo(file) {
  if (!file) return; const allowed = /^video\/(mp4|webm|ogg|quicktime)$/.test(file.type); const max = 100 * 1024 * 1024; if (!allowed) { refs.uploadText.textContent = 'Unsupported video type.'; toast('Please choose an MP4, WebM, OGG or QuickTime video.'); return; } if (file.size > max) { refs.uploadText.textContent = 'Video is too large.'; toast('Please choose a video smaller than 100 MB.'); return; }
  if (state.uploadUrl) URL.revokeObjectURL(state.uploadUrl); state.uploadUrl = URL.createObjectURL(file); refs.video.src = state.uploadUrl; refs.video.load(); refs.videoTitle.textContent = file.name; refs.uploadText.textContent = 'Uploaded for this session'; toast('Video loaded successfully.');
}

function createParticles() { for(let i=0;i<26;i++){const el=document.createElement('i'); el.style.setProperty('--x',`${Math.random()*100}%`); el.style.setProperty('--y',`${Math.random()*100}%`); el.style.setProperty('--d',`${4+Math.random()*8}s`); el.style.animationDelay=`${-Math.random()*8}s`; refs.ambientParticles.appendChild(el);} }

class AudioManager {
  constructor(){ this.ctx=null; this.master=null; this.musicGain=null; this.fxGain=null; this.musicTimer=null; this.step=0; this.enabled=false; this.userStopped=false; }
  init(){ if(this.ctx) return; const C=window.AudioContext||window.webkitAudioContext; if(!C) return; this.ctx=new C(); this.master=this.ctx.createGain(); this.musicGain=this.ctx.createGain(); this.fxGain=this.ctx.createGain(); this.musicGain.gain.value=.16; this.fxGain.gain.value=.8; this.master.gain.value=.7; this.musicGain.connect(this.master); this.fxGain.connect(this.master); this.master.connect(this.ctx.destination); }
  async enable(){ this.init(); if(!this.ctx) return false; await this.ctx.resume(); this.enabled=true; this.userStopped=false; this.startMusic(); refs.soundPrompt.classList.add('hidden'); refs.musicButton.setAttribute('aria-pressed','true'); refs.musicLabel.textContent='Music On'; refs.musicGlyph.textContent='♫'; return true; }
  stop(){ this.enabled=false; this.userStopped=true; if(this.musicTimer) clearInterval(this.musicTimer); this.musicTimer=null; if(this.musicGain) this.musicGain.gain.setTargetAtTime(.0001,this.ctx.currentTime,.03); refs.musicButton.setAttribute('aria-pressed','false'); refs.musicLabel.textContent='Music'; }
  toggle(){ if(this.enabled) this.stop(); else this.enable().catch(()=>{}); }
  startMusic(){ if(!this.ctx||this.musicTimer) return; const notes=[261.63,329.63,392,523.25,392,329.63,293.66,349.23]; this.musicTimer=setInterval(()=>{ if(!this.enabled) return; const n=notes[this.step++%notes.length]; this.note(n,.52,.28, this.musicGain); this.note(n*1.5,.28,.08,this.musicGain); },640); this.musicGain.gain.setTargetAtTime(.16,this.ctx.currentTime,.2); }
  note(freq,dur,vol,gainNode,when=0){const t=this.ctx.currentTime+when; const o=this.ctx.createOscillator(); const g=this.ctx.createGain(); o.type='sine'; o.frequency.value=freq; g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+.04); g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.connect(g); g.connect(gainNode); o.start(t); o.stop(t+dur+.03);}
  sweep(start,end,dur,vol=.22){ if(!this.enabled||!this.ctx)return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type='triangle'; o.frequency.setValueAtTime(start,t); o.frequency.exponentialRampToValueAtTime(end,t+dur); g.gain.setValueAtTime(.0001,t); g.gain.linearRampToValueAtTime(vol,t+.02); g.gain.exponentialRampToValueAtTime(.0001,t+dur); o.connect(g);g.connect(this.fxGain);o.start(t);o.stop(t+dur+.02); }
  click(){this.sweep(500,740,.09,.12)} magic(){this.sweep(520,1180,.45,.16)} pickup(){this.sweep(240,480,.16,.12)} insert(){this.sweep(180,240,.12,.13)} turn(){this.sweep(220,120,.35,.2); this.note(160,.5,.08,this.fxGain,.04)} playUnlock(){this.sweep(440,880,.3,.18)} playOpen(){this.sweep(160,680,.6,.2); this.note(220,.8,.09,this.fxGain,.1)} playReveal(){this.note(659.25,.4,.15,this.fxGain);this.note(783.99,.4,.11,this.fxGain,.12);this.note(987.77,.55,.08,this.fxGain,.25)} playError(){this.sweep(180,120,.18,.12)} cat(){if(this.enabled)this.note(700,.18,.03,this.fxGain)} }
const sound = new AudioManager();

// Wiring
refs.scene = $('#scene');
refs.authButton.addEventListener('click',()=>{ if(state.authenticated){ relock(); } else showAccessDialog(); });
refs.passwordButton.addEventListener('click',()=>{ if(state.authenticated) refs.passwordDialog.showModal(); });
refs.accessForm.addEventListener('submit',accessSubmit); refs.passwordForm.addEventListener('submit',changePasswordSubmit);
refs.showPassword.addEventListener('click',()=>{ const type=refs.accessInput.type==='password'?'text':'password'; refs.accessInput.type=type; refs.showPassword.textContent=type==='password'?'◉':'◌'; });
refs.key.addEventListener('pointerdown',dragStart); refs.key.addEventListener('pointermove',dragMove); refs.key.addEventListener('pointerup',dragEnd); refs.key.addEventListener('pointercancel',dragEnd); refs.key.addEventListener('keydown',onKeyKeydown);
refs.key.addEventListener('dblclick',rotateKey); refs.giftBox.addEventListener('keydown',(e)=>{if((e.key==='Enter'||e.key===' ')&&(state.mode==='PHONE_REVEALED'||state.mode==='PHONE_VIEWER_OPEN')){e.preventDefault();openPhone();}});
refs.musicButton.addEventListener('click',()=>{sound.toggle();});
refs.enableSound.addEventListener('click',()=>{sound.enable();});
$$('[data-close]').forEach(btn=>btn.addEventListener('click',()=>document.getElementById(btn.dataset.close).close()));
['accessDialog','passwordDialog','phoneDialog'].forEach(id=>{ const d=document.getElementById(id); d.addEventListener('click',e=>{ if(e.target===d)d.close(); }); d.addEventListener('close',()=>{ if(id==='phoneDialog'){ refs.video.pause(); state.phoneOpen=false; if(state.mode==='PHONE_VIEWER_OPEN') setState(state.authenticated?'PASSWORD_UNLOCKED':(state.countdownLocked?'COUNTDOWN_UNLOCKED':'LOCKED')); }}); });
refs.giftBox.addEventListener('click',()=>{ if(state.mode==='PHONE_REVEALED') openPhone(); });
refs.uploadVideo.addEventListener('click',()=>refs.videoInput.click()); refs.videoInput.addEventListener('change',e=>uploadVideo(e.target.files[0]));
refs.playVideo.addEventListener('click',toggleVideoPlay); refs.video.addEventListener('click',toggleVideoPlay); refs.video.addEventListener('play',()=>refs.placeholder.classList.add('hidden')); refs.video.addEventListener('pause',updateVideoUI); refs.video.addEventListener('timeupdate',updateVideoUI); refs.video.addEventListener('loadedmetadata',updateVideoUI); refs.video.addEventListener('ended',updateVideoUI); refs.video.addEventListener('error',()=>toast('The video could not be loaded in this browser.'));
refs.seek.addEventListener('input',()=>{const d=refs.video.duration;if(Number.isFinite(d))refs.video.currentTime=(Number(refs.seek.value)/100)*d;}); refs.back10.addEventListener('click',()=>{refs.video.currentTime=Math.max(0,refs.video.currentTime-10)}); refs.forward10.addEventListener('click',()=>{refs.video.currentTime=Math.min(refs.video.duration||1,refs.video.currentTime+10)}); refs.muteVideo.addEventListener('click',()=>{refs.video.muted=!refs.video.muted;updateVideoUI()}); refs.speed.addEventListener('change',()=>{refs.video.playbackRate=Number(refs.speed.value)}); refs.fullscreen.addEventListener('click',()=>{const el=refs.phoneDevice; if(document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(()=>{})});

// Allow a simple rotation gesture after insertion.
let rotateStart = null;
refs.key.addEventListener('pointerdown',e=>{ if(state.keyInserted){rotateStart={x:e.clientX,y:e.clientY};}});
refs.key.addEventListener('pointerup',e=>{ if(state.keyInserted && rotateStart){ const dx=e.clientX-rotateStart.x; const dy=e.clientY-rotateStart.y; if(Math.abs(dx)+Math.abs(dy)>25) rotateKey(); rotateStart=null; }});

window.addEventListener('pointerdown', ()=>{ if(!state.soundOn && !state.audioPromptShown){ state.audioPromptShown=true; refs.soundPrompt.classList.remove('hidden'); } }, {once:true});

createParticles();
const observer = new IntersectionObserver(()=>{}, {threshold:0}); observer.observe(refs.giftBox);
// Expose no credential; verification is hash-only.
updateCountdown(); setInterval(updateCountdown, 500); updateVideoUI();

// On password mode, expose the upload feature; timed unlock only reveals the key.
const originalAuthenticateSuccess = authenticateSuccess;
const showUpload = () => refs.uploadArea.classList.remove('hidden');
const hideUpload = () => refs.uploadArea.classList.add('hidden');
const checkUploadVisibility = () => state.authenticated ? showUpload() : hideUpload();
new MutationObserver(checkUploadVisibility).observe(APP,{attributes:true,attributeFilter:['data-state']});

// Cat ambience — sparse, quiet and user-gated.
setInterval(()=>{ if(sound.enabled && Math.random()<0.22) sound.cat(); }, 9500);

// Seed state.
try { const c=getCountdown(); if(c.active) activateTimedUnlock(); } catch(e) { console.error(e); }
