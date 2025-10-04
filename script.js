// Firebase + App (ES Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/* ===== Firebase Config (User-provided) ===== */
const firebaseConfig = {
  apiKey: "AIzaSyBqgeFglHVOuP8-p1AIAIa3tBEonD5DPt8",
  authDomain: "pharmacyshift.firebaseapp.com",
  projectId: "pharmacyshift",
  storageBucket: "pharmacyshift.firebasestorage.app",
  messagingSenderId: "628923818441",
  appId: "1:628923818441:web:88f2a3554411b7ddbe4818",
  measurementId: "G-WPJ95C048P"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ===== UI Navigation ===== */
const pageAdd = document.getElementById('page-add');
const pageLatest = document.getElementById('page-latest');
const pageAll = document.getElementById('page-all');
const pages = [pageAdd, pageLatest, pageAll];
const show = (el)=>{ pages.forEach(p=>p.classList.add('hidden')); if(el) el.classList.remove('hidden'); window.scrollTo({top:0,behavior:'smooth'}); };

document.getElementById('goAdd').onclick = ()=> show(pageAdd);
document.getElementById('goLatest').onclick = ()=> { show(pageLatest); renderLatest(); };
document.getElementById('goAll').onclick = ()=> { show(pageAll); loadAll(); };
document.getElementById('back1').onclick = ()=> show();
document.getElementById('back2').onclick = ()=> show();
document.getElementById('back3').onclick = ()=> show();

/* ===== Live Clock ===== */
const liveClock = document.getElementById('liveClock');
function tick(){
  const d = new Date();
  const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' };
  liveClock.textContent = d.toLocaleString(undefined, opts).replace(',', ' —');
}
setInterval(tick, 1000); tick();

/* ===== Special Badges by badge number ===== */
const CLINICAL_BADGES = ['78482','5874336'];
const ADMIN_BADGES = ['1001011','1004127'];
const DIRECTOR_BADGES = ['9141896'];

function badgeClassFor(badge){
  if (DIRECTOR_BADGES.includes(badge)) return 'badge-director';
  if (ADMIN_BADGES.includes(badge)) return 'badge-admin';
  if (CLINICAL_BADGES.includes(badge)) return 'badge-clinical';
  return '';
}

/* ===== Save Report (with forwarding) ===== */
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

saveBtn.addEventListener('click', async ()=>{
  const name = document.getElementById('name').value.trim();
  const badge = document.getElementById('badge').value.trim();
  const section = document.getElementById('section').value;
  const shift = document.getElementById('shift').value;
  const sendTo = document.getElementById('sendTo').value;
  const report = document.getElementById('report').value.trim();

  if(!name || !badge || !section || !report){
    alert('Please fill required fields.');
    return;
  }

  const baseDoc = {
    name, badge, section, shift, report,
    sendTo: sendTo || null,
    forwarded: false,
    forwardedFrom: null,
    createdAt: serverTimestamp()
  };

  try{
    // Save in original section
    await addDoc(collection(db, 'Shift Coordinator Reports'), baseDoc);

    // If sent to another section, create a forwarded copy there (full green card)
    if (sendTo && sendTo !== section){
      await addDoc(collection(db, 'Shift Coordinator Reports'), {
        ...baseDoc,
        section: sendTo,
        forwarded: true,
        forwardedFrom: section
      });
    }

    document.getElementById('report').value = '';
    saveStatus.textContent = 'Saved ✔';
    setTimeout(()=> saveStatus.textContent = '', 2200);
    show(pageLatest);
    renderLatest();
  }catch(err){
    console.error(err);
    alert('Failed to save. Check Firebase rules/config.');
  }
});

/* ===== Latest by Section (limit 5 each + popup “View more”) ===== */
const SECTIONS = ['Inpatient Pharmacy','Outpatient Pharmacy','Clinical Services','Material Management','OR Pharmacy','ER Pharmacy','IV','Other'];
const latestWrap = document.getElementById('latestWrap');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
document.getElementById('modalClose').onclick = ()=> modal.close();

function reportHTML(r){
  const when = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt || new Date());
  const ts = new Date(when).toLocaleString(undefined,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const badgeCls = badgeClassFor(r.badge);
  // Forwarded (green) takes precedence over badge color
  const cls = `report ${r.forwarded ? 'forwarded' : badgeCls}`;
  return `<div class="${cls}">
    <div class="meta">
      <span>${ts}</span>
      <span class="tag">Badge ${r.badge}</span>
      ${r.shift ? `<span class="tag">${r.shift}</span>` : ''}
      ${r.forwarded ? `<span class="note">Forwarded from ${r.forwardedFrom}</span>` : ''}
    </div>
    <div><strong>${r.name}</strong> — ${r.section}</div>
    <div>${escapeHtml(r.report).replace(/\n/g,'<br>')}</div>
  </div>`;
}

async function renderLatest(){
  latestWrap.innerHTML = '<div class="muted">Loading…</div>';
  const blocks = await Promise.all(SECTIONS.map(async sect => {
    const qy = query(collection(db,'Shift Coordinator Reports'),
      where('section','==',sect),
      orderBy('createdAt','desc'),
      limit(5));
    const snap = await getDocs(qy);
    return { sect, items: snap.docs.map(d=>({ id:d.id, ...d.data() })) };
  }));

  latestWrap.innerHTML = blocks.map(b => {
    const list = b.items.length ? b.items.map(reportHTML).join('') : `<div class="muted">No reports yet</div>`;
    return `<div class="section-card">
      <div class="section-head">
        <div class="section-title">${b.sect}</div>
        <div><button class="btn small" data-more="${b.sect}">View more</button></div>
      </div>
      <div class="reports">${list}</div>
    </div>`;
  }).join('');

  latestWrap.querySelectorAll('[data-more]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const sect = btn.getAttribute('data-more');
      modalTitle.textContent = `Latest in ${sect}`;
      modal.showModal();
      modalBody.innerHTML = '<div class="muted">Loading…</div>';
      const qy = query(collection(db,'Shift Coordinator Reports'),
        where('section','==',sect),
        orderBy('createdAt','desc'),
        limit(30));
      const snap = await getDocs(qy);
      modalBody.innerHTML = snap.docs.map(d=>reportHTML({ id:d.id, ...d.data() })).join('');
    });
  });
}

