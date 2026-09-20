// ==========================================
// 1. อ้างอิง ELEMENT
// ==========================================
const form = document.getElementById('glucose-form');
const glucoseInput = document.getElementById('glucose-val');
const insulinInput = document.getElementById('insulin-val');
const carbsInput = document.getElementById('carbs-val');
const foodNoteInput = document.getElementById('food-note');
const mealTimeHidden = document.getElementById('meal-time');
const symptomValHidden = document.getElementById('symptom-val');
const editIndexInput = document.getElementById('edit-index');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const expectedHint = document.getElementById('expected-hint');
const rxHintLabel = document.getElementById('rx-hint-label');

const settingsPanel = document.getElementById('settings-panel');
const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingMorningDoseInput = document.getElementById('setting-morning-dose');
const settingEveningDoseInput = document.getElementById('setting-evening-dose');
const settingTargetInput = document.getElementById('setting-target');
const settingIsfInput = document.getElementById('setting-isf');
const settingIcrInput = document.getElementById('setting-icr');

const liveGlucoseVal = document.getElementById('live-glucose-val');
const liveStatusPill = document.getElementById('live-status-pill');
const gaugeNeedle = document.getElementById('gauge-needle');
const tirPercentIn = document.getElementById('tir-percent-in');
const tirBarLow = document.getElementById('tir-bar-low');
const tirBarNormal = document.getElementById('tir-bar-normal');
const tirBarHigh = document.getElementById('tir-bar-high');
const tirValLow = document.getElementById('tir-val-low');
const tirValNorm = document.getElementById('tir-val-norm');
const tirValHigh = document.getElementById('tir-val-high');

const timelineStream = document.getElementById('log-timeline');
const exportBtn = document.getElementById('export-csv-btn');
const timeframeSelect = document.getElementById('timeframe-mode');

let chartInstance = null;

// ==========================================
// 2. จัดการข้อมูลแผนคำสั่งแพทย์
// ==========================================
function loadUserSettings() {
  const defaults = { morningDose: 0, eveningDose: 0, target: 110, isf: 0, icr: 0 };
  const settings = JSON.parse(localStorage.getItem('diabetes_settings') || JSON.stringify(defaults));
  
  if (settingMorningDoseInput) settingMorningDoseInput.value = settings.morningDose || '';
  if (settingEveningDoseInput) settingEveningDoseInput.value = settings.eveningDose || '';
  if (settingTargetInput) settingTargetInput.value = settings.target || '';
  if (settingIsfInput) settingIsfInput.value = settings.isf || '';
  if (settingIcrInput) settingIcrInput.value = settings.icr || '';

  return settings;
}

if (toggleSettingsBtn) toggleSettingsBtn.addEventListener('click', () => settingsPanel.style.display = 'block');
if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsPanel.style.display = 'none');

if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', () => {
    const morningDose = parseFloat(settingMorningDoseInput.value) || 0;
    const eveningDose = parseFloat(settingEveningDoseInput.value) || 0;
    const target = parseFloat(settingTargetInput.value) || 110;
    const isf = parseFloat(settingIsfInput.value) || 0;
    const icr = parseFloat(settingIcrInput.value) || 0;

    localStorage.setItem('diabetes_settings', JSON.stringify({
      morningDose, eveningDose, target, isf, icr
    }));

    settingsPanel.style.display = 'none';
    alert('บันทึกแผนคำสั่งแพทย์เรียบร้อย');
    syncDoctorPrescription(mealTimeHidden.value);
    updateLiveHint();
  });
}

// ==========================================
// 3. AUTO-FILL ขนาดยาตามหมอสั่ง (เช้า-เย็น)
// ==========================================
function syncDoctorPrescription(meal) {
  const settings = loadUserSettings();
  let rxDose = 0;

  if (meal.includes('ก่อนอาหารเช้า') || meal.includes('ก่อนมื้อเช้า')) {
    rxDose = settings.morningDose;
  } else if (meal.includes('ก่อนอาหารเย็น') || meal.includes('ก่อนมื้อเย็น')) {
    rxDose = settings.eveningDose;
  }

  if (rxHintLabel) {
    if (rxDose > 0) {
      rxHintLabel.innerHTML = `💉 ฉีดจริง (<span style="color:#10b981; font-weight:bold;">หมอสั่ง: ${rxDose} U</span>)`;
      insulinInput.value = rxDose;
    } else {
      rxHintLabel.textContent = '💉 ฉีดจริง (ยูนิต)';
      if (meal.includes('หลังอาหาร') || meal.includes('ก่อนนอน')) {
        insulinInput.value = '';
      }
    }
  }
}

