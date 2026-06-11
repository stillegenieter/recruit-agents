/* ════════════════════════════════════════════════
   RecruitAgents — app.js
   Drie AI-agents op de Anthropic Messages API.
   Demo-opzet: API-key client-side (sessionStorage).
   Productie: zet een backend-proxy (bijv. n8n) ertussen.
   ════════════════════════════════════════════════ */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-4-6";

/* ── Settings ── */
const $ = (sel) => document.querySelector(sel);
const settingsModal = $("#settings-modal");

function getSettings() {
  return {
    apiKey: sessionStorage.getItem("ra_apikey") || "",
    model: sessionStorage.getItem("ra_model") || DEFAULT_MODEL,
  };
}

$("#btn-settings").addEventListener("click", () => {
  const s = getSettings();
  $("#setting-apikey").value = s.apiKey;
  $("#setting-model").value = s.model;
  settingsModal.showModal();
});
$("#btn-save-settings").addEventListener("click", () => {
  sessionStorage.setItem("ra_apikey", $("#setting-apikey").value.trim());
  sessionStorage.setItem("ra_model", $("#setting-model").value.trim() || DEFAULT_MODEL);
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

/* ── API call ── */
async function callClaude(systemPrompt, userPrompt) {
  const { apiKey, model } = getSettings();
  if (!apiKey) {
    settingsModal.showModal();
    throw new Error("Vul eerst je Anthropic API-key in bij Instellingen.");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API-fout (${res.status}):\n${body.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
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

/* ════ AGENT 1: SCREENING ════ */
const SCREENING_SYSTEM = `Je bent een ervaren corporate recruiter die kandidaten screent voor softwarefuncties.
Je analyseert een CV tegen een vacature en geeft een eerlijke, onderbouwde matchanalyse in het Nederlands.
Wees kritisch: een hoge score moet verdiend zijn. Reageer UITSLUITEND met geldige JSON, zonder uitleg, zonder markdown-codeblokken, in exact dit formaat:
{
  "matchscore": <getal 0-100>,
  "samenvatting": "<2-3 zinnen kernoordeel>",
  "sterktes": ["<punt>", ...],
  "aandachtspunten": ["<punt>", ...],
  "screeningsvragen": ["<gerichte vraag voor het eerste gesprek>", ...],
  "advies": "<uitnodigen / twijfel / afwijzen, met één zin motivatie>"
}`;

async function runScreening(out) {
  const vacancy = $("#screening-vacancy").value.trim();
  const cv = $("#screening-cv").value.trim();
  if (!vacancy || !cv) throw new Error("Vul zowel de vacaturetekst als het CV in.");
  const result = await callClaude(
    SCREENING_SYSTEM,
    `VACATURE:\n${vacancy}\n\nCV:\n${cv}`
  );
  const atsText = [
    `Matchscore: ${result.matchscore}/100`,
    `Advies: ${result.advies}`,
    ``,
    `Samenvatting: ${result.samenvatting}`,
    ``,
    `Sterke punten:\n${(result.sterktes || []).map((s) => "- " + s).join("\n")}`,
    ``,
    `Aandachtspunten:\n${(result.aandachtspunten || []).map((s) => "- " + s).join("\n")}`,
    ``,
    `Screeningsvragen:\n${(result.screeningsvragen || []).map((s) => "- " + s).join("\n")}`,
  ].join("\n");
  out.innerHTML = `
    <div class="result">
      <div class="score-ring">${esc(result.matchscore)}<small>/100</small></div>
      <h3>Matchanalyse</h3>
      <p>${esc(result.samenvatting)}</p>
      <h4>Advies</h4><p>${esc(result.advies)}</p>
      <h4>Sterke punten</h4>${list(result.sterktes)}
      <h4>Aandachtspunten</h4>${list(result.aandachtspunten)}
      <h4>Screeningsvragen</h4>${list(result.screeningsvragen)}
      ${copyButton(atsText)}
    </div>`;
}

/* ════ AGENT 2: INTERVIEW ════ */
const INTERVIEW_SYSTEM = `Je bent een recruitment-assistent die gespreksverslagen maakt voor een ATS.
Je krijgt een (ruw) transcript of notities van een gesprek en maakt daar een professioneel, gestructureerd verslag van in het Nederlands.
Verzin niets dat niet in de input staat; markeer onduidelijkheden als open vraag. Reageer UITSLUITEND met geldige JSON, zonder markdown-codeblokken, in exact dit formaat:
{
  "titel": "<korte titel van het gesprek>",
  "samenvatting": "<3-5 zinnen>",
  "kernpunten": ["<belangrijkste inhoudelijke punt>", ...],
  "vaardigheden": ["<genoemde skill of competentie>", ...],
  "actiepunten": ["<concrete vervolgactie>", ...],
  "openVragen": ["<wat nog uitgezocht of gevraagd moet worden>", ...],
  "atsNotitie": "<compact verslag van max 150 woorden, geschikt als notitie in het kandidaat- of vacaturedossier>"
}`;

async function runInterview(out) {
  const transcript = $("#interview-transcript").value.trim();
  const type = $("#interview-type").value;
  if (!transcript) throw new Error("Plak eerst een transcript of notities.");
  const result = await callClaude(
    INTERVIEW_SYSTEM,
    `TYPE GESPREK: ${type}\n\nTRANSCRIPT/NOTITIES:\n${transcript}`
  );
  out.innerHTML = `
    <div class="result">
      <h3>${esc(result.titel)}</h3>
      <p>${esc(result.samenvatting)}</p>
      <h4>Kernpunten</h4>${list(result.kernpunten)}
      <h4>Vaardigheden</h4><div>${(result.vaardigheden || []).map((v) => `<span class="badge">${esc(v)}</span>`).join("")}</div>
      <h4>Actiepunten</h4>${list(result.actiepunten)}
      <h4>Open vragen</h4>${list(result.openVragen)}
      <h4>ATS-notitie</h4><div class="msg-block">${esc(result.atsNotitie)}</div>
      ${copyButton(result.atsNotitie || "")}
    </div>`;
}

/* ════ AGENT 3: OUTREACH ════ */
const OUTREACH_SYSTEM = `Je bent een recruiter die persoonlijke, niet-opdringerige outreachberichten schrijft in het Nederlands.
Geen clichés ("ik kwam je indrukwekkende profiel tegen"), geen overdreven enthousiasme. Concreet, menselijk, kort.
Reageer UITSLUITEND met geldige JSON, zonder markdown-codeblokken, in exact dit formaat:
{
  "onderwerp": "<onderwerpregel voor e-mail>",
  "email": "<volledige e-mailtekst incl. aanhef en afsluiting>",
  "linkedin": "<korte LinkedIn-variant van max 80 woorden>"
}`;

async function runOutreach(out) {
  const candidate = $("#outreach-candidate").value.trim();
  const vacancy = $("#outreach-vacancy").value.trim();
  const tone = $("#outreach-tone").value;
  if (!candidate || !vacancy) throw new Error("Vul kandidaatinformatie en vacaturecontext in.");
  const result = await callClaude(
    OUTREACH_SYSTEM,
    `KANDIDAAT:\n${candidate}\n\nVACATURE/CONTEXT:\n${vacancy}\n\nGEWENSTE TOON: ${tone}`
  );
  out.innerHTML = `
    <div class="result">
      <h3>Outreach</h3>
      <h4>Onderwerp</h4><p>${esc(result.onderwerp)}</p>
      <h4>E-mail</h4><div class="msg-block">${esc(result.email)}</div>
      ${copyButton(result.email, "📋 Kopieer e-mail")}
      <h4>LinkedIn-variant</h4><div class="msg-block">${esc(result.linkedin)}</div>
      ${copyButton(result.linkedin, "📋 Kopieer LinkedIn-bericht")}
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

/* ════ CV UPLOAD ════ */
(function () {
  const zone   = document.getElementById("cv-upload-zone");
  const input  = document.getElementById("cv-file-input");
  const btn    = document.getElementById("cv-upload-btn");
  const status = document.getElementById("cv-upload-status");
  const cvArea = document.getElementById("screening-cv");

  const ALLOWED = ["application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const ALLOWED_EXT = /\.(pdf|doc|docx)$/i;

  function setStatus(msg, type = "") {
    status.textContent = msg;
    status.className = "upload-status" + (type ? " " + type : "");
  }

  async function extractPdf(file) {
    // pdf.js 4.x via ESM — falls back to a simple ArrayBuffer read via the global pdfjsLib if loaded
    const arrayBuffer = await file.arrayBuffer();
    // Try global pdfjsLib (loaded as classic script elsewhere), else dynamic import
    let pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
      pdfjsLib = mod;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    const pdf   = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => it.str).join(" "));
    }
    return pages.join("\n\n");
  }

  async function extractDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  async function handleFile(file) {
    if (!file) return;
    const ok = ALLOWED.includes(file.type) || ALLOWED_EXT.test(file.name);
    if (!ok) {
      setStatus("Alleen PDF of Word (.doc/.docx) toegestaan.", "error");
      return;
    }
    setStatus(`Bezig met inlezen: ${file.name}…`, "loading");
    btn.disabled = true;
    try {
      let text = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractPdf(file);
      } else {
        text = await extractDocx(file);
      }
      if (!text.trim()) throw new Error("Geen tekst gevonden in het bestand.");
      cvArea.value = text.trim();
      setStatus(`✓ ${file.name} ingelezen (${text.trim().split(/\s+/).length} woorden)`);
    } catch (err) {
      setStatus("Fout: " + (err.message || err), "error");
    } finally {
      btn.disabled = false;
      input.value = "";
    }
  }

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", () => handleFile(input.files[0]));

  // Drag & drop
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });
})();

/* ── Demo data ── */
const DEMO = {
  screening() {
    $("#screening-vacancy").value =
`Senior UX/UI Designer — softwarebedrijf (HR-tech, Nederland)
Wij zoeken een product designer die zelfstandig complexe softwareflows ontwerpt voor gebruikers in overheid, onderwijs en zorg. Sterk in Figma, design systems, usability testing en samenwerking met developers in een agile team. Je vertaalt klantonderzoek naar werkende interfaces en bewaakt consistentie over meerdere producten.`;
    $("#screening-cv").value =
`Naam: R. Jansen
Ervaring: 6 jaar visual designer bij een recruitmentmarketingbureau. Ontwerp van campagnewebsites, employer branding en vacaturepagina's. Laatste 2 jaar ook UI-werk voor een intern dashboard. Tools: Figma, Adobe CC, Webflow. Geen ervaring met design systems of usability testing genoemd. HBO Communication & Multimedia Design.`;
  },
  interview() {
    $("#interview-type").value = "intakegesprek met kandidaat";
    $("#interview-transcript").value =
`Recruiter: Fijn dat je tijd had. Vertel eens, wat zoek je in een volgende stap?
Kandidaat: Ik werk nu 4 jaar als product designer bij een scale-up in de logistiek. Leuk team, maar het productwerk wordt steeds meer marketing. Ik wil terug naar complexe gebruikersflows, echt usability-werk.
Recruiter: Hoe werk je samen met developers?
Kandidaat: Heel nauw, ik zit in het scrumteam, lever componenten aan in ons design system in Figma, en draai mee in refinements. Ik doe ook zelf gebruikerstesten, ongeveer één ronde per kwartaal.
Recruiter: Wat is je opzegtermijn en salarisindicatie?
Kandidaat: Eén maand. Ik zit nu rond de 4.800 bruto, ik mik op 5.200 à 5.500.
Recruiter: Reistijd naar Helmond?
Kandidaat: Ik woon in Eindhoven, dus prima. Hybride zou wel fijn zijn, twee dagen kantoor.
Recruiter: Top. Ik plan een vervolg in met onze lead designer, waarschijnlijk volgende week.`;
  },
  outreach() {
    $("#outreach-candidate").value =
`Product designer, 5 jaar ervaring bij SaaS-bedrijven, sterk portfolio met design systems en complexe B2B-flows. Schrijft af en toe blogposts over usability testing. Werkt nu bij een fintech in Utrecht.`;
    $("#outreach-vacancy").value =
`Senior UX/UI Designer bij een Nederlands softwarebedrijf in HR-tech (overheid, onderwijs, zorg). Veel autonomie, eigen design system opzetten, klein hecht productteam, kantoor in Brabant met hybride werken.`;
  },
};

document.querySelectorAll("[data-demo]").forEach((btn) => {
  btn.addEventListener("click", () => DEMO[btn.dataset.demo]());
});
