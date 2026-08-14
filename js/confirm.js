(() => {
  const { courts, formatPrice, slotLabel, priceForHour, storageKey, lastBookingKey, locale, timeZone } = ARM;

  function loadBookings() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  }

  function loadLastBooking() {
    try {
      return JSON.parse(sessionStorage.getItem(lastBookingKey) || "null");
    } catch {
      return null;
    }
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

  function niceDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(locale, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function courtNumber(id) {
    const n = courts.findIndex((c) => c.id === id) + 1;
    return n > 0 ? n : "—";
  }

  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  const last = loadLastBooking();
  const booking = (ref && loadBookings().find((b) => b.ref === ref)) || (last && (!ref || last.ref === ref) ? last : null);

  const missing = document.getElementById("confirmMain");
  if (!booking) {
    if (missing) {
      missing.innerHTML = `
        <div class="confirm-hero">
          <p class="eyebrow">Booking confirmation</p>
          <h1>We couldn’t find that booking</h1>
          <p>The reference may have expired in this browser. Start a new demo booking to try again.</p>
        </div>
        <div class="confirm-actions">
          <a class="btn btn-ghost" href="/">Back to home</a>
          <a class="btn btn-accent" href="/#heroCalendar">Book a court</a>
        </div>`;
    }
    return;
  }

  const hourCount = (booking.items || []).reduce((sum, item) => sum + (item.hours || []).length, 0);

  document.getElementById("confirmRef").textContent = booking.ref;
  document.getElementById("confirmDate").textContent = niceDate(booking.date);
  document.getElementById("confirmTotal").textContent = formatPrice(booking.price);
  document.title = `${booking.ref} · Booking confirmed`;

  document.getElementById("confirmMeta").innerHTML = `
    <section class="review-block">
      <p class="review-kicker">Status</p>
      <p class="review-date-value">Confirmed</p>
    </section>
    <section class="review-block">
      <p class="review-kicker">Hours booked</p>
      <p class="review-date-value">${hourCount} hour${hourCount === 1 ? "" : "s"}</p>
    </section>
    <section class="review-block">
      <p class="review-kicker">Booked on</p>
      <p class="review-date-value">${niceDateTime(booking.createdAt)}</p>
    </section>`;

  document.getElementById("confirmCourts").innerHTML = (booking.items || [])
    .map((item) => {
      const hours = item.hours || [];
      const subtotal = hours.reduce((sum, hour) => sum + priceForHour(hour), 0);
      const rows = hours
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
          <p class="review-court-name">Court ${courtNumber(item.courtId)} · ${item.courtName}</p>
          ${rows}
          <div class="review-row review-subtotal">
            <span>Court subtotal</span>
            <strong>${formatPrice(subtotal)}</strong>
          </div>
        </div>`;
    })
    .join("");

  document.getElementById("confirmGuest").innerHTML = [
    ["Name", booking.name],
    ["Phone", booking.phone],
    ["Email", booking.email || "—"],
  ]
    .map(
      ([label, value]) => `
      <div class="review-row">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>`
    )
    .join("");

  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");
  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const open = !mobileNav.hidden;
      mobileNav.hidden = open;
      navToggle.setAttribute("aria-expanded", String(!open));
    });
    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobileNav.hidden = true;
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
})();
