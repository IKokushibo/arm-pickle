(() => {
  const { courts, slotLabel, storageKey, lastBookingKey, pendingPayKey, locale, timeZone } = ARM;

  const money = (n) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(Number(n));

  function loadPending() {
    try {
      return JSON.parse(sessionStorage.getItem(pendingPayKey) || "null");
    } catch {
      return null;
    }
  }

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  }

  function saveBookings(all) {
    localStorage.setItem(storageKey, JSON.stringify(all));
  }

  function bookingHours(item) {
    if (Array.isArray(item.hours)) return item.hours.map(Number);
    if (item.hour != null) return [Number(item.hour)];
    return [];
  }

  function dateFromISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  function niceDate(iso) {
    return dateFromISO(iso).toLocaleDateString(locale, {
      timeZone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function courtNumber(id) {
    return courts.findIndex((c) => c.id === id) + 1;
  }

  function priceForHour(hour) {
    return ARM.priceForHour(hour);
  }

  function drawQr(svg) {
    const size = 29;
    const cells = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const finder =
          (x < 7 && y < 7) || (x > size - 8 && y < 7) || (x < 7 && y > size - 8);
        const on = finder
          ? (x === 0 || y === 0 || x === 6 || y === 6 || x === size - 1 || y === size - 1 || (x > 1 && x < 5 && y > 1 && y < 5) || (x > size - 6 && x < size - 2 && y > 1 && y < 5) || (x > 1 && x < 5 && y > size - 6 && y < size - 2))
          : ((x * 7 + y * 13 + (x ^ y)) % 5) > 1;
        if (on) cells.push(`<rect x="${x}" y="${y}" width="1" height="1" />`);
      }
    }
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.innerHTML = cells.join("");
  }

  const pending = loadPending();
  if (!pending || !pending.items?.length) {
    window.location.replace("/#heroCalendar");
    return;
  }

  const bookHref = `book.html?date=${encodeURIComponent(pending.date)}`;
  const expiresAt = Date.parse(pending.expiresAt || 0) || Date.now() + 5 * 60 * 1000;

  function releaseHold() {
    saveBookings(loadBookings().filter((b) => b.ref !== pending.ref));
    sessionStorage.removeItem(pendingPayKey);
  }

  function goBack() {
    releaseHold();
    window.location.assign(bookHref);
  }

  document.getElementById("payRef").textContent = pending.ref || "—";
  document.getElementById("payReservation").textContent = `Court booking · ${niceDate(pending.date)}`;
  document.getElementById("payBilled").textContent = `Billed to ${pending.name}${pending.email ? ` · ${pending.email}` : ""}`;
  document.getElementById("payAmount").textContent = money(pending.price);
  document.getElementById("cardPayBtn").textContent = `Pay ${money(pending.price)}`;
  document.getElementById("cardName").value = pending.name || "";
  document.getElementById("payCancel").addEventListener("click", goBack);

  document.getElementById("paySchedule").innerHTML = pending.items
    .map((item) => {
      const hours = bookingHours(item);
      const rows = hours
        .map(
          (hour) => `
          <div class="pay-slot-row">
            <span>${slotLabel(hour)}</span>
            <strong>${money(priceForHour(hour))}</strong>
          </div>`
        )
        .join("");
      return `
        <article class="pay-court-block">
          <header>Court ${courtNumber(item.courtId)} · ${item.courtName}</header>
          ${rows}
        </article>`;
    })
    .join("");

  const qrSvg = document.getElementById("payQrSvg");
  if (qrSvg) drawQr(qrSvg);

  const clock = document.getElementById("payClock");
  const timerBox = document.getElementById("payTimerBox");
  const error = document.getElementById("payError");
  let paid = false;

  function tick() {
    if (paid) return;
    const left = Math.max(0, expiresAt - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    clock.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    if (left <= 0) {
      timerBox.classList.add("is-expired");
      error.hidden = false;
      error.textContent = "This hold expired. The courts were released.";
      window.setTimeout(goBack, 1200);
    }
  }
  tick();
  const timer = window.setInterval(tick, 250);

  document.querySelectorAll("[data-method]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-method]").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      const method = btn.dataset.method;
      document.getElementById("panelQr").hidden = method !== "qr";
      document.getElementById("panelCard").hidden = method !== "card";
    });
  });

  const numberInput = document.getElementById("cardNumber");
  const expiryInput = document.getElementById("cardExpiry");
  numberInput.addEventListener("input", () => {
    const digits = numberInput.value.replace(/\D/g, "").slice(0, 16);
    numberInput.value = digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  });
  expiryInput.addEventListener("input", () => {
    const digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
    expiryInput.value = digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
  });
  document.getElementById("cardCvc").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  function finishPay(method, extra = {}) {
    if (paid) return;
    if (Date.now() > expiresAt) {
      error.hidden = false;
      error.textContent = "This hold expired. The courts were released.";
      return;
    }
    paid = true;
    window.clearInterval(timer);
    const booking = {
      ...pending,
      status: "confirmed",
      createdAt: pending.createdAt || new Date().toISOString(),
      paidAt: new Date().toISOString(),
      payment: { method, demo: true, ...extra },
    };
    delete booking.expiresAt;
    const all = loadBookings().filter((b) => b.ref !== pending.ref);
    all.push(booking);
    saveBookings(all);
    sessionStorage.setItem(lastBookingKey, JSON.stringify(booking));
    sessionStorage.removeItem(pendingPayKey);
    const next = new URL("confirm.html", window.location.href);
    next.searchParams.set("ref", booking.ref);
    window.location.assign(next.href);
  }

  document.getElementById("qrPayBtn").addEventListener("click", () => {
    const btn = document.getElementById("qrPayBtn");
    btn.disabled = true;
    btn.textContent = "Confirming payment…";
    window.setTimeout(() => finishPay("qrph"), 800);
  });

  document.getElementById("panelCard").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cardName").value.trim();
    const number = numberInput.value.replace(/\D/g, "");
    const expiry = expiryInput.value.replace(/\D/g, "");
    const cvc = document.getElementById("cardCvc").value.replace(/\D/g, "");
    if (!name || number.length < 16 || expiry.length < 4 || cvc.length < 3) {
      error.hidden = false;
      error.textContent = "Enter complete test card details to continue.";
      return;
    }
    error.hidden = true;
    const btn = document.getElementById("cardPayBtn");
    btn.disabled = true;
    btn.textContent = "Processing payment…";
    window.setTimeout(() => finishPay("test-card", { last4: number.slice(-4) }), 800);
  });

  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const open = !mobileNav.hidden;
      mobileNav.hidden = open;
      navToggle.setAttribute("aria-expanded", String(!open));
    });
  }
})();