// ==========================================
// 4. QUICK-TAP PILLS
// ==========================================
function setupPillSelector(containerId, hiddenInput) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const buttons = container.querySelectorAll('.pill-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      hiddenInput.value = btn.dataset.val;

      if (containerId === 'meal-pills') {
        syncDoctorPrescription(btn.dataset.val);
        updateLiveHint();
      }
    });
  });
}
setupPillSelector('meal-pills', mealTimeHidden);
setupPillSelector('symptom-pills', symptomValHidden);

// ==========================================
// 5. คาดการณ์สุทธิ (ISF / ICR)
// ==========================================
function calculateExpectedGlucose(glucoseVal, insulinVal, carbsVal, settings) {
  const bg = parseFloat(glucoseVal);
  if (isNaN(bg)) return null;

  const ins = parseFloat(insulinVal) || 0;
  const carbs = parseFloat(carbsVal) || 0;
  const isf = parseFloat(settings.isf) || 0;
  const icr = parseFloat(settings.icr) || 0;

  if (isf <= 0) return null;

  const drop = ins * isf;
  const rise = (icr > 0 && carbs > 0) ? (carbs / icr) * isf : 0;
  return Math.max(Math.round(bg - drop + rise), 40);
}

function updateLiveHint() {
  const settings = loadUserSettings();
  const val = glucoseInput.value;
  const ins = insulinInput.value;
  const carbs = carbsInput.value;

  const expected = calculateExpectedGlucose(val, ins, carbs, settings);
  if (expected !== null && (parseFloat(ins) > 0 || parseFloat(carbs) > 0)) {
    expectedHint.style.display = 'block';
    let text = `⚡ <strong>ผลลัพธ์คาดการณ์:</strong> ~${expected} mg/dL `;
    if (parseFloat(ins) > 0) text += `<small style="color:#16a34a;">(ยา -${Math.round(parseFloat(ins) * settings.isf)})</small> `;
    if (parseFloat(carbs) > 0 && settings.icr > 0) text += `<small style="color:#d97706;">(คาร์บ +${Math.round((parseFloat(carbs) / settings.icr) * settings.isf)})</small>`;
    expectedHint.innerHTML = text;
  } else {
    expectedHint.style.display = 'none';
  }
}

glucoseInput.addEventListener('input', updateLiveHint);
insulinInput.addEventListener('input', updateLiveHint);
carbsInput.addEventListener('input', updateLiveHint);

// ==========================================
// 6. เกจหน้าปัด & TIME-IN-RANGE
// ==========================================
function updateGauge(value) {
  if (!liveGlucoseVal || !gaugeNeedle) return;

  if (!value || isNaN(value)) {
    liveGlucoseVal.textContent = '--';
    liveStatusPill.textContent = 'รอการบันทึก';
    liveStatusPill.style.background = '#f1f5f9';
    liveStatusPill.style.color = '#64748b';
    gaugeNeedle.style.transform = 'rotate(0deg)';
    return;
  }

  liveGlucoseVal.textContent = Math.round(value);

  const minVal = 40;
  const maxVal = 240;
  const clamped = Math.min(Math.max(value, minVal), maxVal);
  const angle = ((clamped - minVal) / (maxVal - minVal)) * 180;
  gaugeNeedle.style.transform = `rotate(${angle}deg)`;

  if (value < 70) {
    liveStatusPill.textContent = 'น้ำตาลต่ำ ⚠️';
    liveStatusPill.style.background = '#e0f2fe';
    liveStatusPill.style.color = '#0284c7';
  } else if (value <= 140) {
    liveStatusPill.textContent = 'อยู่ในเกณฑ์ดีเยี่ยม 🟢';
    liveStatusPill.style.background = '#dcfce7';
    liveStatusPill.style.color = '#15803d';
  } else if (value <= 180) {
    liveStatusPill.textContent = 'ค่อนข้างสูง 🟠';
    liveStatusPill.style.background = '#fef3c7';
    liveStatusPill.style.color = '#b45309';
  } else {
    liveStatusPill.textContent = 'สูงเกินเกณฑ์ 🔴';
    liveStatusPill.style.background = '#ffe4e6';
    liveStatusPill.style.color = '#e11d48';
  }
}

