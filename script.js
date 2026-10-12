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
const reportsCollection = db.collection("Shift Coordinator Reports");

const authorizedBadges = Object.freeze({
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
});

const followupStatuses = [
  "Open",
  "Under Processing",
  "Closed"
];

let reports = [];
let filteredReports = [];

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character])
  );
}

function getReportStatus(report) {
  return followupStatuses.includes(report.followupStatus)
    ? report.followupStatus
    : "Open";
}

/* NAVIGATION */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  const selectedPage = document.getElementById(pageId);

  if (selectedPage) {
    selectedPage.classList.add("active");
  }

  if (
    pageId === "latestReportsPage" ||
    pageId === "viewReportsPage"
  ) {
    loadReports();
  }
}

/* GENERATE REPORT */

function generateReport() {
  const requiredFields = [
    "employeeName",
    "badgeNumber",
    "section",
    "shift",
    "q_present",
    "q_absence",
    "q_previous",
    "q_new",
    "q_actions",
    "q_next",
    "q_priority",
    "q_notes",
    "q_shortage"
  ];

  for (const field of requiredFields) {
    if (!getValue(field)) {
      alert("Please complete all required fields.");
      document.getElementById(field)?.focus();
      return;
    }
  }

  const reportText = `Pharmacy Shift Report

Report prepared by ${getValue("employeeName")}, Badge Number ${getValue("badgeNumber")}, for ${getValue("section")}, ${getValue("shift")} shift.

Staff present during the shift: ${getValue("q_present")}.

Attendance updates: ${getValue("q_absence")}.

Endorsed issues from the previous shift: ${getValue("q_previous")}.

New or rising issues during the shift: ${getValue("q_new")}.

Actions taken during the shift: ${getValue("q_actions")}.

Items to be endorsed to the next shift: ${getValue("q_next")}.

Priority level: ${getValue("q_priority")}.

Additional notes: ${getValue("q_notes")}.

Medication shortage status: ${
    getValue("q_shortage") === "Yes"
      ? "Shortage reported."
      : "No shortage reported."
  }`;

  document.getElementById("reportContent").value = reportText;
}

/* SAVE NEW REPORT */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reportForm");

  if (form) {
    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (!getValue("reportContent")) {
        alert("Please generate the report before saving.");
        return;
      }

      const submitButton = form.querySelector(
        'button[type="submit"]'
      );

      if (submitButton) submitButton.disabled = true;

      const now = new Date();

      const newReport = {
        date: now.toISOString(),
        dateDisplay: now.toLocaleString("en-US"),
        employeeName: getValue("employeeName"),
        badgeNumber: getValue("badgeNumber"),
        section: getValue("section"),
        shift: getValue("shift"),
        priority: getValue("q_priority"),
        content: getValue("reportContent"),

        structuredAnswers: {
          present: getValue("q_present"),
          attendanceUpdates: getValue("q_absence"),
          previousShiftIssues: getValue("q_previous"),
          newRisingIssues: getValue("q_new"),
          actionsTaken: getValue("q_actions"),
          nextShiftEndorsement: getValue("q_next"),
          priority: getValue("q_priority"),
          additionalNotes: getValue("q_notes"),
          medicationShortage: getValue("q_shortage")
        },

        followupStatus: "Open",
        followupActions: []
      };

      try {
        await reportsCollection.add(newReport);

        alert("Report saved successfully.");

        form.reset();
        showPage("latestReportsPage");

      } catch (error) {
        console.error("Report save error:", error);
        alert("Unable to save report. Check Firebase permissions.");

      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  loadReports();
});

/* LOAD REPORTS */

function sortReports(data) {
  const priorityRanks = {
    Critical: 1,
    Moderate: 2,
    Normal: 3
  };

  return [...data].sort((a, b) => {
    const priorityDifference =
      (priorityRanks[a.priority] || 4) -
      (priorityRanks[b.priority] || 4);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (
      new Date(b.date).getTime() -
      new Date(a.date).getTime()
    );
  });
}

async function loadReports() {
  try {
    const snapshot = await reportsCollection.get();

    reports = sortReports(
      snapshot.docs.map(documentSnapshot => ({
        ...documentSnapshot.data(),
        id: documentSnapshot.id
      }))
    );

    filteredReports = [...reports];

    displayLatest();
    displayAll();
    updateReportCount();

  } catch (error) {
    console.error("Firebase loading error:", error);

    const latestContainer = document.getElementById(
      "latestReportsList"
    );

    const allContainer = document.getElementById(
      "allReportsList"
    );

    if (latestContainer) {
      latestContainer.textContent =
        "Unable to load reports. Check Firebase access.";
    }

    if (allContainer) {
      allContainer.textContent =
        "Unable to load reports. Check Firebase access.";
    }
  }
}

/* REPORT DISPLAY */

