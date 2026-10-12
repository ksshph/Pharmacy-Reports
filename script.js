const firebaseConfig = {
  apiKey: "AIzaSyBqgeFglHVOuP8-p1AIAIa3tBEonD5DPt8",
  authDomain: "pharmacyshift.firebaseapp.com",
  projectId: "pharmacyshift",
  storageBucket: "pharmacyshift.firebasestorage.app",
  messagingSenderId: "628923818441",
  appId: "1:628923818441:web:88f2a3554411b7ddbe4818",
  measurementId: "G-WPJ95C048P"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

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
  "5874336": "Dr. Sultan Alotaibi"
};

const STATUSES = ["Open", "Under Processing", "Closed"];

let reports = [];
let savedIssues = [];
let allIssues = [];
let filteredReports = [];

const el = id => document.getElementById(id);
const val = id => (el(id)?.value || "").trim();

const esc = value => String(value ?? "").replace(
  /[&<>"']/g,
  c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c])
);

function toDate(value) {
  if (!value) return null;
  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function fmt(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";
}

function reportDate(report) {
  return toDate(
    report.date ||
    report.createdAt ||
    report.timestamp
  );
}

function issueDate(issue) {
  return toDate(issue.createdAt || issue.date);
}

function statusOf(issue) {
  const status = issue.status || issue.followupStatus;
  return STATUSES.includes(status) ? status : "Open";
}

function actionsOf(issue) {
  if (Array.isArray(issue.actions)) return issue.actions;
  if (Array.isArray(issue.followupActions)) {
    return issue.followupActions;
  }
  return [];
}

function statusTag(status) {
  const className = status.toLowerCase().replace(/\s+/g, "-");
  return `<span class="status-pill ${className}">${esc(status)}</span>`;
}

// PAGE NAVIGATION

window.showPage = function(pageId) {
  const target = el(pageId);

  if (!target) {
    console.error("Page not found:", pageId);
    return;
  }

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
    page.style.display = "none";
  });

  target.classList.add("active");
  target.style.display = pageId === "homePage"
    ? "flex"
    : "block";

  window.scrollTo(0, 0);

  if (pageId === "weeklyMonitoringPage") {
    setCurrentWeek();
  }

  if ([
    "latestReportsPage",
    "viewReportsPage",
    "weeklyMonitoringPage"
  ].includes(pageId)) {
    loadData();
  }
};

// REPORT GENERATION

window.generateReport = function() {
  const form = el("reportForm");
  const preview = el("reportContent");

  if (!form || !preview) return;

  const required = preview.required;
  preview.required = false;

  const valid = form.reportValidity();
  preview.required = required;

  if (!valid) return;

  const fields = [
    ["Staff Present", "q_present"],
    ["Attendance Updates", "q_absence"],
    ["Previous Shift Issues", "q_previous"],
    ["New Issues", "q_new"],
    ["Actions Taken During Shift", "q_actions"],
    ["Endorsement to Next Shift", "q_next"],
    ["Priority", "q_priority"],
    ["Additional Notes", "q_notes"],
    ["Medication Shortage", "q_shortage"]
  ];

  const content = fields.map(
    ([label, id]) => `${label}: ${val(id)}`
  ).join("\n\n");

  const individualIssues = getNewIssues().map(
    (item, index) =>
      `${index + 1}. ${item.issue}` +
      (item.action ? `\nInitial Action: ${item.action}` : "")
  ).join("\n\n");

  preview.value =
    "Pharmacy Shift Report\n\n" +
    `Report prepared by ${val("employeeName")}, ` +
    `Badge Number ${val("badgeNumber")}, ` +
    `for ${val("section")}, ${val("shift")} shift.\n\n` +
    content +
    "\n\nIndividual Issues / Endorsements:\n" +
    (individualIssues || "None");
};

