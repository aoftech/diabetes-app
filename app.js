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
const clearAllDataBtn = document.getElementById('clear-all-data-btn');
const settingMorningDoseInput = document.getElementById('setting-morning-dose');
const settingEveningDoseInput = document.getElementById('setting-evening-dose');
const settingTargetInput = document.getElementById('setting-target');
const settingIsfInput = document.getElementById('setting-isf');
const settingIcrInput = document.getElementById('setting-icr');

const displayGlucose = document.getElementById('display-glucose');
const gaugeFill = document.getElementById('gauge-fill');
const gaugeNeedle = document.getElementById('gauge-needle');
const gaugeStatus = document.getElementById('gauge-status');
const tirLow = document.getElementById('tir-low');
const tirTarget = document.getElementById('tir-target');
const tirHigh = document.getElementById('tir-high');
const tirPercent = document.getElementById('tir-percent');

// Chart elements
const svgGrid = document.getElementById('svg-grid');
const svgArea = document.getElementById('svg-area');
const svgLine = document.getElementById('svg-line');
const svgDots = document.getElementById('svg-dots');
const trendSummary = document.getElementById('trend-summary');

const logList = document.getElementById('log-list');
const logCounter = document.getElementById('log-counter');
const exportCsvBtn = document.getElementById('export-csv-btn');

// ==========================================
// 2. ข้อมูลตั้งต้น (STATE) - รักษาข้อมูลเดิมปลอดภัย
// ==========================================
let rxConfig = {
  morningDose: 14,
  eveningDose: 8,
  targetGlucose: 110,
  isf: 40,
  icr: 15
};

let records = [];

function loadSettings() {
  const savedRx = localStorage.getItem('metabolic_rx_config');
  if (savedRx) {
    try { rxConfig = JSON.parse(savedRx); } catch (e) { console.error(e); }
  }
  settingMorningDoseInput.value = rxConfig.morningDose ?? '';
  settingEveningDoseInput.value = rxConfig.eveningDose ?? '';
  settingTargetInput.value = rxConfig.targetGlucose ?? 110;
  settingIsfInput.value = rxConfig.isf ?? 40;
  settingIcrInput.value = rxConfig.icr ?? 15;
}

function saveSettings() {
  rxConfig.morningDose = parseFloat(settingMorningDoseInput.value) || 0;
  rxConfig.eveningDose = parseFloat(settingEveningDoseInput.value) || 0;
  rxConfig.targetGlucose = parseFloat(settingTargetInput.value) || 110;
  rxConfig.isf = parseFloat(settingIsfInput.value) || 40;
  rxConfig.icr = parseFloat(settingIcrInput.value) || 15;

  localStorage.setItem('metabolic_rx_config', JSON.stringify(rxConfig));
  settingsPanel.classList.add('hidden');
  updateRxHintForMeal(mealTimeHidden.value);
  calculateExpectedDose();
}

// โหลดข้อมูลจริงที่มีอยู่ในเครื่องผู้ใช้ (ข้อมูลเดิมจะไม่หาย)
function loadRecords() {
  const saved = localStorage.getItem('metabolic_logs_v2');
  if (saved) {
    try { 
      records = JSON.parse(saved); 
    } catch (e) { 
      records = []; 
    }
  } else {
    records = [];
  }
}

function saveRecords() {
  localStorage.setItem('metabolic_logs_v2', JSON.stringify(records));
  renderAll();
}

// ==========================================
// 3. UI PILLS & RX AUTO-FILL
// ==========================================
function setupPills() {
  const mealPills = document.querySelectorAll('#meal-pills .pill-btn');
  mealPills.forEach(btn => {
    btn.addEventListener('click', () => {
      mealPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-val');
      mealTimeHidden.value = val;
      updateRxHintForMeal(val);
      calculateExpectedDose();
    });
  });

  const symptomPills = document.querySelectorAll('#symptom-pills .pill-btn');
  symptomPills.forEach(btn => {
    btn.addEventListener('click', () => {
      symptomPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      symptomValHidden.value = btn.getAttribute('data-val');
    });
  });
}

function updateRxHintForMeal(mealVal) {
  let rxDose = 0;
  if (mealVal === 'morning') rxDose = rxConfig.morningDose;
  else if (mealVal === 'evening') rxDose = rxConfig.eveningDose;

  if (rxDose > 0) {
    rxHintLabel.textContent = `หมอสั่ง ${rxDose} U`;
    rxHintLabel.style.display = 'inline-block';
    if (editIndexInput.value === '-1') {
      insulinInput.value = rxDose;
    }
  } else {
    rxHintLabel.textContent = `ไม่มีคำสั่งฉีด`;
    rxHintLabel.style.display = 'inline-block';
    if (editIndexInput.value === '-1') {
      insulinInput.value = '';
    }
  }
}

