// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBqgeFglHVOuP8-p1AIAIa3tBEonD5DPt8",
  authDomain: "pharmacyshift.firebaseapp.com",
  projectId: "pharmacyshift",
  storageBucket: "pharmacyshift.firebasestorage.app",
  messagingSenderId: "628923818441",
  appId: "1:628923818441:web:88f2a3554411b7ddbe4818",
  measurementId: "G-WPJ95C048P"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let reports = [];
let filteredReports = [];

// Badge color rules
const badgeColors = {
  "78482": "badge-yellow",
  "5874336": "badge-yellow",
  "1001011": "badge-pink",
  "1004127": "badge-pink",
  "9141896": "badge-blue"
};

// Show/Hide Pages
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

// Submit Report Form
document.getElementById('reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newReport = {
    date: new Date().toISOString(),
    dateDisplay: new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    employeeName: document.getElementById('employeeName').value,
    badgeNumber: document.getElementById('badgeNumber').value,
    section: document.getElementById('section').value,
    shift: document.getElementById('shift').value,
    sendTo: document.getElementById('sendToSection').value,
    content: document.getElementById('reportContent').value
  };
  
  try {
    await db.collection("Shift Coordinator Reports").add(newReport);
    alert("✅ Report saved successfully!");
    document.getElementById('reportForm').reset();
    showPage("latestReportsPage");
    loadReports();
  } catch (error) {
    console.error("Error saving report:", error);
    alert("❌ Error saving report. Please try again.");
  }
});

// Load Reports from Firebase
async function loadReports() {
  try {
    const snapshot = await db.collection("Shift Coordinator Reports").get();
    reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort data from newest to oldest
    reports.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });
    
    filteredReports = [...reports];
    displayLatest();
    displayAll();
    updateReportCount();
  } catch (error) {
    console.error("Error loading reports:", error);
    alert("❌ Error loading reports");
  }
}

// Filter Reports
function filterReports() {
  const startDate = document.getElementById('filterStartDate').value;
  const endDate = document.getElementById('filterEndDate').value;
  const selectedSection = document.getElementById('filterSection').value;
  const selectedShift = document.getElementById('filterShift').value;
  
  filteredReports = reports.filter(report => {
    const reportDate = new Date(report.date);
    let matches = true;
    
    // Filter by start date
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (reportDate < start) matches = false;
    }
    
    // Filter by end date
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (reportDate > end) matches = false;
    }
    
    // Filter by section
    if (selectedSection && selectedSection !== '') {
      if (report.section !== selectedSection) matches = false;
    }
    
    // Filter by shift
    if (selectedShift && selectedShift !== '') {
      if (report.shift !== selectedShift) matches = false;
    }
    
    return matches;
  });
  
  displayFilteredReports();
  updateReportCount();
}

// Reset Filters
function resetFilters() {
  document.getElementById('filterStartDate').value = '';
  document.getElementById('filterEndDate').value = '';
  document.getElementById('filterSection').value = '';
  document.getElementById('filterShift').value = '';
  filteredReports = [...reports];
  displayAll();
  updateReportCount();
}

// Update Report Count
function updateReportCount() {
  const countElement = document.getElementById('reportCount');
  if (countElement) {
    countElement.textContent = `(${filteredReports.length} reports)`;
  }
}

// Display Latest 3 Reports per Section
function displayLatest() {
  const container = document.getElementById("latestReportsList");
  const sections = [...new Set(reports.map(r => r.section))];
  
  if (reports.length === 0) {
    container.innerHTML = "<p style='text-align:center;color:#64748b;padding:20px;'>No reports yet. Add your first report!</p>";
    return;
  }
  
  container.innerHTML = "";
  sections.forEach(sec => {
    const filtered = reports.filter(r => r.section === sec).slice(0, 3);
    const html = filtered.map(r => renderReport(r)).join("");
    container.innerHTML += `
      <div class="card">
        <h3 style="color:#1e40af;margin-bottom:15px;">${sec}</h3>
        ${html}
      </div>`;
  });
}

// Display All Reports
function displayAll() {
  const container = document.getElementById("allReportsList");
  
  if (filteredReports.length === 0) {
    container.innerHTML = "<p style='text-align:center;color:#64748b;padding:20px;'>No reports match your filters.</p>";
    return;
  }
  
  container.innerHTML = filteredReports.map(r => renderReport(r)).join("");
}

// Display Filtered Reports
function displayFilteredReports() {
  displayAll();
}

// Render Single Report
function renderReport(r) {
  const badgeClass = badgeColors[r.badgeNumber] || "";
  const sendInfo = r.sendTo
    ? `<p><em style="color:#047857;">📤 This report was sent from <strong>${r.section}</strong> to <strong>${r.sendTo}</strong></em></p>`
    : "";
  const greenClass = r.sendTo ? "green" : "";
  const displayDate = r.dateDisplay || r.date;
  
  return `
    <div class="report-item ${greenClass}">
      <p><strong>${r.employeeName}</strong> 
      <span class="${badgeClass}">${r.badgeNumber}</span> — ${r.section} — ${r.shift || 'N/A'}</p>
      <p style="font-size:12px;color:#64748b;">${displayDate}</p>
      <p style="margin-top:10px;white-space:pre-wrap;">${r.content}</p>
      ${sendInfo}
    </div>`;
}

// Export Filtered Reports to CSV
function exportFilteredToCSV() {
  if (filteredReports.length === 0) {
    alert("No reports to export!");
    return;
  }
  exportToCSV(filteredReports, 'filtered_reports');
}

// Export All Reports to CSV
function exportAllToCSV() {
  if (reports.length === 0) {
    alert("No reports to export!");
    return;
  }
  exportToCSV(reports, 'all_reports');
}

// CSV Export Function
function exportToCSV(data, filename) {
  // CSV Headers
  const headers = ['Date', 'Employee Name', 'Badge Number', 'Section', 'Shift', 'Send To', 'Report Content'];
  
  // Convert data to CSV rows
  const csvRows = [headers.join(',')];
  
  data.forEach(report => {
    const row = [
      `"${report.dateDisplay || report.date}"`,
      `"${report.employeeName}"`,
      `"${report.badgeNumber}"`,
      `"${report.section}"`,
      `"${report.shift || 'N/A'}"`,
      `"${report.sendTo || 'None'}"`,
      `"${(report.content || '').replace(/"/g, '""')}"` // Escape quotes
    ];
    csvRows.push(row.join(','));
  });
  
  // Create CSV content
  const csvContent = csvRows.join('\n');
  
  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  alert(`✅ Exported ${data.length} reports to CSV successfully!`);
}

// Load reports on page load
window.onload = () => {
  loadReports();
};