function addIssueInput() {
  const container = el("issueInputs");
  if (!container) return;

  const box = document.createElement("div");
  box.className = "issue-entry";

  box.innerHTML = `
    <label>
      Issue / Endorsement
      <textarea class="new-issue-description"
        placeholder="Enter complete issue details"></textarea>
    </label>
    <label>
      Initial Action Taken
      <textarea class="new-issue-action"></textarea>
    </label>
    <button type="button" class="secondary remove-issue">
      Remove Issue
    </button>
  `;

  box.querySelector(".remove-issue").onclick = () => box.remove();
  container.appendChild(box);
}

function getNewIssues() {
  return [...document.querySelectorAll(
    "#issueInputs .issue-entry"
  )].map(box => ({
    issue: box.querySelector(".new-issue-description").value.trim(),
    action: box.querySelector(".new-issue-action").value.trim()
  }));
}

// SAVE REPORT

async function saveReport(event) {
  event.preventDefault();

  const form = el("reportForm");
  if (!form.reportValidity()) return;

  const items = getNewIssues();

  if (items.some(item => !item.issue)) {
    alert("Complete all individual issues.");
    return;
  }

  if (!val("reportContent")) {
    alert("Generate Report Preview first.");
    return;
  }

  const button = form.querySelector('[type="submit"]');
  button.disabled = true;

  const date = new Date().toISOString();
  const ref = reportsRef.doc();

  const answers = {
    present: val("q_present"),
    attendanceUpdates: val("q_absence"),
    previousShiftIssues: val("q_previous"),
    newRisingIssues: val("q_new"),
    actionsTaken: val("q_actions"),
    nextShiftEndorsement: val("q_next"),
    priority: val("q_priority"),
    additionalNotes: val("q_notes"),
    medicationShortage: val("q_shortage")
  };

  const report = {
    date,
    createdAt: date,
    dateDisplay: fmt(date),
    employeeName: val("employeeName"),
    badgeNumber: val("badgeNumber"),
    section: val("section"),
    shift: val("shift"),
    priority: val("q_priority"),
    content: val("reportContent"),
    structuredAnswers: answers,
    followupStatus: "Open",
    followupActions: [],
    issueCount: items.length
  };

  try {
    const batch = db.batch();
    batch.set(ref, report);

    for (const item of items) {
      const issueRef = issuesRef.doc();

      batch.set(issueRef, {
        reportId: ref.id,
        date,
        createdAt: date,
        section: report.section,
        shift: report.shift,
        priority: report.priority,
        issue: item.issue,
        description: item.issue,
        status: "Open",
        statusHistory: [{
          date,
          status: "Open",
          previousStatus: null,
          updatedBy: report.employeeName,
          action: item.action || "Issue reported"
        }],
        actions: item.action ? [{
          name: report.employeeName,
          action: item.action,
          date
        }] : [],
        lastUpdatedBy: item.action ? report.employeeName : "",
        closedAt: null,
        closedBy: null
      });
    }

    await batch.commit();

    form.reset();
    el("issueInputs").innerHTML = "";

    alert("Report saved successfully.");
    showPage("latestReportsPage");

  } catch (error) {
    console.error(error);
    alert("Unable to save report. Check Firebase permissions.");
  } finally {
    button.disabled = false;
  }
}

// LEGACY REPORT ISSUES

function isRoutine(text) {
  return /^(yes|no|none|nil|n\/a|nothing|no issues?|no shortage reported|لا|نعم|لا يوجد|-|\.)$/i
    .test(String(text || "").trim());
}

function splitNarratives(raw) {
  const text = String(raw || "").trim();

  if (!text || isRoutine(text)) return [];

  return text
    .split(/\n(?=\s*(?:\d+[.)]|[-•*])\s+)/)
    .map(x => x.trim().replace(/^(?:\d+[.)]|[-•*])\s+/, ""))
    .filter(x => x && !isRoutine(x));
}

