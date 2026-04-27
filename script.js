const firebaseConfig = {
  apiKey: "AIzaSyBqgeFglHVOuP8-p1AIAIa3tBEonD5DPt8",
  authDomain: "pharmacyshift.firebaseapp.com",
  projectId: "pharmacyshift",
  storageBucket: "pharmacyshift.firebasestorage.app",
  messagingSenderId: "628923818441",
  appId: "1:628923818441:web:88f2a3554411b7ddbe4818",
  measurementId: "G-WPJ95C048P"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let reports = [];
let filteredReports = [];

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));

  const page = document.getElementById(pageId);
  if (page) page.classList.add("active");

  if (pageId === "latestReportsPage" || pageId === "viewReportsPage") {
    loadReports();
  }
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

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
      alert("Please complete all fields before generating the report.");
      return;
    }
  }

  const employeeName = getValue("employeeName");
  const badgeNumber = getValue("badgeNumber");
  const section = getValue("section");
  const shift = getValue("shift");
  const present = getValue("q_present");
  const absence = getValue("q_absence");
  const previous = getValue("q_previous");
  const newIssues = getValue("q_new");
  const actions = getValue("q_actions");
  const next = getValue("q_next");
  const priority = getValue("q_priority");
  const notes = getValue("q_notes");
  const shortage = getValue("q_shortage");

  const shortageText = shortage === "Yes"
    ? "Shortage reported."
    : "No shortage reported.";

  const report = `Pharmacy Shift Report

Report prepared by ${employeeName}, Badge Number ${badgeNumber}, for ${section}, ${shift} shift.

Staff present during the shift: ${present}.

Attendance updates: ${absence}.

Endorsed issues from the previous shift: ${previous}.

New or rising issues during the shift: ${newIssues}.

Actions taken during the shift: ${actions}.

Items to be endorsed to the next shift: ${next}.

Priority level: ${priority}.

Additional notes: ${notes}.

Medication shortage status: ${shortageText}`;

  document.getElementById("reportContent").value = report;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reportForm");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const reportContent = getValue("reportContent");

      if (!reportContent) {
        alert("Please generate the report before saving.");
        return;
      }

      const newReport = {
        date: new Date().toISOString(),
        dateDisplay: new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }),
        employeeName: getValue("employeeName"),
        badgeNumber: getValue("badgeNumber"),
        section: getValue("section"),
        shift: getValue("shift"),
        priority: getValue("q_priority"),
        content: reportContent,
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
        }
      };

      try {
        await db.collection("Shift Coordinator Reports").add(newReport);
        alert("Report saved successfully.");
        form.reset();
        document.getElementById("reportContent").value = "";
        showPage("latestReportsPage");
        loadReports();
      } catch (error) {
        console.error("Error saving report:", error);
        alert("Error saving report. Please try again.");
      }
    });
  }

  loadReports();
});

function sortReports(data) {
  const priorityRank = {
    Critical: 1,
    Moderate: 2,
    Normal: 3
  };

  return data.sort((a, b) => {
    const rankA = priorityRank[a.priority] || 4;
    const rankB = priorityRank[b.priority] || 4;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return new Date(b.date) - new Date(a.date);
  });
}

async function loadReports() {
  try {
    const snapshot = await db.collection("Shift Coordinator Reports").get();

    reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    reports = sortReports(reports);
    filteredReports = [...reports];

    displayLatest();
    displayAll();
    updateReportCount();
  } catch (error) {
    console.error("Error loading reports:", error);
  }
}

function displayLatest() {
  const container = document.getElementById("latestReportsList");
  if (!container) return;

  if (reports.length === 0) {
    container.innerHTML = "<p class='empty-msg'>No reports yet.</p>";
    return;
  }

  const sections = [...new Set(reports.map(r => r.section || "Unspecified Section"))];

  container.innerHTML = "";

  sections.forEach(section => {
    const latest = reports
      .filter(r => (r.section || "Unspecified Section") === section)
      .slice(0, 3);

    container.innerHTML += `
      <div class="section-block">
        <h3>${section}</h3>
        ${latest.map(r => renderReport(r)).join("")}
      </div>
    `;
  });
}

function displayAll() {
  const container = document.getElementById("allReportsList");
  if (!container) return;

  if (filteredReports.length === 0) {
    container.innerHTML = "<p class='empty-msg'>No reports found.</p>";
    return;
  }

  container.innerHTML = filteredReports.map(r => renderReport(r)).join("");
}

function renderReport(r) {
  const priority = r.priority || "Normal";
  const priorityClass = priority === "Critical"
    ? "critical"
    : priority === "Moderate"
      ? "moderate"
      : "normal";

  return `
    <div class="report-item ${priorityClass}">
      <div class="report-header">
        <div>
          <strong>${r.employeeName || "N/A"}</strong>
          <span>— ${r.section || "N/A"} — ${r.shift || "N/A"}</span>
        </div>
        <span class="priority-badge ${priorityClass}">${priority}</span>
      </div>
      <p class="report-date">${r.dateDisplay || r.date || ""}</p>
      <p class="report-content">${r.content || ""}</p>
    </div>
  `;
}

function filterReports() {
  const startDate = getValue("filterStartDate");
  const endDate = getValue("filterEndDate");
  const selectedSection = getValue("filterSection");
  const selectedShift = getValue("filterShift");
  const selectedPriority = getValue("filterPriority");

  filteredReports = reports.filter(report => {
    const reportDate = new Date(report.date);
    let match = true;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (reportDate < start) match = false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (reportDate > end) match = false;
    }

    if (selectedSection && report.section !== selectedSection) match = false;
    if (selectedShift && report.shift !== selectedShift) match = false;
    if (selectedPriority && report.priority !== selectedPriority) match = false;

    return match;
  });

  filteredReports = sortReports(filteredReports);
  displayAll();
  updateReportCount();
}

function resetFilters() {
  const ids = [
    "filterStartDate",
    "filterEndDate",
    "filterSection",
    "filterShift",
    "filterPriority"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  filteredReports = [...reports];
  displayAll();
  updateReportCount();
}

function updateReportCount() {
  const countElement = document.getElementById("reportCount");
  if (countElement) {
    countElement.textContent = `(${filteredReports.length} reports)`;
  }
}

function exportFilteredToCSV() {
  exportToCSV(filteredReports, "filtered_reports");
}

function exportAllToCSV() {
  exportToCSV(reports, "all_reports");
}

function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    alert("No reports to export.");
    return;
  }

  const headers = [
    "Date",
    "Employee Name",
    "Badge Number",
    "Section",
    "Shift",
    "Priority",
    "Report Content"
  ];

  const rows = [headers.join(",")];

  data.forEach(report => {
    rows.push([
      `"${report.dateDisplay || report.date || ""}"`,
      `"${report.employeeName || ""}"`,
      `"${report.badgeNumber || ""}"`,
      `"${report.section || ""}"`,
      `"${report.shift || ""}"`,
      `"${report.priority || ""}"`,
      `"${(report.content || "").replace(/"/g, '""')}"`
    ].join(","));
  });

  const csvContent = rows.join("\n");
  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;"
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
