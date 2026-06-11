# RecruitAgents

Een prototype van AI-recruitment-agents, geïnspireerd op platformen zoals Carv, maar volledig eigen code en design — bedoeld als opstap naar integratie met je eigen ATS.

**Drie agents:**

| Agent | Input | Output |
|---|---|---|
| 🔎 **Screening Agent** | Vacaturetekst + CV | Matchscore, sterke punten, aandachtspunten, screeningsvragen, advies |
| 🎙 **Interview Agent** | Transcript of notities (bijv. uit Plaud) | Gestructureerd verslag + compacte ATS-notitie |
| ✉️ **Outreach Agent** | Kandidaatprofiel + vacaturecontext | Persoonlijke e-mail + LinkedIn-variant |

Volledig client-side (HTML/CSS/JS, geen build-stap), aangedreven door de [Anthropic Messages API](https://docs.claude.com).

## Snel starten (lokaal)

1. Clone of download deze repo.
2. Open `index.html` in je browser (of draai `npx serve .`).
3. Klik op **⚙ Instellingen** en vul je Anthropic API-key in (aanmaken via [console.anthropic.com](https://console.anthropic.com)).
4. Kies een agent, klik op **Demo-data laden** en daarna op de actieknop.

## Hosten op GitHub Pages

```bash
cd recruit-agents
git init
git add .
git commit -m "Initial commit: RecruitAgents prototype"
git branch -M main
git remote add origin https://github.com/stillegenieter/recruit-agents.git
git push -u origin main
```

Daarna op GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / root → Save.**
Na een minuut staat de app live op `https://stillegenieter.github.io/recruit-agents/`.

> Repo nog niet aangemaakt? Doe dat eerst via [github.com/new](https://github.com/new) met de naam `recruit-agents`.

## ⚠️ Beveiliging — lees dit

Dit is een **demo-opzet**: je API-key staat in `sessionStorage` van de browser en gaat rechtstreeks naar `api.anthropic.com` (via de header `anthropic-dangerous-direct-browser-access`). Dat is prima voor lokaal testen of een interne demo, maar **niet voor productie of een publieke site**:

- Iedereen die de pagina gebruikt, moet een eigen key invullen — zet **nooit** een key hardcoded in de code of in een publieke repo.
- Voor productie: zet een backend-proxy tussen frontend en Anthropic. Een **n8n-webhook** is hier ideaal voor — frontend POST naar je n8n-instance, n8n voegt de key serverside toe, roept de Anthropic API aan en stuurt de JSON terug. Pas dan `API_URL` in `js/app.js` aan.

## ATS-integratie

Elke agent levert gestructureerde JSON (zie de systeem-prompts in `js/app.js`). Die structuur kun je direct mappen op ATS-velden:

- **Screening** → kandidaatstatus, score-veld, notitie
- **Interview** → gespreksnotitie in kandidaat- of vacaturedossier
- **Outreach** → e-mailtemplate / berichtgeschiedenis

Typische productieflow: `ATS-webhook → n8n → Anthropic API → ATS-update`. De frontend wordt dan optioneel — de agents kunnen volledig headless draaien.

## Structuur

```
recruit-agents/
├── index.html        # UI met drie agent-panelen
├── css/styles.css    # Eigen design (dark, editorial)
└── js/app.js         # Agent-prompts, API-calls, rendering
```

## Aanpassen

- **Model wijzigen**: via ⚙ Instellingen, of `DEFAULT_MODEL` in `js/app.js`.
- **Prompts tunen**: de drie `*_SYSTEM`-constanten in `js/app.js` — pas ze aan op jullie tone-of-voice en ATS-velden.
- **Agent toevoegen**: kopieer een panel in `index.html` + een runner in `app.js`.

---

*Intern prototype — niet gelieerd aan Carv.com.*