function extractLegacy(report) {
  const answers = report.structuredAnswers || {};

  const fields = [
    [
      "Previous Shift Issues",
      answers.previousShiftIssues || answers.previousIssues
    ],
    [
      "New Issues",
      answers.newRisingIssues || answers.newIssues
    ],
    [
      "Next Shift Endorsement",
      answers.nextShiftEndorsement || answers.endorsementToNextShift
    ],
    [
      "Additional Notes",
      answers.additionalNotes || answers.notes
    ]
  ];

  if (!fields.some(item => String(item[1] || "").trim())) {
    const content = String(report.content || "");
    const labels = [
      ["Previous Shift Issues",
        /(?:Previous Shift Issues|Endorsed issues from the previous shift):\s*/i],
      ["New Issues",
        /(?:New Issues|New or rising issues during the shift):\s*/i],
      ["Next Shift Endorsement",
        /(?:Endorsement to Next Shift|Next Shift Endorsement|Items to be endorsed to the next shift):\s*/i],
      ["Additional Notes", /Additional Notes:\s*/i]
    ];

    const lines = content.split(/\r?\n/);
    const boundary = /^(?:Staff Present|Attendance Updates|Previous Shift Issues|New Issues|Actions Taken|Endorsement to Next Shift|Next Shift Endorsement|Priority|Additional Notes|Medication Shortage|Individual Issues)/i;

    labels.forEach(([name, regex], index) => {
      const start = lines.findIndex(line => regex.test(line.trim()));
      if (start < 0) return;

      const collected = [
        lines[start].trim().replace(regex, "")
      ];

      for (let j = start + 1; j < lines.length; j++) {
        if (boundary.test(lines[j].trim())) break;
        collected.push(lines[j]);
      }

      fields[index][1] = collected.join("\n").trim();
    });
  }

  const result = [];

  fields.forEach(([category, raw], fieldIndex) => {
    splitNarratives(raw).forEach((description, index) => {
      result.push({
        id: `legacy_${report.id}_${fieldIndex}_${index}`,
        reportId: report.id,
        date: report.date || report.createdAt,
        createdAt: report.date || report.createdAt,
        section: report.section || "Other",
        category,
        issue: description,
        description,
        status: null,
        actions: [],
        statusHistory: [],
        closedAt: null,
        closedBy: null,
        legacy: true
      });
    });
  });

  return result;
}

function buildIssues() {
  const savedIds = new Set(savedIssues.map(issue => issue.id));
  const combined = [...savedIssues];

  reports.forEach(report => {
    const existingTexts = new Set(
      savedIssues
        .filter(issue => issue.reportId === report.id)
        .map(issue =>
          String(issue.issue || issue.description || "")
            .trim()
            .toLowerCase()
        )
    );

    extractLegacy(report).forEach(issue => {
      const text = issue.issue.trim().toLowerCase();

      if (savedIds.has(issue.id) || existingTexts.has(text)) {
        return;
      }

      combined.push(issue);
      existingTexts.add(text);
    });
  });

  allIssues = combined;
}

// LOAD FIREBASE DATA

async function loadData() {
  try {
    const [reportSnapshot, issueSnapshot] = await Promise.all([
      reportsRef.get(),
      issuesRef.get()
    ]);

    reports = reportSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));

    reports.sort((a, b) =>
      (reportDate(b)?.getTime() || 0) -
      (reportDate(a)?.getTime() || 0)
    );

    savedIssues = issueSnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));

    buildIssues();

    filteredReports = [...reports];

    renderLatest();
    renderAll();
    renderMonitoring();

  } catch (error) {
    console.error(error);

    ["latestReportsList", "allReportsList"].forEach(id => {
      if (el(id)) {
        el(id).textContent = "Unable to load reports.";
      }
    });

    if (el("monitoringTableBody")) {
      el("monitoringTableBody").innerHTML =
        '<tr><td colspan="7">Unable to load issues.</td></tr>';
    }
  }
}

// REPORT DISPLAY

function historyOf(issue) {
  return Array.isArray(issue.statusHistory)
    ? [...issue.statusHistory].sort(
        (a, b) =>
          (toDate(a.date)?.getTime() || 0) -
          (toDate(b.date)?.getTime() || 0)
      )
    : [];
}