function renderReport(report) {
  const priority = ["Normal", "Moderate", "Critical"]
    .includes(report.priority)
      ? report.priority
      : "Normal";

  const status = getReportStatus(report);

  const statusClass = status
    .toLowerCase()
    .replace(/\s+/g, "-");

  const actions = Array.isArray(report.followupActions)
    ? report.followupActions
    : [];

  const actionHistory = actions.length
    ? actions.map(entry => `
        <div class="action-entry">
          <strong>${escapeHTML(entry.name || "Unknown")}</strong>:
          ${escapeHTML(entry.action || "")}
          <small>${escapeHTML(entry.date || "")}</small>
        </div>
      `).join("")
    : '<p class="muted">No follow-up actions yet.</p>';

  return `
    <div
      class="report-item ${priority.toLowerCase()}"
      data-report-id="${escapeHTML(report.id)}"
    >

      <div class="report-header">
        <div>
          <strong>${escapeHTML(report.employeeName || "N/A")}</strong>
          <span>
            ${escapeHTML(report.section || "N/A")}
            â
            ${escapeHTML(report.shift || "N/A")}
          </span>
        </div>

        <span class="priority-badge ${priority.toLowerCase()}">
          ${escapeHTML(priority)}
        </span>
      </div>

      <p class="report-date">
        ${escapeHTML(report.dateDisplay || report.date || "")}
      </p>

      <p class="report-content">
        ${escapeHTML(report.content || "")}
      </p>

      <div class="followup-panel">

        <div class="followup-heading">
          <strong>Report Follow-up</strong>

          <span class="status-pill ${statusClass}">
            ${escapeHTML(status)}
          </span>
        </div>

        <div class="action-history">
          ${actionHistory}
        </div>

        ${
          status === "Closed"
            ? `
              <p class="closed-by">
                Closed by: ${escapeHTML(report.closedBy || "Unknown")}
              </p>
            `
            : ""
        }

        <div class="followup-editor">

          <label>Badge Number</label>
          <input
            type="password"
            inputmode="numeric"
            autocomplete="off"
            class="followup-badge"
            placeholder="Enter badge number"
          >

          <label>Action Taken</label>
          <textarea
            class="followup-action"
            rows="3"
            placeholder="Enter action taken..."
          ></textarea>

          <label>Report Status</label>
          <select class="followup-status">
            ${
              followupStatuses.map(item => `
                <option
                  value="${item}"
                  ${item === status ? "selected" : ""}
                >
                  ${item}
                </option>
              `).join("")
            }
          </select>

          <button
            type="button"
            class="followup-save"
          >
            Save Follow-up
          </button>

          <span
            class="followup-message"
            role="status"
          ></span>

        </div>
      </div>
    </div>
  `;
}

/* LATEST REPORTS */

function displayLatest() {
  const container = document.getElementById(
    "latestReportsList"
  );

  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML =
      '<p class="empty-msg">No reports yet.</p>';
    return;
  }

  const sections = [
    ...new Set(
      reports.map(report => report.section || "Other")
    )
  ];

  container.innerHTML = sections.map(section => {
    const sectionReports = reports
      .filter(report => (report.section || "Other") === section)
      .slice(0, 3);

    return `
      <div class="section-block">
        <h3>${escapeHTML(section)}</h3>
        ${sectionReports.map(renderReport).join("")}
      </div>
    `;
  }).join("");
}

/* ALL REPORTS */

function displayAll() {
  const container = document.getElementById(
    "allReportsList"
  );

  if (!container) return;

  container.innerHTML = filteredReports.length
    ? filteredReports.map(renderReport).join("")
    : '<p class="empty-msg">No reports found.</p>';
}

/* FILTERS */

