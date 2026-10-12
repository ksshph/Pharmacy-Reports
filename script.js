const firebaseConfig = {
  apiKey: 'AIzaSyBqgeFglHVOuP8-p1AIAIa3tBEonD5DPt8',
  authDomain: 'pharmacyshift.firebaseapp.com',
  projectId: 'pharmacyshift',
  storageBucket: 'pharmacyshift.firebasestorage.app',
  messagingSenderId: '628923818441',
  appId: '1:628923818441:web:88f2a3554411b7ddbe4818',
  measurementId: 'G-WPJ95C048P'
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const reportsRef = db.collection('Shift Coordinator Reports');
const issuesRef = db.collection('Shift Report Issues');
const authorizedBadges = Object.freeze({
  '9141896':'Dr. Shaker Al Nufaiee', '1001011':'Ms. Munira Alsubaie',
  '1000186':'Dr. Abdullah Alqurashi', '7000195':'Dr. Amal Alghalbi',
  '7000322':'Dr. Abdulrahman Altowairqi', '403645':'Dr. Ayidh Alharthi',
  '7000940':'Dr. Amani Alhumali', '1003849':'Dr. Nawaf Alzaidi',
  '1004054':'Dr. Abdulaziz Almutairi', '7000547':'Mr. Faris Alzahrani',
  '1003972':'Ms. Nidaa Alhumaidi', '1003968':'Ms. Rahaf Alzaydani',
  '7000375':'Dr. Rami Al Khaldi', '5874336':'Dr. Sultan Alotaibi'
});
const STATUSES = ['Open','Under Processing','Closed'];
let reports = [], savedIssues = [], allIssues = [], filteredReports = [];
const el = id => document.getElementById(id);
const val = id => (el(id)?.value || '').trim();
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toDate = x => {
  if (!x) return null;
  const d = typeof x.toDate === 'function' ? x.toDate() : new Date(x);
  return Number.isFinite(d.getTime()) ? d : null;
};
const reportDate = r => toDate(r.date || r.createdAt || r.timestamp);
const issueDate = i => toDate(i.createdAt || i.date);
const fmt = d => { const x = toDate(d); return x ? x.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'; };
const statusOf = x => STATUSES.includes(x.status || x.followupStatus) ? (x.status || x.followupStatus) : 'Open';
const statusTag = s => `<span class="status-pill ${esc(s.toLowerCase().replace(/\s+/g,'-'))}">${esc(s)}</span>`;
const actionsOf = x => Array.isArray(x.actions) ? x.actions : Array.isArray(x.followupActions) ? x.followupActions : [];
const yesNo = x => /^(?:yes|no|none|nil|n\/?a|not applicable|nothing|no issues?|no shortage(?: reported)?|لا|نعم|لا يوجد|ما فيه|مافيه|تم|\-|\.)[\s.!]*$/i.test(String(x || '').trim());

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  if (id === 'weeklyMonitoringPage') setCurrentWeek();
  if (['latestReportsPage','viewReportsPage','weeklyMonitoringPage'].includes(id)) loadData();
  window.scrollTo(0,0);
}

/* Use complete narrative blocks, not keyword-only summaries. A blank or yes/no
   answer is ignored. Separate numbered/bulleted paragraphs when clearly marked. */
function splitNarratives(raw) {
  const text = String(raw || '').replace(/\r/g,'').trim();
  if (!text || yesNo(text)) return [];
  const lines = text.split('\n');
  const blocks = [];
  let current = '';
  const flush = () => { if (current.trim() && !yesNo(current)) blocks.push(current.trim()); current = ''; };
  for (const line of lines) {
    const trimmed = line.trim();
    const marker = /^(?:\d+[.)]|[-•*])\s+/.test(trimmed);
    if (!trimmed) { if (current) current += '\n'; continue; }
    if (marker && current.trim()) flush();
    current += (current && !current.endsWith('\n') ? '\n' : '') + (marker ? trimmed.replace(/^(?:\d+[.)]|[-•*])\s+/,'') : line.trimEnd());
  }
  flush();
  return blocks;
}

