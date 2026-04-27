// Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBqgeFglHVOuP8-p1AIAIa3tBEonD5DPt8",
  authDomain: "pharmacyshift.firebaseapp.com",
  projectId: "pharmacyshift",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let reports = [];

// Navigation
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  if (pageId !== "homePage") loadReports();
}

// Helper
function getValue(id) {
  return document.getElementById(id).value.trim();
}

// Generate Report
function generateReport() {

  const fields = [
    "employeeName","badgeNumber","section","shift",
    "q_present","q_absence","q_previous","q_new",
    "q_actions","q_next","q_priority","q_notes","q_shortage"
  ];

  for (let f of fields) {
    if (!getValue(f)) {
      alert("Please complete all fields.");
      return;
    }
  }

  const report = `Pharmacy Shift Report

Report prepared by ${getValue("employeeName")}, Badge Number ${getValue("badgeNumber")}, for ${getValue("section")}, ${getValue("shift")} shift.

Staff present during the shift: ${getValue("q_present")}.

Attendance updates: ${getValue("q_absence")}.

Endorsed issues from the previous shift: ${getValue("q_previous")}.

New or rising issues during the shift: ${getValue("q_new")}.

Actions taken during the shift: ${getValue("q_actions")}.

Items to be endorsed to the next shift: ${getValue("q_next")}.

Priority level: ${getValue("q_priority")}.

Additional notes: ${getValue("q_notes")}.

Medication shortage status: ${getValue("q_shortage") === "Yes" ? "Shortage reported." : "No shortage reported."}.`;

  document.getElementById("reportContent").value = report;
}

// Save
document.getElementById("reportForm").addEventListener("submit", async e => {
  e.preventDefault();

  await db.collection("Shift Coordinator Reports").add({
    employeeName: getValue("employeeName"),
    badgeNumber: getValue("badgeNumber"),
    section: getValue("section"),
    shift: getValue("shift"),
    content: getValue("reportContent"),
    priority: getValue("q_priority"),
    date: new Date().toISOString()
  });

  alert("Saved");
  e.target.reset();
});

// Load
async function loadReports() {
  const snapshot = await db.collection("Shift Coordinator Reports").get();
  reports = snapshot.docs.map(d => d.data());
  displayReports();
}

// Display
function displayReports() {
  const container = document.getElementById("allReportsList");
  if (!container) return;

  container.innerHTML = reports.map(r => {
    let cls = r.priority === "Critical" ? "critical"
            : r.priority === "Moderate" ? "moderate"
            : "normal";

    return `
    <div class="report-item ${cls}">
      <strong>${r.employeeName}</strong> — ${r.section}
      <p>${r.content}</p>
    </div>`;
  }).join("");
}
