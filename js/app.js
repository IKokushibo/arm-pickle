(() => {
  const courtList = document.getElementById("courtList");
  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");
  const installBtn = document.getElementById("installBtn");
  const pwaStatus = document.getElementById("pwaStatus");

  function renderCourts() {
    courtList.innerHTML = ARM.courts
      .map(
        (c, index) => `
      <article class="court-item${index % 2 === 1 ? " court-item-reverse" : ""}">
        <figure class="court-media">
          <img src="${c.image}" alt="${c.imageAlt}" width="960" height="540" loading="lazy" />
        </figure>
        <div class="court-body">
          <p class="court-badge">${c.badge}</p>
          <h3>${c.name}</h3>
          <p>${c.description}</p>
          <ul class="court-specs">
            <li><span>Surface</span> ${c.surface}</li>
            <li><span>Lighting</span> ${c.lighting}</li>
            <li><span>Capacity</span> ${c.capacity}</li>
            <li><span>Best for</span> ${c.bestFor}</li>
          </ul>
          <a class="btn btn-accent court-book" href="/book.html?date=${ARM.todayISO()}&court=${encodeURIComponent(c.id)}" data-court="${c.id}">Book this court</a>
        </div>
      </article>`
      )
      .join("");
  }

  function setupNav() {
    navToggle.addEventListener("click", () => {
      const open = mobileNav.hasAttribute("hidden") === false;
      if (open) {
        mobileNav.hidden = true;
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open menu");
      } else {
        mobileNav.hidden = false;
        navToggle.setAttribute("aria-expanded", "true");
        navToggle.setAttribute("aria-label", "Close menu");
      }
    });

    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => {
        mobileNav.hidden = true;
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  let deferredPrompt = null;

  function setupInstall() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.hidden = false;
      if (pwaStatus) pwaStatus.textContent = "Install ready. Tap Install app for the home-screen experience.";
    });

    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      installBtn.hidden = true;
      if (pwaStatus) pwaStatus.textContent = "Installed. Open ARM Court from your home screen anytime.";
    });

    if (window.matchMedia("(display-mode: standalone)").matches) {
      if (pwaStatus) pwaStatus.textContent = "Running as installed app.";
    }
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) {
      if (pwaStatus) pwaStatus.textContent = "Service workers not supported in this browser.";
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (pwaStatus && !window.matchMedia("(display-mode: standalone)").matches) {
        pwaStatus.textContent = `PWA ready (${reg.scope}). Add to home screen on mobile.`;
      }
    } catch (err) {
      console.warn("SW registration failed", err);
      if (pwaStatus) pwaStatus.textContent = "PWA service worker needs HTTPS or localhost to install.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderCourts();
    setupNav();
    setupInstall();
    ARM.booking.init();
    registerSW();

    courtList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-court]");
      if (!btn) return;
      e.preventDefault();
      const courtId = btn.dataset.court;
      const date = ARM.todayISO();
      const url = new URL("book.html", window.location.href);
      url.searchParams.set("date", date);
      url.searchParams.set("court", courtId);
      window.location.href = url.href;
    });
  });
})();