function extractLegacy(r) {
  const a = r.structuredAnswers || {};
  const fields = [
    ['previous','Previous Shift Issues',a.previousShiftIssues ?? a.previousIssues],
    ['new','New Issues',a.newRisingIssues ?? a.newIssues],
    ['endorsement','Next Shift Endorsement',a.nextShiftEndorsement ?? a.endorsementToNextShift],
    ['notes','Additional Notes',a.additionalNotes ?? a.notes]
  ];
  /* For old reports without structuredAnswers, recover labeled paragraphs from
     the full report text. Keep multi-line lists, such as medication names. */
  if (!fields.some(f => String(f[2] || '').trim())) {
    const raw = String(r.content || '');
    const labels = [
      ['previous','Previous Shift Issues',/^(?:Endorsed issues from the previous shift|Previous Shift Issues)\s*:\s*/i],
      ['new','New Issues',/^(?:New or rising issues during the shift|New Issues)\s*:\s*/i],
      ['endorsement','Next Shift Endorsement',/^(?:Items to be endorsed to the next shift|Endorsement to Next Shift|Next Shift Endorsement)\s*:\s*/i],
      ['notes','Additional Notes',/^Additional Notes\s*:\s*/i]
    ];
    const boundaries = /^(?:Staff present during the shift|Attendance updates|Endorsed issues from the previous shift|New or rising issues during the shift|Actions taken during the shift|Items to be endorsed to the next shift|Priority level|Additional notes|Medication shortage status|Staff Present|Previous Shift Issues|New Issues|Endorsement to Next Shift|Next Shift Endorsement|Endorsement Priority|Medication Shortage)\s*:/i;
    const lines = raw.replace(/\r/g,'').split('\n');
    for (const [key,label,regex] of labels) {
      const index = lines.findIndex(line => regex.test(line.trim()));
      if (index < 0) continue;
      const result = [lines[index].trim().replace(regex,'')];
      for (let k=index+1;k<lines.length;k++) {
        if (boundaries.test(lines[k].trim())) break;
        result.push(lines[k]);
      }
      const target = fields.find(f => f[0] === key);
      target[2] = result.join('\n').trim();
    }
  }
  const result = [];
  for (const [key,label,raw] of fields) {
    splitNarratives(raw).forEach((text,index) => {
      const id = `legacy_${r.id}_${key}_${index}`;
      result.push({
        id, reportId:r.id, section:r.section || 'Other',
        date:r.date || r.createdAt || null, createdAt:r.date || r.createdAt || null,
        issue:text, description:text, category:label,
        status:null, actions:[], statusHistory:[], closedAt:null, closedBy:null,
        lastUpdatedBy:'', legacy:true
      });
    });
  }
  return result;
}

function buildIssues() {
  const savedById = new Map(savedIssues.map(i => [i.id,i]));
  const combined = [...savedIssues];
  for (const r of reports) {
    const existing = savedIssues.filter(i => i.reportId === r.id);
    const normalized = new Set(existing.map(i => String(i.issue || i.description || '').trim().toLowerCase()));
    for (const candidate of extractLegacy(r)) {
      if (savedById.has(candidate.id)) continue;
      /* Do not repeat a narrative already entered as an individual issue. */
      const key = candidate.issue.trim().toLowerCase();
      if (normalized.has(key)) continue;
      combined.push(candidate);
      normalized.add(key);
    }
  }
  allIssues = combined;
}