function calculateExpectedDose() {
  const g = parseFloat(glucoseInput.value);
  const c = parseFloat(carbsInput.value) || 0;
  
  if (isNaN(g)) {
    expectedHint.textContent = 'คาดการณ์: -';
    return;
  }

  const target = rxConfig.targetGlucose || 110;
  const isf = rxConfig.isf || 40;
  const icr = rxConfig.icr || 15;

  let correction = 0;
  if (g > target && isf > 0) {
    correction = (g - target) / isf;
  }
  
  let carbDose = 0;
  if (c > 0 && icr > 0) {
    carbDose = c / icr;
  }

  const totalExpected = Math.max(0, correction + carbDose).toFixed(1);
  expectedHint.textContent = `สูตรแพทย์คาดการณ์: ~${totalExpected} U (แก้น้ำตาล +${correction.toFixed(1)} / คาร์บ +${carbDose.toFixed(1)})`;
}

// ==========================================
// 4. เกจ, TIR และ กราฟเส้น SVG TREND
// ==========================================
function updateGauge(glucose) {
  if (!glucose || isNaN(glucose)) {
    displayGlucose.textContent = '--';
    gaugeStatus.textContent = 'พร้อมรับข้อมูล';
    gaugeStatus.className = 'gauge-status-badge status-normal';
    setGaugeRotation(0);
    return;
  }

  displayGlucose.textContent = Math.round(glucose);

  const minG = 40;
  const maxG = 300;
  const clamped = Math.min(Math.max(glucose, minG), maxG);
  const percent = (clamped - minG) / (maxG - minG);
  const angle = -90 + (percent * 180);

  setGaugeRotation(angle);

  if (glucose < 70) {
    gaugeStatus.textContent = '⚠️ น้ำตาลต่ำกว่าเกณฑ์ (ระวังวูบ)';
    gaugeStatus.className = 'gauge-status-badge status-low';
    gaugeFill.style.stroke = 'var(--status-low)';
  } else if (glucose <= 140) {
    gaugeStatus.textContent = '✅ อยู่ในเกณฑ์ปกติที่ดีเยี่ยม';
    gaugeStatus.className = 'gauge-status-badge status-normal';
    gaugeFill.style.stroke = 'var(--status-target)';
  } else if (glucose <= 180) {
    gaugeStatus.textContent = '⚡ เริ่มสูงกว่าเป้าหมาย';
    gaugeStatus.className = 'gauge-status-badge status-warning';
    gaugeFill.style.stroke = 'var(--status-warning)';
  } else {
    gaugeStatus.textContent = '🚨 น้ำตาลสูงเกินเกณฑ์มาตรฐาน';
    gaugeStatus.className = 'gauge-status-badge status-danger';
    gaugeFill.style.stroke = 'var(--status-danger)';
  }
}

function setGaugeRotation(angle) {
  gaugeNeedle.style.transform = `rotate(${angle}deg)`;
  const totalArc = 251.2;
  const progressPercent = (angle + 90) / 180;
  const offset = totalArc - (totalArc * progressPercent);
  gaugeFill.style.strokeDashoffset = offset;
}

function updateTIR() {
  if (records.length === 0) {
    tirLow.style.width = '0%';
    tirTarget.style.width = '0%';
    tirHigh.style.width = '0%';
    tirPercent.textContent = '0% ในเกณฑ์';
    return;
  }

  let lowCount = 0;
  let targetCount = 0;
  let highCount = 0;

  records.forEach(r => {
    if (r.glucose < 70) lowCount++;
    else if (r.glucose <= 140) targetCount++;
    else highCount++;
  });

  const total = records.length;
  const lowP = ((lowCount / total) * 100).toFixed(0);
  const targetP = ((targetCount / total) * 100).toFixed(0);
  const highP = ((highCount / total) * 100).toFixed(0);

  tirLow.style.width = `${lowP}%`;
  tirTarget.style.width = `${targetP}%`;
  tirHigh.style.width = `${highP}%`;
  tirPercent.textContent = `${targetP}% ในเกณฑ์ (70-140)`;
}

