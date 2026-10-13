// ============================================
//  СМЕНА — график 3/3 + редактирование
//  Даниил: старт 11.10.2025
//  Юра: старт 14.10.2025
//  Смена: 13:00 → 01:00
// ============================================

const SHIFT_CONFIG = {
  daniil: {
    name: 'Даниил',
    startDate: '2026-10-11',
    timeFrom: '13:00',
    timeTo: '01:00'
  },
  yura: {
    name: 'Юра',
    startDate: '2026-10-14',
    timeFrom: '13:00',
    timeTo: '01:00'
  }
};

const CYCLE = 6;
const WORK_DAYS = 3;

let currentShiftPerson = 'daniil';
let shiftSelectedDate = null;
let currentCalendarMonth = null;

// Список ручных правок из Supabase: [{person, date, status}]
let shiftOverrides = [];
let shiftSyncTimer = null;

// ============================================
//  ЛОГИКА ГРАФИКА
// ============================================

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((b0 - a0) / MS);
}

// Проверяет: есть ли ручная правка для (person, date)
function getOverride(person, date) {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return shiftOverrides.find(o => o.person === person && o.date === key) || null;
}

// Итоговый статус дня — ручная правка перебивает график
function isWorkDay(personKey, date) {
  const override = getOverride(personKey, date);
  if (override) return override.status === 'work';

  const cfg = SHIFT_CONFIG[personKey];
  if (!cfg) return false;
  const start = parseDate(cfg.startDate);
  const diff = daysBetween(start, date);
  if (diff < 0) return false;
  const posInCycle = ((diff % CYCLE) + CYCLE) % CYCLE;
  return posInCycle < WORK_DAYS;
}

// Помечен ли день как «ручная правка»
function hasOverride(personKey, date) {
  return !!getOverride(personKey, date);
}

function dayInCycle(personKey, date) {
  const cfg = SHIFT_CONFIG[personKey];
  if (!cfg) return 0;
  const start = parseDate(cfg.startDate);
  const diff = daysBetween(start, date);
  if (diff < 0) return 0;
  return (((diff % CYCLE) + CYCLE) % CYCLE) + 1;
}

function daysLeftInBlock(personKey, date) {
  const inCycle = dayInCycle(personKey, date);
  if (inCycle === 0) return 0;
  if (inCycle <= WORK_DAYS) return WORK_DAYS - inCycle + 1;
  return CYCLE - inCycle + 1;
}

