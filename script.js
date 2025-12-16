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

  output: document.getElementById("output"),
};

let grantPrimaryBtn = null;

/* =========================
 * Helpers
 * ========================= */

function setOutput(obj) {
  els.output.textContent =
    typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
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
    els.panel?.classList.remove("hidden");
  }
}

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

  return res.json();
}

/* =========================
 * Core actions
 * ========================= */

async function refreshTeams() {
  setOutput("Loading teams...");
  const data = await apiCall("listTeams");

  if (!data.ok) throw new Error(data.error);

  els.teamSelect.innerHTML = "";
  data.result.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    els.teamSelect.appendChild(opt);
  });

  setOutput({ ok: true, teamsLoaded: data.result.length });
}

async function grantSecondary() {
  const email = els.userEmail.value.trim();
  const teamId = els.teamSelect.value;

  if (!email || !teamId) return alert("Email and team are required.");

  setOutput("Granting secondary access...");
  const res = await apiCall("grantAccess", { email, teamId });
  setOutput(res);
}

async function grantPrimary() {
  const email = els.userEmail.value.trim();
  const teamId = els.teamSelect.value;

  if (!email || !teamId) return alert("Email and team are required.");

  setOutput("Granting PRIMARY access...");
  const res = await apiCall("grantAccess", {
    email,
    teamId,
    mode: "primary",
  });

  setOutput(res);
}

async function revokeAccess() {
  const email = els.userEmail.value.trim();
  const teamId = els.teamSelect.value;

  if (!email || !teamId) return alert("Email and team are required.");

  setOutput("Revoking access...");
  const res = await apiCall("revokeAccess", { email, teamId });
  setOutput(res);
}

async function decipherTeams() {
  const email = els.userEmail.value.trim();
  if (!email) return alert("Enter an email first.");

  setOutput("Deciphering teams...");
  const res = await apiCall("decipherTeams", { email });
  setOutput(res);

  // 🔥 Reveal Grant-as-Primary button ONLY if no primary team
  if (res.ok && res.result && res.result.hasPrimary === false) {
    revealGrantPrimary();
  } else {
    hideGrantPrimary();
  }
}

/* =========================
 * UI helpers
 * ========================= */

function revealGrantPrimary() {
  if (grantPrimaryBtn) return;

  grantPrimaryBtn = document.createElement("button");
  grantPrimaryBtn.textContent = "Grant as PRIMARY";
  grantPrimaryBtn.style.marginLeft = "8px";
  grantPrimaryBtn.style.background = "#ffb703";
  grantPrimaryBtn.style.fontWeight = "bold";

  grantPrimaryBtn.addEventListener("click", () =>
    grantPrimary().catch(e =>
      setOutput({ ok: false, error: e.message || e })
    )
  );

  els.grantBtn.parentNode.appendChild(grantPrimaryBtn);
}

function hideGrantPrimary() {
  if (grantPrimaryBtn) {
    grantPrimaryBtn.remove();
    grantPrimaryBtn = null;
  }
}

/* =========================
 * Wire events
 * ========================= */

els.saveCfgBtn?.addEventListener("click", () => {
  setGatewayUrl(els.gatewayUrl.value);
  setOutput({ ok: true, saved: els.gatewayUrl.value });
});

els.unlockBtn?.addEventListener("click", async () => {
  adminCode = els.adminCode.value.trim();
  sessionStorage.setItem("revops_admin_code", adminCode);
  els.panel?.classList.remove("hidden");
  setOutput({ ok: true, unlocked: true });
});

els.refreshTeamsBtn?.addEventListener("click", () =>
  refreshTeams().catch(e => setOutput(e))
);

els.grantBtn?.addEventListener("click", () =>
  grantSecondary().catch(e => setOutput(e))
);

els.revokeBtn?.addEventListener("click", () =>
  revokeAccess().catch(e => setOutput(e))
);

/* Add Decipher Teams button dynamically */
(function addDecipherButton() {
  const btn = document.createElement("button");
  btn.textContent = "Decipher Teams";
  btn.style.marginLeft = "8px";
  btn.addEventListener("click", () =>
    decipherTeams().catch(e => setOutput(e))
  );
  els.grantBtn.parentNode.appendChild(btn);
})();

/* =========================
 * Init
 * ========================= */

loadSaved();