// วาดกราฟเส้น SVG TREND บนพื้นหลังขาว
function renderTrendChart() {
  if (!svgGrid || !svgArea || !svgLine || !svgDots) return;

  svgGrid.innerHTML = '';
  svgDots.innerHTML = '';

  if (records.length === 0) {
    svgArea.setAttribute('d', '');
    svgLine.setAttribute('d', '');
    trendSummary.textContent = 'ยังไม่มีข้อมูล';
    return;
  }

  // ดึง 10 รายการล่าสุด และเรียงจาก อดีต -> ปัจจุบัน (ซ้ายไปขวา)
  const recentRecords = records.slice(0, 10).reverse();
  trendSummary.textContent = `${recentRecords.length} รายการล่าสุด`;

  const w = 400;
  const h = 150;
  const paddingX = 35;
  const paddingTop = 25;
  const paddingBottom = 25;
  const chartH = h - paddingTop - paddingBottom;
  const chartW = w - (paddingX * 2);

  const minG = 50;
  const maxG = 250;

  const getY = (val) => {
    const clamped = Math.min(Math.max(val, minG), maxG);
    const p = (clamped - minG) / (maxG - minG);
    return (paddingTop + chartH) - (p * chartH);
  };

  // 1. วาดแถบเป้าหมายสีเขียว (Target Zone 70 - 140)
  const y140 = getY(140);
  const y70 = getY(70);
  const zoneH = Math.abs(y70 - y140);

  const targetZoneRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  targetZoneRect.setAttribute('x', '0');
  targetZoneRect.setAttribute('y', y140);
  targetZoneRect.setAttribute('width', w);
  targetZoneRect.setAttribute('height', zoneH);
  targetZoneRect.setAttribute('fill', 'rgba(34, 197, 94, 0.1)');
  svgGrid.appendChild(targetZoneRect);

  // เส้นประขอบบน 140
  const line140 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line140.setAttribute('x1', '0'); line140.setAttribute('y1', y140);
  line140.setAttribute('x2', w); line140.setAttribute('y2', y140);
  line140.setAttribute('stroke', 'rgba(22, 163, 74, 0.45)');
  line140.setAttribute('stroke-dasharray', '4 4');
  svgGrid.appendChild(line140);

  // เส้นประขอบล่าง 70
  const line70 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line70.setAttribute('x1', '0'); line70.setAttribute('y1', y70);
  line70.setAttribute('x2', w); line70.setAttribute('y2', y70);
  line70.setAttribute('stroke', 'rgba(2, 132, 199, 0.45)');
  line70.setAttribute('stroke-dasharray', '4 4');
  svgGrid.appendChild(line70);

  // 2. คำนวณพิกัดจุด (X, Y)
  const stepX = recentRecords.length > 1 ? chartW / (recentRecords.length - 1) : chartW / 2;
  const points = recentRecords.map((r, i) => {
    const x = recentRecords.length === 1 ? paddingX + (chartW / 2) : paddingX + (i * stepX);
    const y = getY(r.glucose);
    return { x, y, val: r.glucose, raw: r };
  });

  // สร้าง Path เส้นกราฟ
  let lineD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    lineD += ` L ${points[i].x} ${points[i].y}`;
  }
  svgLine.setAttribute('d', lineD);

  // สร้าง Path พื้นที่แรเงาใต้กราฟ
  const areaD = `${lineD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
  svgArea.setAttribute('d', areaD);

  // 3. วาดจุดกลมและตัวเลขค่าน้ำตาล
  points.forEach((p) => {
    let dotColor = '#16a34a';
    if (p.val < 70) dotColor = '#0284c7';
    else if (p.val > 140) dotColor = '#dc2626';

    // วงกลมจุด
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.x);
    circle.setAttribute('cy', p.y);
    circle.setAttribute('r', '4.5');
    circle.setAttribute('fill', dotColor);
    circle.setAttribute('stroke', '#ffffff');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('class', 'chart-dot');
    svgDots.appendChild(circle);

    // ตัวเลขน้ำตาลกำกับเหนือจุด (ตัวหนังสือดำ คมชัด)
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', p.x);
    text.setAttribute('y', p.y - 8);
    text.setAttribute('class', 'chart-label');
    text.textContent = p.val;
    svgDots.appendChild(text);
  });
}

// ==========================================
// 5. ไทม์ไลน์และบันทึกข้อมูล
// ==========================================
function renderTimeline() {
  logList.innerHTML = '';
  logCounter.textContent = `${records.length} รายการ`;

  if (records.length === 0) {
    logList.innerHTML = `<div style="text-align:center; padding: 24px; color: var(--text-muted); font-size: 0.9rem;">ยังไม่มีบันทึกข้อมูล ลองเริ่มบันทึกครั้งแรกด้านบนได้เลยครับ</div>`;
    return;
  }

  records.forEach((rec, idx) => {
    const card = document.createElement('div');
    card.className = 'timeline-card';

    let circleColor = 'var(--status-target)';
    if (rec.glucose < 70) circleColor = 'var(--status-low)';
    else if (rec.glucose > 140) circleColor = 'var(--status-danger)';

    const d = new Date(rec.timestamp);
    const timeStr = d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    let mealLabel = 'มื้อทั่วไป';
    if (rec.mealTime === 'morning') mealLabel = '🌅 ก่อนมื้อเช้า';
    else if (rec.mealTime === 'evening') mealLabel = '🌇 ก่อนมื้อเย็น';
    else if (rec.mealTime === 'post-meal') mealLabel = '⏱️ หลังอาหาร 2h';
    else if (rec.mealTime === 'bedtime') mealLabel = '🌙 ก่อนนอน';

    let rxDiffChip = '';
    if (rec.prescribedInsulin > 0) {
      const diff = (rec.actualInsulin || 0) - rec.prescribedInsulin;
      if (diff === 0) {
        rxDiffChip = `<span class="chip chip-rx">🟢 ตรงตามสั่ง (${rec.prescribedInsulin}U)</span>`;
      } else if (diff > 0) {
        rxDiffChip = `<span class="chip chip-diff-high">🟠 ฉีดเกินสั่ง +${diff}U</span>`;
      } else {
        rxDiffChip = `<span class="chip chip-diff-low">🔵 ฉีดน้อยกว่าสั่ง ${diff}U</span>`;
      }
    }

    card.innerHTML = `
      <div class="card-left">
        <div class="glucose-circle" style="border-color: ${circleColor}">
          <span class="val" style="color: ${circleColor}">${rec.glucose}</span>
          <span class="lbl">mg/dL</span>
        </div>
        <div class="card-info">
          <div class="info-title">${mealLabel} ${rec.actualInsulin ? `• ฉีด ${rec.actualInsulin} U` : ''}</div>
          <div class="info-time">${timeStr} • ${rec.symptom || 'ปกติ'}</div>
          <div class="info-chips">
            ${rxDiffChip}
            ${rec.carbs ? `<span class="chip">🍞 ${rec.carbs}g</span>` : ''}
            ${rec.foodNote ? `<span class="chip">💬 ${rec.foodNote}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="card-actions">
        <button class="action-mini-btn edit-btn" onclick="handleEdit(${idx})">✏️</button>
        <button class="action-mini-btn del-btn" onclick="handleDelete(${idx})">🗑️</button>
      </div>
    `;
    logList.appendChild(card);
  });
}

