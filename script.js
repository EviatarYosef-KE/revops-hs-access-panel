let adminCode = null;

const els = {
  adminCode: document.getElementById("adminCode"),
  unlockBtn: document.getElementById("unlockBtn"),
  gatewayUrl: document.getElementById("gatewayUrl"),
  saveCfgBtn: document.getElementById("saveCfgBtn"),
  panel: document.getElementById("panel"),

  userEmail: document.getElementById("userEmail"),
  teamSelect: document.getElementById("teamSelect"),
  roleIdInput: document.getElementById("roleIdInput"),
  duration: document.getElementById("duration"),

  refreshTeamsBtn: document.getElementById("refreshTeamsBtn"),
  listRolesBtn: document.getElementById("listRolesBtn"),
  grantBtn: document.getElementById("grantBtn"),
  revokeBtn: document.getElementById("revokeBtn"),

  // optional in some versions
  listPassesBtn: document.getElementById("listPassesBtn"),
  revokeExpiredBtn: document.getElementById("revokeExpiredBtn"),

  output: document.getElementById("output"),
};

let btnDecipher = null;
let btnInspect = null;
let btnGrantPrimary = null;

/* =========================
 * Output helpers
 * ========================= */

function setOutput(obj) {
  if (!els.output) return;
  els.output.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

/* =========================
 * Local storage helpers
 * ========================= */

function getGatewayUrl() {
  return (localStorage.getItem("revops_gateway_url") || "").trim();
}

function setGatewayUrl(url) {
  localStorage.setItem("revops_gateway_url", String(url || "").trim());
}

/* =========================
 * API call (Vercel proxy -> Apps Script)
 * ========================= */

async function apiCall(action, payload = {}) {
  const gasUrl = getGatewayUrl();
  if (!gasUrl) throw new Error("Please save Apps Script Web App URL first.");

  const bodyPayload = { action, ...payload };
  if (adminCode) bodyPayload.adminCode = adminCode;

  const res = await fetch("/api/gateway", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gasUrl, payload: bodyPayload }),
  });

  const json = await res.json();
  return json;
}

/* =========================
 * Core actions
 * ========================= */