function historyHTML(issue) {
  const history = historyOf(issue);

  if (history.length) {
    return history.map(entry => `
      <div class="action-entry">
        <strong>${esc(entry.updatedBy || "")}</strong>
        ${entry.status ? statusTag(entry.status) : ""}
        <div>${esc(entry.action || "")}</div>
        <small>${esc(fmt(entry.date))}</small>
      </div>
    `).join("");
  }

  const actions = actionsOf(issue);

  return actions.length
    ? actions.map(action => `
        <div class="action-entry">
          <strong>${esc(action.name || "")}</strong>
          <div>${esc(action.action || "")}</div>
          <small>${esc(fmt(action.date))}</small>
        </div>
      `).join("")
    : "<p>No action recorded.</p>";
}

function editorHTML(issue) {
  return `
    <div class="followup-editor" data-issue-id="${esc(issue.id)}">
      <label>Authorized Badge
        <input class="f-badge" type="password" inputmode="numeric">
      </label>

      <label>Action Taken
        <textarea class="f-action"></textarea>
      </label>

      <label>Status
        <select class="f-status">
          ${STATUSES.map(status => `
            <option value="${status}"
              ${statusOf(issue) === status ? "selected" : ""}>
              ${status}
            </option>
          `).join("")}
        </select>
      </label>

      <button type="button" class="followup-save">
        Save Follow-up
      </button>

      <p class="followup-message"></p>
    </div>
  `;
}

function issueHTML(issue) {
  return `
    <div class="issue-card">
      <strong>${esc(issue.category || "Issue")}:
        ${esc(issue.issue || issue.description || "")}
      </strong>

      ${statusTag(statusOf(issue))}
      ${historyHTML(issue)}

      ${issue.closedBy
        ? `<p>Closed by: ${esc(issue.closedBy)}</p>`
        : ""}

      ${editorHTML(issue)}
    </div>
  `;
}

function reportHTML(report) {
  const related = allIssues.filter(
    issue => issue.reportId === report.id
  );

  const priority = ["Normal", "Moderate", "Critical"]
    .includes(report.priority)
    ? report.priority
    : "Normal";

  return `
    <article class="report-item ${priority.toLowerCase()}">
      <div class="report-header">
        <strong>
          ${esc(report.employeeName || "Unknown")}
          — ${esc(report.section || "")}
        </strong>
        <span class="priority-badge ${priority.toLowerCase()}">
          ${priority}
        </span>
      </div>

      <p class="report-date">
        ${esc(report.dateDisplay || fmt(reportDate(report)))}
      </p>

      <div class="report-content">
        ${esc(report.content || "")}
      </div>

      ${related.length ? `
        <div class="followup-panel">
          <h3>Issue Follow-up</h3>
          ${related.map(issueHTML).join("")}
        </div>
      ` : ""}
    </article>
  `;
}

function renderLatest() {
  const target = el("latestReportsList");
  if (!target) return;

  const sections = [...new Set(
    reports.map(report => report.section || "Other")
  )];

  target.innerHTML = sections.length
    ? sections.map(section => `
        <div class="section-block">
          <h3>${esc(section)}</h3>
          ${reports
            .filter(report => (report.section || "Other") === section)
            .slice(0, 3)
            .map(reportHTML)
            .join("")}
        </div>
      `).join("")
    : '<p class="empty-msg">No reports available.</p>';
}

function renderAll() {
  const target = el("allReportsList");

  if (target) {
    target.innerHTML = filteredReports.length
      ? filteredReports.map(reportHTML).join("")
      : '<p class="empty-msg">No reports found.</p>';
  }

  if (el("reportCount")) {
    el("reportCount").textContent =
      `(${filteredReports.length} reports)`;
  }
}