function addIssueInput() {
  const wrapper = document.createElement('div');
  wrapper.className = 'issue-entry';
  wrapper.innerHTML = `<label>Issue / Endorsement (full details) *<textarea class="new-issue-description" required placeholder="Write the complete issue, including medication lists"></textarea></label><label>Initial Action Taken<textarea class="new-issue-action"></textarea></label><button type="button" class="secondary remove-issue">Remove Issue</button>`;
  wrapper.querySelector('.remove-issue').addEventListener('click', () => wrapper.remove());
  el('issueInputs')?.append(wrapper);
}
function getNewIssues() {
  return [...document.querySelectorAll('#issueInputs .issue-entry')].map(box => ({
    issue:box.querySelector('.new-issue-description').value.trim(),
    action:box.querySelector('.new-issue-action').value.trim()
  }));
}
function generateReport() {
  const form = el('reportForm');
  const preview=el('reportContent');
  const wasRequired=preview?.required;
  if(preview) preview.required=false;
  const valid=form.reportValidity();
  if(preview) preview.required=wasRequired;
  if(!valid) return;
  const fields = [
    ['Staff Present','q_present'], ['Attendance Updates','q_absence'],
    ['Previous Shift Issues','q_previous'], ['New Issues','q_new'],
    ['Actions Taken During Shift','q_actions'],
    ['Endorsement to Next Shift','q_next'], ['Priority','q_priority'],
    ['Additional Notes','q_notes'], ['Medication Shortage','q_shortage']
  ];
  el('reportContent').value = `Pharmacy Shift Report\n\nReport prepared by ${val('employeeName')}, Badge Number ${val('badgeNumber')}, for ${val('section')}, ${val('shift')} shift.\n\n` + fields.map(([label,id]) => `${label}: ${val(id)}`).join('\n\n') + '\n\nIndividual Issues / Endorsements:\n' + (getNewIssues().map((x,i) => `${i+1}. ${x.issue}${x.action ? '\nInitial Action: '+x.action : ''}`).join('\n\n') || 'None');
}
async function saveReport(event) {
  event.preventDefault();
  const form = el('reportForm');
  if (!form.reportValidity()) return;
  const items = getNewIssues();
  if (items.some(i => !i.issue)) { alert('Complete every individual issue.'); return; }
  if (!val('reportContent')) { alert('Generate Report Preview first.'); return; }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  const date = new Date().toISOString();
  const ref = reportsRef.doc();
  const answers = {
    present:val('q_present'), attendanceUpdates:val('q_absence'),
    previousShiftIssues:val('q_previous'), newRisingIssues:val('q_new'),
    actionsTaken:val('q_actions'), nextShiftEndorsement:val('q_next'),
    priority:val('q_priority'), additionalNotes:val('q_notes'),
    medicationShortage:val('q_shortage')
  };
  const report = {
    date, dateDisplay:fmt(date), createdAt:date,
    employeeName:val('employeeName'), badgeNumber:val('badgeNumber'),
    section:val('section'), shift:val('shift'), priority:val('q_priority'),
    content:val('reportContent'), structuredAnswers:answers,
    followupStatus:'Open', followupActions:[], issueCount:items.length
  };
  try {
    const batch = db.batch();
    batch.set(ref,report);
    /* Explicit issues are stored separately. If no explicit issue was added,
       the meaningful narrative answers are still shown as virtual legacy issues. */
    for (const item of items) {
      const doc = issuesRef.doc();
      batch.set(doc,{
        reportId:ref.id, date, createdAt:date, section:report.section,
        shift:report.shift, priority:report.priority,
        issue:item.issue, description:item.issue, status:'Open',
        statusHistory:[{date,status:'Open',previousStatus:null,updatedBy:report.employeeName,action:item.action||'Issue reported'}],
        actions:item.action ? [{name:report.employeeName,action:item.action,date}] : [],
        lastUpdatedBy:item.action ? report.employeeName : '',
        lastUpdatedAt:item.action ? date : null,
        closedAt:null,closedBy:null,legacy:false
      });
    }
    await batch.commit();
    form.reset();
    if (el('issueInputs')) el('issueInputs').innerHTML = '';
    alert('Report saved successfully.');
    showPage('latestReportsPage');
  } catch (e) {
    console.error(e);
    alert('Unable to save. Check Firebase permissions.');
  } finally { button.disabled = false; }
}

async function loadData() {
  try {
    const [rs,is] = await Promise.all([reportsRef.get(),issuesRef.get()]);
    reports = rs.docs.map(d => ({...d.data(),id:d.id})).sort((a,b) => (reportDate(b)?.getTime() || 0)-(reportDate(a)?.getTime() || 0));
    savedIssues = is.docs.map(d => ({...d.data(),id:d.id}));
    buildIssues();
    filteredReports = [...reports];
    renderLatest(); renderAll(); renderMonitoring();
  } catch (e) {
    console.error(e);
    for (const id of ['latestReportsList','allReportsList']) if (el(id)) el(id).textContent = 'Unable to load reports. Check Firebase permissions.';
    if (el('monitoringTableBody')) el('monitoringTableBody').innerHTML = '<tr><td colspan="7">Unable to load issues. Check Firebase permissions.</td></tr>';
  }
}

