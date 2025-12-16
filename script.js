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
    els.panel.classList.remove("hidden");
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
  setOutput({ message: "Teams loaded", count: teams.length });
}

els.saveCfgBtn.addEventListener("click", () => {
  const url = els.gatewayUrl.value.trim();
  setGatewayUrl(url);
  setOutput({ savedGatewayUrl: url });
});

els.unlockBtn.addEventListener("click", async () => {
  const code = els.adminCode.value.trim();
  if (!code) return alert("Enter admin code.");

  // We store in session only
  adminCode = code;
  sessionStorage.setItem("revops_admin_code", code);

  // quick validation: try an admin action that requires auth
  try {
    const test = await apiCall("listPasses");
    if (!test.ok && String(test.error || "").toLowerCase().includes("unauthorized")) {
      throw new Error("Unauthorized: wrong admin code.");
    }
    els.panel.classList.remove("hidden");
    setOutput({ message: "Admin unlocked" });
  } catch (e) {
    sessionStorage.removeItem("revops_admin_code");
    adminCode = null;
    setOutput({ error: String(e.message || e) });
    alert(String(e.message || e));
  }
});

els.refreshTeamsBtn.addEventListener("click", () => refreshTeams().catch(e => setOutput({ error: String(e.message || e) })));

els.grantBtn.addEventListener("click", async () => {
  try {
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

    if (!data.ok && String(data.error || "").toLowerCase().includes("unauthorized")) {
      alert("Unauthorized. Re-enter admin code.");
    }
  } catch (e) {
    setOutput({ error: String(e.message || e) });
  }
});

els.revokeBtn.addEventListener("click", async () => {
  try {
    const email = els.userEmail.value.trim();
    const teamId = els.teamSelect.value;

    if (!email) return alert("Enter a user email.");
    if (!teamId) return alert("Select a team.");

    setOutput("Revoking...");
    const data = await apiCall("revokeAccess", { email, teamId });
    setOutput(data);
  } catch (e) {
    setOutput({ error: String(e.message || e) });
  }
});

els.listPassesBtn.addEventListener("click", async () => {
  try {
    setOutput("Loading passes...");
    const data = await apiCall("listPasses");
    setOutput(data);
  } catch (e) {
    setOutput({ error: String(e.message || e) });
  }
});

els.revokeExpiredBtn.addEventListener("click", async () => {
  try {
    setOutput("Revoking expired passes...");
    const data = await apiCall("revokeExpiredPasses");
    setOutput(data);
  } catch (e) {
    setOutput({ error: String(e.message || e) });
  }
});

loadSaved();