// ============================================
//  ФОРМАТИРОВАНИЕ
// ============================================

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_RU_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatLongDate(date) {
  const wd = WEEKDAYS_RU[date.getDay()];
  const day = date.getDate();
  const month = MONTHS_RU[date.getMonth()];
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${day} ${month}`;
}

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ============================================
//  ПРАВА
// ============================================

function canEditShift() {
  const me = getCurrentUser();
  if (!me) return false;
  return me.name === 'Даниил';
}

// ============================================
//  ОТРИСОВКА
// ============================================

function renderShift() {
  const root = document.getElementById('shift-root');
  if (!root) return;

  const me = getCurrentUser();
  let defaultPerson = 'daniil';
  if (me && me.name === 'Юра') defaultPerson = 'yura';
  if (!['daniil', 'yura'].includes(currentShiftPerson)) {
    currentShiftPerson = defaultPerson;
  }
  if (!shiftSelectedDate) shiftSelectedDate = today();
  if (!currentCalendarMonth) {
    const t = today();
    currentCalendarMonth = { year: t.getFullYear(), month: t.getMonth() };
  }

  const cfg = SHIFT_CONFIG[currentShiftPerson];

  root.innerHTML = `
    <h1 class="section-title">Смена</h1>
    <p class="section-sub">График 3 через 3</p>

    <div class="shift-tabs">
      <button class="shift-tab ${currentShiftPerson === 'daniil' ? 'active' : ''}" data-person="daniil">Даниил</button>
      <button class="shift-tab ${currentShiftPerson === 'yura' ? 'active' : ''}" data-person="yura">Юра</button>
    </div>

    ${renderTodayCard(cfg)}
    ${renderCalendar(cfg)}
    ${renderSelectedDayInfo(cfg)}
  `;

  root.querySelectorAll('.shift-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentShiftPerson = tab.dataset.person;
      shiftSelectedDate = today();
      renderShift();
    });
  });

  const prevBtn = root.querySelector('.calendar-prev');
  const nextBtn = root.querySelector('.calendar-next');
  if (prevBtn) prevBtn.addEventListener('click', () => shiftMonth(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => shiftMonth(+1));

  root.querySelectorAll('.cal-day').forEach(cell => {
    if (cell.classList.contains('empty')) return;
    cell.addEventListener('click', () => {
      const y = parseInt(cell.dataset.y, 10);
      const m = parseInt(cell.dataset.m, 10);
      const d = parseInt(cell.dataset.d, 10);
      const date = new Date(y, m, d);
      shiftSelectedDate = date;

      // Если можно редактировать — открываем модалку
      if (canEditShift()) {
        openShiftEditModal(date);
      } else {
        renderShift();
      }
    });
  });
}

function renderTodayCard(cfg) {
  const t = today();
  const isWork = isWorkDay(currentShiftPerson, t);
  const left = daysLeftInBlock(currentShiftPerson, t);
  const over = hasOverride(currentShiftPerson, t);

  const emoji = isWork ? '🟢' : '⚪';
  const label = isWork ? 'РАБОТА' : 'ВЫХОДНОЙ';
  const subline = isWork
    ? `${cfg.timeFrom} → ${cfg.timeTo} · осталось ${left} ${plural(left, 'день', 'дня', 'дней')}${over ? ' · изменено вручную' : ''}`
    : `Отдых · осталось ${left} ${plural(left, 'день', 'дня', 'дней')}${over ? ' · изменено вручную' : ''}`;

  return `
    <div class="shift-today ${isWork ? 'work' : 'off'}">
      <div class="shift-today-label">СЕГОДНЯ · ${escapeHtmlShift(cfg.name)}</div>
      <div class="shift-today-status">${emoji} ${label}</div>
      <div class="shift-today-date">${formatLongDate(t)}</div>
      <div class="shift-today-sub">${subline}</div>
    </div>
  `;
}

function renderCalendar(cfg) {
  const { year, month } = currentCalendarMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const t = today();
  const tStr = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
  const selStr = `${shiftSelectedDate.getFullYear()}-${shiftSelectedDate.getMonth()}-${shiftSelectedDate.getDate()}`;

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let cells = '';
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const work = isWorkDay(currentShiftPerson, date);
    const over = hasOverride(currentShiftPerson, date);
    const isToday = `${year}-${month}-${d}` === tStr;
    const isSelected = `${year}-${month}-${d}` === selStr;

    const classes = ['cal-day'];
    if (work) classes.push('work');
    else classes.push('off');
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');
    if (over) classes.push('overridden');

    cells += `
      <div class="${classes.join(' ')}" data-y="${year}" data-m="${month}" data-d="${d}">
        <span class="cal-day-num">${d}</span>
        ${work ? '<span class="cal-day-dot"></span>' : ''}
        ${over ? '<span class="cal-day-star">★</span>' : ''}
      </div>
    `;
  }

  return `
    <div class="calendar">
      <div class="calendar-header">
        <button class="calendar-prev" aria-label="Назад">‹</button>
        <div class="calendar-title">${MONTHS_RU_NOM[month]} ${year}</div>
        <button class="calendar-next" aria-label="Вперёд">›</button>
      </div>
      <div class="calendar-weekdays">
        ${weekDays.map(w => `<div class="cal-weekday">${w}</div>`).join('')}
      </div>
      <div class="calendar-grid">
        ${cells}
      </div>
      <div class="calendar-legend">
        <span class="legend-item"><span class="legend-dot work"></span> Работа</span>
        <span class="legend-item"><span class="legend-dot off"></span> Выходной</span>
        ${canEditShift() ? '<span class="legend-item"><span class="legend-star">★</span> Изменено</span>' : ''}
      </div>
    </div>
  `;
}

function renderSelectedDayInfo(cfg) {
  if (!shiftSelectedDate) return '';
  const work = isWorkDay(currentShiftPerson, shiftSelectedDate);
  const over = hasOverride(currentShiftPerson, shiftSelectedDate);
  const label = work ? 'Работа' : 'Выходной';
  const time = work ? `${cfg.timeFrom} → ${cfg.timeTo}` : 'Отдых';

  return `
    <div class="shift-selected-info ${work ? 'work' : 'off'}">
      <div class="shift-selected-date">${formatLongDate(shiftSelectedDate)}</div>
      <div class="shift-selected-status">
        ${label}${work ? ' · ' + time : ''}
        ${over ? ' · изменено вручную' : ''}
      </div>
    </div>
  `;
}

function shiftMonth(delta) {
  if (!currentCalendarMonth) return;
  let { year, month } = currentCalendarMonth;
  month += delta;
  if (month < 0) { month = 11; year -= 1; }
  if (month > 11) { month = 0; year += 1; }
  currentCalendarMonth = { year, month };
  renderShift();
}

// ============================================
//  МОДАЛКА РЕДАКТИРОВАНИЯ
// ============================================

function openShiftEditModal(date) {
  const modal = document.getElementById('shift-edit-modal');
  if (!modal) return;

  const cfg = SHIFT_CONFIG[currentShiftPerson];
  const work = isWorkDay(currentShiftPerson, date);
  const over = hasOverride(currentShiftPerson, date);

  document.getElementById('shift-edit-title').textContent = formatLongDate(date);
  document.getElementById('shift-edit-sub').textContent =
    `${cfg.name} · сейчас: ${work ? 'Работа' : 'Выходной'}${over ? ' (изменено)' : ''}`;

  modal.dataset.date = dateToKey(date);
  modal.dataset.person = currentShiftPerson;
  modal.classList.remove('hidden');
}

function closeShiftEditModal() {
  const modal = document.getElementById('shift-edit-modal');
  if (modal) modal.classList.add('hidden');
}

async function setShiftOverride(status) {
  const modal = document.getElementById('shift-edit-modal');
  if (!modal) return;

  const person = modal.dataset.person;
  const date = modal.dataset.date;

  // Если статус совпадает с автоматическим — сохраняем как override всё равно
  // (это защита от того, что график может быть сдвинут позже)

  try {
    const { error } = await window.db
      .from('shift_overrides')
      .upsert(
        { person, date, status },
        { onConflict: 'person,date' }
      );

    if (error) {
      console.error('Ошибка сохранения:', error);
      alert('Не удалось сохранить');
      return;
    }

    await loadShiftOverrides();
    closeShiftEditModal();
    renderShift();
  } catch (e) {
    console.error('Ошибка сети:', e);
    alert('Ошибка при сохранении');
  }
}

async function deleteShiftOverride() {
  const modal = document.getElementById('shift-edit-modal');
  if (!modal) return;

  const person = modal.dataset.person;
  const date = modal.dataset.date;

  try {
    const { error } = await window.db
      .from('shift_overrides')
      .delete()
      .eq('person', person)
      .eq('date', date);

    if (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось сбросить');
      return;
    }

    await loadShiftOverrides();
    closeShiftEditModal();
    renderShift();
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

// ============================================
//  ЗАГРУЗКА ПРАВОК ИЗ SUPABASE
// ============================================

async function loadShiftOverrides() {
  try {
    const { data, error } = await window.db
      .from('shift_overrides')
      .select('person, date, status');

    if (error) {
      console.error('Ошибка загрузки правок:', error);
      return;
    }
    shiftOverrides = data || [];
  } catch (e) {
    console.error('Ошибка сети:', e);
  }
}

function startShiftSync() {
  if (shiftSyncTimer) clearInterval(shiftSyncTimer);
  shiftSyncTimer = setInterval(async () => {
    await loadShiftOverrides();
    renderShift();
  }, 3000);
}

// ============================================
//  УТИЛИТЫ
// ============================================

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function escapeHtmlShift(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================

async function initShift() {
  const t = today();
  currentCalendarMonth = { year: t.getFullYear(), month: t.getMonth() };
  shiftSelectedDate = t;

  const me = getCurrentUser();
  currentShiftPerson = (me && me.name === 'Юра') ? 'yura' : 'daniil';

  await loadShiftOverrides();
  renderShift();
  startShiftSync();

  // Обработчики модалки — один раз
  const modal = document.getElementById('shift-edit-modal');
  if (modal && !modal.dataset.bound) {
    modal.dataset.bound = '1';

    // Тап по фону — закрыть
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeShiftEditModal();
    });

    const workBtn = document.getElementById('shift-edit-work');
    if (workBtn) workBtn.addEventListener('click', () => setShiftOverride('work'));

    const offBtn = document.getElementById('shift-edit-off');
    if (offBtn) offBtn.addEventListener('click', () => setShiftOverride('off'));

    const resetBtn = document.getElementById('shift-edit-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => deleteShiftOverride());

    const cancelBtn = document.getElementById('shift-edit-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeShiftEditModal);
  }
}