function updateTIR(logs) {
  if (!tirPercentIn) return;

  if (!logs || logs.length === 0) {
    tirPercentIn.textContent = '0%';
    tirBarLow.style.width = '0%';
    tirBarNormal.style.width = '0%';
    tirBarHigh.style.width = '0%';
    tirValLow.textContent = '0%';
    tirValNorm.textContent = '0%';
    tirValHigh.textContent = '0%';
    return;
  }

  let low = 0, norm = 0, high = 0;
  logs.forEach(i => {
    const v = parseFloat(i.value);
    if (v < 70) low++;
    else if (v <= 140) norm++;
    else high++;
  });

  const total = logs.length;
  const lowP = Math.round((low / total) * 100);
  const normP = Math.round((norm / total) * 100);
  const highP = 100 - lowP - normP;

  tirPercentIn.textContent = `${normP}%`;
  tirBarLow.style.width = `${lowP}%`;
  tirBarNormal.style.width = `${normP}%`;
  tirBarHigh.style.width = `${highP}%`;

  tirValLow.textContent = `${lowP}%`;
  tirValNorm.textContent = `${normP}%`;
  tirValHigh.textContent = `${highP}%`;
}

// ==========================================
// 7. เรนเดอร์ไทม์ไลน์ชีวิต (METABOLIC JOURNEY)
// ==========================================
function loadTimeline() {
  const logs = JSON.parse(localStorage.getItem('glucose_logs') || '[]');

  if (logs.length === 0) {
    timelineStream.innerHTML = '<p style="font-size: 0.85rem; color: #94a3b8; text-align: center; padding: 20px 0;">ยังไม่มีข้อมูลจังหวะชีวิต</p>';
    updateGauge(null);
    updateTIR([]);
    return;
  }

  updateGauge(parseFloat(logs[0].value));
  updateTIR(logs);

  timelineStream.innerHTML = logs.map((item, index) => {
    const val = parseFloat(item.value);
    let dotColor = '#10b981';
    let tagColor = '#15803d';

    if (val < 70) { dotColor = '#38bdf8'; tagColor = '#0284c7'; }
    else if (val > 140) { dotColor = '#f43f5e'; tagColor = '#e11d48'; }

    return `
      <div class="timeline-node">
        <div class="timeline-dot" style="background: ${dotColor};"></div>
        <div class="timeline-content-box">
          <div class="node-header">
            <span class="node-time">🕒 ${item.date}</span>
            <span class="node-val-tag" style="color: ${tagColor};">${item.value} <small style="font-size: 0.7rem;">mg/dL</small></span>
          </div>

          <div class="node-details">
            <strong>${item.meal}</strong> ${item.foodNote ? `• ${item.foodNote}` : ''}
          </div>

          <div class="node-badges">
            ${item.symptom ? `<span class="mini-badge">🧘 ${item.symptom}</span>` : ''}
            ${item.insulin ? `<span class="mini-badge" style="background:#e0f2fe; color:#0369a1;">💉 ฉีด ${item.insulin} U</span>` : ''}
            ${item.rxBadge ? `<span class="mini-badge" style="background:#dcfce7; color:#166534; font-weight:bold;">${item.rxBadge}</span>` : ''}
            ${item.carbs ? `<span class="mini-badge" style="background:#fef3c7; color:#92400e;">🍞 ${item.carbs} g</span>` : ''}
            ${item.expectedVal ? `<span class="mini-badge" style="background:#f1f5f9;">คาด: ${item.expectedVal}</span>` : ''}
          </div>

          <div class="node-actions">
            <button type="button" class="mini-btn" onclick="startEdit(${index})">✏️ แก้ไข</button>
            <button type="button" class="mini-btn" style="color: #f43f5e;" onclick="deleteLog(${index})">🗑️ ลบ</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 8. แก้ไข / ลบ
// ==========================================
window.startEdit = function(index) {
  const logs = JSON.parse(localStorage.getItem('glucose_logs') || '[]');
  const item = logs[index];
  if (!item) return;

  glucoseInput.value = item.value;
  insulinInput.value = item.insulin || '';
  carbsInput.value = item.carbs || '';
  foodNoteInput.value = item.foodNote || '';
  editIndexInput.value = index;

  document.querySelectorAll('#meal-pills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === item.meal);
  });
  mealTimeHidden.value = item.meal;

  if (item.symptom) {
    document.querySelectorAll('#symptom-pills .pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === item.symptom);
    });
    symptomValHidden.value = item.symptom;
  }

  submitBtn.innerHTML = '<span>💾 บันทึกการแก้ไข</span>';
  cancelEditBtn.style.display = 'block';
  updateLiveHint();
  window.scrollTo({ top: 200, behavior: 'smooth' });
};

function resetForm() {
  form.reset();
  editIndexInput.value = '-1';
  submitBtn.innerHTML = '<span>⚡ บันทึกจังหวะเวลานี้</span>';
  cancelEditBtn.style.display = 'none';
  expectedHint.style.display = 'none';

  mealTimeHidden.value = 'ก่อนอาหารเช้า (ฉีดยา)';
  symptomValHidden.value = 'สดชื่นปกติ';

  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#meal-pills .pill-btn')?.classList.add('active');
  document.querySelector('#symptom-pills .pill-btn')?.classList.add('active');

  syncDoctorPrescription('ก่อนอาหารเช้า (ฉีดยา)');
}
cancelEditBtn.addEventListener('click', resetForm);

window.deleteLog = function(index) {
  if (confirm('คุณต้องการลบข้อมูลช่วงเวลานี้ใช่หรือไม่?')) {
    const logs = JSON.parse(localStorage.getItem('glucose_logs') || '[]');
    logs.splice(index, 1);
    localStorage.setItem('glucose_logs', JSON.stringify(logs));
    if (editIndexInput.value == index) resetForm();
    refreshCockpit();
  }
};

// ==========================================
// 9. กราฟแนวโน้ม (โซนเป้าหมาย 70-130)
// ==========================================
const targetZonePlugin = {
  id: 'targetZone',
  beforeDraw(chart) {
    const { ctx, chartArea: { left, right }, scales: { y } } = chart;
    if (!y) return;

    const y70 = y.getPixelForValue(70);
    const y130 = y.getPixelForValue(130);

    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
    ctx.fillRect(left, y130, right - left, y70 - y130);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);

    ctx.beginPath();
    ctx.moveTo(left, y130); ctx.lineTo(right, y130);
    ctx.moveTo(left, y70); ctx.lineTo(right, y70);
    ctx.stroke();

    ctx.restore();
  }
};

function renderChart() {
  const canvas = document.getElementById('glucoseChart');
  if (!canvas) return;

  const logs = JSON.parse(localStorage.getItem('glucose_logs') || '[]');
  const recentLogs = logs.slice(0, 8).reverse();

  const labels = recentLogs.map(i => i.date.split(' ')[0]);
  const dataPoints = recentLogs.map(i => parseFloat(i.value));

  if (chartInstance) chartInstance.destroy();

  const ctx = canvas.getContext('2d');
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: dataPoints,
        borderColor: '#0f172a',
        backgroundColor: 'rgba(15, 23, 42, 0.03)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointBackgroundColor: recentLogs.map(i => {
          const v = parseFloat(i.value);
          return v > 140 ? '#f43f5e' : (v < 70 ? '#38bdf8' : '#10b981');
        }),
        pointRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { suggestedMin: 50, suggestedMax: 220, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      },
      plugins: { legend: { display: false } }
    },
    plugins: [targetZonePlugin]
  });
}

// ==========================================
// 10. ส่งออก CSV 9 คอลัมน์สำหรับแพทย์
// ==========================================
function exportToCSV() {
  const logs = JSON.parse(localStorage.getItem('glucose_logs') || '[]');
  if (logs.length === 0) return alert('ยังไม่มีข้อมูลบันทึกสำหรับส่งออก');

  const headers = [
    'วันที่และเวลา',
    'ระดับน้ำตาล (mg/dL)',
    'ช่วงเวลาตรวจ',
    'อินซูลินฉีดจริง (U)',
    'เทียบคำสั่งแพทย์',
    'คาร์โบไฮเดรต (g)',
    'เมนูอาหาร / พฤติกรรม',
    'สภาพร่างกาย / อาการ',
    'ค่าน้ำตาลคาดการณ์ (mg/dL)'
  ];

  const rows = logs.map(i => [
    `"${i.date}"`,
    `"${i.value}"`,
    `"${i.meal}"`,
    `"${i.insulin ? i.insulin + ' U' : '-'}"`,
    `"${i.rxStatus || '-'}"`,
    `"${i.carbs ? i.carbs + ' g' : '-'}"`,
    `"${(i.foodNote || '-').replace(/"/g, '""')}"`,
    `"${i.symptom || '-'}"`,
    `"${i.expectedVal || '-'}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diabetes-prescription-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
if (exportBtn) exportBtn.addEventListener('click', exportToCSV);

// ==========================================
// 11. บันทึกข้อมูลประจำวัน
// ==========================================
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const value = glucoseInput.value;
  const meal = mealTimeHidden.value;
  const symptom = symptomValHidden.value;
  const insulin = parseFloat(insulinInput.value) || null;
  const carbs = parseFloat(carbsInput.value) || null;
  const foodNote = foodNoteInput.value.trim();
  const editIndex = parseInt(editIndexInput.value, 10);
  const logs = JSON.parse(localStorage.getItem('glucose_logs') || '[]');
  const settings = loadUserSettings();

  let prescribedDose = 0;
  if (meal.includes('ก่อนอาหารเช้า') || meal.includes('ก่อนมื้อเช้า')) {
    prescribedDose = settings.morningDose;
  } else if (meal.includes('ก่อนอาหารเย็น') || meal.includes('ก่อนมื้อเย็น')) {
    prescribedDose = settings.eveningDose;
  }

  let rxStatus = '-';
  let rxBadge = '';

  if (prescribedDose > 0 && insulin !== null) {
    const diff = insulin - prescribedDose;
    if (diff === 0) {
      rxStatus = `ตรงตามหมอสั่ง (${prescribedDose} U)`;
      rxBadge = `🟢 ตามสั่ง ${prescribedDose} U`;
    } else if (diff > 0) {
      rxStatus = `เกินหมอสั่ง +${diff} U (สั่ง ${prescribedDose} U)`;
      rxBadge = `🟠 เกินสั่ง +${diff} U`;
    } else {
      rxStatus = `น้อยกว่าหมอสั่ง ${diff} U (สั่ง ${prescribedDose} U)`;
      rxBadge = `🔵 น้อยกว่าสั่ง ${diff} U`;
    }
  }

  const expectedVal = calculateExpectedGlucose(value, insulin, carbs, settings);
  const now = new Date();
  const dateStr = now.toLocaleString('th-TH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const record = {
    value,
    meal,
    symptom,
    insulin,
    carbs,
    foodNote,
    expectedVal,
    prescribedDose,
    rxStatus,
    rxBadge,
    date: dateStr,
    timestamp: now.toISOString()
  };

  if (editIndex >= 0) {
    record.date = `${logs[editIndex].date.split(' (แก้ไข)')[0]} (แก้ไข)`;
    logs[editIndex] = record;
  } else {
    logs.unshift(record);
  }

  localStorage.setItem('glucose_logs', JSON.stringify(logs));
  resetForm();
  refreshCockpit();
});

// ==========================================
// 12. เริ่มต้นระบบ
// ==========================================
function refreshCockpit() {
  loadTimeline();
  renderChart();
}

loadUserSettings();
syncDoctorPrescription(mealTimeHidden.value);
refreshCockpit();
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Metabolic Cockpit - สมุดบันทึกเบาหวาน</title>
  <link rel="manifest" href="manifest.json">
  <link rel="stylesheet" href="style.css">
  <meta name="theme-color" content="#0f172a">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="cockpit-container">
    
    <!-- ส่วนหัว Header -->
    <header class="app-header">
      <div>
        <h1 class="logo-title">METABOLIC COCKPIT</h1>
        <p class="logo-sub">บันทึกระดับน้ำตาล & อินซูลินตามหมอสั่ง</p>
      </div>
      <div class="header-actions">
        <button type="button" id="toggle-settings-btn" class="icon-round-btn" title="ตั้งค่าสูตรแพทย์">⚙️</button>
        <button type="button" id="export-csv-btn" class="icon-round-btn" title="ส่งออก CSV">📥</button>
      </div>
    </header>

    <!-- แผงตั้งค่ายาตามคำสั่งแพทย์ (เปิด/ปิดได้) -->
    <section id="settings-panel" class="settings-modal" style="display: none;">
      <div class="settings-header">
        <h3>📋 แผนการรักษาและยาตามคำสั่งแพทย์</h3>
        <button type="button" id="close-settings-btn" class="close-btn">&times;</button>
      </div>
      
      <div class="settings-box-inner">
        <span class="settings-label-highlight">ขนาดยาอินซูลินที่หมอสั่งประจำวัน</span>
        <div class="settings-grid" style="grid-template-columns: 1fr 1fr; margin-top: 8px;">
          <div>
            <label>🌅 ยาเช้าตามสั่ง (ยูนิต)</label>
            <input type="number" id="setting-morning-dose" placeholder="เช่น 14" step="0.5">
          </div>
          <div>
            <label>🌇 ยาเย็นตามสั่ง (ยูนิต)</label>
            <input type="number" id="setting-evening-dose" placeholder="เช่น 8" step="0.5">
          </div>
        </div>
      </div>

      <div class="settings-grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 10px;">
        <div>
          <label>เป้าหมาย (mg/dL)</label>
          <input type="number" id="setting-target" placeholder="เช่น 110">
        </div>
        <div>
          <label>ISF (1 U ลด)</label>
          <input type="number" id="setting-isf" placeholder="เช่น 40">
        </div>
        <div>
          <label>ICR (1 U คุมคาร์บ)</label>
          <input type="number" id="setting-icr" placeholder="เช่น 15">
        </div>
      </div>
      
      <button type="button" id="save-settings-btn" class="btn-dark" style="margin-top: 12px;">💾 บันทึกแผนคำสั่งแพทย์</button>
    </section>

    <!-- 1. เกจหน้าปัดกึ่งวงกลม (Metabolic Semi-Gauge) -->
    <section class="gauge-hero-card">
      <div class="gauge-wrapper">
        <svg viewBox="0 0 200 110" class="gauge-svg">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e2e8f0" stroke-width="16" stroke-linecap="round"/>
          <path d="M 20 100 A 80 80 0 0 1 50 48" fill="none" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/>
          <path d="M 54 44 A 80 80 0 0 1 146 44" fill="none" stroke="#10b981" stroke-width="16"/>
          <path d="M 150 48 A 80 80 0 0 1 180 100" fill="none" stroke="#f43f5e" stroke-width="16" stroke-linecap="round"/>
          <line id="gauge-needle" x1="100" y1="100" x2="30" y2="100" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>
          <circle cx="100" cy="100" r="7" fill="#0f172a"/>
        </svg>
        
        <div class="gauge-readout">
          <span class="readout-label">ระดับล่าสุด</span>
          <div class="readout-value-row">
            <span id="live-glucose-val">--</span>
            <small>mg/dL</small>
          </div>
          <span id="live-status-pill" class="status-pill">รอการบันทึก</span>
        </div>
      </div>

      <!-- แถบ Time-in-Range (TIR) -->
      <div class="tir-section">
        <div class="tir-title-row">
          <span>สัดส่วนในเกณฑ์ (Time-in-Range)</span>
          <strong id="tir-percent-in">0%</strong>
        </div>
        <div class="tir-bar-container">
          <div id="tir-bar-low" class="tir-segment tir-low" style="width: 0%;"></div>
          <div id="tir-bar-normal" class="tir-segment tir-normal" style="width: 0%;"></div>
          <div id="tir-bar-high" class="tir-segment tir-high" style="width: 0%;"></div>
        </div>
        <div class="tir-legend">
          <span><i class="dot dot-low"></i> ต่ำ (&lt;70): <b id="tir-val-low">0%</b></span>
          <span><i class="dot dot-norm"></i> ปกติ (70-140): <b id="tir-val-norm">0%</b></span>
          <span><i class="dot dot-high"></i> สูง (&gt;140): <b id="tir-val-high">0%</b></span>
        </div>
      </div>
    </section>

    <!-- 2. ฟอร์มบันทึก Cockpit -->
    <section class="cockpit-card">
      <form id="glucose-form">
        <input type="hidden" id="edit-index" value="-1">

        <div class="dial-inputs">
          <div class="input-glow-card">
            <span class="input-hint">🩸 ระดับน้ำตาล</span>
            <input type="number" id="glucose-val" placeholder="0" required inputmode="numeric">
          </div>
          <div class="input-glow-card">
            <span class="input-hint" id="rx-hint-label">💉 ฉีดจริง (หมอสั่ง: -)</span>
            <input type="number" id="insulin-val" placeholder="0" step="0.5" inputmode="decimal">
          </div>
          <div class="input-glow-card">
            <span class="input-hint">🍞 คาร์บ (g)</span>
            <input type="number" id="carbs-val" placeholder="0" step="1" inputmode="numeric">
          </div>
        </div>

        <!-- Quick-Tap Pills: มื้ออาหาร เช้า-เย็น -->
        <div class="pill-group-container">
          <label class="group-label">ช่วงเวลาจังหวะชีวิต:</label>
          <div class="pill-selector" id="meal-pills">
            <button type="button" class="pill-btn active" data-val="ก่อนอาหารเช้า (ฉีดยา)">🌅 ก่อนมื้อเช้า (ฉีดยา)</button>
            <button type="button" class="pill-btn" data-val="หลังอาหารเช้า 2h">⏱️ หลังมื้อเช้า 2h</button>
            <button type="button" class="pill-btn" data-val="ก่อนอาหารเย็น (ฉีดยา)">🌇 ก่อนมื้อเย็น (ฉีดยา)</button>
            <button type="button" class="pill-btn" data-val="หลังอาหารเย็น 2h">⏱️ หลังมื้อเย็น 2h</button>
            <button type="button" class="pill-btn" data-val="ก่อนนอน">🌙 ก่อนนอน</button>
          </div>
          <input type="hidden" id="meal-time" value="ก่อนอาหารเช้า (ฉีดยา)">
        </div>

        <!-- Quick-Tap Pills: อาการทางกาย -->
        <div class="pill-group-container">
          <label class="group-label">ความรู้สึก / อาการทางกาย:</label>
          <div class="pill-selector" id="symptom-pills">
            <button type="button" class="pill-btn active" data-val="สดชื่นปกติ">🟢 สดชื่นปกติ</button>
            <button type="button" class="pill-btn" data-val="หิวสั่น/เหงื่อแตก">⚡ หิวสั่น</button>
            <button type="button" class="pill-btn" data-val="วิงเวียน/มึนหัว">🌀 วิงเวียน</button>
            <button type="button" class="pill-btn" data-val="อ่อนเพลีย/ง่วง">💤 อ่อนเพลีย</button>
          </div>
          <input type="hidden" id="symptom-val" value="สดชื่นปกติ">
        </div>

        <input type="text" id="food-note" class="minimal-text-input" placeholder="✍️ บันทึกอาหาร หรือพฤติกรรม (เช่น ข้าวผัดกะเพรา, เดิน 20 นาที)">

        <!-- ข้อความคาดการณ์สด -->
        <div id="expected-hint" class="expected-hud" style="display: none;"></div>

        <button type="submit" id="submit-btn" class="cockpit-action-btn">
          <span>⚡ บันทึกจังหวะเวลานี้</span>
        </button>
        <button type="button" id="cancel-edit-btn" class="btn-cancel" style="display: none;">ยกเลิกการแก้ไข</button>
      </form>
    </section>

    <!-- 3. ไทม์ไลน์ชีวิต (Metabolic Journey) -->
    <section class="timeline-section">
      <div class="section-title-row">
        <h3>📅 เส้นทางจังหวะชีวิต (Metabolic Journey)</h3>
        <select id="timeframe-mode" class="time-filter-mini">
          <option value="all">ทั้งหมด</option>
          <option value="month">เดือนนี้</option>
          <option value="year">ปีนี้</option>
        </select>
      </div>

      <div class="timeline-stream" id="log-timeline"></div>
    </section>

    <!-- กราฟ Pocket Chart -->
    <section class="chart-pocket">
      <h4>📈 แนวโน้มต่อเนื่อง (โซนปกติ 70-130)</h4>
      <div style="height: 180px; width: 100%;">
        <canvas id="glucoseChart"></canvas>
      </div>
    </section>

    <!-- Disclaimer ทางการแพทย์ -->
    <footer class="safety-footnote">
      ⚠️ ตัวเลขและการคาดการณ์มีไว้เพื่อเป็นสมุดสังเกตส่วนบุคคลเท่านั้น ห้ามปรับเปลี่ยนขนาดยาอินซูลินเองโดยไม่ได้รับคำแนะนำจากแพทย์ประจำตัว
    </footer>

  </div>

  <script src="app.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js');
    }
  </script>
</body>
</html>
{
  "name": "สมุดบันทึกเบาหวาน",
  "short_name": "เบาหวาน",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "icons": [
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
:root {
  --bg-space: #f8fafc;
  --panel-bg: #ffffff;
  --text-dark: #0f172a;
  --text-muted: #64748b;
  --accent-blue: #0284c7;
  --normal-green: #10b981;
  --alert-orange: #f59e0b;
  --danger-rose: #f43f5e;
  --card-border: #e2e8f0;
  --radius-xl: 24px;
  --radius-md: 12px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Prompt", sans-serif;
  background-color: var(--bg-space);
  color: var(--text-dark);
  display: flex;
  justify-content: center;
  padding: 12px;
}

.cockpit-container {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 40px;
}

/* Header */
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px;
}
.logo-title {
  font-size: 1.25rem;
  font-weight: 900;
  letter-spacing: 1.5px;
  color: var(--text-dark);
}
.logo-sub {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.header-actions {
  display: flex;
  gap: 8px;
}
.icon-round-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: var(--panel-bg);
  border: 1px solid var(--card-border);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}

/* Settings Modal */
.settings-modal {
  background: #1e293b;
  color: #fff;
  padding: 16px;
  border-radius: var(--radius-md);
}
.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.settings-box-inner {
  background: #0f172a;
  padding: 12px;
  border-radius: 10px;
}
.settings-label-highlight {
  font-size: 0.8rem;
  color: #38bdf8;
  font-weight: bold;
}
.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.4rem;
  cursor: pointer;
}
.settings-grid {
  display: grid;
  gap: 8px;
}
.settings-grid label {
  font-size: 0.7rem;
  color: #94a3b8;
}
.settings-grid input {
  width: 100%;
  height: 38px;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 8px;
  color: #fff;
  padding: 0 8px;
  font-size: 0.9rem;
  margin-top: 4px;
}
.btn-dark {
  width: 100%;
  height: 40px;
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

/* 1. Gauge Card */
.gauge-hero-card {
  background: var(--panel-bg);
  border-radius: var(--radius-xl);
  padding: 20px 16px 16px;
  border: 1px solid var(--card-border);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
}
.gauge-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gauge-svg {
  width: 240px;
  height: 130px;
}
#gauge-needle {
  transform-origin: 100px 100px;
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.gauge-readout {
  position: absolute;
  bottom: 0px;
  text-align: center;
}
.readout-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
}
.readout-value-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}
#live-glucose-val {
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--text-dark);
  line-height: 1;
}
.readout-value-row small {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-weight: 600;
}
.status-pill {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 20px;
  background: #f1f5f9;
  color: var(--text-muted);
  margin-top: 4px;
}

/* TIR Section */
.tir-section {
  margin-top: 20px;
  border-top: 1px dashed var(--card-border);
  padding-top: 14px;
}
.tir-title-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: var(--text-muted);
  margin-bottom: 6px;
}
.tir-bar-container {
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  display: flex;
  overflow: hidden;
  gap: 2px;
}
.tir-segment {
  height: 100%;
  transition: width 0.4s ease;
}
.tir-low { background: #38bdf8; }
.tir-normal { background: var(--normal-green); }
.tir-high { background: var(--danger-rose); }
.tir-legend {
  display: flex;
  justify-content: space-between;
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 8px;
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 2px;
}
.dot-low { background: #38bdf8; }
.dot-norm { background: var(--normal-green); }
.dot-high { background: var(--danger-rose); }

/* 2. Cockpit Card */
.cockpit-card {
  background: var(--panel-bg);
  border-radius: var(--radius-xl);
  padding: 18px;
  border: 1px solid var(--card-border);
}
.dial-inputs {
  display: grid;
  grid-template-columns: 1.2fr 1.1fr 0.9fr;
  gap: 8px;
}
.input-glow-card {
  background: #f8fafc;
  border: 1.5px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 8px;
  display: flex;
  flex-direction: column;
}
.input-hint {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.input-glow-card input {
  border: none;
  background: transparent;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text-dark);
  outline: none;
  width: 100%;
  margin-top: 2px;
}

/* Pill Selector */
.pill-group-container {
  margin-top: 12px;
}
.group-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
}
.pill-selector {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.pill-btn {
  white-space: nowrap;
  padding: 8px 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 24px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;
}
.pill-btn.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);
}

.minimal-text-input {
  width: 100%;
  height: 44px;
  border: 1.5px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 0 12px;
  font-size: 0.9rem;
  margin-top: 12px;
  outline: none;
}
.minimal-text-input:focus {
  border-color: #0f172a;
}

.expected-hud {
  margin-top: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: var(--radius-md);
  padding: 10px;
  font-size: 0.82rem;
  color: #166534;
}

.cockpit-action-btn {
  width: 100%;
  height: 52px;
  margin-top: 14px;
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md);
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);
}
.btn-cancel {
  width: 100%;
  height: 40px;
  background: #94a3b8;
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  margin-top: 8px;
  font-weight: 600;
}

/* 3. Timeline */
.timeline-section {
  background: var(--panel-bg);
  border-radius: var(--radius-xl);
  padding: 18px;
  border: 1px solid var(--card-border);
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.section-title-row h3 {
  font-size: 0.95rem;
  color: var(--text-dark);
}
.time-filter-mini {
  padding: 4px 8px;
  font-size: 0.8rem;
  border-radius: 6px;
  border: 1px solid var(--card-border);
}

.timeline-stream {
  position: relative;
  padding-left: 24px;
}
.timeline-stream::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 10px;
  bottom: 10px;
  width: 2px;
  background: #e2e8f0;
}
.timeline-node {
  position: relative;
  margin-bottom: 16px;
}
.timeline-dot {
  position: absolute;
  left: -20px;
  top: 4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #cbd5e1;
  border: 2px solid #fff;
}
.timeline-content-box {
  background: #f8fafc;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
}
.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.node-time {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.node-val-tag {
  font-size: 1.1rem;
  font-weight: 900;
}
.node-details {
  font-size: 0.82rem;
  color: #334155;
  margin-top: 4px;
}
.node-badges {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.mini-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 6px;
  background: #e2e8f0;
  color: #475569;
}
.node-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.mini-btn {
  background: none;
  border: none;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-muted);
}

/* Pocket Chart */
.chart-pocket {
  background: var(--panel-bg);
  border-radius: var(--radius-xl);
  padding: 16px;
  border: 1px solid var(--card-border);
}
.chart-pocket h4 {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.safety-footnote {
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-muted);
  line-height: 1.4;
  padding: 0 10px;
}
const CACHE_NAME = 'glucose-app-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