function historyHTML(i) {
  const a = actionsOf(i);
  const h=historyOf(i);
  if (h.length) return h.map(x=>`<div class="action-entry"><strong>${esc(x.updatedBy||'')}</strong> ${x.status?statusTag(x.status):''}<div>${esc(x.action||'')}</div><small>${esc(fmt(x.date))}</small></div>`).join('');
  return a.length ? a.map(x => `<div class="action-entry"><strong>${esc(x.name || '')}</strong><div>${esc(x.action || '')}</div><small>${esc(fmt(x.date))}</small></div>`).join('') : '<p class="muted">No action recorded.</p>';
}
function editorHTML(issue) {
  return `<div class="followup-editor" data-issue-id="${esc(issue.id)}"><label>Authorized Badge<input class="f-badge" type="password" autocomplete="off" inputmode="numeric"></label><label>Action Taken<textarea class="f-action" placeholder="Enter follow-up action"></textarea></label><label>Status<select class="f-status">${STATUSES.map(s => `<option value="${s}" ${statusOf(issue)===s?'selected':''}>${s}</option>`).join('')}</select></label><button type="button" class="followup-save">Save Follow-up</button><p class="followup-message" role="status"></p></div>`;
}
function issueHTML(i) {
  return `<div class="issue-card"><div class="followup-heading"><strong>${esc(i.category ? i.category+': ' : '')}${esc(i.issue || i.description || '')}</strong>${statusTag(statusOf(i))}</div>${historyHTML(i)}${i.closedBy ? `<div class="closed-by">Closed by: ${esc(i.closedBy)}</div>` : ''}${editorHTML(i)}</div>`;
}
function reportHTML(r) {
  const own = allIssues.filter(i => i.reportId === r.id);
  const priority = ['Critical','Moderate','Normal'].includes(r.priority) ? r.priority : 'Normal';
  return `<article class="report-item ${priority.toLowerCase()}"><div class="report-header"><strong>${esc(r.employeeName || 'Unknown')} — ${esc(r.section || '')}</strong><span class="priority-badge ${priority.toLowerCase()}">${esc(priority)}</span></div><p class="report-date">${esc(r.dateDisplay || fmt(reportDate(r)))}</p><div class="report-content">${esc(r.content || '')}</div>${own.length ? `<div class="followup-panel"><h3>Issue Follow-up</h3>${own.map(issueHTML).join('')}</div>` : ''}</article>`;
}
function renderLatest() {
  const target = el('latestReportsList'); if (!target) return;
  const groups = [...new Set(reports.map(r => r.section || 'Other'))];
  target.innerHTML = groups.length ? groups.map(s => `<div class="section-block"><h3>${esc(s)}</h3>${reports.filter(r => (r.section || 'Other')===s).slice(0,3).map(reportHTML).join('')}</div>`).join('') : '<p class="empty-msg">No reports available.</p>';
}
function renderAll() {
  if (el('allReportsList')) el('allReportsList').innerHTML = filteredReports.length ? filteredReports.map(reportHTML).join('') : '<p class="empty-msg">No reports found.</p>';
  if (el('reportCount')) el('reportCount').textContent = `(${filteredReports.length} reports)`;
}
function filterReports() {
  filteredReports = reports.filter(r => {
    const d = reportDate(r);
    const day = d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
    return (!val('filterStartDate') || day >= val('filterStartDate')) && (!val('filterEndDate') || day <= val('filterEndDate')) && (!val('filterSection') || r.section === val('filterSection')) && (!val('filterShift') || r.shift === val('filterShift')) && (!val('filterPriority') || r.priority === val('filterPriority'));
  }); renderAll();
}
function resetFilters() {
  ['filterStartDate','filterEndDate','filterSection','filterShift','filterPriority'].forEach(id => { if (el(id)) el(id).value=''; });
  filteredReports=[...reports]; renderAll();
}

