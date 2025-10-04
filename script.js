// Firebase
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

// Badge rules
const badgeColors = {
  "78482": "badge-yellow",
  "5874336": "badge-yellow",
  "1001011": "badge-pink",
  "1004127": "badge-pink",
  "9141896": "badge-blue"
};

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

document.getElementById('reportForm').addEventListener('submit', async e => {
  e.preventDefault();
  const newReport = {
    date: new Date().toLocaleString(),
    employeeName: document.getElementById('employeeName').value,
    badgeNumber: document.getElementById('badgeNumber').value,
    section: document.getElementById('section').value,
    shift: document.getElementById('shift').value,
    sendTo: document.getElementById('sendToSection').value,
    content: document.getElementById('reportContent').value
  };
  await db.collection("reports").add(newReport);
  localStorage.setItem("reportsBackup", JSON.stringify([...reports, newReport]));
  alert("✅ Report saved successfully!");
  showPage("latestReportsPage");
  loadReports();
});

async function loadReports() {
  const snapshot = await db.collection("reports").get();
  reports = snapshot.docs.map(doc => doc.data());
  displayLatest();
  displayAll();
}

function displayLatest() {
  const container = document.getElementById("latestReportsList");
  const sections = [...new Set(reports.map(r => r.section))];
  container.innerHTML = "";
  sections.forEach(sec => {
    const filtered = reports.filter(r => r.section === sec).slice(-3);
    const html = filtered.map(r => renderReport(r)).join("");
    container.innerHTML += `<div class="card"><h3>${sec}</h3>${html}</div>`;
  });
}

function displayAll() {
  document.getElementById("allReportsList").innerHTML =
    reports.map(r => renderReport(r)).join("");
}

function renderReport(r) {
  const badgeClass = badgeColors[r.badgeNumber] || "";
  const sendInfo = r.sendTo
    ? `<p><em style="color:#047857;">This report was sent from ${r.section} to ${r.sendTo}</em></p>`
    : "";
  const greenClass = r.sendTo ? "green" : "";
  return `
    <div class="report-item ${greenClass}">
      <p><strong>${r.employeeName}</strong> 
      <span class="${badgeClass}">${r.badgeNumber}</span> — ${r.section}</p>
      <p>${r.content}</p>
      ${sendInfo}
    </div>`;
}

window.onload = loadReports;