window.filterReports = function() {
  filteredReports = reports.filter(report => {
    const date = reportDate(report);

    const day = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1)
          .padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : "";

    return (
      (!val("filterStartDate") || day >= val("filterStartDate")) &&
      (!val("filterEndDate") || day <= val("filterEndDate")) &&
      (!val("filterSection") ||
        report.section === val("filterSection")) &&
      (!val("filterShift") ||
        report.shift === val("filterShift")) &&
      (!val("filterPriority") ||
        report.priority === val("filterPriority"))
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
  ].forEach(id => {
    if (el(id)) el(id).value = "";
  });

  filteredReports = [...reports];
  renderAll();
};

// TUESDAY-TO-TUESDAY MONITORING

function tuesdayRange(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;

  const [year, month, day] = value.split("-").map(Number);
  const chosen = new Date(year, month - 1, day);

  if (
    chosen.getFullYear() !== year ||
    chosen.getMonth() !== month - 1 ||
    chosen.getDate() !== day
  ) {
    return null;
  }

  const offset = (chosen.getDay() - 2 + 7) % 7;

  const start = new Date(
    year,
    month - 1,
    day - offset,
    0, 0, 0, 0
  );

  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 7,
    0, 0, 0, 0
  );

  return { start, end };
}

function setCurrentWeek() {
  const picker = el("monitoringWeek");
  if (!picker) return;

  if (picker.type !== "date") picker.type = "date";

  if (/^\d{4}-\d{2}-\d{2}$/.test(picker.value)) return;

  const today = new Date();
  const offset = (today.getDay() - 2 + 7) % 7;

  const tuesday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - offset
  );

  picker.value =
    `${tuesday.getFullYear()}-` +
    `${String(tuesday.getMonth() + 1).padStart(2, "0")}-` +
    `${String(tuesday.getDate()).padStart(2, "0")}`;
}

function hasRecordedStatus(issue) {
  return STATUSES.includes(issue.status) ||
    historyOf(issue).some(entry =>
      STATUSES.includes(entry.status) && !entry.imported
    );
}

function bootstrapLegacy(issue) {
  if (hasRecordedStatus(issue)) return false;

  const created = issueDate(issue);
  if (!created) return false;

  const launch = new Date("2026-10-12T00:00:00+03:00");
  const cutoff = new Date(
    launch.getTime() - 14 * 24 * 60 * 60 * 1000
  );

  return created >= cutoff;
}

function statusAt(issue, date) {
  const entries = historyOf(issue).filter(
    entry =>
      STATUSES.includes(entry.status) &&
      !entry.imported &&
      toDate(entry.date)
  );

  if (!entries.length) {
    const closed = toDate(issue.closedAt);
    if (closed && closed < date) return "Closed";
    return statusOf(issue);
  }

  let status = "Open";

  for (const entry of entries) {
    if (toDate(entry.date) >= date) break;
    status = entry.status;
  }

  return status;
}

function isIncluded(issue, range) {
  const created = issueDate(issue);

  if (!created || created >= range.end) return false;

  if (!hasRecordedStatus(issue) && !bootstrapLegacy(issue)) {
    return false;
  }

  if (created >= range.start) return true;

  if (statusAt(issue, range.start) !== "Closed") return true;

  return historyOf(issue).some(entry => {
    const date = toDate(entry.date);
    return date &&
      date >= range.start &&
      date < range.end &&
      entry.status !== "Closed";
  });
}

function lastActionAt(issue, cutoff) {
  return actionsOf(issue)
    .filter(action =>
      toDate(action.date) &&
      toDate(action.date) < cutoff
    )
    .sort((a, b) => toDate(a.date) - toDate(b.date))
    .at(-1);
}

function closedByAt(issue, cutoff) {
  if (statusAt(issue, cutoff) !== "Closed") return "—";

  const entry = historyOf(issue)
    .filter(item =>
      item.status === "Closed" &&
      toDate(item.date) &&
      toDate(item.date) < cutoff
    )
    .at(-1);

  return entry?.updatedBy || issue.closedBy || "—";
}

