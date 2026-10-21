
const firebaseConfig = {
  apiKey: "AIzaSyBqgeFglHVOuP8x-p1AIAIa3tBEonD5DPt8",
  authDomain: "pharmacyshift.firebaseapp.com",
  projectId: "pharmacyshift",
  storageBucket: "pharmacyshift.firebasestorage.app",
  messagingSenderId: "628923818441",
  appId: "1:628923818441:web:88f2a3554411b7ddbe4818",
  measurementId: "G-WPJ95C048P"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const reportsRef = db.collection("Shift Coordinator Reports");
const issuesRef = db.collection("Shift Report Issues");

const authorizedBadges = {
  "9141896": "Dr. Shaker Al Nufaiee",
  "1001011": "Ms. Munira Alsubaie",
  "1000186": "Dr. Abdullah Alqurashi",
  "7000195": "Dr. Amal Alghalbi",
  "7000322": "Dr. Abdulrahman Altowairqi",
  "403645": "Dr. Ayidh Alharthi",
  "7000940": "Dr. Amani Alhumali",
  "1003849": "Dr. Nawaf Alzaidi",
  "1004054": "Dr. Abdulaziz Almutairi",
  "7000547": "Mr. Faris Alzahrani",
  "1003972": "Ms. Nidaa Alhumaidi",
  "1003968": "Ms. Rahaf Alzaydani",
  "7000375": "Dr. Rami Al Khaldi",
  "5874336": "Dr. Sultan Alotaibi",
  "7000403": "Dr. Shahad Alwagdani",
  "7000324": "Dr. Aisha Majrabi"
};

const AREAS = [
  "ER Pharmacy",
  "IV Pharmacy",
  "Inpatient Pharmacy",
  "Outpatient Pharmacy",
  "Clinical Services",
  "Material Management",
  "OR Pharmacy"
];

const CATEGORIES = [
  ["Material Management", "area_material"],
  ["Automation and Informatics", "area_automation"],
  ["Drug Repackaging and Unit Dose", "area_repackaging"],
  ["Clinical Services", "area_clinical"],
  ["Narcotic and Psychotropic Substances", "area_narcotics"],
  ["Inpatient Services", "area_inpatient"],
  ["IV", "area_iv"]
];

const STATUSES = ["Open", "Under Processing", "Closed"];
const START_MS = Date.parse("2026-10-13T00:00:00+03:00");
const SAUDI_TZ = "Asia/Riyadh";

let reports = [];
let savedIssues = [];
let allIssues = [];
let filteredReports = [];
let monitoringShown = [];
let previewSignature = "";

const el = id => document.getElementById(id);
const val = id => (el(id)?.value || "").trim();

function esc(x) {
  return String(x ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function toDate(x) {
  if (!x) return null;
  const d = typeof x.toDate === "function" ? x.toDate() : new Date(x);
  return Number.isFinite(d.getTime()) ? d : null;
}

function fmt(x) {
  const d = toDate(x);
  return d
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: SAUDI_TZ,
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(d)
    : "—";
}

function saudiDay(x) {
  const d = toDate(x);
  if (!d) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAUDI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);

  const part = type => parts.find(p => p.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function todaySaudi() {
  return saudiDay(new Date());
}

function dayMs(day) {
  return Date.parse(`${day}T00:00:00+03:00`);
}

function reportTime(r) {
  return toDate(r.createdAt || r.date || r.timestamp);
}

function issueTime(i) {
  return toDate(i.createdAt || i.date);
}

function isRoutine(text) {
  return /^(n|no|none|nil|n\/a|na|nothing|no issues?|not applicable|لا يوجد|لا توجد|لا شيء|[-–—.]|\s*)$/i
    .test(String(text || "").trim());
}

function purposeLabel(p) {
  return ({
    handover: "For Handover Only",
    action: "For Action",
    both: "For Handover & Action"
  })[p] || "Unspecified";
}

function normalizeArea(s) {
  return s === "IV" ? "IV Pharmacy" : (s || "Other");
}

function sectionDisplay(i) {
  const from = normalizeArea(i.fromSection || i.section);
  const to = i.sentTo || "";
  return from + (to && to !== from ? ` → ${to}` : "");
}

function fillSelect(id, items, placeholder) {
  el(id).innerHTML =
    `<option value="">${esc(placeholder)}</option>` +
    items.map(x =>
      `<option value="${esc(x)}">${esc(x)}</option>`
    ).join("");
}

function setupFields() {
  fillSelect("section", AREAS, "Select Area / From Section");
  fillSelect("sentTo", AREAS, "Select Section (Optional)");
  fillSelect("filterSection", AREAS, "All Sections");
  fillSelect("monitoringSection", AREAS, "All Sections");

  fillSelect(
    "monitoringCategory",
    CATEGORIES.map(x => x[0]).concat(["In-Charge Endorsement"]),
    "All Categories"
  );

  el("categoryFields").innerHTML = CATEGORIES.map(([name, id]) => `
    <details class="entry-accordion">
      <summary>
        <span>${esc(name)}</span>
        <span class="filled-mark" id="mark_${id}" hidden>✓ Filled</span>
      </summary>
      <div class="entry-body">
        <label for="${id}">Issue / Endorsement (Optional)</label>
        <textarea id="${id}" rows="4"
          placeholder="Write the full issue or endorsement..."></textarea>
      </div>
    </details>
  `).join("");

  el("reportDate").value = todaySaudi();
  el("monitoringFrom").value = "2026-10-13";
  el("monitoringTo").value = todaySaudi();

  CATEGORIES.forEach(([, id]) => {
    el(id).addEventListener("input", () => {
      el("mark_" + id).hidden = !val(id);
      previewSignature = "";
    });
  });

  el("reportForm").querySelectorAll("input,select,textarea")
    .forEach(node => node.addEventListener("input", () => {
      if (node.id !== "reportContent") previewSignature = "";
    }));
}

window.showPage = function(id) {
  if (!el(id)) return;

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  el(id).classList.add("active");
  window.scrollTo(0, 0);

  if ([
    "latestReportsPage",
    "viewReportsPage",
    "weeklyMonitoringPage"
  ].includes(id)) {
    loadData();
  }
};

function answersNow() {
  return {
    employeeName: val("employeeName"),
    badgeNumber: val("badgeNumber"),
    reportDate: val("reportDate"),
    section: val("section"),
    sentTo: val("sentTo"),
    shift: val("shift"),
    present: val("q_present"),
    attendanceUpdates: val("q_absence"),
    areas: Object.fromEntries(
      CATEGORIES.map(([name, id]) => [name, val(id)])
    ),
    incharge: val("area_incharge"),
    handover: val("area_handover"),
    purpose: val("reportPurpose")
  };
}

function signature(a) {
  return JSON.stringify(a);
}

function previewText(a) {
  return [
    "PHARMACY SHIFT REPORT",
    "",
    `Date: ${a.reportDate}`,
    `Prepared By: ${a.employeeName}`,
    `Badge Number: ${a.badgeNumber}`,
    `From Section: ${a.section}`,
    ...(a.sentTo ? [`Sent To: ${a.sentTo}`] : []),
    `Shift: ${a.shift}`,
    "",
    "ATTENDANCE",
    `Staff Present:\n${a.present || "—"}`,
    `Attendance Updates:\n${a.attendanceUpdates || "—"}`,
    "",
    "ISSUES / ENDORSEMENTS",
    ...CATEGORIES.map(([name]) =>
      `${name}:\n${a.areas[name] || "No issues reported"}\n`
    ),
    "IN-CHARGE ENDORSEMENT",
    a.incharge || "No endorsement",
    "",
    "NEXT SHIFT HANDOVER",
    a.handover || "No handover",
    "",
    `Report Purpose: ${purposeLabel(a.purpose)}`
  ].join("\n");
}

window.generateReport = function() {
  if (!el("reportForm").reportValidity()) return;

  const a = answersNow();
  el("reportContent").value = previewText(a);
  previewSignature = signature(a);

  el("reportContent").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
};

async function saveReport(event) {
  event.preventDefault();

  const form = el("reportForm");
  if (!form.reportValidity()) return;

  const a = answersNow();

  if (previewSignature !== signature(a) || !val("reportContent")) {
    alert("Please generate the report preview after your latest changes.");
    return;
  }

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;

  try {
    const ref = reportsRef.doc();
    const now = new Date().toISOString();

    const entries = CATEGORIES.map(([category, id]) => ({
      area: category,
      category,
      text: val(id)
    })).filter(x => x.text && !isRoutine(x.text));

    if (a.incharge && !isRoutine(a.incharge)) {
      entries.push({
        area: "In-Charge Endorsement",
        category: "In-Charge Endorsement",
        text: a.incharge
      });
    }

    const report = {
      date: now,
      createdAt: now,
      reportDate: a.reportDate,
      employeeName: a.employeeName,
      badgeNumber: a.badgeNumber,
      section: a.section,
      fromSection: a.section,
      sentTo: a.sentTo,
      shift: a.shift,
      priority: "Normal",
      content: val("reportContent"),
      structuredAnswers: {
        present: a.present,
        attendanceUpdates: a.attendanceUpdates,
        areas: a.areas,
        incharge: a.incharge,
        handover: a.handover
      },
      areaEntries: entries,
      reportPurpose: a.purpose,
      issueCount: entries.length,
      entryClassificationVersion: 5
    };

    const batch = db.batch();
    batch.set(ref, report);

    entries.forEach(entry => {
      const issueRef = issuesRef.doc();

      batch.set(issueRef, {
        reportId: ref.id,
        date: now,
        createdAt: now,
        reportDate: a.reportDate,
        section: a.section,
        fromSection: a.section,
        sentTo: a.sentTo,
        shift: a.shift,
        area: entry.category,
        category: entry.category,
        issue: entry.text,
        description: entry.text,
        classification: a.purpose,
        reportPurpose: a.purpose,
        status: a.purpose === "handover" ? "Handover" : "Open",
        actions: [],
        statusHistory: [],
        lastUpdatedBy: "",
        closedAt: null,
        closedBy: null
      });
    });

    await batch.commit();

    form.reset();
    el("reportDate").value = todaySaudi();
    el("reportContent").value = "";
    previewSignature = "";

    document.querySelectorAll(".entry-accordion").forEach(d => {
      d.open = false;
    });

    CATEGORIES.forEach(([, id]) => {
      el("mark_" + id).hidden = true;
    });

    alert("Report saved successfully.");
    showPage("latestReportsPage");

  } catch (error) {
    console.error(error);
    alert("Unable to save report. Check Firebase access.");
  } finally {
    button.disabled = false;
  }
}

function actionsOf(i) {
  return Array.isArray(i.actions)
    ? i.actions
    : Array.isArray(i.followupActions) ? i.followupActions : [];
}

function historyOf(i) {
  return Array.isArray(i.statusHistory) ? i.statusHistory : [];
}

function statusOf(i) {
  const s = i.status || i.followupStatus;
  return STATUSES.includes(s) ? s : "Open";
}

function tag(s) {
  return `<span class="status-pill ${esc(
    s.toLowerCase().replace(/\s+/g, "-")
  )}">${esc(s)}</span>`;
}

function historyHTML(i) {
  const history = historyOf(i);

  if (history.length) {
    return history.map(x => `
      <div class="action-entry">
        <strong>${esc(x.updatedBy || x.name || "—")}</strong>
        ${x.status ? tag(x.status) : ""}
        <div>${esc(x.action || "")}</div>
        <small>${esc(fmt(x.date))}</small>
      </div>
    `).join("");
  }

  const actions = actionsOf(i);

  return actions.length
    ? actions.map(x => `
      <div class="action-entry">
        <strong>${esc(x.name || "—")}</strong>
        <div>${esc(x.action || "")}</div>
        <small>${esc(fmt(x.date))}</small>
      </div>
    `).join("")
    : "<p>No action recorded.</p>";
}

function legacyIssues(r) {
  if (Number(r.entryClassificationVersion) >= 2) return [];

  const a = r.structuredAnswers || {};
  const fields = [
    ["Previous Shift Issues", a.previousShiftIssues || a.previousIssues],
    ["New Issues", a.newRisingIssues || a.newIssues],
    ["Next Shift Endorsement", a.nextShiftEndorsement || a.endorsementToNextShift],
    ["Additional Notes", a.additionalNotes || a.notes]
  ];

  return fields.flatMap(([category, text], idx) => {
    if (!text || isRoutine(text)) return [];

    return [{
      id: `legacy_${r.id}_${idx}`,
      reportId: r.id,
      date: r.date || r.createdAt,
      createdAt: r.date || r.createdAt,
      section: r.section,
      category,
      issue: String(text),
      classification: "unreviewed",
      status: "Open",
      actions: [],
      legacy: true
    }];
  });
}

function buildIssues() {
  allIssues = [...savedIssues];
  const keys = new Set(savedIssues.map(x => x.id));

  reports.forEach(r => {
    legacyIssues(r).forEach(i => {
      if (!keys.has(i.id)) {
        allIssues.push(i);
        keys.add(i.id);
      }
    });
  });
}

async function loadData() {
  try {
    const [rs, is] = await Promise.all([
      reportsRef.get(),
      issuesRef.get()
    ]);

    reports = rs.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    savedIssues = is.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    reports.sort((a, b) =>
      (reportTime(b)?.getTime() || 0) -
      (reportTime(a)?.getTime() || 0)
    );

    buildIssues();
    filterReports();
    renderLatest();
    renderMonitoring();

  } catch (error) {
    console.error(error);

    ["latestReportsList", "allReportsList"].forEach(id => {
      el(id).textContent = "Unable to load reports.";
    });

    el("monitoringTableBody").innerHTML =
      '<tr><td colspan="9">Unable to load monitoring data.</td></tr>';
  }
}

function reportHTML(r) {
  const related = allIssues.filter(i =>
    i.reportId === r.id && i.classification !== "unreviewed"
  );

  const entries = Array.isArray(r.areaEntries) ? r.areaEntries : [];
  const structured = r.structuredAnswers || {};

  const panels = entries.map(entry => {
    const linked = related.filter(i =>
      (i.area || i.category) === entry.area &&
      String(i.issue || i.description || "").trim() ===
      String(entry.text || "").trim()
    );

    return `
      <details class="area-accordion">
        <summary>${esc(entry.area)}</summary>
        <div class="area-details">
          <p class="issue-original">${esc(entry.text)}</p>
          ${linked.map(i => `
            <div>
              <strong>Status:
                ${tag(i.status === "Handover" ? "Handover" : statusOf(i))}
              </strong>
              ${historyHTML(i)}
            </div>
          `).join("")}
        </div>
      </details>
    `;
  }).join("");

  const extra = related.filter(i =>
    !entries.some(e =>
      e.area === (i.area || i.category) &&
      String(e.text || "").trim() ===
      String(i.issue || i.description || "").trim()
    )
  ).map(i => `
    <details class="area-accordion">
      <summary>${esc(i.category || i.area || "Issue")}</summary>
      <div class="area-details">
        <p>${esc(i.issue || i.description || "")}</p>
        ${historyHTML(i)}
      </div>
    </details>
  `).join("");

  return `
    <details class="report-accordion">
      <summary>
        <strong>
          ${esc(normalizeArea(r.section))} — ${esc(r.shift || "Shift")}
        </strong>
        <span class="report-meta">
          ${esc(r.reportDate || saudiDay(reportTime(r)))}
          · ${esc(r.employeeName || "Unknown")}
          ${r.sentTo ? " · Sent To: " + esc(r.sentTo) : ""}
        </span>
      </summary>

      <div class="report-accordion-body">
        <button class="download-btn" data-download="${esc(r.id)}">
          Download Report
        </button>

        <details class="area-accordion">
          <summary>General Information &amp; Attendance</summary>
          <div class="area-details">
            <p><strong>Prepared By:</strong>
              ${esc(r.employeeName || "—")}</p>
            <p><strong>Badge:</strong>
              ${esc(r.badgeNumber || "—")}</p>
            <p><strong>From:</strong>
              ${esc(normalizeArea(r.section))}</p>
            ${r.sentTo ? `<p><strong>Sent To:</strong>
              ${esc(r.sentTo)}</p>` : ""}
            <p><strong>Staff Present:</strong>
              ${esc(structured.present || "—")}</p>
            <p><strong>Attendance Updates:</strong>
              ${esc(structured.attendanceUpdates || "—")}</p>
          </div>
        </details>

        ${panels}
        ${extra}

        ${structured.incharge &&
          !entries.some(e => e.area === "In-Charge Endorsement")
          ? `<details class="area-accordion">
              <summary>In-Charge Endorsement</summary>
              <div class="area-details">
                <p>${esc(structured.incharge)}</p>
              </div>
            </details>`
          : ""}

        ${structured.handover
          ? `<details class="area-accordion">
              <summary>Next Shift Handover</summary>
              <div class="area-details">
                <p>${esc(structured.handover)}</p>
              </div>
            </details>`
          : ""}

        <details class="area-accordion">
          <summary>Full Original Report</summary>
          <div class="area-details">
            <div class="report-content">${esc(r.content || "")}</div>
          </div>
        </details>
      </div>
    </details>
  `;
}

function renderLatest() {
  const sections = [...new Set(
    reports.map(r => normalizeArea(r.section))
  )];

  el("latestReportsList").innerHTML = sections.length
    ? sections.map(section => `
      <div class="section-block">
        <h3>${esc(section)}</h3>
        ${reports
          .filter(r => normalizeArea(r.section) === section)
          .slice(0, 3)
          .map(reportHTML)
          .join("")}
      </div>
    `).join("")
    : '<p class="empty-msg">No reports available.</p>';
}

function renderAll() {
  el("allReportsList").innerHTML = filteredReports.length
    ? filteredReports.map(reportHTML).join("")
    : '<p class="empty-msg">No reports found.</p>';

  el("reportCount").textContent =
    `(${filteredReports.length} reports)`;
}

window.filterReports = function() {
  filteredReports = reports.filter(r => {
    const day = r.reportDate || saudiDay(reportTime(r));

    return (
      (!val("filterStartDate") || day >= val("filterStartDate")) &&
      (!val("filterEndDate") || day <= val("filterEndDate")) &&
      (!val("filterSection") ||
        normalizeArea(r.section) === val("filterSection")) &&
      (!val("filterShift") || r.shift === val("filterShift")) &&
      (!val("filterPriority") || r.priority === val("filterPriority"))
    );
  });

  renderAll();
};

window.resetFilters = function() {
  [
    "filterStartDate",
    "filterEndDate",
    "filterSection",
    "filterShift",
    "filterPriority"
  ].forEach(id => el(id).value = "");

  filterReports();
};

// All dates or custom period. No Tuesday-to-Tuesday grouping.
function monitoringRange() {
  if (val("monitoringMode") === "all") {
    return {
      start: START_MS,
      end: Date.now() + 1,
      all: true
    };
  }

  const from = val("monitoringFrom");
  const to = val("monitoringTo");

  if (!from || !to || from > to || from < "2026-10-13") {
    return null;
  }

  return {
    start: dayMs(from),
    end: dayMs(to) + 86400000,
    all: false
  };
}

function statusAt(i, cutoff) {
  const history = historyOf(i)
    .filter(x => STATUSES.includes(x.status) && toDate(x.date))
    .sort((a, b) => toDate(a.date) - toDate(b.date));

  if (!history.length) {
    const closed = toDate(i.closedAt);

    if (closed && closed.getTime() >= cutoff) {
      return "Open";
    }

    return statusOf(i);
  }

  let status = "Open";

  for (const x of history) {
    if (toDate(x.date).getTime() >= cutoff) break;
    status = x.status;
  }

  return status;
}

function actionAt(i, cutoff) {
  return [...actionsOf(i)]
    .filter(a =>
      toDate(a.date) && toDate(a.date).getTime() < cutoff
    )
    .sort((a, b) => toDate(a.date) - toDate(b.date))
    .at(-1);
}

function closedByAt(i, cutoff) {
  if (statusAt(i, cutoff) !== "Closed") return "—";

  const history = historyOf(i)
    .filter(x =>
      x.status === "Closed" &&
      toDate(x.date) &&
      toDate(x.date).getTime() < cutoff
    )
    .sort((a, b) => toDate(a.date) - toDate(b.date));

  return history.at(-1)?.updatedBy || i.closedBy || "—";
}

function renderMonitoring() {
  el("monitoringDateFields").hidden =
    val("monitoringMode") !== "period";

  const range = monitoringRange();
  const tbody = el("monitoringTableBody");

  if (!range) {
    monitoringShown = [];
    tbody.innerHTML =
      '<tr><td colspan="9">Select valid dates from 13 October 2026.</td></tr>';

    [
      "monitoringTotal",
      "monitoringPending",
      "monitoringClosed"
    ].forEach(id => el(id).textContent = "0");

    return;
  }

  const cutoff = Math.min(range.end, Date.now() + 1);

  el("monitoringRangeNotice").textContent = range.all
    ? "All actionable issues created from 13 October 2026."
    : `Custom Period: ${val("monitoringFrom")} to ${val("monitoringTo")}. Earlier eligible unresolved issues remain visible.`;

  monitoringShown = allIssues.filter(i => {
    const created = issueTime(i)?.getTime();

    if (!created || created < START_MS || created >= cutoff) {
      return false;
    }

    if (
      i.classification === "unreviewed" ||
      i.classification === "handover" ||
      i.status === "Handover"
    ) {
      return false;
    }

    if (
      !range.all &&
      created < range.start &&
      statusAt(i, range.start) === "Closed"
    ) {
      return false;
    }

    if (
      val("monitoringSection") &&
      normalizeArea(i.fromSection || i.section) !==
        val("monitoringSection")
    ) {
      return false;
    }

    if (
      val("monitoringCategory") &&
      (i.category || i.area) !== val("monitoringCategory")
    ) {
      return false;
    }

    if (
      val("monitoringStatus") &&
      statusAt(i, cutoff) !== val("monitoringStatus")
    ) {
      return false;
    }

    return true;
  }).sort((a, b) => issueTime(b) - issueTime(a));

  el("monitoringTotal").textContent = monitoringShown.length;

  el("monitoringPending").textContent =
    monitoringShown.filter(i =>
      statusAt(i, cutoff) !== "Closed"
    ).length;

  el("monitoringClosed").textContent =
    monitoringShown.filter(i =>
      statusAt(i, cutoff) === "Closed"
    ).length;

  tbody.innerHTML = monitoringShown.length
    ? monitoringShown.map(i => {
        const action = actionAt(i, cutoff);

        return `
          <tr>
            <td>${esc(i.reportDate || saudiDay(issueTime(i)))}</td>
            <td class="monitoring-section">
              ${esc(sectionDisplay(i))}
            </td>
            <td>${esc(i.category || i.area || "General")}</td>
            <td class="monitoring-issue">
              ${esc(i.issue || i.description || "")}
            </td>
            <td class="monitoring-action">
              ${esc(action?.action || "Awaiting Action")}
            </td>
            <td>${tag(statusAt(i, cutoff))}</td>
            <td>${esc(action?.name || i.lastUpdatedBy || "—")}</td>
            <td>${esc(closedByAt(i, cutoff))}</td>
            <td>
              <button class="btn-inline" data-issue="${esc(i.id)}">
                View / Update
              </button>
            </td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="9">No issues found.</td></tr>';
}

function openIssue(id) {
  const i = allIssues.find(x => x.id === id);
  if (!i) return;

  const panel = el("issueDetailsPanel");
  panel.hidden = false;

  panel.innerHTML = `
    <button class="secondary" id="closeIssue">
      ← Back to Monitoring
    </button>

    <h2>Issue Details &amp; Action History</h2>

    <p><strong>Section / Area:</strong>
      ${esc(sectionDisplay(i))}</p>

    <p><strong>Category:</strong>
      ${esc(i.category || i.area || "General")}</p>

    <div class="guidance issue-original">
      ${esc(i.issue || i.description || "")}
    </div>

    <h3>Action History</h3>
    ${historyHTML(i)}

    <div class="followup-editor" data-id="${esc(i.id)}">
      <label>
        Authorized Badge Number
        <input class="f-badge" type="password" inputmode="numeric">
      </label>

      <label>
        Action Taken
        <textarea class="f-action"
          placeholder="Document action taken..."></textarea>
      </label>

      <label>
        Status
        <select class="f-status">
          ${STATUSES.map(s => `
            <option ${statusOf(i) === s ? "selected" : ""}>
              ${s}
            </option>
          `).join("")}
        </select>
      </label>

      <button class="followup-save">
        Save Follow-up
      </button>

      <p class="followup-message"></p>
    </div>
  `;

  panel.scrollIntoView({ behavior: "smooth" });
}

async function saveFollowup(button) {
  const editor = button.closest(".followup-editor");
  const id = editor.dataset.id;

  const badge = editor.querySelector(".f-badge").value.trim();
  const name = authorizedBadges[badge];
  const action = editor.querySelector(".f-action").value.trim();
  const status = editor.querySelector(".f-status").value;
  const message = editor.querySelector(".followup-message");

  if (!name) {
    message.textContent = "Unauthorized badge number.";
    return;
  }

  if (!STATUSES.includes(status)) {
    message.textContent = "Invalid status.";
    return;
  }

  const i = allIssues.find(x => x.id === id);
  if (!i) return;

  if (!action && status === statusOf(i)) {
    message.textContent = "Enter an action or change the status.";
    return;
  }

  button.disabled = true;
  message.textContent = "Saving...";

  try {
    await db.runTransaction(async transaction => {
      const ref = issuesRef.doc(id);
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        throw Error("Issue record not found.");
      }

      const current = snapshot.data();
      const now = new Date().toISOString();
      const previous = statusOf(current);
      const actions = [...actionsOf(current)];

      if (action) {
        actions.push({
          name,
          action,
          date: now
        });
      }

      const statusHistory = [
        ...historyOf(current),
        {
          date: now,
          status,
          previousStatus: previous,
          updatedBy: name,
          action: action || "Status updated"
        }
      ];

      transaction.update(ref, {
        actions,
        statusHistory,
        status,
        lastUpdatedBy: name,
        lastUpdatedAt: now,
        closedBy: status === "Closed" ? name : null,
        closedAt: status === "Closed" ? now : null
      });
    });

    el("issueDetailsPanel").hidden = true;
    await loadData();

  } catch (error) {
    console.error(error);
    message.textContent = "Unable to save. Check Firestore permissions.";
    button.disabled = false;
  }
}

function downloadReport(id) {
  const r = reports.find(x => x.id === id);
  if (!r) return;

  const blob = new Blob([r.content || ""], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download =
    `Pharmacy_Report_${r.reportDate || saudiDay(reportTime(r))}_${id}.txt`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportExcel(rows, name) {
  if (typeof XLSX === "undefined") {
    alert("Excel library could not load.");
    return;
  }

  if (!rows.length) {
    alert("No data to export.");
    return;
  }

  const sheet = XLSX.utils.json_to_sheet(rows);

  sheet["!cols"] = Object.keys(rows[0]).map(key => ({
    wch: /Issue|Content|Action|Endorsement/i.test(key) ? 70 : 24
  }));

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Reports");

  XLSX.writeFile(book, `${name}_${todaySaudi()}.xlsx`);
}

function reportExportRows(data) {
  return data.map(r => {
    const related = allIssues.filter(i => i.reportId === r.id);

    return {
      "Date": r.reportDate || saudiDay(reportTime(r)),
      "Employee Name": r.employeeName || "",
      "Badge Number": r.badgeNumber || "",
      "From Section": normalizeArea(r.section),
      "Sent To": r.sentTo || "",
      "Shift": r.shift || "",
      "Report Purpose": purposeLabel(r.reportPurpose),
      "Full Original Report": r.content || "",
      "Issues": related.map(i =>
        `${i.category || i.area}: ${i.issue || i.description}`
      ).join("\n\n"),
      "Actions Taken": related.map(i =>
        actionsOf(i).map(a =>
          `${a.name}: ${a.action} (${fmt(a.date)})`
        ).join("\n")
      ).join("\n\n"),
      "Statuses": related.map(i => statusOf(i)).join("; "),
      "Closed By": related.map(i =>
        i.closedBy || ""
      ).filter(Boolean).join("; ")
    };
  });
}

window.exportFilteredToCSV = () => {
  exportExcel(
    reportExportRows(filteredReports),
    "Filtered_Pharmacy_Reports"
  );
};

window.exportAllToCSV = () => {
  exportExcel(
    reportExportRows(reports),
    "All_Pharmacy_Reports"
  );
};

function exportMonitoring() {
  const range = monitoringRange();
  if (!range) {
    alert("Please select a valid monitoring period.");
    return;
  }

  const cutoff = Math.min(range.end, Date.now() + 1);

  exportExcel(monitoringShown.map(i => {
    const action = actionAt(i, cutoff);

    return {
      "Date": i.reportDate || saudiDay(issueTime(i)),
      "Section / Area": sectionDisplay(i),
      "Issue Category": i.category || i.area || "",
      "Original Issue / Endorsement": i.issue || i.description || "",
      "Action Taken": action?.action || "",
      "Status": statusAt(i, cutoff),
      "Updated By": action?.name || i.lastUpdatedBy || "",
      "Closed By": closedByAt(i, cutoff)
    };
  }), "Pharmacy_Monitoring");
}

document.addEventListener("DOMContentLoaded", () => {
  setupFields();

  el("reportForm").addEventListener("submit", saveReport);

  document.addEventListener("click", event => {
    const download = event.target.closest("[data-download]");

    if (download) {
      downloadReport(download.dataset.download);
      return;
    }

    const issue = event.target.closest("[data-issue]");

    if (issue) {
      openIssue(issue.dataset.issue);
      return;
    }

    if (event.target.closest("#closeIssue")) {
      el("issueDetailsPanel").hidden = true;
      return;
    }

    const save = event.target.closest(".followup-save");

    if (save) {
      saveFollowup(save);
    }
  });

  [
    "monitoringMode",
    "monitoringSection",
    "monitoringCategory",
    "monitoringStatus",
    "monitoringFrom",
    "monitoringTo"
  ].forEach(id => {
    el(id).addEventListener("change", renderMonitoring);
  });

  el("monitoringApply").addEventListener(
    "click",
    renderMonitoring
  );

  el("monitoringReset").addEventListener("click", () => {
    [
      "monitoringSection",
      "monitoringCategory",
      "monitoringStatus"
    ].forEach(id => el(id).value = "");

    el("monitoringMode").value = "all";
    renderMonitoring();
  });

  el("exportMonitoring").addEventListener(
    "click",
    exportMonitoring
  );

  loadData();
});
