/* ════════════════════════════════════════════════
   RecruitAgents — app.proxy.js
   Variant van app.js die via de n8n-proxy werkt.
   Gebruik: vervang in index.html
     <script src="js/app.js"></script>
   door
     <script src="js/app.proxy.js"></script>
   en pas PROXY_URL hieronder aan.
   ════════════════════════════════════════════════ */

const PROXY_URL = "https://n8n.driessen.software/webhook/recruit-agents";
const SECRET_HEADER = "x-ra-key"; // moet matchen met je Header Auth credential in n8n

/* ── Settings (het key-veld bevat nu het webhook-secret) ── */
const $ = (sel) => document.querySelector(sel);
const settingsModal = $("#settings-modal");

document.addEventListener("DOMContentLoaded", () => {
  // Labels in de settings-modal aanpassen aan proxy-modus
  const keyLabel = $("#setting-apikey")?.closest("label");
  if (keyLabel) keyLabel.firstChild.textContent = "Webhook-secret (x-ra-key)";
  const modelLabel = $("#setting-model")?.closest("label");
  if (modelLabel) modelLabel.style.display = "none"; // model wordt serverside bepaald
  const warning = document.querySelector(".setting-warning");
  if (warning)
    warning.textContent =
      "Dit secret wordt alleen in deze browsersessie bewaard en gaat naar je eigen n8n-instance. De Anthropic API-key staat veilig serverside in n8n.";
});

function getSecret() {
  return sessionStorage.getItem("ra_apikey") || "";
}

$("#btn-settings").addEventListener("click", () => {
  $("#setting-apikey").value = getSecret();
  settingsModal.showModal();
});
$("#btn-save-settings").addEventListener("click", () => {
  sessionStorage.setItem("ra_apikey", $("#setting-apikey").value.trim());
  settingsModal.close();
});
$("#btn-close-settings").addEventListener("click", () => settingsModal.close());

/* ── Tabs ── */
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".agent-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $("#panel-" + tab.dataset.agent).classList.add("active");
  });
});

/* ── Proxy call ── */
async function callAgent(agent, input) {
  const secret = getSecret();
  if (!secret) {
    settingsModal.showModal();
    throw new Error("Vul eerst het webhook-secret in bij Instellingen.");
  }
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SECRET_HEADER]: secret,
    },
    body: JSON.stringify({ agent, input }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Proxy-fout (${res.status}):\n${body.slice(0, 400)}`);
  }
  const data = await res.json();
  if (!data.ok || !data.result) {
    throw new Error("Onverwacht antwoord van de proxy: " + JSON.stringify(data).slice(0, 200));
  }
  return data.result;
}

/* ── Helpers ── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const list = (items) => `<ul>${(items || []).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

function setLoading(el, label) {
  el.innerHTML = `<div class="output-loading"><div class="spinner"></div>${esc(label)}</div>`;
}
function setError(el, err) {
  el.innerHTML = `<div class="output-error">✗ ${esc(err.message || err)}</div>`;
}
function copyButton(text, label = "📋 Kopieer voor ATS") {
  const id = "copy-" + Math.random().toString(36).slice(2, 8);
  setTimeout(() => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(text);
      btn.textContent = "✓ Gekopieerd";
      setTimeout(() => (btn.textContent = label), 1800);
    });
  }, 0);
  return `<div class="copy-row"><button class="btn-ghost" id="${id}">${label}</button></div>`;
}

/* ════ Runners (prompts leven nu in n8n) ════ */
async function runScreening(out) {
  const vacature = $("#screening-vacancy").value.trim();
  const cv = $("#screening-cv").value.trim();
  if (!vacature || !cv) throw new Error("Vul zowel de vacaturetekst als het CV in.");
  const r = await callAgent("screening", { vacature, cv });
  const atsText = [
    `Matchscore: ${r.matchscore}/100`,
    `Advies: ${r.advies}`,
    ``,
    `Samenvatting: ${r.samenvatting}`,
    ``,
    `Sterke punten:\n${(r.sterktes || []).map((s) => "- " + s).join("\n")}`,
    ``,
    `Aandachtspunten:\n${(r.aandachtspunten || []).map((s) => "- " + s).join("\n")}`,
    ``,
    `Screeningsvragen:\n${(r.screeningsvragen || []).map((s) => "- " + s).join("\n")}`,
  ].join("\n");
  out.innerHTML = `
    <div class="result">
      <div class="score-ring">${esc(r.matchscore)}<small>/100</small></div>
      <h3>Matchanalyse</h3>
      <p>${esc(r.samenvatting)}</p>
      <h4>Advies</h4><p>${esc(r.advies)}</p>
      <h4>Sterke punten</h4>${list(r.sterktes)}
      <h4>Aandachtspunten</h4>${list(r.aandachtspunten)}
      <h4>Screeningsvragen</h4>${list(r.screeningsvragen)}
      ${copyButton(atsText)}
    </div>`;
}

