// ============================================
//  СМЕНА — график 3/3
//  Даниил: старт 11.10.2025 (первый рабочий)
//  Юра: старт 14.10.2025 (первый рабочий)
//  Смена: 13:00 → 01:00
// ============================================

const SHIFT_CONFIG = {
  daniil: {
    name: 'Даниил',
    startDate: '2025-10-11',
    timeFrom: '13:00',
    timeTo: '01:00'
  },
  yura: {
    name: 'Юра',
    startDate: '2025-10-14',
    timeFrom: '13:00',
    timeTo: '01:00'
  }
};

const CYCLE = 6;        // 6 дней в цикле
const WORK_DAYS = 3;    // первые 3 — работа, следующие 3 — выход

let currentShiftPerson = 'daniil';   // 'daniil' или 'yura'
let shiftSelectedDate = null;

// ============================================
//  ЛОГИКА ГРАФИКА
// ============================================

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000;
  // округляем до дней, чтобы DST не влиял
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((b0 - a0) / MS);
}

function isWorkDay(personKey, date) {
  const cfg = SHIFT_CONFIG[personKey];
  if (!cfg) return false;
  const start = parseDate(cfg.startDate);
  const diff = daysBetween(start, date);
  if (diff < 0) return false;               // до старта — не работа
  const posInCycle = ((diff % CYCLE) + CYCLE) % CYCLE;
  return posInCycle < WORK_DAYS;
}

// Номер дня внутри цикла (1..6)
function dayInCycle(personKey, date) {
  const cfg = SHIFT_CONFIG[personKey];
  if (!cfg) return 0;
  const start = parseDate(cfg.startDate);
  const diff = daysBetween(start, date);
  if (diff < 0) return 0;
  return (((diff % CYCLE) + CYCLE) % CYCLE) + 1;
}

// Сколько дней осталось до конца текущего блока (работы или выходного)
function daysLeftInBlock(personKey, date) {
  const inCycle = dayInCycle(personKey, date);
  if (inCycle === 0) return 0;
  if (inCycle <= WORK_DAYS) return WORK_DAYS - inCycle + 1; // до конца работы
  return CYCLE - inCycle + 1;                               // до конца выходного
}

// ============================================
//  ФОРМАТИРОВАНИЕ
// ============================================

const WEEKDAYS_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAYS_RU_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
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

// ============================================
//  ОТРИСОВКА
// ============================================

let currentCalendarMonth = null; // {year, month}

function renderShift() {
  const root = document.getElementById('shift-root');
  if (!root) return;

  const me = getCurrentUser();
  // Если вошёл Юра — показываем Юру, если Даниил — Даниила, иначе Даниила по умолчанию
  let defaultPerson = 'daniil';
  if (me && me.name === 'Юра') defaultPerson = 'yura';
  if (!['daniil', 'yura'].includes(currentShiftPerson)) {
    currentShiftPerson = defaultPerson;
  }
  if (!shiftSelectedDate) shiftSelectedDate = today();

  // Инициализация отображаемого месяца
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

  // Обработчики
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
    cell.addEventListener('click', () => {
      const y = parseInt(cell.dataset.y, 10);
      const m = parseInt(cell.dataset.m, 10);
      const d = parseInt(cell.dataset.d, 10);
      shiftSelectedDate = new Date(y, m, d);
      renderShift();
    });
  });
}

// Карточка «Сегодня»
function renderTodayCard(cfg) {
  const t = today();
  const isWork = isWorkDay(currentShiftPerson, t);
  const left = daysLeftInBlock(currentShiftPerson, t);

  const emoji = isWork ? '🟢' : '⚪';
  const label = isWork ? 'РАБОТА' : 'ВЫХОДНОЙ';
  const subline = isWork
    ? `${cfg.timeFrom} → ${cfg.timeTo} · осталось ${left} ${plural(left, 'день', 'дня', 'дней')}`
    : `Отдых · осталось ${left} ${plural(left, 'день', 'дня', 'дней')}`;

  return `
    <div class="shift-today ${isWork ? 'work' : 'off'}">
      <div class="shift-today-label">СЕГОДНЯ · ${escapeHtmlShift(cfg.name)}</div>
      <div class="shift-today-status">${emoji} ${label}</div>
      <div class="shift-today-date">${formatLongDate(t)}</div>
      <div class="shift-today-sub">${subline}</div>
    </div>
  `;
}

// Календарь на месяц
function renderCalendar(cfg) {
  const { year, month } = currentCalendarMonth;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // сдвиг: Пн = 0, Вс = 6

  const t = today();
  const tStr = `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
  const selStr = `${shiftSelectedDate.getFullYear()}-${shiftSelectedDate.getMonth()}-${shiftSelectedDate.getDate()}`;

  // Дни недели
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let cells = '';
  for (let i = 0; i < startWeekday; i++) {
    cells += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const work = isWorkDay(currentShiftPerson, date);
    const isToday = `${year}-${month}-${d}` === tStr;
    const isSelected = `${year}-${month}-${d}` === selStr;

    const classes = ['cal-day'];
    if (work) classes.push('work');
    else classes.push('off');
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');

    cells += `
      <div class="${classes.join(' ')}" data-y="${year}" data-m="${month}" data-d="${d}">
        <span class="cal-day-num">${d}</span>
        ${work ? '<span class="cal-day-dot"></span>' : ''}
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
      </div>
    </div>
  `;
}

// Информация о выбранном дне
function renderSelectedDayInfo(cfg) {
  if (!shiftSelectedDate) return '';
  const work = isWorkDay(currentShiftPerson, shiftSelectedDate);
  const label = work ? 'Работа' : 'Выходной';
  const time = work ? `${cfg.timeFrom} → ${cfg.timeTo}` : 'Отдых';

  return `
    <div class="shift-selected-info ${work ? 'work' : 'off'}">
      <div class="shift-selected-date">${formatLongDate(shiftSelectedDate)}</div>
      <div class="shift-selected-status">${label}${work ? ' · ' + time : ''}</div>
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
function initShift() {
  const t = today();
  currentCalendarMonth = { year: t.getFullYear(), month: t.getMonth() };
  shiftSelectedDate = t;

  const me = getCurrentUser();
  currentShiftPerson = (me && me.name === 'Юра') ? 'yura' : 'daniil';

  renderShift();
}