function renderMonitoring() {
  const tbody = el("monitoringTableBody");
  if (!tbody) return;

  setCurrentWeek();

  const range = tuesdayRange(val("monitoringWeek"));
  if (!range) return;

  let caption = el("tuesdayRangeLabel");

  if (!caption) {
    caption = document.createElement("p");
    caption.id = "tuesdayRangeLabel";
    caption.className = "hint";

    el("monitoringWeek")
      ?.closest("label")
      ?.insertAdjacentElement("afterend", caption);
  }

  if (caption) {
    caption.textContent =
      `Tuesday ${range.start.toLocaleDateString("en-GB")}` +
      ` → Tuesday ${range.end.toLocaleDateString("en-GB")}`;
  }

  const asOf = new Date(
    Math.min(range.end.getTime(), Date.now())
  );

  const base = allIssues.filter(issue =>
    isIncluded(issue, range) &&
    (!val("monitoringSection") ||
      issue.section === val("monitoringSection"))
  );

  const shown = base.filter(issue =>
    !val("monitoringStatus") ||
    statusAt(issue, asOf) === val("monitoringStatus")
  );

  if (el("monitoringTotal")) {
    el("monitoringTotal").textContent = base.length;
  }

  if (el("monitoringPending")) {
    el("monitoringPending").textContent = base.filter(
      issue => statusAt(issue, asOf) !== "Closed"
    ).length;
  }

  if (el("monitoringClosed")) {
    el("monitoringClosed").textContent = base.filter(
      issue => statusAt(issue, asOf) === "Closed"
    ).length;
  }

  shown.sort((a, b) =>
    (issueDate(b)?.getTime() || 0) -
    (issueDate(a)?.getTime() || 0)
  );

  tbody.innerHTML = shown.length
    ? shown.map(issue => {
        const latest = lastActionAt(issue, asOf);
        const carried = issueDate(issue) < range.start;

        return `
          <tr>
            <td>${esc(fmt(issueDate(issue)))}</td>
            <td>${esc(issue.section || "")}</td>
            <td>
              <button type="button"
                class="open-issue-details"
                data-issue-id="${esc(issue.id)}"
                style="background:none;border:0;
                text-align:left;color:#174c72;
                cursor:pointer;white-space:pre-wrap">
                ${esc(issue.category || "Issue")}:
                ${esc(issue.issue || issue.description || "")}
              </button>
              ${carried
                ? '<div class="carry-badge">Carried Forward</div>'
                : ""}
            </td>
            <td>${esc(latest?.action || "No action recorded")}</td>
            <td>${esc(latest?.name || "—")}</td>
            <td>${statusTag(statusAt(issue, asOf))}</td>
            <td>${esc(closedByAt(issue, asOf))}</td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="7">No issues found for this week.</td></tr>';
}

// ISSUE DETAILS

function openIssueDetails(id) {
  const issue = allIssues.find(item => item.id === id);
  if (!issue) return;

  let panel = el("issueDetailsPanel");

  if (!panel) {
    panel = document.createElement("div");
    panel.id = "issueDetailsPanel";
    panel.className = "card";
    el("weeklyMonitoringPage").appendChild(panel);
  }

  panel.innerHTML = `
    <button type="button" class="secondary close-issue-details">
      ← Back to Monitoring
    </button>

    <h2>Issue Details & Status History</h2>

    <p>${esc(issue.section || "")}
      — ${esc(fmt(issueDate(issue)))}</p>

    <div class="report-content">
      ${esc(issue.issue || issue.description || "")}
    </div>

    <h3>Follow-up History</h3>

    ${historyHTML(issue)}
    ${editorHTML(issue)}
  `;

  panel.style.display = "block";
  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// SAVE FOLLOW-UP

async function saveFollowup(button) {
  const editor = button.closest(".followup-editor");
  if (!editor) return;

  const id = editor.dataset.issueId;
  const issue = allIssues.find(item => item.id === id);
  if (!issue) return;

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

  if (!action && status === statusOf(issue) &&
      hasRecordedStatus(issue)) {
    message.textContent = "Enter an action or change status.";
    return;
  }

  button.disabled = true;
  message.textContent = "Saving...";

  try {
    const ref = issuesRef.doc(id);

    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);

      const current = snapshot.exists
        ? snapshot.data()
        : issue;

      const previous = statusOf(current);
      const date = new Date().toISOString();

      const actions = [...actionsOf(current)];

      if (action) {
        actions.push({ name, action, date });
      }

      const statusHistory = [
        ...historyOf(current),
        {
          date,
          status,
          previousStatus: hasRecordedStatus(current)
            ? previous
            : null,
          updatedBy: name,
          action: action || "Status updated"
        }
      ];

      const update = {
        actions,
        statusHistory,
        status,
        lastUpdatedBy: name,
        lastUpdatedAt: date,
        closedBy: status === "Closed" ? name : null,
        closedAt: status === "Closed" ? date : null
      };

      if (snapshot.exists) {
        transaction.update(ref, update);
      } else {
        transaction.set(ref, {
          ...issue,
          ...update,
          legacy: true
        });
      }
    });

    await loadData();

  } catch (error) {
    console.error(error);
    message.textContent =
      "Unable to save. Check Firestore permissions.";
    button.disabled = false;
  }
}

// EXCEL EXPORT

function exportReportsToExcel(data, filename) {
  if (!data.length) {
    alert("No reports to export.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("Excel library is unavailable.");
    return;
  }

  const rows = [[
    "Date",
    "Employee Name",
    "Badge Number",
    "Section",
    "Shift",
    "Priority",
    "Report Content",
    "Follow-up Actions",
    "Status",
    "Closed By",
    "Last Updated By"
  ]];

  data.forEach(report => {
    const related = allIssues.filter(
      issue => issue.reportId === report.id
    );

    rows.push([
      report.dateDisplay || fmt(reportDate(report)),
      report.employeeName || "",
      report.badgeNumber || "",
      report.section || "",
      report.shift || "",
      report.priority || "",
      report.content || "",
      related.map(issue =>
        `${issue.category || "Issue"}: ${issue.issue || ""}\n` +
        actionsOf(issue).map(action =>
          `${action.name}: ${action.action}`
        ).join("\n")
      ).join("\n\n"),
      related.map(statusOf).join("; "),
      related.map(issue => issue.closedBy || "")
        .filter(Boolean).join("; "),
      related.map(issue => issue.lastUpdatedBy || "")
        .filter(Boolean).join("; ")
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  sheet["!cols"] = [
    { wch: 24 }, { wch: 25 }, { wch: 16 },
    { wch: 24 }, { wch: 14 }, { wch: 14 },
    { wch: 75 }, { wch: 75 }, { wch: 25 },
    { wch: 26 }, { wch: 26 }
  ];

  const book = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    book,
    sheet,
    "Reports"
  );

  XLSX.writeFile(
    book,
    `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

window.exportFilteredToCSV = function() {
  exportReportsToExcel(
    filteredReports,
    "Filtered_Pharmacy_Reports"
  );
};

window.exportAllToCSV = function() {
  exportReportsToExcel(
    reports,
    "All_Pharmacy_Reports"
  );
};

// INITIALIZE

document.addEventListener("DOMContentLoaded", () => {
  el("reportForm")?.addEventListener(
    "submit",
    saveReport
  );

  el("addIssueBtn")?.addEventListener(
    "click",
    addIssueInput
  );

  document.addEventListener("click", event => {
    const detail = event.target.closest(".open-issue-details");

    if (detail) {
      openIssueDetails(detail.dataset.issueId);
      return;
    }

    if (event.target.closest(".close-issue-details")) {
      const panel = el("issueDetailsPanel");
      if (panel) panel.style.display = "none";
      return;
    }

    const saveButton = event.target.closest(".followup-save");

    if (saveButton) {
      saveFollowup(saveButton);
    }
  });

  [
    "monitoringWeek",
    "monitoringSection",
    "monitoringStatus"
  ].forEach(id => {
    el(id)?.addEventListener(
      "change",
      renderMonitoring
    );
  });

  setCurrentWeek();
  loadData();
});