/* Tuesday 00:00 to next Tuesday 00:00, local time.
   The existing HTML input is converted from type=week to type=date
   automatically so no HTML edits are required. */
function tuesdayRange(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const [year,month,day] = value.split('-').map(Number);
  const chosen = new Date(year,month-1,day);
  if (chosen.getFullYear()!==year || chosen.getMonth()!==month-1 || chosen.getDate()!==day) return null;
  const daysSinceTuesday = (chosen.getDay()-2+7)%7;
  const start = new Date(year,month-1,day-daysSinceTuesday,0,0,0,0);
  const end = new Date(start.getFullYear(),start.getMonth(),start.getDate()+7,0,0,0,0);
  return {start,end};
}
function setCurrentWeek() {
  const picker=el('monitoringWeek');
  if (!picker) return;
  const previousValue=picker.value;
  if (picker.type !== 'date') picker.type='date';
  if (/^\d{4}-\d{2}-\d{2}$/.test(picker.value)) return;
  const today=new Date();
  const daysSinceTuesday=(today.getDay()-2+7)%7;
  const tuesday=new Date(today.getFullYear(),today.getMonth(),today.getDate()-daysSinceTuesday);
  const yyyy=tuesday.getFullYear();
  const mm=String(tuesday.getMonth()+1).padStart(2,'0');
  const dd=String(tuesday.getDate()).padStart(2,'0');
  picker.value=`${yyyy}-${mm}-${dd}`;
}
/* Dashboard launch: initialize ONLY the most recent 14 days of legacy
   untracked issues as Open. Once followed up, carry unresolved issues forever. */
const DASHBOARD_LAUNCH_WINDOW_DAYS = 14;
function hasRecordedStatus(i) {
  return STATUSES.includes(i.status) ||
    (Array.isArray(i.statusHistory) && i.statusHistory.some(h => STATUSES.includes(h.status) && !h.imported));
}
function historyOf(i) {
  return Array.isArray(i.statusHistory) ? [...i.statusHistory].sort((a,b)=>(toDate(a.date)?.getTime()||0)-(toDate(b.date)?.getTime()||0)) : [];
}
function statusAt(i, date) {
  const entries=historyOf(i).filter(h=>STATUSES.includes(h.status) && !h.imported && toDate(h.date));
  if (!entries.length) {
    const closed=toDate(i.closedAt);
    if (closed && closed<date) return 'Closed';
    return statusOf(i);
  }
  let status='Open';
  for (const h of entries) {
    if (toDate(h.date)>=date) break;
    status=h.status;
  }
  return status;
}
function bootstrapLegacy(i) {
  if (hasRecordedStatus(i)) return false;
  const created=issueDate(i);
  if (!created) return false;
  // Fixed dashboard launch window. Never expire issues after 14 days.
  const launch=new Date('2026-10-12T00:00:00+03:00');
  const cutoff=new Date(launch.getTime()-14*86400000);
  return created>=cutoff;
}