async function refreshTeams() {
  setOutput("Loading teams...");
  const data = await apiCall("listTeams");

  if (!data.ok) throw new Error(data.error || "Failed to load teams.");

  const teams = Array.isArray(data.result) ? data.result : [];
  if (els.teamSelect) {
    els.teamSelect.innerHTML = "";
    for (const t of teams) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.name || "(no name)"} (${t.id})`;
      els.teamSelect.appendChild(opt);
    }
  }

  setOutput({ ok: true, message: "Teams loaded", count: teams.length });
}

async function listRoles() {
  setOutput("Loading roles...");
  const data = await apiCall("listRoles");

  if (!data.ok) throw new Error(data.error || "Failed to load roles.");

  const roles = Array.isArray(data.result) ? data.result : [];
  
  setOutput({
    ok: true,
    message: "Roles loaded",
    count: roles.length,
    roles: roles,
    hint: "Copy a role ID and paste it in the 'Default Role ID' field if user has no roles"
  });
}

async function grantSecondary() {
  const email = (els.userEmail?.value || "").trim();
  const teamId = els.teamSelect?.value;
  const roleId = (els.roleIdInput?.value || "").trim();

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  setOutput("Granting (secondary)...");
  
  const payload = { email, teamId };
  if (roleId) payload.defaultRoleId = roleId;
  
  const res = await apiCall("grantAccess", payload);
  setOutput(res);
}

async function revokeAccess() {
  const email = (els.userEmail?.value || "").trim();
  const teamId = els.teamSelect?.value;

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  setOutput("Revoking...");
  const res = await apiCall("revokeAccess", { email, teamId });
  setOutput(res);
}

async function decipherTeams() {
  const email = (els.userEmail?.value || "").trim();
  if (!email) return alert("Enter a user email first.");

  setOutput("Deciphering teams...");
  const res = await apiCall("decipherTeams", { email });
  setOutput(res);

  // Reveal "Grant as PRIMARY" only if decipherTeams says user has no primary team
  const hasPrimary = !!(res && res.ok && res.result && res.result.hasPrimary === true);
  const explicitlyNoPrimary = !!(res && res.ok && res.result && res.result.hasPrimary === false);

  if (explicitlyNoPrimary) {
    showGrantPrimaryButton();
  } else {
    hideGrantPrimaryButton();
  }

  // If backend didn't return structure, default to hiding
  if (!hasPrimary && !explicitlyNoPrimary) hideGrantPrimaryButton();
}

async function inspectUser() {
  const email = (els.userEmail?.value || "").trim();
  if (!email) return alert("Enter a user email first.");

  setOutput("Inspecting user (detailed comparison)...");
  const res = await apiCall("inspectUser", { email });
  setOutput(res);
}

async function grantPrimary() {
  const email = (els.userEmail?.value || "").trim();
  const teamId = els.teamSelect?.value;
  const roleId = (els.roleIdInput?.value || "").trim();

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  setOutput("Granting as PRIMARY...");
  
  const payload = { email, teamId, mode: "primary" };
  if (roleId) payload.defaultRoleId = roleId;
  
  const res = await apiCall("grantAccess", payload);
  setOutput(res);
}

/* =========================
 * UI injection
 * ========================= */

function showGrantPrimaryButton() {
  if (btnGrantPrimary) return; // already exists
  if (!els.grantBtn || !els.grantBtn.parentNode) return;

  btnGrantPrimary = document.createElement("button");
  btnGrantPrimary.id = "btnGrantPrimary";
  btnGrantPrimary.textContent = "Grant as PRIMARY";
  btnGrantPrimary.style.marginLeft = "8px";
  btnGrantPrimary.style.fontWeight = "700";

  btnGrantPrimary.addEventListener("click", () => {
    grantPrimary().catch(e => setOutput({ ok: false, error: String(e?.message || e) }));
  });

  els.grantBtn.parentNode.appendChild(btnGrantPrimary);
}

function hideGrantPrimaryButton() {
  if (btnGrantPrimary) {
    btnGrantPrimary.remove();
    btnGrantPrimary = null;
  }
}

function ensureExtraButtons() {
  if (!els.grantBtn || !els.grantBtn.parentNode) return;

  // Decipher Teams button
  if (!btnDecipher) {
    btnDecipher = document.createElement("button");
    btnDecipher.id = "btnDecipherTeams";
    btnDecipher.textContent = "Decipher Teams";
    btnDecipher.style.marginLeft = "8px";
    btnDecipher.addEventListener("click", () => {
      decipherTeams().catch(e => setOutput({ ok: false, error: String(e?.message || e) }));
    });
    els.grantBtn.parentNode.appendChild(btnDecipher);
  }

  // Inspect User button
  if (!btnInspect) {
    btnInspect = document.createElement("button");
    btnInspect.id = "btnInspectUser";
    btnInspect.textContent = "Inspect User";
    btnInspect.style.marginLeft = "8px";
    btnInspect.addEventListener("click", () => {
      inspectUser().catch(e => setOutput({ ok: false, error: String(e?.message || e) }));
    });
    els.grantBtn.parentNode.appendChild(btnInspect);
  }
}

/* =========================
 * Unlock + config
 * ========================= */

function loadSaved() {
  const url = getGatewayUrl();
  if (url && els.gatewayUrl) els.gatewayUrl.value = url;

  const savedCode = sessionStorage.getItem("revops_admin_code");
  if (savedCode) {
    adminCode = savedCode;
    els.panel?.classList.remove("hidden");
    ensureExtraButtons();
  }
}

els.saveCfgBtn?.addEventListener("click", () => {
  const url = (els.gatewayUrl?.value || "").trim();
  setGatewayUrl(url);
  setOutput({ ok: true, savedGatewayUrl: url });
});

els.unlockBtn?.addEventListener("click", async () => {
  const code = (els.adminCode?.value || "").trim();
  if (!code) return alert("Enter admin code.");

  adminCode = code;
  sessionStorage.setItem("revops_admin_code", code);

  // optional validation: try a cheap call
  try {
    const test = await apiCall("ping");
    if (!test.ok) throw new Error(test.error || "Unlock validation failed.");

    els.panel?.classList.remove("hidden");
    ensureExtraButtons();
    setOutput({ ok: true, message: "Unlocked" });
  } catch (e) {
    sessionStorage.removeItem("revops_admin_code");
    adminCode = null;
    setOutput({ ok: false, error: String(e?.message || e) });
    alert(String(e?.message || e));
  }
});

/* =========================
 * Wire base buttons
 * ========================= */

els.refreshTeamsBtn?.addEventListener("click", () =>
  refreshTeams().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.listRolesBtn?.addEventListener("click", () =>
  listRoles().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.grantBtn?.addEventListener("click", () =>
  grantSecondary().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.revokeBtn?.addEventListener("click", () =>
  revokeAccess().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

// Optional legacy buttons if they exist
els.listPassesBtn?.addEventListener?.("click", async () => {
  try {
    setOutput("Listing passes...");
    const res = await apiCall("listPasses");
    setOutput(res);
  } catch (e) {
    setOutput({ ok: false, error: String(e?.message || e) });
  }
});

els.revokeExpiredBtn?.addEventListener?.("click", async () => {
  try {
    setOutput("Revoking expired passes...");
    const res = await apiCall("revokeExpiredPasses");
    setOutput(res);
  } catch (e) {
    setOutput({ ok: false, error: String(e?.message || e) });
  }
});

/* =========================
 * Init
 * ========================= */

loadSaved();
ensureExtraButtons();
hideGrantPrimaryButton();