function filterReports() {
  const startDate = getValue("filterStartDate");
  const endDate = getValue("filterEndDate");
  const selectedSection = getValue("filterSection");
  const selectedShift = getValue("filterShift");
  const selectedPriority = getValue("filterPriority");

  filteredReports = reports.filter(report => {
    const reportDate = new Date(report.date);

    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`);

      if (reportDate < start) return false;
    }

    if (endDate) {
      const end = new Date(`${endDate}T23:59:59`);

      if (reportDate > end) return false;
    }

    if (
      selectedSection &&
      report.section !== selectedSection
    ) return false;

    if (
      selectedShift &&
      report.shift !== selectedShift
    ) return false;

    if (
      selectedPriority &&
      report.priority !== selectedPriority
    ) return false;

    return true;
  });

  filteredReports = sortReports(filteredReports);

  displayAll();
  updateReportCount();
}

function resetFilters() {
  [
    "filterStartDate",
    "filterEndDate",
    "filterSection",
    "filterShift",
    "filterPriority"
  ].forEach(id => {
    const element = document.getElementById(id);

    if (element) element.value = "";
  });

  filteredReports = [...reports];

  displayAll();
  updateReportCount();
}

function updateReportCount() {
  const countElement = document.getElementById(
    "reportCount"
  );

  if (countElement) {
    countElement.textContent =
      `(${filteredReports.length} reports)`;
  }
}

/* SAVE FOLLOW-UP */

document.addEventListener("click", event => {
  const button = event.target.closest(".followup-save");

  if (button) {
    saveFollowup(button);
  }
});

async function saveFollowup(button) {
  const card = button.closest(".report-item");
  const panel = button.closest(".followup-panel");

  if (!card || !panel) return;

  const badge = panel.querySelector(
    ".followup-badge"
  ).value.trim();

  const action = panel.querySelector(
    ".followup-action"
  ).value.trim();

  const status = panel.querySelector(
    ".followup-status"
  ).value;

  const message = panel.querySelector(
    ".followup-message"
  );

  const employeeName = authorizedBadges[badge];

  if (!employeeName) {
    message.textContent = "Unauthorized badge number.";
    return;
  }

  if (!followupStatuses.includes(status)) {
    message.textContent = "Invalid report status.";
    return;
  }

  if (action.length > 3000) {
    message.textContent = "Action text is too long.";
    return;
  }

  const reportId = card.dataset.reportId;

  const currentReport = reports.find(
    report => report.id === reportId
  );

  if (!currentReport) {
    message.textContent =
      "Report not found. Refresh and try again.";
    return;
  }

  if (
    !action &&
    status === getReportStatus(currentReport)
  ) {
    message.textContent =
      "Enter an action or change the report status.";
    return;
  }

  button.disabled = true;
  message.textContent = "Saving...";

  try {
    const reportReference = reportsCollection.doc(reportId);

    await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(
        reportReference
      );

      if (!snapshot.exists) {
        throw new Error("Report not found.");
      }

      const data = snapshot.data();

      const previousStatus = getReportStatus(data);
      const now = new Date().toISOString();

      const actionHistory = Array.isArray(
        data.followupActions
      )
        ? [...data.followupActions]
        : [];

      if (action) {
        actionHistory.push({
          name: employeeName,
          action: action,
          date: now
        });
      }

      const update = {
        followupActions: actionHistory,
        followupStatus: status,
        lastUpdatedBy: employeeName,
        lastUpdatedAt: now
      };

      if (status === "Closed") {
        update.closedBy =
          previousStatus === "Closed" && data.closedBy
            ? data.closedBy
            : employeeName;

        update.closedAt =
          previousStatus === "Closed" && data.closedAt
            ? data.closedAt
            : now;
      } else {
        update.closedBy = null;
        update.closedAt = null;
      }

      transaction.update(reportReference, update);
    });

    await loadReports();

  } catch (error) {
    console.error("Follow-up save error:", error);

    message.textContent =
      "Unable to save. Check Firebase permissions.";

    button.disabled = false;
  }
}

/* EXCEL EXPORT */

function exportFilteredToCSV() {
  exportToExcel(filteredReports, "filtered_reports");
}

function exportAllToCSV() {
  exportToExcel(reports, "all_reports");
}

function exportToExcel(data, filename) {
  if (!data || data.length === 0) {
    alert("No reports to export.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("Excel library is not loaded.");
    return;
  }

  const headers = [
    "Date",
    "Employee Name",
    "Badge Number",
    "Section",
    "Shift",
    "Priority",
    "Report Content",
    "Action Taken",
    "Status",
    "Closed By",
    "Last Updated By"
  ];

  const rows = [headers];

  data.forEach(report => {
    const actions = Array.isArray(
      report.followupActions
    )
      ? report.followupActions
      : [];

    const actionText = actions.map(entry =>
      `${entry.name || "Unknown"}: ${entry.action || ""}`
    ).join("\n");

    rows.push([
      report.dateDisplay || report.date || "",
      report.employeeName || "",
      report.badgeNumber || "",
      report.section || "",
      report.shift || "",
      report.priority || "",
      report.content || "",
      actionText,
      getReportStatus(report),
      report.closedBy || "",
      report.lastUpdatedBy || ""
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 26 },
    { wch: 16 },
    { wch: 24 },
    { wch: 15 },
    { wch: 15 },
    { wch: 65 },
    { wch: 75 },
    { wch: 22 },
    { wch: 26 },
    { wch: 26 }
  ];

  const statusColors = {
    Open: "FFFCE0E0",
    "Under Processing": "FFFFF0C2",
    Closed: "FFDDF3E3"
  };

  rows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const address = XLSX.utils.encode_cell({
        r: rowIndex,
        c: columnIndex
      });

      const cell = worksheet[address];

      if (!cell) return;

      cell.s = {
        alignment: {
          vertical: "top",
          wrapText: true
        }
      };

      if (rowIndex === 0) {
        cell.s.fill = {
          fgColor: {
            rgb: "FF0F2A44"
          }
        };

        cell.s.font = {
          bold: true,
          color: {
            rgb: "FFFFFFFF"
          }
        };
      } else if (columnIndex === 8) {
        const status = getReportStatus(
          data[rowIndex - 1]
        );

        cell.s.fill = {
          fgColor: {
            rgb: statusColors[status]
          }
        };

        cell.s.font = {
          bold: true
        };
      }
    });
  });

  worksheet["!rows"] = rows.map((row, index) => ({
    hpt: index === 0
      ? 30
      : Math.min(
          180,
          Math.max(
            35,
            20 * (
              String(row[7] || "").split("\n").length + 1
            )
          )
        )
  }));

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Shift Reports"
  );

  XLSX.writeFile(
    workbook,
    `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
