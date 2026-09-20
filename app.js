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