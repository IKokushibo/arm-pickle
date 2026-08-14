(() => {
  const { locale, timeZone, todayISO, manilaNow } = ARM;

  const state = {
    viewYear: null,
    viewMonth: null,
    selectedDate: null,
  };

  const els = {
    calendarGrid: document.getElementById("calendarGrid"),
    monthLabel: document.getElementById("monthLabel"),
    prevMonth: document.getElementById("prevMonth"),
    nextMonth: document.getElementById("nextMonth"),
    dateHint: document.getElementById("selectedDateHint"),
  };

  if (!els.calendarGrid) return;

  function toISODate(year, monthIndex, day) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function dateFromISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  function renderCalendar() {
    const first = dateFromISO(toISODate(state.viewYear, state.viewMonth, 1));
    const startPad = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(state.viewYear, state.viewMonth + 1, 0)).getUTCDate();
    const label = first.toLocaleString(locale, {
      timeZone,
      month: "long",
      year: "numeric",
    });
    els.monthLabel.textContent = label;

    const today = todayISO();
    const cells = [];

    for (let i = 0; i < startPad; i += 1) {
      cells.push(`<button type="button" class="day-btn is-outside" disabled aria-hidden="true"></button>`);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = toISODate(state.viewYear, state.viewMonth, day);
      const disabled = iso < today;
      const selected = state.selectedDate === iso;
      const isToday = today === iso;
      cells.push(
        `<button type="button" class="day-btn${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}" data-date="${iso}" ${disabled ? "disabled" : ""} aria-pressed="${selected}" aria-label="${label} ${day}">${day}</button>`
      );
    }

    els.calendarGrid.innerHTML = cells.join("");
  }

  function selectDate(iso) {
    state.selectedDate = iso;
    if (els.dateHint) {
      els.dateHint.textContent = dateFromISO(iso).toLocaleDateString(locale, {
        timeZone,
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
    renderCalendar();
    const court = sessionStorage.getItem(ARM.preferredCourtKey);
    const url = new URL("book.html", window.location.href);
    url.searchParams.set("date", iso);
    if (court) url.searchParams.set("court", court);
    window.location.href = url.href;
  }

  function initMonth() {
    const t = manilaNow();
    state.viewYear = t.year;
    state.viewMonth = t.month - 1;
  }

  function bind() {
    els.prevMonth.addEventListener("click", () => {
      state.viewMonth -= 1;
      if (state.viewMonth < 0) {
        state.viewMonth = 11;
        state.viewYear -= 1;
      }
      renderCalendar();
    });

    els.nextMonth.addEventListener("click", () => {
      state.viewMonth += 1;
      if (state.viewMonth > 11) {
        state.viewMonth = 0;
        state.viewYear += 1;
      }
      renderCalendar();
    });

    els.calendarGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-date]");
      if (!btn || btn.disabled) return;
      selectDate(btn.dataset.date);
    });
  }

  ARM.booking = {
    init() {
      initMonth();
      renderCalendar();
      bind();
    },
  };
})();