/* ===== All Reports + Filters + CSV ===== */
const allList = document.getElementById('allList');
const fSection = document.getElementById('fSection');
const fShift = document.getElementById('fShift');
const fFrom = document.getElementById('fFrom');
const fTo = document.getElementById('fTo');
document.getElementById('applyFilters').onclick = ()=> loadAll();
document.getElementById('exportCsv').onclick = exportCsv;

async function fetchAll(){
  const qy = query(collection(db,'Shift Coordinator Reports'), orderBy('createdAt','desc'), limit(400));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}
function toYMD(ts){
  const d = ts?.toDate ? ts.toDate() : (ts || new Date());
  return new Date(d).toISOString().slice(0,10);
}
function applyFilters(items){
  let data = [...items];
  if (fSection.value) data = data.filter(r=> r.section === fSection.value);
  if (fShift.value) data = data.filter(r=> r.shift === fShift.value);
  if (fFrom.value) data = data.filter(r=> toYMD(r.createdAt) >= fFrom.value);
  if (fTo.value) data = data.filter(r=> toYMD(r.createdAt) <= fTo.value);
  return data;
}
async function loadAll(){
  allList.innerHTML = '<div class="muted">Loading…</div>';
  const data = await fetchAll();
  const filtered = applyFilters(data);
  if (!filtered.length){ allList.innerHTML = '<div class="muted">No reports.</div>'; return; }
  allList.innerHTML = filtered.map(reportHTML).join('');
}
async function exportCsv(){
  const data = applyFilters(await fetchAll());
  const rows = [['Date','Name','Badge','Section','Shift','Forwarded','From','SendTo','Report']];
  data.forEach(r=>{
    const dt = r.createdAt?.toDate ? r.createdAt.toDate() : (r.createdAt || new Date());
    rows.push([
      new Date(dt).toISOString(),
      r.name || '', r.badge || '', r.section || '', r.shift || '',
      r.forwarded ? 'Yes':'No', r.forwardedFrom || '', r.sendTo || '',
      (r.report||'').replaceAll('"','""')
    ]);
  });
  const csv = rows.map(row=> row.map(v=> `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'pharmacy_reports.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ===== Helpers ===== */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Prefetch latest on load (home)
renderLatest();