function isIncluded(i,range) {
  const created=issueDate(i);
  if (!created || created>=range.end) return false;
  if (!hasRecordedStatus(i) && !bootstrapLegacy(i)) return false;
  if (created>=range.start) return true;
  if (statusAt(i,range.start)!=='Closed') return true;
  return historyOf(i).some(h=>toDate(h.date)>=range.start && toDate(h.date)<range.end && h.status!=='Closed');
}
function lastActionAt(i,cutoff) {
  return actionsOf(i).filter(a=>toDate(a.date) && toDate(a.date)<cutoff)
    .sort((a,b)=>toDate(a.date)-toDate(b.date)).at(-1);
}
function closedByAt(i,cutoff) {
  if (statusAt(i,cutoff)!=='Closed') return '—';
  const h=historyOf(i).filter(x=>x.status==='Closed' && toDate(x.date) && toDate(x.date)<cutoff).at(-1);
  return h?.updatedBy || (toDate(i.closedAt)<cutoff ? i.closedBy : '') || '—';
}
function renderMonitoring() {
  const tbody=el('monitoringTableBody'); if (!tbody) return;
  setCurrentWeek();
  const range=tuesdayRange(val('monitoringWeek'));
  if (!range) { tbody.innerHTML='<tr><td colspan="7">Choose a valid week.</td></tr>'; return; }
  let caption=el('tuesdayRangeLabel');
  if (!caption) {
    caption=document.createElement('p'); caption.id='tuesdayRangeLabel'; caption.className='hint';
    el('monitoringWeek')?.closest('label')?.insertAdjacentElement('afterend',caption);
  }
  if (caption) caption.textContent=`Tuesday ${range.start.toLocaleDateString('en-GB')} → Tuesday ${range.end.toLocaleDateString('en-GB')} (end exclusive)`;
  const asOf=new Date(Math.min(range.end.getTime(),Date.now()));
  const base=allIssues.filter(i=>isIncluded(i,range) && (!val('monitoringSection') || i.section===val('monitoringSection')));
  const shown=base.filter(i=>!val('monitoringStatus') || statusAt(i,asOf)===val('monitoringStatus'));
  if (el('monitoringTotal')) el('monitoringTotal').textContent=base.length;
  if (el('monitoringPending')) el('monitoringPending').textContent=base.filter(i=>statusAt(i,asOf)!=='Closed').length;
  if (el('monitoringClosed')) el('monitoringClosed').textContent=base.filter(i=>statusAt(i,asOf)==='Closed').length;
  shown.sort((a,b)=>(issueDate(b)?.getTime()||0)-(issueDate(a)?.getTime()||0));
  tbody.innerHTML=shown.length ? shown.map(i=>{
    const carry=issueDate(i)<range.start;
    const latest=lastActionAt(i,asOf);
    return `<tr><td>${esc(fmt(issueDate(i)))}</td><td>${esc(i.section || '')}</td><td><button type="button" class="open-issue-details" data-issue-id="${esc(i.id)}" style="background:none;border:0;padding:0;text-align:left;color:#174c72;cursor:pointer;font-weight:700;white-space:pre-wrap">${esc(i.category ? i.category+': ' : '')}${esc(i.issue || i.description || '')}</button>${carry ? '<div class="carry-badge">Carried Forward</div>' : ''}${bootstrapLegacy(i) ? '<div class="carry-badge">Initial Open</div>' : ''}</td><td>${latest ? esc(latest.action || '') : 'No action recorded'}</td><td>${esc(latest?.name || '—')}</td><td>${statusTag(statusAt(i,asOf))}</td><td>${esc(closedByAt(i,asOf))}</td></tr>`;
  }).join('') : '<tr><td colspan="7">No issues found for the selected Tuesday-to-Tuesday period.</td></tr>';
}
function openIssueDetails(id) {
  const i=allIssues.find(x=>x.id===id); if (!i) return;
  let panel=el('issueDetailsPanel');
  if (!panel) {
    panel=document.createElement('div'); panel.id='issueDetailsPanel'; panel.className='card';
    el('weeklyMonitoringPage')?.appendChild(panel);
  }
  panel.innerHTML=`<button type="button" class="close-issue-details secondary">← Back to Monitoring</button><h2>Issue Details & Status History</h2><p>${esc(i.section||'')} · ${esc(fmt(issueDate(i)))}</p><div class="report-content">${esc(i.issue||i.description||'')}</div><h3>Follow-up History</h3>${historyOf(i).length ? historyOf(i).map(h=>`<div class="action-entry"><strong>${esc(fmt(h.date))}</strong> ${h.status?statusTag(h.status):''}<div>${esc(h.action||'')}</div><small>Updated by: ${esc(h.updatedBy||'Unknown')}</small></div>`).join('') : historyHTML(i)}${editorHTML(i)}`;
  panel.style.display='block';
  panel.scrollIntoView({behavior:'smooth',block:'start'});
}

