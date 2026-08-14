(() => {
  const AUTH_KEY = "arm_admin_auth";

  function readAuth() {
    try {
      return (
        JSON.parse(localStorage.getItem(AUTH_KEY) || "null") ||
        JSON.parse(sessionStorage.getItem(AUTH_KEY) || "null")
      );
    } catch {
      return null;
    }
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
  }

  if (!readAuth()?.ok) {
    location.replace("/login.html");
    return;
  }

  const { courts, slotHours, slotLabel, priceForHour, storageKey, locale, timeZone, todayISO } = ARM;

  const money = (n) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);

  const state = {
    calMode: "daily",
    calDate: todayISO(),
    calCourtId: courts[0]?.id || "",
    page: 1,
    pageSize: 10,
    filters: { search: "", status: "", type: "", method: "" },
  };

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

  function dateFromISO(iso) {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  function toISO(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  function addDays(iso, n) {
    const d = dateFromISO(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return toISO(d);
  }

  function niceDate(iso, opts = {}) {
    const d = dateFromISO(iso);
    if (!d) return "—";
    return d.toLocaleDateString(locale, {
      timeZone,
      weekday: opts.weekday,
      month: opts.month || "long",
      day: "numeric",
      year: opts.year === false ? undefined : "numeric",
    });
  }

  function courtNumber(id) {
    const n = courts.findIndex((c) => c.id === id) + 1;
    return n > 0 ? n : "—";
  }

  function hoursOf(item) {
    if (Array.isArray(item?.hours)) return item.hours.map(Number);
    if (item?.hour != null) return [Number(item.hour)];
    return [];
  }

  function isActivePending(b) {
    if (String(b.status || "").toLowerCase() !== "pending") return false;
    if (!b.expiresAt) return true;
    return Date.parse(b.expiresAt) > Date.now();
  }

  function normalize(b) {
    const items = Array.isArray(b.items)
      ? b.items
      : b.courtId
        ? [{ courtId: b.courtId, courtName: b.courtName || "Court", hours: hoursOf(b) }]
        : [];
    const status = String(b.status || "confirmed").toLowerCase();
    const method = b.payment?.method || (status === "pending" ? "unpaid" : "demo");
    const paid =
      status === "confirmed"
        ? "paid"
        : status === "pending"
          ? "pending"
          : status === "cancelled" || status === "failed"
            ? "failed"
            : status;
    const type = b.type || (method === "walk-in" ? "Walk-in" : "Online Appointment");
    return {
      ...b,
      items,
      hourCount: items.reduce((sum, item) => sum + hoursOf(item).length, 0),
      status,
      method,
      paid,
      type,
      price:
        Number(b.price) ||
        items.reduce((sum, item) => sum + hoursOf(item).reduce((s, h) => s + priceForHour(h), 0), 0),
    };
  }

  function allBookings() {
    return loadBookings()
      .map(normalize)
      .filter((b) => b.status !== "pending" || isActivePending(b))
      .sort((a, b) => Date.parse(b.createdAt || b.paidAt || 0) - Date.parse(a.createdAt || a.paidAt || 0));
  }

  function pill(text, kind) {
    return `<span class="admin-pill is-${kind}">${text}</span>`;
  }

  function statusPill(status) {
    if (status === "confirmed") return pill("confirmed", "ok");
    if (status === "pending") return pill("pending payment", "warn");
    if (status === "cancelled" || status === "failed") return pill(status, "bad");
    return pill(status, "info");
  }

  function paymentPill(paid) {
    if (paid === "paid") return pill("paid", "ok");
    if (paid === "pending") return pill("pending", "warn");
    return pill(paid, "bad");
  }

  function methodPill(method) {
    const label =
      method === "qrph"
        ? "Paid Online"
        : method === "test-card"
          ? "Card"
          : method === "walk-in"
            ? "Walk-in"
            : method === "unpaid"
              ? "Unpaid"
              : "Demo";
    return pill(label, method === "unpaid" ? "warn" : "info");
  }

  function typePill(type) {
    return pill(type.includes("Walk") ? "walk-in" : "online", "info");
  }

  function bookingCardHtml(b) {
    const courtsLabel =
      b.items.map((item) => `Court ${courtNumber(item.courtId)}`).join(", ") || "—";
    const slotsLabel = b.items
      .map((item) => {
        const n = hoursOf(item).length;
        return `${n} slot${n === 1 ? "" : "s"}`;
      })
      .join(" · ");
    return `
      <button type="button" class="admin-booking-card" data-view-ref="${b.ref}">
        <div class="admin-booking-card-top">
          <strong>${b.ref || "—"}</strong>
          <strong class="admin-booking-card-amount">${money(b.price)}</strong>
        </div>
        <p class="admin-booking-card-name">${b.name || "Guest"}</p>
        <p class="admin-booking-card-meta">${niceDate(b.date)} · ${courtsLabel}${slotsLabel ? ` · ${slotsLabel}` : ""}</p>
        <div class="admin-badges">${typePill(b.type)}${statusPill(b.status)}${paymentPill(b.paid)}</div>
      </button>`;
  }

  function findSlotBooking(list, date, courtId, hour) {
    return list.find(
      (b) =>
        b.date === date &&
        (b.status === "confirmed" || b.status === "pending") &&
        b.items.some((item) => item.courtId === courtId && hoursOf(item).includes(hour))
    );
  }

  function bookingsOnDate(list, date) {
    return list.filter((b) => b.date === date && (b.status === "confirmed" || b.status === "pending"));
  }

  function startOfWeek(iso) {
    const d = dateFromISO(iso);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return toISO(d);
  }

  function monthMatrix(iso) {
    const d = dateFromISO(iso);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const first = new Date(Date.UTC(year, month, 1, 12));
    const startPad = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(toISO(new Date(Date.UTC(year, month, day, 12))));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function openManual(prefill = {}) {
    const dialog = document.getElementById("manualDialog");
    if (prefill.date) document.getElementById("manualDate").value = prefill.date;
    if (prefill.courtId) document.getElementById("manualCourt").value = prefill.courtId;
    if (prefill.hour != null) document.getElementById("manualHour").value = String(prefill.hour);
    dialog.showModal();
  }

  function methodLabel(method) {
    if (method === "qrph") return "Paid Online";
    if (method === "test-card") return "Card";
    if (method === "walk-in") return "Walk-in";
    if (method === "unpaid") return "Unpaid";
    return "Demo";
  }

  function channelLabel(method) {
    if (method === "qrph") return "paymongo";
    if (method === "test-card") return "card";
    if (method === "walk-in") return "desk";
    return "demo";
  }

  function merchantLabel(method) {
    if (method === "qrph") return "PayMongo";
    if (method === "test-card") return "Demo Card";
    if (method === "walk-in") return "Walk-in Desk";
    return "ARM Demo";
  }

  function createdLabel(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(locale, {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function courtSummary(b) {
    if (!b.items.length) return { title: "—", sub: "No courts" };
    const names = b.items.map((item) => `Court ${courtNumber(item.courtId)}`);
    const unique = [...new Set(names)];
    const sub = b.items
      .map((item) => `Court ${courtNumber(item.courtId)}: ${hoursOf(item).length} slot${hoursOf(item).length === 1 ? "" : "s"}`)
      .join(" · ");
    return { title: unique.join(", "), sub };
  }

  function slotRowsHtml(b) {
    if (!b.items.length) return `<p class="admin-muted">No slots on this booking.</p>`;
    return b.items
      .map((item) => {
        const hours = hoursOf(item).sort((a, c) => a - c);
        const price = hours.reduce((s, h) => s + priceForHour(h), 0);
        return `
          <div class="bd-slot">
            <div>
              <strong>Court ${courtNumber(item.courtId)}</strong>
              <span>${hours.map(slotLabel).join(", ") || "—"}</span>
            </div>
            <div class="bd-slot-meta">
              <span>${hours.length} slot${hours.length === 1 ? "" : "s"}</span>
              <strong>${money(price || b.price)}</strong>
            </div>
          </div>`;
      })
      .join("");
  }

  let detailRef = null;

  function viewBooking(ref) {
    detailRef = ref;
    const root = document.getElementById("bookingDetailRoot");
    const b = allBookings().find((x) => x.ref === ref);
    if (!b) {
      root.innerHTML = `
        <button type="button" class="bd-back" data-back-bookings>← Back to Bookings</button>
        <p class="admin-muted">Booking not found.</p>`;
      showView("booking-detail");
      return;
    }

    const courtInfo = courtSummary(b);
    const canAct = b.status === "confirmed" || b.status === "pending";
    root.innerHTML = `
      <button type="button" class="bd-back" data-back-bookings>← Back to Bookings</button>

      <div class="bd-header">
        <div class="bd-title-row">
          <h2 class="bd-ref">${b.ref}</h2>
          <div class="admin-badges">
            ${typePill(b.type)}
            ${statusPill(b.status)}
          </div>
        </div>
        <div class="bd-actions">
          <button type="button" class="admin-btn admin-btn-accent" data-bd-rebook ${canAct ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 4v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Rebook
          </button>
          <button type="button" class="admin-btn admin-btn-danger" data-bd-refund ${canAct ? "" : "disabled"}>Refund</button>
          <button type="button" class="admin-btn" data-bd-cancel ${canAct ? "" : "disabled"}>Cancel booking</button>
        </div>
      </div>

      <div class="bd-summary">
        <article class="bd-stat">
          <span class="bd-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
          <span class="bd-stat-label">Date</span>
          <strong>${niceDate(b.date)}</strong>
        </article>
        <article class="bd-stat">
          <span class="bd-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></span>
          <span class="bd-stat-label">Courts</span>
          <strong>${courtInfo.title}</strong>
          <span class="bd-stat-sub">${courtInfo.sub}</span>
        </article>
        <article class="bd-stat">
          <span class="bd-stat-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></span>
          <span class="bd-stat-label">Payment</span>
          <strong>${methodLabel(b.method)}</strong>
          <div class="bd-stat-pill">${paymentPill(b.paid)}</div>
        </article>
        <article class="bd-stat is-total">
          <span class="bd-stat-label">Total amount</span>
          <strong class="bd-total">${money(b.price)}</strong>
        </article>
      </div>

      <div class="bd-grid">
        <div class="bd-col">
          <article class="admin-card bd-card">
            <div class="bd-card-head">
              <span class="bd-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg></span>
              <h3>Customer</h3>
            </div>
            <div class="bd-fields">
              <div>
                <span class="bd-label">Full name</span>
                <strong>${b.name || "Guest"}</strong>
              </div>
              <div>
                <span class="bd-label">Contact</span>
                <strong class="bd-phone">${b.phone || "—"}</strong>
              </div>
              <div class="bd-span-2">
                <span class="bd-label">Email</span>
                <strong>${b.email || "—"}</strong>
              </div>
            </div>
          </article>

          <article class="admin-card bd-card">
            <div class="bd-card-head">
              <h3>Court time slots</h3>
            </div>
            <div class="bd-slots">${slotRowsHtml(b)}</div>
          </article>
        </div>

        <div class="bd-col">
          <article class="admin-card bd-card">
            <div class="bd-card-head">
              <span class="bd-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></span>
              <h3>Payment</h3>
            </div>
            <div class="bd-pay-list">
              <div><span class="bd-label">Method</span>${methodPill(b.method)}</div>
              <div><span class="bd-label">Status</span>${paymentPill(b.paid)}</div>
              <div><span class="bd-label">Amount</span><strong>${money(b.price)}</strong></div>
              <div><span class="bd-label">Channel</span><strong>${channelLabel(b.method)}</strong></div>
              <div><span class="bd-label">Merchant</span><strong>${merchantLabel(b.method)}</strong></div>
              <div><span class="bd-label">Due date</span><strong>${b.status === "pending" && b.expiresAt ? createdLabel(b.expiresAt) : "—"}</strong></div>
            </div>
          </article>

          <article class="admin-card bd-card">
            <div class="bd-card-head">
              <h3>Internal</h3>
            </div>
            <div class="bd-pay-list">
              <div><span class="bd-label">Created</span><strong>${createdLabel(b.createdAt || b.paidAt)}</strong></div>
              <div><span class="bd-label">Reference</span><strong>${b.ref}</strong></div>
            </div>
          </article>
        </div>
      </div>`;

    showView("booking-detail");
  }

  function updateBookingStatus(ref, status) {
    const all = loadBookings();
    const idx = all.findIndex((x) => x.ref === ref);
    if (idx < 0) return;
    all[idx] = {
      ...all[idx],
      status,
      payment: {
        ...(all[idx].payment || {}),
        status: status === "confirmed" ? "paid" : status === "pending" ? "pending" : "failed",
      },
    };
    saveBookings(all);
    refresh();
    viewBooking(ref);
  }

  function dashRowHtml(b) {
    return `
      <tr>
        <td><a href="#" data-view-ref="${b.ref}">${b.ref || "—"}</a></td>
        <td><strong>${b.name || "Guest"}</strong><br><span class="admin-muted">${b.phone || "—"}</span></td>
        <td>${typePill(b.type)}</td>
        <td>${niceDate(b.date)}</td>
        <td>${b.items.map((item) => `Court ${courtNumber(item.courtId)}`).join(", ") || "—"}</td>
        <td>${b.items.map((item) => `Court ${courtNumber(item.courtId)}: ${hoursOf(item).length} slots`).join("<br>") || "—"}</td>
        <td>${money(b.price)}</td>
        <td>${methodPill(b.method)}</td>
        <td>${paymentPill(b.paid)}</td>
        <td>${statusPill(b.status)}</td>
      </tr>`;
  }

  function managementRowHtml(b) {
    return `
      <tr>
        <td>
          <strong>${b.ref || "—"}</strong>
          <div class="admin-badges">${typePill(b.type)}</div>
        </td>
        <td>
          <strong>${b.name || "Guest"}</strong><br>
          <span class="admin-muted">${b.phone || "—"}</span>
        </td>
        <td>
          ${niceDate(b.date)}<br>
          <span class="admin-muted">${b.items.map((item) => `Court ${courtNumber(item.courtId)} · ${hoursOf(item).length} slots`).join(" · ")}</span>
        </td>
        <td>${money(b.price)}</td>
        <td>
          <div class="admin-badges">${methodPill(b.method)}${paymentPill(b.paid)}</div>
        </td>
        <td>${statusPill(b.status)}</td>
        <td><button type="button" class="admin-btn admin-btn-dark admin-btn-sm" data-view-ref="${b.ref}">View booking</button></td>
      </tr>`;
  }

  function emptyRows(cols, msg) {
    return `<tr><td colspan="${cols}" class="admin-empty">${msg}</td></tr>`;
  }

  function statsFrom(list) {
    const confirmed = list.filter((b) => b.status === "confirmed");
    const pending = list.filter((b) => b.status === "pending");
    const refunded = list.filter((b) => b.status === "cancelled" || b.status === "failed" || b.paid === "failed");
    const online = list.filter((b) => !String(b.type).includes("Walk"));
    const walkin = list.filter((b) => String(b.type).includes("Walk"));
    return {
      total: list.length,
      confirmed: confirmed.length,
      pending: pending.length,
      revenue: confirmed.reduce((sum, b) => sum + b.price, 0),
      refundTotal: refunded.reduce((sum, b) => sum + b.price, 0),
      refunded: refunded.length,
      online: online.length,
      walkin: walkin.length,
    };
  }

  function renderStats(el, stats) {
    if (!el) return;
    const cards = [
      ["Total bookings", stats.total, "▣", "primary"],
      ["Confirmed", stats.confirmed, "✓", "primary"],
      ["Pending", stats.pending, "⏳", "primary"],
      ["Net revenue", money(stats.revenue), "₱", "primary"],
      ["Total refunds", money(stats.refundTotal), "↺", "secondary"],
      ["Refunded", stats.refunded, "✕", "secondary"],
      ["Online", stats.online, "◎", "secondary"],
      ["Walk-in", stats.walkin, "👤", "secondary"],
    ];
    el.innerHTML = cards
      .map(
        ([label, value, icon, tier]) => `
      <article class="admin-stat is-${tier}">
        <div class="admin-stat-icon" aria-hidden="true">${icon}</div>
        <div class="admin-stat-copy">
          <p>${label}</p>
          <strong>${value}</strong>
        </div>
      </article>`
      )
      .join("");
  }

  function renderUpcoming(list) {
    const today = todayISO();
    const upcoming = list
      .filter((b) => (b.status === "confirmed" || b.status === "pending") && b.date >= today)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.ref).localeCompare(String(b.ref)))
      .slice(0, 6);
    const el = document.getElementById("dashUpcoming");
    if (!upcoming.length) {
      el.innerHTML = `<p class="admin-empty">No upcoming bookings.</p>`;
      return;
    }
    el.innerHTML = `<div class="admin-list">${upcoming
      .map(
        (b) => `
      <button type="button" class="admin-list-item is-button" data-view-ref="${b.ref}">
        <div class="admin-list-main">
          <div class="admin-list-top">
            <strong class="admin-list-ref">${b.ref}</strong>
            <strong class="admin-list-amount">${money(b.price)}</strong>
          </div>
          <span class="admin-list-sub">${b.name || "Guest"} · ${niceDate(b.date)}</span>
          <div class="admin-badges">${typePill(b.type)}${statusPill(b.status)}</div>
        </div>
      </button>`
      )
      .join("")}</div>`;
  }

  function renderTransactions(targetId, list, limit = 8) {
    const el = document.getElementById(targetId);
    const rows = list.slice(0, limit);
    if (!rows.length) {
      el.innerHTML = `<p class="admin-empty">No transactions yet.</p>`;
      return;
    }
    el.innerHTML = `<div class="admin-list">${rows
      .map(
        (b) => `
      <button type="button" class="admin-list-item is-button" data-view-ref="${b.ref}">
        <div class="admin-list-main">
          <div class="admin-list-top">
            <strong class="admin-list-ref">${b.ref || "—"}</strong>
            <strong class="admin-list-amount">${money(b.price)}</strong>
          </div>
          <span class="admin-list-sub">${b.name || "Guest"} · ${methodLabel(b.method)}</span>
          <div class="admin-list-bottom">
            <div class="admin-badges">${methodPill(b.method)}${paymentPill(b.paid)}</div>
            ${statusPill(b.status)}
          </div>
        </div>
      </button>`
      )
      .join("")}</div>`;
  }

  function renderCourts() {
    document.getElementById("courtsGrid").innerHTML = courts
      .map(
        (c, i) => `
      <article class="admin-court-card">
        <img src="${c.image}" alt="${c.imageAlt}" loading="lazy" />
        <div>
          <h3>Court ${i + 1} · ${c.name}</h3>
          <p>${c.badge} · ${c.bestFor}</p>
        </div>
      </article>`
      )
      .join("");
  }

  function renderPricing() {
    document.getElementById("pricingGrid").innerHTML = `
      <article class="admin-price-card">
        <h3>Morning</h3>
        <p class="admin-muted">Monday – Sunday · 7 AM – 4 PM</p>
        <p class="price">${money(ARM.rates.morning.price)}</p>
        <p class="admin-muted">Per court / hour</p>
      </article>
      <article class="admin-price-card">
        <h3>Night</h3>
        <p class="admin-muted">Monday – Sunday · 5 PM – 6 AM</p>
        <p class="price">${money(ARM.rates.night.price)}</p>
        <p class="admin-muted">Per court / hour</p>
      </article>`;
  }

  function renderAvailability(list) {
    const today = todayISO();
    document.getElementById("availDate").textContent = niceDate(today);
    document.getElementById("availabilityList").innerHTML = courts
      .map((c, i) => {
        const taken = slotHours.filter((hour) => !!findSlotBooking(list, today, c.id, hour)).length;
        const pct = Math.round((taken / slotHours.length) * 100);
        return `
          <div class="admin-avail-row">
            <div>
              <strong>Court ${i + 1} · ${c.name}</strong>
              <span class="admin-muted">${taken} / ${slotHours.length} slots booked today</span>
            </div>
            <div class="admin-bar"><span style="width:${pct}%"></span></div>
            <strong>${pct}%</strong>
          </div>`;
      })
      .join("");
  }

  function renderNotifications(list) {
    const notes = [];
    const pending = list.filter((b) => b.status === "pending");
    if (pending.length) {
      notes.push({
        title: `${pending.length} pending payment hold${pending.length === 1 ? "" : "s"}`,
        body: "Courts are reserved until the checkout window ends.",
        kind: "warn",
      });
    }
    const today = todayISO();
    const todayCount = list.filter((b) => b.date === today && b.status === "confirmed").length;
    notes.push({
      title: `${todayCount} confirmed booking${todayCount === 1 ? "" : "s"} today`,
      body: "Synced from this browser’s demo booking storage.",
      kind: "info",
    });
    if (!list.length) {
      notes.unshift({
        title: "No bookings yet",
        body: "Run a booking on the public site to populate the admin dashboard.",
        kind: "info",
      });
    }
    document.getElementById("notificationsList").innerHTML = notes
      .map(
        (n) => `
      <div class="admin-list-item">
        <div>
          <strong>${n.title}</strong>
          <span>${n.body}</span>
        </div>
        <div class="admin-list-meta">${pill(n.kind, n.kind === "warn" ? "warn" : "info")}</div>
      </div>`
      )
      .join("");
  }

  function renderDaily(list) {
    const date = state.calDate;
    if (!state.calCourtId || !courts.some((c) => c.id === state.calCourtId)) {
      state.calCourtId = courts[0]?.id || "";
    }
    document.getElementById("calRangeLabel").textContent = niceDate(date, { weekday: "long" });

    const head = courts.map((c, i) => `<th>Court ${i + 1}</th>`).join("");
    const rows = slotHours
      .map((hour) => {
        const cells = courts
          .map((c) => {
            const hit = findSlotBooking(list, date, c.id, hour);
            if (!hit) {
              return `<td><button type="button" class="cal-chip is-open" data-book-slot data-date="${date}" data-court="${c.id}" data-hour="${hour}">Available</button></td>`;
            }
            const cls = hit.status === "pending" ? "is-warn" : "is-ok";
            return `<td><button type="button" class="cal-chip ${cls}" data-view-ref="${hit.ref}">${hit.name || hit.ref}</button></td>`;
          })
          .join("");
        return `<tr><th>${slotLabel(hour)}</th>${cells}</tr>`;
      })
      .join("");

    const activeCourt = courts.find((c) => c.id === state.calCourtId) || courts[0];
    const activeIndex = Math.max(0, courts.findIndex((c) => c.id === state.calCourtId));
    const mobileSlots = slotHours
      .map((hour) => {
        const hit = findSlotBooking(list, date, state.calCourtId, hour);
        if (!hit) {
          return `
            <button type="button" class="admin-day-slot is-open" data-book-slot data-date="${date}" data-court="${state.calCourtId}" data-hour="${hour}">
              <span class="admin-day-slot-time">${slotLabel(hour)}</span>
              <span class="cal-chip is-open">Available</span>
            </button>`;
        }
        const cls = hit.status === "pending" ? "is-warn" : "is-ok";
        return `
          <button type="button" class="admin-day-slot ${cls}" data-view-ref="${hit.ref}">
            <span class="admin-day-slot-time">${slotLabel(hour)}</span>
            <span class="admin-day-slot-info">
              <strong>${hit.name || hit.ref}</strong>
              <span class="cal-chip ${cls}">${hit.status === "pending" ? "Pending" : "Confirmed"}</span>
            </span>
          </button>`;
      })
      .join("");

    document.getElementById("calCanvas").innerHTML = `
      <div class="admin-cal-desktop">
        <div class="admin-table-wrap admin-cal-scroll">
          <table class="admin-cal-table">
            <thead><tr><th>Time</th>${head}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <div class="admin-cal-mobile">
        <div class="admin-court-tabs" role="tablist" aria-label="Courts">
          ${courts
            .map(
              (c, i) => `
            <button type="button" class="admin-court-tab${c.id === state.calCourtId ? " is-active" : ""}" data-cal-court="${c.id}" role="tab" aria-selected="${c.id === state.calCourtId}">
              Court ${i + 1}
            </button>`
            )
            .join("")}
        </div>
        <div class="admin-day-court-head">
          <strong>Court ${activeIndex + 1} · ${activeCourt?.name || "Court"}</strong>
          <span class="admin-muted">${niceDate(date, { weekday: "short", month: "short", year: false })}</span>
        </div>
        <div class="admin-day-slots">${mobileSlots}</div>
      </div>`;
  }

  function renderWeekly(list) {
    const start = startOfWeek(state.calDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    document.getElementById("calRangeLabel").textContent = `${niceDate(days[0], { month: "short", year: false })} – ${niceDate(days[6], { month: "short" })}`;
    const totalSlots = courts.length * slotHours.length;
    document.getElementById("calCanvas").innerHTML = `
      <div class="admin-week-grid">
        ${days
          .map((iso) => {
            const dayBookings = bookingsOnDate(list, iso);
            const taken = dayBookings.reduce((sum, b) => sum + b.hourCount, 0);
            const open = Math.max(0, totalSlots - taken);
            const sample = dayBookings[0];
            return `
            <button type="button" class="admin-week-cell" data-jump-day="${iso}">
              <header>
                <strong>${niceDate(iso, { weekday: "short", month: "short", year: false })}</strong>
                ${dayBookings.length ? `<span class="admin-count">${dayBookings.length}</span>` : `<span class="cal-chip is-open">Open</span>`}
              </header>
              ${
                sample
                  ? `<p class="admin-week-booking">${slotLabel(hoursOf(sample.items[0])[0] || slotHours[0])} ${sample.name || ""}</p>`
                  : `<p class="cal-chip is-open">Available</p><span class="admin-muted">Click to book or review hours</span>`
              }
              <p class="admin-muted">${open} hours open</p>
            </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderMonthly(list) {
    const d = dateFromISO(state.calDate);
    const cells = monthMatrix(state.calDate);
    document.getElementById("calRangeLabel").textContent = d.toLocaleDateString(locale, {
      timeZone,
      month: "long",
      year: "numeric",
    });
    document.getElementById("calCanvas").innerHTML = `
      <div class="admin-month-grid">
        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<div class="admin-month-dow">${d}</div>`).join("")}
        ${cells
          .map((iso) => {
            if (!iso) return `<div class="admin-month-cell is-empty"></div>`;
            const dayBookings = bookingsOnDate(list, iso);
            const sample = dayBookings[0];
            const isToday = iso === todayISO();
            const isSelected = iso === state.calDate;
            return `
              <button type="button" class="admin-month-cell${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}" data-jump-day="${iso}">
                <span class="admin-month-num">${Number(iso.slice(8))}</span>
                ${
                  sample
                    ? `<span class="admin-month-event">${slotLabel(hoursOf(sample.items[0])[0] || slotHours[0]).split(" – ")[0]} ${sample.name || ""}</span>`
                    : `<span class="cal-chip is-open">Available</span>`
                }
              </button>`;
          })
          .join("")}
      </div>`;
  }

  function renderCalendar(list) {
    document.getElementById("calDateInput").value = state.calDate;
    document.querySelectorAll("[data-cal-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.calMode === state.calMode);
    });
    if (state.calMode === "weekly") renderWeekly(list);
    else if (state.calMode === "monthly") renderMonthly(list);
    else renderDaily(list);
  }

  function filteredBookings(list) {
    const q = state.filters.search.trim().toLowerCase();
    return list.filter((b) => {
      if (state.filters.status && b.status !== state.filters.status) return false;
      if (state.filters.type === "online" && String(b.type).includes("Walk")) return false;
      if (state.filters.type === "walk-in" && !String(b.type).includes("Walk")) return false;
      if (state.filters.method && b.method !== state.filters.method) return false;
      if (!q) return true;
      const hay = `${b.ref} ${b.name} ${b.email} ${b.phone}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function renderBookingsTable(list) {
    const filtered = filteredBookings(list);
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * state.pageSize;
    const slice = filtered.slice(start, start + state.pageSize);
    const end = total ? Math.min(total, start + slice.length) : 0;
    document.getElementById("bookingsPagerLabel").textContent = total
      ? `Showing ${start + 1}–${end} of ${total}`
      : "Showing 0";
    document.getElementById("bookingsBody").innerHTML =
      slice.map(managementRowHtml).join("") || emptyRows(7, "No bookings match these filters.");
    const cards = document.getElementById("bookingsCards");
    if (cards) {
      cards.innerHTML = slice.length
        ? slice.map(bookingCardHtml).join("")
        : `<p class="admin-empty">No bookings match these filters.</p>`;
    }
    const nums = document.getElementById("pageNumbers");
    nums.innerHTML = Array.from({ length: pages }, (_, i) => {
      const p = i + 1;
      return `<button type="button" class="admin-page-btn${p === state.page ? " is-active" : ""}" data-page="${p}">${p}</button>`;
    }).join("");
  }

  function refresh() {
    const list = allBookings();
    const stats = statsFrom(list);
    renderStats(document.getElementById("dashStats"), stats);
    renderStats(document.getElementById("reportStats"), stats);
    renderUpcoming(list);
    renderTransactions("dashTransactions", list, 6);
    renderTransactions("transactionsList", list, 40);
    const recent = list.slice(0, 8);
    document.getElementById("dashRecentBody").innerHTML =
      recent.map(dashRowHtml).join("") || emptyRows(10, "No bookings yet.");
    const recentCards = document.getElementById("dashRecentCards");
    if (recentCards) {
      recentCards.innerHTML = recent.length
        ? recent.map(bookingCardHtml).join("")
        : `<p class="admin-empty">No bookings yet.</p>`;
    }
    renderCalendar(list);
    renderBookingsTable(list);
    renderCourts();
    renderPricing();
    renderAvailability(list);
    renderNotifications(list);
  }

  function setNavOpen(open) {
    document.body.classList.toggle("is-nav-open", open);
    const btn = document.getElementById("adminMenuBtn");
    if (btn) {
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }
    const scrim = document.getElementById("adminScrim");
    if (scrim) scrim.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function showView(name) {
    document.querySelectorAll(".admin-view").forEach((view) => {
      const on = view.id === `view-${name}`;
      view.hidden = !on;
      view.classList.toggle("is-active", on);
    });
    const navName = name === "booking-detail" ? "bookings" : name;
    document.querySelectorAll(".admin-nav-link[data-view]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.view === navName);
    });
    const active = document.getElementById(`view-${name}`);
    const title =
      name === "booking-detail" && detailRef
        ? `Booking ${detailRef}`
        : active?.dataset.title || "Admin";
    document.getElementById("adminTitle").textContent = title;
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function setupManual() {
    const dialog = document.getElementById("manualDialog");
    const courtSel = document.getElementById("manualCourt");
    const hourSel = document.getElementById("manualHour");
    const dateInput = document.getElementById("manualDate");
    courtSel.innerHTML = courts.map((c, i) => `<option value="${c.id}">Court ${i + 1} · ${c.name}</option>`).join("");
    hourSel.innerHTML = slotHours.map((h) => `<option value="${h}">${slotLabel(h)}</option>`).join("");
    dateInput.value = todayISO();

    document.getElementById("manualBookingBtn").addEventListener("click", () => openManual({ date: state.calDate }));
    document.getElementById("manualPhone").addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 11);
    });

    document.getElementById("manualSave").addEventListener("click", (e) => {
      e.preventDefault();
      const name = document.getElementById("manualName").value.trim();
      const phone = document.getElementById("manualPhone").value.replace(/\D/g, "");
      const date = dateInput.value || todayISO();
      const courtId = courtSel.value;
      const hour = Number(hourSel.value);
      if (!name || !phone) return;
      const court = courts.find((c) => c.id === courtId);
      const booking = {
        ref: `ARM-${Math.floor(Math.random() * 9000) + 1000}`,
        status: "confirmed",
        type: "Walk-in",
        date,
        items: [{ courtId, courtName: court?.name || "Court", hours: [hour] }],
        name,
        phone,
        email: "",
        price: priceForHour(hour),
        createdAt: new Date().toISOString(),
        payment: { method: "walk-in", demo: true },
      };
      const all = loadBookings();
      all.push(booking);
      saveBookings(all);
      dialog.close();
      document.getElementById("manualName").value = "";
      document.getElementById("manualPhone").value = "";
      refresh();
      showView("bookings");
    });
  }

  function setupCalendar() {
    document.querySelectorAll("[data-cal-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.calMode = btn.dataset.calMode;
        refresh();
      });
    });
    document.getElementById("calToday").addEventListener("click", () => {
      state.calDate = todayISO();
      refresh();
    });
    document.getElementById("calPrev").addEventListener("click", () => {
      if (state.calMode === "monthly") state.calDate = addDays(state.calDate.slice(0, 8) + "01", -1);
      else if (state.calMode === "weekly") state.calDate = addDays(state.calDate, -7);
      else state.calDate = addDays(state.calDate, -1);
      refresh();
    });
    document.getElementById("calNext").addEventListener("click", () => {
      if (state.calMode === "monthly") {
        const d = dateFromISO(state.calDate);
        d.setUTCMonth(d.getUTCMonth() + 1);
        state.calDate = toISO(d);
      } else if (state.calMode === "weekly") state.calDate = addDays(state.calDate, 7);
      else state.calDate = addDays(state.calDate, 1);
      refresh();
    });
    document.getElementById("calDateInput").addEventListener("change", (e) => {
      if (e.target.value) {
        state.calDate = e.target.value;
        refresh();
      }
    });
  }

  function setupFilters() {
    document.getElementById("filterApply").addEventListener("click", () => {
      state.filters.search = document.getElementById("filterSearch").value;
      state.filters.status = document.getElementById("filterStatus").value;
      state.filters.type = document.getElementById("filterType").value;
      state.filters.method = document.getElementById("filterMethod").value;
      state.page = 1;
      refresh();
    });
    document.getElementById("filterSearch").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("filterApply").click();
    });
    document.getElementById("rowsPerPage").addEventListener("change", (e) => {
      state.pageSize = Number(e.target.value) || 10;
      state.page = 1;
      refresh();
    });
    document.getElementById("pagePrev").addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      refresh();
    });
    document.getElementById("pageNext").addEventListener("click", () => {
      state.page += 1;
      refresh();
    });
    document.getElementById("pageNumbers").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-page]");
      if (!btn) return;
      state.page = Number(btn.dataset.page);
      refresh();
    });
  }

  document.getElementById("adminNav").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    showView(btn.dataset.view);
  });

  document.querySelectorAll(".admin-link[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.getElementById("adminMenuBtn").addEventListener("click", () => {
    setNavOpen(!document.body.classList.contains("is-nav-open"));
  });

  document.getElementById("adminScrim")?.addEventListener("click", () => setNavOpen(false));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setNavOpen(false);
  });

  document.body.addEventListener("click", (e) => {
    if (e.target.closest("[data-back-bookings]")) {
      showView("bookings");
      return;
    }
    const rebook = e.target.closest("[data-bd-rebook]");
    if (rebook && detailRef) {
      const b = allBookings().find((x) => x.ref === detailRef);
      if (b) {
        openManual({
          date: b.date,
          courtId: b.items[0]?.courtId,
          hour: hoursOf(b.items[0] || {})[0],
        });
      }
      return;
    }
    const refund = e.target.closest("[data-bd-refund]");
    if (refund && detailRef) {
      if (confirm("Mark this booking as refunded / cancelled?")) {
        updateBookingStatus(detailRef, "cancelled");
      }
      return;
    }
    const cancel = e.target.closest("[data-bd-cancel]");
    if (cancel && detailRef) {
      if (confirm("Cancel this booking?")) {
        updateBookingStatus(detailRef, "cancelled");
      }
      return;
    }
    const courtTab = e.target.closest("[data-cal-court]");
    if (courtTab) {
      state.calCourtId = courtTab.dataset.calCourt;
      renderCalendar(allBookings());
      return;
    }
    const jump = e.target.closest("[data-jump-day]");
    if (jump) {
      state.calDate = jump.dataset.jumpDay;
      state.calMode = "daily";
      refresh();
      return;
    }
    const slot = e.target.closest("[data-book-slot]");
    if (slot) {
      openManual({
        date: slot.dataset.date,
        courtId: slot.dataset.court,
        hour: Number(slot.dataset.hour),
      });
      return;
    }
    const view = e.target.closest("[data-view-ref]");
    if (view) {
      e.preventDefault();
      viewBooking(view.dataset.viewRef);
    }
  });

  setupManual();
  setupCalendar();
  setupFilters();
  refresh();
  showView("dashboard");

  document.getElementById("adminLogout")?.addEventListener("click", () => {
    clearAuth();
    location.href = "/login.html";
  });
})();