function renderAll() {
  renderTimeline();
  updateTIR();
  renderTrendChart();
  if (records.length > 0) {
    updateGauge(records[0].glucose);
  } else {
    updateGauge(null);
  }
}

// ==========================================
// 6. FORM HANDLERS & EXPORT CSV
// ==========================================
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const glucose = parseFloat(glucoseInput.value);
  if (isNaN(glucose)) return;

  const actualInsulin = parseFloat(insulinInput.value) || 0;
  const carbs = parseFloat(carbsInput.value) || 0;
  const foodNote = foodNoteInput.value.trim();
  const mealTime = mealTimeHidden.value;
  const symptom = symptomValHidden.value;

  let prescribedInsulin = 0;
  if (mealTime === 'morning') prescribedInsulin = rxConfig.morningDose || 0;
  else if (mealTime === 'evening') prescribedInsulin = rxConfig.eveningDose || 0;

  const editIdx = parseInt(editIndexInput.value);

  if (editIdx >= 0) {
    records[editIdx] = {
      ...records[editIdx],
      glucose,
      mealTime,
      actualInsulin,
      prescribedInsulin,
      carbs,
      symptom,
      foodNote
    };
    resetForm();
  } else {
    const newRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      glucose,
      mealTime,
      actualInsulin,
      prescribedInsulin,
      carbs,
      symptom,
      foodNote
    };
    records.unshift(newRecord);
    resetForm();
  }

  saveRecords();
});

function resetForm() {
  form.reset();
  editIndexInput.value = '-1';
  submitBtn.querySelector('.btn-text').textContent = '⚡ บันทึกจังหวะเวลานี้';
  cancelEditBtn.classList.add('hidden');
  updateRxHintForMeal(mealTimeHidden.value);
  calculateExpectedDose();
}

