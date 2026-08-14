(() => {
  const courtList = document.getElementById("courtList");
  const navToggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");
  const installBtn = document.getElementById("installBtn");
  const installMenuBtn = document.getElementById("installMenuBtn");
  const installDialog = document.getElementById("installDialog");
  const installDialogBody = document.getElementById("installDialogBody");
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

  function closeMobileNav() {
    if (!mobileNav || !navToggle) return;
    mobileNav.hidden = true;
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
  }

  function setupNav() {
    navToggle.addEventListener("click", () => {
      const open = mobileNav.hasAttribute("hidden") === false;
      if (open) {
        closeMobileNav();
      } else {
        mobileNav.hidden = false;
        navToggle.setAttribute("aria-expanded", "true");
        navToggle.setAttribute("aria-label", "Close menu");
      }
    });

    mobileNav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => closeMobileNav());
    });
  }

  let deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function setInstallVisible(visible) {
    if (installBtn) installBtn.hidden = !visible;
    if (installMenuBtn) installMenuBtn.hidden = !visible;
  }

  function showInstallHelp() {
    if (!installDialog || !installDialogBody) return;
    installDialogBody.innerHTML = isIos()
      ? "On iPhone: tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>."
      : "On Android Chrome: tap the browser menu (<strong>⋮</strong>), then choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.";
    if (typeof installDialog.showModal === "function") {
      installDialog.showModal();
    } else {
      alert(installDialogBody.textContent);
    }
  }

  async function handleInstallClick() {
    closeMobileNav();

    if (isStandalone()) {
      setInstallVisible(false);
      if (pwaStatus) pwaStatus.textContent = "Already running as the installed app.";
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      setInstallVisible(false);
      return;
    }

    showInstallHelp();
  }

  function setupInstall() {
    if (isStandalone()) {
      setInstallVisible(false);
      if (pwaStatus) pwaStatus.textContent = "Running as installed app.";
      return;
    }

    // Always show in the burger menu; header button only after browser is ready.
    if (installMenuBtn) installMenuBtn.hidden = false;
    if (installBtn) installBtn.hidden = true;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) installBtn.hidden = false;
      if (installMenuBtn) installMenuBtn.hidden = false;
      if (pwaStatus) {
        pwaStatus.textContent = "Install ready. Open the menu and tap Install app.";
      }
    });

    [installBtn, installMenuBtn].forEach((btn) => {
      if (btn) btn.addEventListener("click", handleInstallClick);
    });

    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      setInstallVisible(false);
      if (pwaStatus) pwaStatus.textContent = "Installed. Open ARM Court from your home screen anytime.";
    });
  }

  async function registerSW() {
    if (!("serviceWorker" in navigator)) {
      if (pwaStatus) pwaStatus.textContent = "Service workers not supported in this browser.";
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (pwaStatus && !isStandalone()) {
        pwaStatus.textContent = `PWA ready (${reg.scope}). Use menu → Install app.`;
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
