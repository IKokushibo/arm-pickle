(() => {
  const {
    courts,
    slotHours,
    formatPrice,
    slotLabel,
    priceForHour,
    storageKey,
    pendingPayKey,
    locale,
    timeZone,
    todayISO,
  } = ARM;

  const params = new URLSearchParams(window.location.search);
  const dateISO = params.get("date");

  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || dateISO < todayISO()) {
    window.location.replace("/#heroCalendar");
    return;
  }

  const state = {
    date: dateISO,
    /** @type {Record<string, number[]>} */
    picks: {},
    activeCourtId: null,
    phase: "court",
    carouselIndex: 0,
    pendingReview: null,
    bookingComplete: false,
    processing: false,
  };

  const els = {
    courtSection: document.getElementById("bookCourtSection"),
    grid: document.getElementById("bookCourtGrid"),
    dots: document.getElementById("carouselDots"),
    prev: document.getElementById("carouselPrev"),
    next: document.getElementById("carouselNext"),
    nextCard: document.getElementById("bookNextCard"),
    nextHint: document.getElementById("bookNextHint"),
    pickTimesBtn: document.getElementById("pickTimesBtn"),
    slotsPanel: document.getElementById("bookSlotsPanel"),
    timesTitle: document.getElementById("timesTitle"),
    timesLead: document.getElementById("timesLead"),
    slotGrid: document.getElementById("bookSlotGrid"),
    slotsBack: document.getElementById("slotsBack"),
    addCourtBtn: document.getElementById("addCourtBtn"),
    continueBar: document.getElementById("bookContinueBar"),
    continueInline: document.getElementById("bookContinueInline"),
    sidebarContinue: document.getElementById("sidebarContinueBtn"),
    detailsForm: document.getElementById("bookDetailsForm"),
    sidebarDate: document.getElementById("sidebarDate"),
    sidebarBody: document.getElementById("sidebarBody"),
    sidebarTotal: document.getElementById("sidebarTotal"),
    detailsBack: document.getElementById("detailsBack"),
    reviewDialog: document.getElementById("reviewDialog"),
    reviewClose: document.getElementById("reviewClose"),
    reviewDate: document.getElementById("reviewDate"),
    reviewCourts: document.getElementById("reviewCourts"),
    reviewGuest: document.getElementById("reviewGuest"),
    reviewTotal: document.getElementById("reviewTotal"),
    reviewPayBtn: document.getElementById("reviewPayBtn"),
    reviewBack: document.getElementById("reviewBack"),
    reviewEyebrow: document.getElementById("reviewEyebrow"),
    reviewTitle: document.getElementById("reviewTitle"),
    reviewSub: document.getElementById("reviewSub"),
    reviewNotes: document.getElementById("reviewNotes"),
    reviewActions: document.getElementById("reviewActions"),
    reviewRefWrap: document.getElementById("reviewRefWrap"),
    reviewProcessing: document.getElementById("reviewProcessing"),
    bookMain: document.getElementById("bookMain"),
    bookingConfirm: document.getElementById("bookingConfirm"),
    receiptRef: document.getElementById("receiptRef"),
    receiptDate: document.getElementById("receiptDate"),
    receiptCourts: document.getElementById("receiptCourts"),
    receiptGuest: document.getElementById("receiptGuest"),
    receiptTotal: document.getElementById("receiptTotal"),
    confirmRef: document.getElementById("confirmRef"),
    photoDialog: document.getElementById("photoDialog"),
    photoImg: document.getElementById("photoDialogImg"),
    photoCaption: document.getElementById("photoDialogCaption"),
    stepLabel: document.getElementById("bookStepLabel"),
    stepTitle: document.getElementById("bookStepTitle"),
    lead: document.getElementById("bookLead"),
    hint: document.getElementById("bookHint"),
    stepper: document.getElementById("bookStepper"),
    navToggle: document.getElementById("navToggle"),
    mobileNav: document.getElementById("mobileNav"),
  };

  function dateFromISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  function niceDate(iso, opts = {}) {
    return dateFromISO(iso).toLocaleDateString(locale, {
      timeZone,
      weekday: opts.weekday || "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  }

  function saveBooking(booking) {
    const all = loadBookings();
    all.push(booking);
    localStorage.setItem(storageKey, JSON.stringify(all));
  }

  function writeBookings(all) {
    localStorage.setItem(storageKey, JSON.stringify(all));
  }

  function bookingHours(itemOrBooking) {
    if (Array.isArray(itemOrBooking.hours)) return itemOrBooking.hours.map(Number);
    if (itemOrBooking.hour != null) return [Number(itemOrBooking.hour)];
    return [];
  }

  function isActiveHold(b) {
    if (!b || b.status !== "pending") return false;
    if (!b.expiresAt) return true;
    return Date.parse(b.expiresAt) > Date.now();
  }

  function isSlotTaken(date, courtId, hour) {
    const h = Number(hour);
    const court = String(courtId);
    return loadBookings().some((b) => {
      if (b.status === "pending" && !isActiveHold(b)) return false;
      if (String(b.date) !== String(date)) return false;
      if (Array.isArray(b.items)) {
        return b.items.some((item) => String(item.courtId) === court && bookingHours(item).includes(h));
      }
      return String(b.courtId) === court && bookingHours(b).includes(h);
    });
  }

  function isSlotBlocked(date, courtId, hour) {
    return isSlotTaken(date, courtId, hour) || isSlotPast(date, hour);
  }

  function stripBlockedHours() {
    Object.keys(state.picks).forEach((id) => {
      state.picks[id] = hoursFor(id).filter((h) => !isSlotBlocked(state.date, id, h));
    });
  }

  function isSlotPast(date, hour) {
    const nowISO = todayISO();
    if (date < nowISO) return true;
    if (date > nowISO) return false;
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: ARM.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date())
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value])
    );
    const nowSecs = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
    return nowSecs >= hour * 3600;
  }

  function openSlotsCount(courtId) {
    return slotHours.filter((hour) => !isSlotBlocked(dateISO, courtId, hour)).length;
  }

  function courtById(id) {
    return courts.find((c) => c.id === id) || null;
  }

  function courtNumber(id) {
    return courts.findIndex((c) => c.id === id) + 1;
  }

  function hoursFor(courtId) {
    return state.picks[courtId] || [];
  }

  function pickedCourtIds() {
    return Object.keys(state.picks);
  }

  function allPickedHours() {
    return pickedCourtIds().flatMap((id) => hoursFor(id).map((hour) => ({ courtId: id, hour })));
  }

  function cartTotal() {
    return allPickedHours().reduce((sum, item) => sum + priceForHour(item.hour), 0);
  }

  function bandForHour(hour) {
    return hour >= 7 && hour < 17 ? "Morning" : "Night";
  }

  function ensureCourt(courtId) {
    if (!state.picks[courtId]) state.picks[courtId] = [];
  }

  function updateStepper() {
    const items = [...els.stepper.querySelectorAll("li")];
    items.forEach((li, i) => {
      li.classList.remove("is-done", "is-current");
      if (i === 0) li.classList.add("is-done");
    });
    if (state.phase === "court") items[1].classList.add("is-current");
    if (state.phase === "time") {
      items[1].classList.add("is-done");
      items[2].classList.add("is-current");
    }
    if (state.phase === "details") {
      items[1].classList.add("is-done");
      items[2].classList.add("is-done");
      items[3].classList.add("is-current");
    }
  }

  function renderDots() {
    els.dots.innerHTML = courts
      .map(
        (c, i) =>
          `<button type="button" aria-label="${c.name}" class="${i === state.carouselIndex ? "is-active" : ""}" data-dot="${i}"></button>`
      )
      .join("");
  }

  function scrollToIndex(index) {
    state.carouselIndex = Math.max(0, Math.min(courts.length - 1, index));
    const card = els.grid.children[state.carouselIndex];
    if (card) card.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    renderDots();
  }

  function renderCourts() {
    els.grid.innerHTML = courts
      .map((c, i) => {
        const open = openSlotsCount(c.id);
        const inCart = hoursFor(c.id).length > 0 || state.activeCourtId === c.id;
        return `
        <article class="book-court-card${inCart ? " is-selected" : ""}" data-court="${c.id}">
          <figure class="book-court-photo">
            <img src="${c.image}" alt="${c.imageAlt}" width="640" height="400" loading="${i < 2 ? "eager" : "lazy"}" />
            <p class="book-court-badge">${c.badge}</p>
          </figure>
          <div class="book-court-info">
            <p class="book-court-kicker">Court ${i + 1}</p>
            <h3>${c.name}</h3>
            <p class="book-court-desc">${c.description}</p>
            <p class="book-court-meta">${open} times open${hoursFor(c.id).length ? ` · ${hoursFor(c.id).length} selected` : ""}</p>
            <button type="button" class="view-photos" data-photos="${c.id}">View court photos</button>
          </div>
        </article>`;
      })
      .join("");
    renderDots();
  }

  function updateContinueBar() {
    const show = state.phase !== "details" && allPickedHours().length > 0;
    els.continueBar.hidden = !show;
    els.continueInline.hidden = !show;
    els.sidebarContinue.hidden = !show;
    document.body.classList.toggle("has-continue-bar", show);
  }

  function renderSlots() {
    const court = courtById(state.activeCourtId);
    if (!court || state.phase === "court" || state.phase === "details") {
      els.slotsPanel.hidden = true;
      updateContinueBar();
      return;
    }

    els.slotsPanel.hidden = false;
    const n = courtNumber(court.id);
    els.timesTitle.textContent = "Pick your play times";
    els.timesLead.textContent = `Tap one or more hours for Court ${n}. Available slots can be booked; unavailable slots stay visible.`;

    stripBlockedHours();
    const selectedHours = hoursFor(court.id);
    els.slotGrid.innerHTML = slotHours
      .map((hour) => {
        const taken = isSlotTaken(state.date, court.id, hour);
        const past = isSlotPast(state.date, hour);
        const disabled = taken || past;
        const selected = !disabled && selectedHours.includes(hour);
        const price = priceForHour(hour);
        const band = bandForHour(hour);
        const iconClass = band === "Morning" ? "is-sun" : "is-moon";
        const icon = band === "Morning" ? "☀" : "☾";
        const status = taken ? "Booked" : past ? "Unavailable" : "Available";
        const stateClass = taken ? " is-booked is-unavailable" : past ? " is-unavailable" : selected ? " is-selected is-available" : " is-available";
        return `
        <button type="button" class="time-slot${stateClass}" data-hour="${hour}" ${disabled ? "disabled" : ""} aria-disabled="${disabled}" aria-pressed="${selected}">
          <span class="tier-icon ${iconClass}" aria-hidden="true">${icon}</span>
          <span class="time-slot-copy">
            <strong>${slotLabel(hour)}</strong>
            <span>${formatPrice(price)} · ${band}</span>
          </span>
          <span class="time-slot-status">${status}</span>
        </button>`;
      })
      .join("");

    updateContinueBar();
  }

  function updateSidebar() {
    els.sidebarDate.textContent = niceDate(state.date);
    const ids = pickedCourtIds();

    if (!ids.length && !state.activeCourtId) {
      els.sidebarBody.innerHTML = `<p class="book-empty">No courts chosen yet — start by tapping a court.</p>`;
      els.sidebarTotal.textContent = formatPrice(0);
      return;
    }

    const rows = (ids.length ? ids : [state.activeCourtId]).map((id) => {
      const court = courtById(id);
      const hours = hoursFor(id).slice().sort((a, b) => a - b);
    return `
        <div class="book-sidebar-item">
          <div class="book-pick">
            <strong>Court ${courtNumber(id)}</strong>
            <span>${court.name}</span>
            ${
              hours.length
                ? hours
                    .map(
                      (h) => `
              <span class="book-pick-slot">
                <span>${slotLabel(h)}</span>
                <strong>${formatPrice(priceForHour(h))}</strong>
              </span>`
                    )
                    .join("")
                : `<span>No time slots selected</span>`
            }
          </div>
          <button type="button" class="book-remove" data-remove="${id}">Remove</button>
        </div>`;
    });

    els.sidebarBody.innerHTML = rows.join("");
    els.sidebarTotal.textContent = formatPrice(cartTotal());
  }

  function updateNextCard() {
    els.nextCard.hidden = true;
    if (state.activeCourtId) {
      els.hint.textContent = `Court ${courtNumber(state.activeCourtId)} selected. Available and unavailable times are shown below.`;
    } else {
      els.hint.textContent = "Tap a court card to continue. Times are Philippine Time (PHT). Prices in ₱.";
    }
  }

  function isDesktop() {
    return window.matchMedia("(min-width: 900px)").matches;
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function scrollToTimes() {
    const el = els.slotsPanel;
    if (!el || el.hidden) return;
    const header = document.querySelector(".site-header");
    const offset = (header?.offsetHeight || 0) + 10;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function setPhase(phase) {
    const changed = state.phase !== phase;
    state.phase = phase;
    const court = courtById(state.activeCourtId);

    if (phase === "court") {
      els.courtSection.hidden = false;
      els.stepLabel.textContent = "Step 2 · Choose your court";
      els.stepTitle.textContent = "Tap a court to pick times for it.";
      els.lead.textContent = "Swipe through all 6 covered courts. Want a second court later? You can add another after.";
      els.detailsForm.hidden = true;
      els.slotsPanel.hidden = !state.activeCourtId;
    } else if (phase === "time") {
      els.courtSection.hidden = false;
      els.stepLabel.textContent = "Step 3 · Choose your times";
      els.stepTitle.textContent = "Pick your play times";
      els.lead.textContent = court
        ? `Tap one or more hours for Court ${courtNumber(court.id)}. You can add more courts later if you want.`
        : "Tap one or more hours.";
      els.detailsForm.hidden = true;
    } else {
      els.courtSection.hidden = true;
      els.stepLabel.textContent = "Step 4 · Your details";
      els.stepTitle.textContent = "Enter your details.";
      els.lead.textContent = "Lock in this demo booking with your contact information.";
      els.detailsForm.hidden = false;
    }

    updateStepper();
    updateNextCard();
    renderCourts();
    renderSlots();
    updateSidebar();
    document.body.classList.remove("is-phase-court", "is-phase-time", "is-phase-details");
    document.body.classList.add(`is-phase-${phase}`);
    if (!changed) return;
    if (phase === "time" && !isDesktop()) {
      requestAnimationFrame(() => requestAnimationFrame(scrollToTimes));
    } else {
      scrollToTop();
    }
  }

  function selectCourt(courtId) {
    state.activeCourtId = courtId;
    ensureCourt(courtId);
    const idx = courts.findIndex((c) => c.id === courtId);
    if (idx >= 0) state.carouselIndex = idx;
    setPhase("time");
    if (idx >= 0) scrollToIndex(idx);
    if (!isDesktop()) {
      requestAnimationFrame(() => requestAnimationFrame(scrollToTimes));
    }
  }

  function removeCourt(courtId) {
    delete state.picks[courtId];
    if (state.activeCourtId === courtId) {
      const remaining = pickedCourtIds();
      state.activeCourtId = remaining[0] || null;
    }
    if (!state.activeCourtId) setPhase("court");
    else {
      renderCourts();
      renderSlots();
      updateSidebar();
      updateNextCard();
      updateContinueBar();
    }
  }

  function toggleHour(hour) {
    const courtId = state.activeCourtId;
    if (!courtId) return;
    if (isSlotBlocked(state.date, courtId, hour)) return;
    ensureCourt(courtId);
    const hours = hoursFor(courtId);
    const idx = hours.indexOf(hour);
    if (idx >= 0) hours.splice(idx, 1);
    else hours.push(hour);
    hours.sort((a, b) => a - b);
    state.picks[courtId] = hours;
    renderSlots();
    updateSidebar();
  }

  function openPhotos(courtId) {
    const court = courtById(courtId);
    if (!court) return;
    els.photoImg.src = court.image;
    els.photoImg.alt = court.imageAlt;
    els.photoCaption.textContent = `${court.name} · Court ${courtNumber(courtId)}`;
    els.photoDialog.showModal();
  }

  function fillReview(data) {
    state.bookingComplete = false;
    state.processing = false;
    els.reviewEyebrow.textContent = "Check before you confirm";
    els.reviewTitle.textContent = "Review your booking";
    els.reviewSub.textContent = "Nothing is locked in yet — go back if you need to change anything.";
    els.reviewNotes.hidden = false;
    els.reviewActions.hidden = false;
    els.reviewRefWrap.hidden = true;
    els.reviewClose.hidden = false;
    els.reviewProcessing.hidden = true;
    els.reviewPayBtn.disabled = false;
    els.reviewBack.disabled = false;
    els.reviewPayBtn.textContent = "Confirm booking";

    els.reviewDate.textContent = niceDate(data.date);
    els.reviewCourts.innerHTML = data.items
      .map((item) => {
        const n = courtNumber(item.courtId);
        const rows = item.hours
          .map(
            (hour) => `
            <div class="review-row">
              <span>${slotLabel(hour)}</span>
              <strong>${formatPrice(priceForHour(hour))}</strong>
            </div>`
          )
          .join("");
        return `
          <div class="review-court">
            <p class="review-court-name">Court ${n} · ${item.courtName}</p>
            ${rows}
          </div>`;
      })
      .join("");
    els.reviewGuest.innerHTML = [
      ["Name", data.name],
      ["Phone", data.phone],
      ["Email", data.email || "—"],
    ]
      .map(
        ([label, value]) => `
        <div class="review-row">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>`
      )
      .join("");
    els.reviewTotal.textContent = formatPrice(data.price);
  }

  function receiptMarkup(data) {
    const courtsHtml = data.items
      .map((item) => {
        const n = courtNumber(item.courtId);
        const rows = item.hours
          .map(
            (hour) => `
            <div class="review-row">
              <span>${slotLabel(hour)}</span>
              <strong>${formatPrice(priceForHour(hour))}</strong>
            </div>`
          )
          .join("");
        return `
          <div class="review-court">
            <p class="review-court-name">Court ${n} · ${item.courtName}</p>
            ${rows}
          </div>`;
      })
      .join("");
    const guestHtml = [
      ["Name", data.name],
      ["Phone", data.phone],
      ["Email", data.email || "—"],
    ]
      .map(
        ([label, value]) => `
        <div class="review-row">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>`
      )
      .join("");
    return { courtsHtml, guestHtml };
  }

  function showConfirmation(booking) {
    const { courtsHtml, guestHtml } = receiptMarkup(booking);
    els.receiptRef.textContent = booking.ref;
    els.receiptDate.textContent = niceDate(booking.date);
    els.receiptCourts.innerHTML = courtsHtml;
    els.receiptGuest.innerHTML = guestHtml;
    els.receiptTotal.textContent = formatPrice(booking.price);

    if (els.reviewDialog.open) els.reviewDialog.close();
    els.bookMain.hidden = true;
    els.bookingConfirm.hidden = false;
    els.continueBar.hidden = true;
    els.continueInline.hidden = true;
    els.sidebarContinue.hidden = true;
    document.body.classList.remove("has-continue-bar");
    document.body.classList.add("is-phase-confirmed");
    document.title = `${booking.ref} · ARM Pickleball Court`;
    scrollToTop();
  }

  function itemsHaveBlockedSlots(items) {
    return (items || []).some((item) =>
      (item.hours || []).some((hour) => isSlotBlocked(state.date, item.courtId, hour))
    );
  }

  function makeRef() {
    return `ARM-${Math.floor(Math.random() * 9000) + 1000}`;
  }

  function goToPayment(data) {
    if (itemsHaveBlockedSlots(data.items)) {
      if (els.reviewDialog.open) els.reviewDialog.close();
      setPhase("time");
      els.timesLead.textContent = "Some of those times were just booked. Please pick available slots.";
      return;
    }
    const pending = {
      ...data,
      ref: makeRef(),
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
    const prev = (() => {
      try {
        return JSON.parse(sessionStorage.getItem(pendingPayKey) || "null");
      } catch {
        return null;
      }
    })();
    const kept = loadBookings().filter((b) => {
      if (b.status !== "pending") return true;
      if (!isActiveHold(b)) return false;
      if (prev && b.ref === prev.ref) return false;
      return true;
    });
    kept.push(pending);
    writeBookings(kept);
    sessionStorage.setItem(pendingPayKey, JSON.stringify(pending));
    const next = new URL("pay.html", window.location.href);
    next.searchParams.set("ref", pending.ref);
    window.location.assign(next.href);
  }

  function setupNav() {
    if (!els.navToggle || !els.mobileNav) return;
    els.navToggle.addEventListener("click", () => {
      const open = !els.mobileNav.hidden;
      els.mobileNav.hidden = open;
      els.navToggle.setAttribute("aria-expanded", String(!open));
    });
    els.mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        els.mobileNav.hidden = true;
        els.navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  function bind() {
    els.grid.addEventListener("click", (e) => {
      const photos = e.target.closest("[data-photos]");
      if (photos) {
        e.preventDefault();
        e.stopPropagation();
        openPhotos(photos.dataset.photos);
        return;
      }
      const card = e.target.closest("[data-court]");
      if (!card) return;
      selectCourt(card.dataset.court);
    });

    els.prev.addEventListener("click", () => scrollToIndex(state.carouselIndex - 1));
    els.next.addEventListener("click", () => scrollToIndex(state.carouselIndex + 1));
    els.dots.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-dot]");
      if (!btn) return;
      scrollToIndex(Number(btn.dataset.dot));
    });

    els.grid.addEventListener("scroll", () => {
      const cards = [...els.grid.children];
      if (!cards.length) return;
      const mid = els.grid.scrollLeft + els.grid.clientWidth / 2;
      let closest = 0;
      let dist = Infinity;
      cards.forEach((card, i) => {
        const center = card.offsetLeft + card.offsetWidth / 2;
        const d = Math.abs(center - mid);
        if (d < dist) {
          dist = d;
          closest = i;
        }
      });
      if (closest !== state.carouselIndex) {
        state.carouselIndex = closest;
        renderDots();
      }
    });

    els.pickTimesBtn.addEventListener("click", () => {
      if (!state.activeCourtId) return;
      setPhase("time");
    });

    els.slotsBack.addEventListener("click", () => setPhase("court"));

    els.addCourtBtn.addEventListener("click", () => {
      setPhase("court");
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-continue-details]");
      if (!btn) return;
      if (!allPickedHours().length) return;
      setPhase("details");
      document.getElementById("guestName")?.focus({ preventScroll: true });
    });

    els.slotGrid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-hour]");
      if (!btn || btn.disabled || btn.getAttribute("aria-disabled") === "true") return;
      toggleHour(Number(btn.dataset.hour));
    });

    els.sidebarBody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (!btn) return;
      removeCourt(btn.dataset.remove);
    });

    els.detailsBack.addEventListener("click", () => setPhase("time"));

    document.getElementById("guestPhone")?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
    });
    document.getElementById("guestPhone")?.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text") || "";
      const digits = text.replace(/\D/g, "").slice(0, 11);
      const input = e.target;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const next = `${input.value.slice(0, start)}${digits}${input.value.slice(end)}`.replace(/\D/g, "").slice(0, 11);
      input.value = next;
    });

    els.detailsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const items = pickedCourtIds()
        .map((id) => ({
          courtId: id,
          courtName: courtById(id).name,
          hours: hoursFor(id).map(Number),
        }))
        .filter((item) => item.hours.length);
      if (!items.length) return;
      if (itemsHaveBlockedSlots(items)) {
        setPhase("time");
        els.timesLead.textContent = "Some of those times are already booked. Please pick available slots.";
        return;
      }

      const name = document.getElementById("guestName").value.trim();
      const phone = document.getElementById("guestPhone").value.replace(/\D/g, "");
      const email = document.getElementById("guestEmail").value.trim();
      if (!name || !phone) return;

      state.pendingReview = {
        date: state.date,
        items,
        name,
        phone,
        email,
        price: cartTotal(),
      };
      fillReview(state.pendingReview);
      els.reviewDialog.showModal();
    });

    els.reviewClose.addEventListener("click", () => {
      if (state.processing) return;
      els.reviewDialog.close();
    });
    els.reviewBack.addEventListener("click", () => {
      if (state.processing) return;
      els.reviewDialog.close();
    });
    els.reviewDialog.addEventListener("click", (e) => {
      if (state.processing) return;
      if (e.target === els.reviewDialog) els.reviewDialog.close();
    });
    els.reviewDialog.addEventListener("cancel", (e) => {
      if (state.processing) e.preventDefault();
    });

    els.reviewPayBtn.addEventListener("click", () => {
      const data = state.pendingReview;
      if (!data) return;
      goToPayment(data);
    });
  }

  setupNav();
  els.sidebarDate.textContent = niceDate(state.date);
  renderCourts();
  setPhase("court");
  bind();

  const preselect = params.get("court") || sessionStorage.getItem(ARM.preferredCourtKey);
  if (preselect && courtById(preselect)) {
    sessionStorage.removeItem(ARM.preferredCourtKey);
    selectCourt(preselect);
  }
})();