window.handleEdit = function(index) {
  const r = records[index];
  editIndexInput.value = index;
  glucoseInput.value = r.glucose;
  insulinInput.value = r.actualInsulin || '';
  carbsInput.value = r.carbs || '';
  foodNoteInput.value = r.foodNote || '';

  const mealPills = document.querySelectorAll('#meal-pills .pill-btn');
  mealPills.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-val') === r.mealTime);
  });
  mealTimeHidden.value = r.mealTime;

  const symptomPills = document.querySelectorAll('#symptom-pills .pill-btn');
  symptomPills.forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-val') === r.symptom);
  });
  symptomValHidden.value = r.symptom;

  submitBtn.querySelector('.btn-text').textContent = '💾 อัปเดตรายการนี้';
  cancelEditBtn.classList.remove('hidden');
  updateRxHintForMeal(r.mealTime);
  calculateExpectedDose();
  window.scrollTo({ top: 180, behavior: 'smooth' });
};

window.handleDelete = function(index) {
  if (confirm('ต้องการลบข้อมูลรายการนี้ใช่หรือไม่?')) {
    records.splice(index, 1);
    saveRecords();
  }
};

cancelEditBtn.addEventListener('click', resetForm);

glucoseInput.addEventListener('input', () => {
  const g = parseFloat(glucoseInput.value);
  if (!isNaN(g)) updateGauge(g);
  calculateExpectedDose();
});

carbsInput.addEventListener('input', calculateExpectedDose);

// Export CSV 9 Columns พร้อม BOM ป้องกันภาษาไทยเพี้ยนใน Excel
exportCsvBtn.addEventListener('click', () => {
  if (records.length === 0) {
    alert('ยังไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  const headers = [
    "วันที่", "เวลา", "ระดับน้ำตาล (mg/dL)", "ช่วงเวลา/มื้อ", 
    "ยาฉีดจริง (Unit)", "ยาตามสั่งหมอ (Unit)", "ผลต่างจากคำสั่งหมอ", 
    "คาร์โบไฮเดรต (g)", "สภาวะร่างกาย/หมายเหตุ"
  ];

  const rows = records.map(r => {
    const d = new Date(r.timestamp);
    const dateStr = d.toLocaleDateString('th-TH');
    const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    let mealLabel = 'มื้อทั่วไป';
    if (r.mealTime === 'morning') mealLabel = 'ก่อนมื้อเช้า';
    else if (r.mealTime === 'evening') mealLabel = 'ก่อนมื้อเย็น';
    else if (r.mealTime === 'post-meal') mealLabel = 'หลังอาหาร 2h';
    else if (r.mealTime === 'bedtime') mealLabel = 'ก่อนนอน';

    let diffText = 'ไม่มีคำสั่ง';
    if (r.prescribedInsulin > 0) {
      const diff = (r.actualInsulin || 0) - r.prescribedInsulin;
      diffText = diff === 0 ? 'ตรงตามสั่ง' : (diff > 0 ? `เกิน +${diff}` : `ขาด ${diff}`);
    }

    const note = [r.symptom, r.foodNote].filter(Boolean).join(' - ');

    return [
      `"${dateStr}"`, `"${timeStr}"`, r.glucose, `"${mealLabel}"`,
      r.actualInsulin || 0, r.prescribedInsulin || 0, `"${diffText}"`,
      r.carbs || 0, `"${note.replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diabetes-prescription-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Modal Settings Listeners
toggleSettingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', saveSettings);

// ล้างข้อมูลบันทึกทั้งหมด พร้อมระบบยืนยันป้องกันการกดพลาด
if (clearAllDataBtn) {
  clearAllDataBtn.addEventListener('click', () => {
    if (records.length === 0) {
      alert('ไม่มีข้อมูลประวัติให้ล้างครับ');
      return;
    }

    const confirm1 = confirm(`⚠️ คำเตือน: คุณต้องการลบประวัติบันทึกทั้งหมดจำนวน ${records.length} รายการ ใช่หรือไม่?\n(ข้อมูลที่ลบแล้วจะไม่สามารถกู้คืนได้)`);
    if (confirm1) {
      const confirm2 = confirm('ยืนยันครั้งสุดท้าย: กด "ตกลง" เพื่อล้างประวัติทั้งหมดทันที');
      if (confirm2) {
        records = [];
        saveRecords();
        settingsPanel.classList.add('hidden');
        alert('✅ ล้างข้อมูลประวัติบันทึกทั้งหมดเรียบร้อยแล้ว');
      }
    }
  });
}

// ==========================================
// 7. PWA SERVICE WORKER & INIT
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW Ready:', reg.scope))
      .catch(err => console.error('SW Error:', err));
  });
}

// Initial Boot
loadSettings();
setupPills();
loadRecords();
updateRxHintForMeal(mealTimeHidden.value);
