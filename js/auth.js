/* ════════════════════════════════════════════════
   RecruitAgents — auth.js
   Microsoft Entra authenticatie via MSAL.js v3.
   Config (clientId + tenantId) wordt opgeslagen in
   localStorage en is instelbaar via de Settings modal.
   ════════════════════════════════════════════════ */

const AUTH_KEYS = { clientId: "ra_msal_clientid", tenantId: "ra_msal_tenantid" };
const SCOPES    = ["openid", "profile", "User.Read"];

let msalInstance = null;
let currentAccount = null;

/* ── MSAL config ophalen uit localStorage ── */
function getMsalConfig() {
  const clientId = localStorage.getItem(AUTH_KEYS.clientId) || "";
  const tenantId = localStorage.getItem(AUTH_KEYS.tenantId) || "common";
  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin + window.location.pathname,
    },
    cache: { cacheLocation: "sessionStorage" },
  };
}

function isConfigured() {
  return !!localStorage.getItem(AUTH_KEYS.clientId);
}

/* ── UI helpers ── */
function showLoginScreen(message) {
  const screen = document.getElementById("login-screen");
  const main   = document.querySelector("main");
  const footer = document.querySelector("footer");
  if (message) {
    document.getElementById("login-message").textContent = message;
  }
  screen.hidden  = false;
  main.hidden    = true;
  footer.hidden  = true;
  document.getElementById("auth-user-info").hidden = true;
}

function showApp(account) {
  currentAccount = account;
  document.getElementById("login-screen").hidden = true;
  document.querySelector("main").hidden  = false;
  document.querySelector("footer").hidden = false;

  const info   = document.getElementById("auth-user-info");
  const name   = account.name || account.username || "Gebruiker";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  document.getElementById("auth-avatar").textContent  = initials;
  document.getElementById("auth-name").textContent    = name.split(" ")[0];
  info.hidden = false;
}

/* ── Login / Logout ── */
async function login() {
  if (!isConfigured()) {
    showLoginScreen("Vul eerst de Microsoft-configuratie in via ⚙ Instellingen.");
    document.getElementById("btn-settings").click();
    return;
  }
  try {
    const cfg = getMsalConfig();
    msalInstance = new msal.PublicClientApplication(cfg);
    await msalInstance.initialize();
    const result = await msalInstance.loginPopup({ scopes: SCOPES });
    msalInstance.setActiveAccount(result.account);
    showApp(result.account);
  } catch (err) {
    const msg = err.errorCode === "user_cancelled"
      ? "Inloggen geannuleerd."
      : "Inloggen mislukt: " + (err.message || err);
    document.getElementById("login-error").textContent = msg;
  }
}

async function logout() {
  if (!msalInstance) return;
  const account = msalInstance.getActiveAccount();
  try {
    await msalInstance.logoutPopup({ account });
  } catch (_) { /* popup blocked — still clear local state */ }
  msalInstance.setActiveAccount(null);
  currentAccount = null;
  showLoginScreen("");
  document.getElementById("login-error").textContent = "";
}

/* ── Silent SSO bij page load ── */
async function trysilentLogin() {
  if (!isConfigured()) {
    showLoginScreen("");
    return;
  }
  try {
    const cfg = getMsalConfig();
    msalInstance = new msal.PublicClientApplication(cfg);
    await msalInstance.initialize();

    // Handle redirect response (if any)
    await msalInstance.handleRedirectPromise();

    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      showLoginScreen("");
      return;
    }
    msalInstance.setActiveAccount(accounts[0]);
    const result = await msalInstance.acquireTokenSilent({
      scopes: SCOPES,
      account: accounts[0],
    });
    showApp(result.account);
  } catch (_) {
    showLoginScreen("");
  }
}

/* ── Settings: lezen / opslaan van MSAL-config ── */
function loadAuthSettings() {
  document.getElementById("setting-msal-clientid").value =
    localStorage.getItem(AUTH_KEYS.clientId) || "";
  document.getElementById("setting-msal-tenantid").value =
    localStorage.getItem(AUTH_KEYS.tenantId) || "";
}

function saveAuthSettings() {
  const clientId = document.getElementById("setting-msal-clientid").value.trim();
  const tenantId = document.getElementById("setting-msal-tenantid").value.trim();
  if (clientId) localStorage.setItem(AUTH_KEYS.clientId, clientId);
  if (tenantId) localStorage.setItem(AUTH_KEYS.tenantId, tenantId || "common");
  // Reset MSAL instance so it picks up new config on next login
  msalInstance = null;
}

/* ── Init ── */
document.addEventListener("DOMContentLoaded", () => {
  // Knoppenwiring
  document.getElementById("btn-login").addEventListener("click", login);
  document.getElementById("btn-logout").addEventListener("click", logout);

  // Settings modal: auth-velden laden/opslaan
  const settingsBtn  = document.getElementById("btn-settings");
  const saveBtn      = document.getElementById("btn-save-settings");
  const origSaveClick = saveBtn.onclick;
  settingsBtn.addEventListener("click", loadAuthSettings, { capture: true });
  saveBtn.addEventListener("click", saveAuthSettings, { capture: true });

  // Silent login proberen
  trysilentLogin();
});