async function saveFollowup(button) {
  const editor=button.closest('.followup-editor'); if (!editor) return;
  const id=editor.dataset.issueId;
  const issue=allIssues.find(i => i.id===id); if (!issue) return;
  const badge=editor.querySelector('.f-badge').value.trim();
  const name=authorizedBadges[badge];
  const action=editor.querySelector('.f-action').value.trim();
  const status=editor.querySelector('.f-status').value;
  const message=editor.querySelector('.followup-message');
  if (!name) { message.textContent='Unauthorized badge number.'; return; }
  if (!STATUSES.includes(status)) { message.textContent='Invalid status.'; return; }
  if (!action && status===statusOf(issue) && hasRecordedStatus(issue)) { message.textContent='Enter an action or change status.'; return; }
  button.disabled=true; message.textContent='Saving...';
  try {
    const ref=issuesRef.doc(id);
    await db.runTransaction(async tx => {
      const snap=await tx.get(ref);
      const current=snap.exists ? snap.data() : issue;
      const previous=statusOf(current);
      const date=new Date().toISOString();
      const actions=[...actionsOf(current)];
      if (action) actions.push({name,action,date});
      const statusHistory=[...historyOf(current),{date,status,previousStatus:hasRecordedStatus(current)?previous:null,updatedBy:name,action:action||'Status updated'}];
      const update={actions,statusHistory,status,lastUpdatedBy:name,lastUpdatedAt:date,
        closedBy:status==='Closed' ? (previous==='Closed' && current.closedBy ? current.closedBy : name) : null,
        closedAt:status==='Closed' ? (previous==='Closed' && current.closedAt ? current.closedAt : date) : null};
      if (snap.exists) tx.update(ref,update);
      else tx.set(ref,{...issue,...update,legacy:true});
    });
    await loadData();
  } catch(e) { console.error(e); message.textContent='Unable to save. Check Firestore permissions.'; button.disabled=false; }
}

function exportReportsToExcel(data,name) {
  if (!data.length) { alert('No reports to export.'); return; }
  if (typeof XLSX==='undefined') { alert('Excel library is unavailable.'); return; }
  const rows=[['Date','Employee Name','Badge Number','Section','Shift','Priority','Report Content','Follow-up Actions','Status','Closed By','Last Updated By']];
  for (const r of data) {
    const own=allIssues.filter(i => i.reportId===r.id);
    rows.push([r.dateDisplay||fmt(reportDate(r)),r.employeeName||'',r.badgeNumber||'',r.section||'',r.shift||'',r.priority||'',r.content||'',own.map(i => `${i.category||'Issue'}: ${i.issue||''}\n${actionsOf(i).map(a=>`${a.name}: ${a.action}`).join('\n')}`).join('\n\n'),own.map(statusOf).join('; '),own.map(i=>i.closedBy||'').filter(Boolean).join('; '),own.map(i=>i.lastUpdatedBy||'').filter(Boolean).join('; ')]);
  }
  const sheet=XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols']=[{wch:24},{wch:25},{wch:16},{wch:24},{wch:14},{wch:14},{wch:75},{wch:75},{wch:25},{wch:26},{wch:26}];
  rows.forEach((row,r)=>row.forEach((_,c)=>{
    const cell=sheet[XLSX.utils.encode_cell({r,c})];if (!cell) return;
    cell.s={alignment:{vertical:'top',wrapText:true}};
    if (r===0) cell.s={...cell.s,fill:{fgColor:{rgb:'102B43'}},font:{bold:true,color:{rgb:'FFFFFF'}}};
  }));
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Reports');
  XLSX.writeFile(book,`${name}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
function exportFilteredToCSV(){exportReportsToExcel(filteredReports,'Filtered_Pharmacy_Reports')}
function exportAllToCSV(){exportReportsToExcel(reports,'All_Pharmacy_Reports')}

document.addEventListener('DOMContentLoaded',()=>{
  el('reportForm')?.addEventListener('submit',saveReport);
  el('addIssueBtn')?.addEventListener('click',addIssueInput);
  document.addEventListener('click',event=>{
    const detail=event.target.closest('.open-issue-details');
    if(detail){openIssueDetails(detail.dataset.issueId);return;}
    if(event.target.closest('.close-issue-details')){
      const panel=el('issueDetailsPanel');if(panel)panel.style.display='none';return;
    }
    const btn=event.target.closest('.followup-save'); if (btn) saveFollowup(btn);
  });
  ['monitoringWeek','monitoringSection','monitoringStatus'].forEach(id=>el(id)?.addEventListener('change',renderMonitoring));
  setCurrentWeek();loadData();
});
