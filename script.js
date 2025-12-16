let adminCode = null;

const els = {
  adminCode: document.getElementById("adminCode"),
  unlockBtn: document.getElementById("unlockBtn"),
  gatewayUrl: document.getElementById("gatewayUrl"),
  saveCfgBtn: document.getElementById("saveCfgBtn"),
  panel: document.getElementById("panel"),

  userEmail: document.getElementById("userEmail"),
  teamSelect: document.getElementById("teamSelect"),
  duration: document.getElementById("duration"),

  refreshTeamsBtn: document.getElementById("refreshTeamsBtn"),
  grantBtn: document.getElementById("grantBtn"),
  revokeBtn: document.getElementById("revokeBtn"),

  listPassesBtn: document.getElementById("listPassesBtn"),
  revokeExpiredBtn: document.getElementById("revokeExpiredBtn"),

  output: document.getElementById("output"),
};

function setOutput(obj) {
  els.output.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function getGatewayUrl() {
  return (localStorage.getItem("revops_gateway_url") || "").trim();
}

function setGatewayUrl(url) {
  localStorage.setItem("revops_gateway_url", url.trim());
}

function loadSaved() {
  const url = getGatewayUrl();
  if (url) els.gatewayUrl.value = url;

  const savedCode = sessionStorage.getItem("revops_admin_code");
  if (savedCode) {
    adminCode = savedCode;
    if (els.panel) els.panel.classList.remove("hidden");
  }
}

/**
 * Calls Vercel proxy which calls Apps Script
 */
async function apiCall(action, payload = {}) {
  const gasUrl = getGatewayUrl();
  if (!gasUrl) throw new Error("Please save Apps Script Web App URL first.");

  const bodyPayload = { action, ...payload };
  if (adminCode) bodyPayload.adminCode = adminCode;

  const res = await fetch("/api/gateway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gasUrl,
      payload: bodyPayload,
    }),
  });

  const json = await res.json();
  return json;
}

async function refreshTeams() {
  setOutput("Loading teams...");
  const data = await apiCall("listTeams");

  if (!data.ok) throw new Error(data.error || "Failed to load teams.");

  const teams = data.result || [];
  els.teamSelect.innerHTML = "";

  for (const t of teams) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.name || "(no name)"} (${t.id})`;
    els.teamSelect.appendChild(opt);
  }

  setOutput({ ok: true, message: "Teams loaded", count: teams.length });
}

async function grantAccess() {
  const email = els.userEmail.value.trim();
  const teamId = els.teamSelect.value;
  const dur = els.duration.value;

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  const payload = { email, teamId };

  if (dur !== "permanent") payload.expiresInHours = Number(dur);

  setOutput("Granting...");
  const data = await apiCall("grantAccess", payload);
  setOutput(data);
}

async function revokeAccess() {
  const email = els.userEmail.value.trim();
  const teamId = els.teamSelect.value;

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  setOutput("Revoking...");
  const data = await apiCall("revokeAccess", { email, teamId });
  setOutput(data);
}

async function listPasses() {
  setOutput("Loading passes...");
  const data = await apiCall("listPasses");
  setOutput(data);
}

async function revokeExpired() {
  setOutput("Revoking expired passes...");
  const data = await apiCall("revokeExpiredPasses");
  setOutput(data);
}

/**
 * Decipher Teams:
 * Calls backend action "decipherTeams" (you must add it in Apps Script)
 */
async function decipherTeams() {
  const email = els.userEmail.value.trim();
  if (!email) return alert("Enter a user email first.");

  setOutput("Deciphering teams...");
  const data = await apiCall("decipherTeams", { email });
  setOutput(data);
}

/**
 * Adds a Decipher Teams button dynamically if it doesn't exist in HTML.
 * This avoids you touching index.html if you don't want to yet.
 */
function ensureDecipherButton() {
  if (!els.panel) return;

  // If button already exists, do nothing
  if (document.getElementById("decipherBtn")) return;

  // Try to insert into the first row of buttons (where refresh/grant/revoke usually are)
  const candidateRows = els.panel.querySelectorAll(".row");
  if (!candidateRows || candidateRows.length === 0) return;

  const btn = document.createElement("button");
  btn.id = "decipherBtn";
  btn.textContent = "Decipher Teams";
  btn.addEventListener("click", () => decipherTeams().catch(e => setOutput({ ok: false, error: String(e.message || e) })));

  // Put it next to Refresh Teams if possible
  candidateRows[0].appendChild(btn);
}

/* =========================
 * Wire up events
 * ========================= */

els.saveCfgBtn?.addEventListener("click", () => {
  const url = els.gatewayUrl.value.trim();
  setGatewayUrl(url);
  setOutput({ ok: true, savedGatewayUrl: url });
});

els.unlockBtn?.addEventListener("click", async () => {
  const code = els.adminCode.value.trim();
  if (!code) return alert("Enter admin code.");

  // Store in session only
  adminCode = code;
  sessionStorage.setItem("revops_admin_code", code);

  // Validate by calling an admin action
  try {
    const test = await apiCall("listPasses");
    if (!test.ok && String(test.error || "").toLowerCase().includes("unauthorized")) {
      throw new Error("Unauthorized: wrong admin code.");
    }

    els.panel?.classList.remove("hidden");
    ensureDecipherButton();
    setOutput({ ok: true, message: "Admin unlocked" });
  } catch (e) {
    sessionStorage.removeItem("revops_admin_code");
    adminCode = null;
    setOutput({ ok: false, error: String(e.message || e) });
    alert(String(e.message || e));
  }
});

els.refreshTeamsBtn?.addEventListener("click", () => refreshTeams().catch(e => setOutput({ ok: false, error: String(e.message || e) })));
els.grantBtn?.addEventListener("click", () => grantAccess().catch(e => setOutput({ ok: false, error: String(e.message || e) })));
els.revokeBtn?.addEventListener("click", () => revokeAccess().catch(e => setOutput({ ok: false, error: String(e.message || e) })));
els.listPassesBtn?.addEventListener("click", () => listPasses().catch(e => setOutput({ ok: false, error: String(e.message || e) })));
els.revokeExpiredBtn?.addEventListener("click", () => revokeExpired().catch(e => setOutput({ ok: false, error: String(e.message || e) })));

/* =========================
 * Init
 * ========================= */
loadSaved();
ensureDecipherButton();
