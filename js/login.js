(() => {
  const AUTH_KEY = "arm_admin_auth";
  const DEMO_EMAIL = "admin@arm.court";
  const DEMO_PASSWORD = "admin";

  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const rememberInput = document.getElementById("rememberMe");
  const errorEl = document.getElementById("loginError");
  const toggleBtn = document.getElementById("togglePassword");

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

  function writeAuth(payload, remember) {
    const raw = JSON.stringify(payload);
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
    (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, raw);
  }

  const existing = readAuth();
  if (existing?.ok) {
    location.replace("/admin.html");
    return;
  }

  toggleBtn?.addEventListener("click", () => {
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    toggleBtn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = String(emailInput.value || "").trim().toLowerCase();
    const password = String(passwordInput.value || "");

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      writeAuth(
        {
          ok: true,
          email,
          at: Date.now(),
        },
        Boolean(rememberInput?.checked)
      );
      location.href = "/admin.html";
      return;
    }

    errorEl.hidden = false;
  });
})();