async function runInterview(out) {
  const transcript = $("#interview-transcript").value.trim();
  const type = $("#interview-type").value;
  if (!transcript) throw new Error("Plak eerst een transcript of notities.");
  const r = await callAgent("interview", { type, transcript });
  out.innerHTML = `
    <div class="result">
      <h3>${esc(r.titel)}</h3>
      <p>${esc(r.samenvatting)}</p>
      <h4>Kernpunten</h4>${list(r.kernpunten)}
      <h4>Vaardigheden</h4><div>${(r.vaardigheden || []).map((v) => `<span class="badge">${esc(v)}</span>`).join("")}</div>
      <h4>Actiepunten</h4>${list(r.actiepunten)}
      <h4>Open vragen</h4>${list(r.openVragen)}
      <h4>ATS-notitie</h4><div class="msg-block">${esc(r.atsNotitie)}</div>
      ${copyButton(r.atsNotitie || "")}
    </div>`;
}

async function runOutreach(out) {
  const kandidaat = $("#outreach-candidate").value.trim();
  const vacature = $("#outreach-vacancy").value.trim();
  const toon = $("#outreach-tone").value;
  if (!kandidaat || !vacature) throw new Error("Vul kandidaatinformatie en vacaturecontext in.");
  const r = await callAgent("outreach", { kandidaat, vacature, toon });
  out.innerHTML = `
    <div class="result">
      <h3>Outreach</h3>
      <h4>Onderwerp</h4><p>${esc(r.onderwerp)}</p>
      <h4>E-mail</h4><div class="msg-block">${esc(r.email)}</div>
      ${copyButton(r.email, "📋 Kopieer e-mail")}
      <h4>LinkedIn-variant</h4><div class="msg-block">${esc(r.linkedin)}</div>
      ${copyButton(r.linkedin, "📋 Kopieer LinkedIn-bericht")}
    </div>`;
}

/* ── Run wiring ── */
const RUNNERS = { screening: runScreening, interview: runInterview, outreach: runOutreach };
const LOADING_LABELS = {
  screening: "Agent analyseert de match…",
  interview: "Agent structureert het gesprek…",
  outreach: "Agent schrijft je bericht…",
};

document.querySelectorAll("[data-run]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const agent = btn.dataset.run;
    const out = $("#output-" + agent);
    btn.disabled = true;
    setLoading(out, LOADING_LABELS[agent]);
    try {
      await RUNNERS[agent](out);
    } catch (err) {
      setError(out, err);
    } finally {
      btn.disabled = false;
    }
  });
});

/* ── Demo data ── */
const DEMO = {
  screening() {
    $("#screening-vacancy").value =
`Senior UX/UI Designer — softwarebedrijf (HR-tech, Nederland)
Wij zoeken een product designer die zelfstandig complexe softwareflows ontwerpt voor gebruikers in overheid, onderwijs en zorg. Sterk in Figma, design systems, usability testing en samenwerking met developers in een agile team.`;
    $("#screening-cv").value =
`Naam: R. Jansen
Ervaring: 6 jaar visual designer bij een recruitmentmarketingbureau. Campagnewebsites, employer branding, vacaturepagina's. Laatste 2 jaar UI-werk voor een intern dashboard. Tools: Figma, Adobe CC, Webflow. Geen design systems of usability testing genoemd.`;
  },
  interview() {
    $("#interview-type").value = "intakegesprek met kandidaat";
    $("#interview-transcript").value =
`Recruiter: Wat zoek je in een volgende stap?
Kandidaat: Ik werk 4 jaar als product designer bij een logistieke scale-up, maar het werk wordt steeds meer marketing. Ik wil terug naar complexe gebruikersflows.
Recruiter: Samenwerking met developers?
Kandidaat: Ik zit in het scrumteam, lever componenten in ons Figma design system en doe elk kwartaal gebruikerstesten.
Recruiter: Opzegtermijn en salaris?
Kandidaat: Eén maand, nu 4.800 bruto, ik mik op 5.200 à 5.500. Woon in Eindhoven, hybride met twee kantoordagen zou fijn zijn.`;
  },
  outreach() {
    $("#outreach-candidate").value =
`Product designer, 5 jaar ervaring bij SaaS-bedrijven, sterk portfolio met design systems en complexe B2B-flows. Werkt nu bij een fintech in Utrecht.`;
    $("#outreach-vacancy").value =
`Senior UX/UI Designer bij een Nederlands softwarebedrijf in HR-tech (overheid, onderwijs, zorg). Veel autonomie, eigen design system opzetten, klein productteam, kantoor in Brabant, hybride.`;
  },
};

document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", () => DEMO[btn.dataset.demo]());
});
