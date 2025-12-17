let adminCode = null;
let loadedRoles = [];
let loadedTeams = [];
let currentUser = null;

const els = {
  adminCode: document.getElementById("adminCode"),
  unlockBtn: document.getElementById("unlockBtn"),
  gatewayUrl: document.getElementById("gatewayUrl"),
  saveCfgBtn: document.getElementById("saveCfgBtn"),
  panel: document.getElementById("panel"),

  userEmail: document.getElementById("userEmail"),
  teamSelect: document.getElementById("teamSelect"),
  roleSelect: document.getElementById("roleSelect"),
  duration: document.getElementById("duration"),

  refreshTeamsBtn: document.getElementById("refreshTeamsBtn"),
  listRolesBtn: document.getElementById("listRolesBtn"),
  inspectBtn: document.getElementById("inspectBtn"),
  decipherBtn: document.getElementById("decipherBtn"),
  grantSecondaryBtn: document.getElementById("grantSecondaryBtn"),
  grantPrimaryBtn: document.getElementById("grantPrimaryBtn"),
  assignRoleBtn: document.getElementById("assignRoleBtn"),
  revokeBtn: document.getElementById("revokeBtn"),

  listPassesBtn: document.getElementById("listPassesBtn"),
  revokeExpiredBtn: document.getElementById("revokeExpiredBtn"),

  outputFormatted: document.getElementById("outputFormatted"),
  outputRaw: document.getElementById("outputRaw"),
  userInfoCard: document.getElementById("userInfoCard"),
  resourceStatus: document.getElementById("resourceStatus"),
  actionHelp: document.getElementById("actionHelp"),
};

/* =========================
 * UI Helpers
 * ========================= */

function setOutput(obj, formatted = null) {
  // Raw JSON output
  if (els.outputRaw) {
    els.outputRaw.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  }

  // Formatted output
  if (els.outputFormatted) {
    if (formatted) {
      els.outputFormatted.innerHTML = formatted;
    } else {
      els.outputFormatted.innerHTML = formatOutput(obj);
    }
  }
}

function formatOutput(obj) {
  if (typeof obj === "string") return `<p>${escapeHtml(obj)}</p>`;
  
  if (!obj.ok) {
    return `<div class="alert alert-error">
      <strong>❌ Error:</strong> ${escapeHtml(obj.error || "Unknown error")}
    </div>`;
  }

  return `<div class="alert alert-success">
    <strong>✅ Success:</strong> ${escapeHtml(obj.message || "Operation completed")}
  </div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function showUserInfo(inspectData) {
  if (!els.userInfoCard) return;
  
  const merged = inspectData.merged || {};
  const fromList = inspectData.fromList || {};
  const fromFull = inspectData.fromFull || {};
  
  const hasRoles = merged.roleIds && Array.isArray(merged.roleIds) && merged.roleIds.length > 0;
  const hasPrimary = merged.primaryTeamId != null && String(merged.primaryTeamId).trim() !== "";
  const hasSecondary = merged.secondaryTeamIds && Array.isArray(merged.secondaryTeamIds) && merged.secondaryTeamIds.length > 0;

  // Find role names
  let roleNames = "None";
  if (hasRoles) {
    const names = merged.roleIds.map(id => {
      const role = loadedRoles.find(r => String(r.id) === String(id));
      return role ? role.name : `Role ${id}`;
    });
    roleNames = names.join(", ");
  }

  // Find team names
  let primaryTeamName = "None";
  if (hasPrimary) {
    const team = loadedTeams.find(t => String(t.id) === String(merged.primaryTeamId));
    primaryTeamName = team ? team.name : `Team ${merged.primaryTeamId}`;
  }

  let secondaryTeamNames = "None";
  if (hasSecondary) {
    const names = merged.secondaryTeamIds.map(id => {
      const team = loadedTeams.find(t => String(t.id) === String(id));
      return team ? team.name : `Team ${id}`;
    });
    secondaryTeamNames = names.join(", ");
  }

  els.userInfoCard.innerHTML = `
    <div class="user-summary">
      <div class="user-field">
        <span class="field-label">Email:</span>
        <span class="field-value">${escapeHtml(inspectData.email)}</span>
      </div>
      <div class="user-field">
        <span class="field-label">User ID:</span>
        <span class="field-value">${escapeHtml(inspectData.userId)}</span>
      </div>
      <div class="user-field">
        <span class="field-label">Roles:</span>
        <span class="field-value ${hasRoles ? '' : 'missing'}">
          ${hasRoles ? '✅ ' + escapeHtml(roleNames) : '⚠️ No roles assigned'}
        </span>
      </div>
      <div class="user-field">
        <span class="field-label">Primary Team:</span>
        <span class="field-value ${hasPrimary ? '' : 'missing'}">
          ${hasPrimary ? '✅ ' + escapeHtml(primaryTeamName) : '⚠️ No primary team'}
        </span>
      </div>
      <div class="user-field">
        <span class="field-label">Secondary Teams:</span>
        <span class="field-value">
          ${hasSecondary ? escapeHtml(secondaryTeamNames) : 'None'}
        </span>
      </div>
    </div>
  `;
  
  els.userInfoCard.classList.remove("hidden");

  // Update action help
  if (!hasRoles && !hasPrimary) {
    updateActionHelp("⚠️ User has no roles or primary team. Select a role and team, then grant PRIMARY access.");
  } else if (!hasPrimary) {
    updateActionHelp("⚠️ User has no primary team. Grant PRIMARY access first.");
  } else {
    updateActionHelp("✅ User is set up. You can grant secondary access or revoke existing access.");
  }

  // Store current user state
  currentUser = {
    email: inspectData.email,
    userId: inspectData.userId,
    hasRoles,
    hasPrimary,
    merged
  };

  // Update button states
  updateButtonStates();
}

function updateActionHelp(message) {
  if (els.actionHelp) {
    els.actionHelp.textContent = message;
  }
}

function updateButtonStates() {
  const hasTeam = els.teamSelect && els.teamSelect.value;
  const hasRole = els.roleSelect && els.roleSelect.value;
  const hasUser = currentUser != null;

  // Grant Primary button - show only if user has no primary team
  if (els.grantPrimaryBtn) {
    if (hasUser && !currentUser.hasPrimary) {
      els.grantPrimaryBtn.classList.remove("hidden");
      els.grantPrimaryBtn.disabled = !hasTeam;
    } else {
      els.grantPrimaryBtn.classList.add("hidden");
    }
  }

  // Grant Secondary button - enable only if user has primary team
  if (els.grantSecondaryBtn) {
    if (hasUser && currentUser.hasPrimary) {
      els.grantSecondaryBtn.disabled = !hasTeam;
    } else {
      els.grantSecondaryBtn.disabled = true;
    }
  }

  // Assign Role Only button - enable if user exists and role selected
  if (els.assignRoleBtn) {
    els.assignRoleBtn.disabled = !hasUser || !hasRole;
  }

  // Revoke button
  if (els.revokeBtn) {
    els.revokeBtn.disabled = !hasTeam || !hasUser;
  }
}

function showResourceStatus(message, type = "info") {
  if (!els.resourceStatus) return;
  
  els.resourceStatus.className = `status-box alert-${type}`;
  els.resourceStatus.textContent = message;
  els.resourceStatus.classList.remove("hidden");
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
  showResourceStatus("Loading teams...", "info");
  const data = await apiCall("listTeams");

  if (!data.ok) throw new Error(data.error || "Failed to load teams.");

  loadedTeams = Array.isArray(data.result) ? data.result : [];
  
  if (els.teamSelect) {
    els.teamSelect.innerHTML = '<option value="">-- Select a team --</option>';
    for (const t of loadedTeams) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = `${t.name || "(no name)"} (${t.id})`;
      els.teamSelect.appendChild(opt);
    }
  }

  showResourceStatus(`✅ Loaded ${loadedTeams.length} teams`, "success");
  setOutput(data, `<div class="alert alert-success">
    <strong>✅ Teams loaded:</strong> ${loadedTeams.length} teams available
  </div>`);
}

async function listRoles() {
  showResourceStatus("Loading roles...", "info");
  const data = await apiCall("listRoles");

  if (!data.ok) throw new Error(data.error || "Failed to load roles.");

  loadedRoles = Array.isArray(data.result) ? data.result : [];
  
  // Populate role dropdown
  if (els.roleSelect) {
    els.roleSelect.innerHTML = '<option value="">-- Auto-detect or choose --</option>';
    for (const r of loadedRoles) {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.name || "(no name)"}`;
      if (r.requiresSuperAdmin) {
        opt.textContent += " (Super Admin)";
      }
      els.roleSelect.appendChild(opt);
    }
  }

  showResourceStatus(`✅ Loaded ${loadedRoles.length} roles`, "success");

  // Format roles nicely
  let rolesHtml = '<div class="alert alert-success"><strong>✅ Roles loaded:</strong></div><div class="role-list">';
  for (const r of loadedRoles) {
    rolesHtml += `
      <div class="role-item">
        <span class="role-name">${escapeHtml(r.name)}</span>
        <span class="role-id">ID: ${escapeHtml(r.id)}</span>
        ${r.requiresSuperAdmin ? '<span class="badge badge-warning">Super Admin</span>' : ''}
      </div>
    `;
  }
  rolesHtml += '</div>';
  
  setOutput(data, rolesHtml);
}

async function inspectUser() {
  const email = (els.userEmail?.value || "").trim();
  if (!email) return alert("Enter a user email first.");

  setOutput("Inspecting user...");
  const res = await apiCall("inspectUser", { email });
  
  if (!res.ok) {
    setOutput(res);
    return;
  }

  showUserInfo(res.result);
  setOutput(res, '<div class="alert alert-info"><strong>ℹ️ User inspection complete</strong> - see details above</div>');
}

async function decipherTeams() {
  const email = (els.userEmail?.value || "").trim();
  if (!email) return alert("Enter a user email first.");

  setOutput("Deciphering teams...");
  const res = await apiCall("decipherTeams", { email });
  
  if (!res.ok) {
    setOutput(res);
    return;
  }

  const result = res.result;
  
  // Format team info nicely
  let teamsHtml = `
    <div class="alert alert-info">
      <strong>👤 ${escapeHtml(result.user.email)}</strong>
    </div>
    <div class="teams-summary">
  `;

  if (result.primary) {
    teamsHtml += `
      <div class="team-item primary">
        <span class="badge badge-primary">PRIMARY</span>
        <span class="team-name">${escapeHtml(result.primary.name)}</span>
        <span class="team-id">ID: ${escapeHtml(result.primary.id)}</span>
      </div>
    `;
  } else {
    teamsHtml += `
      <div class="team-item missing">
        <span class="badge badge-warning">NO PRIMARY</span>
        <span class="team-name">User has no primary team</span>
      </div>
    `;
  }

  if (result.secondary && result.secondary.length > 0) {
    for (const team of result.secondary) {
      teamsHtml += `
        <div class="team-item secondary">
          <span class="badge badge-secondary">SECONDARY</span>
          <span class="team-name">${escapeHtml(team.name)}</span>
          <span class="team-id">ID: ${escapeHtml(team.id)}</span>
        </div>
      `;
    }
  }

  teamsHtml += `</div>`;

  setOutput(res, teamsHtml);

  // Update current user state
  if (result.user) {
    currentUser = {
      email: result.user.email,
      userId: result.user.id,
      hasPrimary: result.hasPrimary,
      hasRoles: true // We don't know for sure from decipher
    };
    updateButtonStates();
  }
}

async function grantSecondary() {
  const email = (els.userEmail?.value || "").trim();
  const teamId = els.teamSelect?.value;
  const roleId = (els.roleSelect?.value || "").trim();

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  setOutput("Granting secondary access...");
  
  const payload = { email, teamId };
  if (roleId) payload.defaultRoleId = roleId;
  
  const res = await apiCall("grantAccess", payload);
  
  // Show verification results
  if (res.ok && res.result && res.result.verification) {
    const v = res.result.verification;
    let verifyHtml = '<div class="alert alert-success"><strong>✅ Access granted</strong></div>';
    
    verifyHtml += '<div class="verification-box">';
    verifyHtml += '<h4>Verification (what HubSpot actually stored):</h4>';
    verifyHtml += `<p><strong>Roles:</strong> ${v.actualRoleIds && v.actualRoleIds.length > 0 ? v.actualRoleIds.join(', ') : '⚠️ None (role assignment may have failed)'}</p>`;
    verifyHtml += `<p><strong>Primary Team:</strong> ${v.actualPrimaryTeamId || 'None'}</p>`;
    verifyHtml += `<p><strong>Secondary Teams:</strong> ${v.actualSecondaryTeamIds && v.actualSecondaryTeamIds.length > 0 ? v.actualSecondaryTeamIds.join(', ') : 'None'}</p>`;
    verifyHtml += '</div>';
    
    if (!v.actualRoleIds || v.actualRoleIds.length === 0) {
      verifyHtml += '<div class="alert alert-warning"><strong>⚠️ Warning:</strong> Role was not assigned by HubSpot. You may need to assign the role manually in HubSpot UI, or the role ID might be invalid.</div>';
    }
    
    setOutput(res, verifyHtml);
  } else {
    setOutput(res);
  }

  if (res.ok) {
    // Refresh user info
    setTimeout(() => inspectUser(), 1000);
  }
}

async function grantPrimary() {
  const email = (els.userEmail?.value || "").trim();
  const teamId = els.teamSelect?.value;
  const roleId = (els.roleSelect?.value || "").trim();

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  setOutput("Granting PRIMARY access...");
  
  const payload = { email, teamId, mode: "primary" };
  if (roleId) payload.defaultRoleId = roleId;
  
  const res = await apiCall("grantAccess", payload);
  
  // Show verification results
  if (res.ok && res.result && res.result.verification) {
    const v = res.result.verification;
    let verifyHtml = '<div class="alert alert-success"><strong>✅ Primary access granted</strong></div>';
    
    verifyHtml += '<div class="verification-box">';
    verifyHtml += '<h4>Verification (what HubSpot actually stored):</h4>';
    verifyHtml += `<p><strong>Roles:</strong> ${v.actualRoleIds && v.actualRoleIds.length > 0 ? v.actualRoleIds.join(', ') : '⚠️ None (role assignment may have failed)'}</p>`;
    verifyHtml += `<p><strong>Primary Team:</strong> ${v.actualPrimaryTeamId || 'None'}</p>`;
    verifyHtml += `<p><strong>Secondary Teams:</strong> ${v.actualSecondaryTeamIds && v.actualSecondaryTeamIds.length > 0 ? v.actualSecondaryTeamIds.join(', ') : 'None'}</p>`;
    verifyHtml += '</div>';
    
    if (!v.actualRoleIds || v.actualRoleIds.length === 0) {
      verifyHtml += '<div class="alert alert-warning"><strong>⚠️ Warning:</strong> Role was not assigned by HubSpot. You may need to assign the role manually in HubSpot UI, or try using the "Assign Role Only" button.</div>';
    }
    
    setOutput(res, verifyHtml);
  } else {
    setOutput(res);
  }

  if (res.ok) {
    // Refresh user info
    setTimeout(() => inspectUser(), 1000);
  }
}

async function assignRoleOnly() {
  const email = (els.userEmail?.value || "").trim();
  const roleId = (els.roleSelect?.value || "").trim();

  if (!email) return alert("Enter a user email.");
  if (!roleId) return alert("Select a role.");

  setOutput("Assigning role...");
  
  const res = await apiCall("assignRole", { email, roleId });
  
  // Show verification results
  if (res.ok && res.result && res.result.verification) {
    const v = res.result.verification;
    let verifyHtml = '<div class="alert alert-success"><strong>✅ Role assignment attempted</strong></div>';
    
    verifyHtml += '<div class="verification-box">';
    verifyHtml += '<h4>Verification (what HubSpot actually stored):</h4>';
    verifyHtml += `<p><strong>Roles:</strong> ${v.actualRoleIds && v.actualRoleIds.length > 0 ? '✅ ' + v.actualRoleIds.join(', ') : '⚠️ None (assignment failed)'}</p>`;
    verifyHtml += '</div>';
    
    if (!v.actualRoleIds || v.actualRoleIds.length === 0) {
      verifyHtml += '<div class="alert alert-error"><strong>❌ Error:</strong> HubSpot did not assign the role. This might mean:<br>1. The role ID is invalid<br>2. The role requires Super Admin permissions<br>3. Your API token lacks necessary scopes<br>4. HubSpot API limitations</div>';
    }
    
    setOutput(res, verifyHtml);
  } else {
    setOutput(res);
  }

  if (res.ok) {
    // Refresh user info
    setTimeout(() => inspectUser(), 1000);
  }
}

async function revokeAccess() {
  const email = (els.userEmail?.value || "").trim();
  const teamId = els.teamSelect?.value;

  if (!email) return alert("Enter a user email.");
  if (!teamId) return alert("Select a team.");

  if (!confirm(`Revoke access for ${email} from the selected team?`)) return;

  setOutput("Revoking access...");
  const res = await apiCall("revokeAccess", { email, teamId });
  setOutput(res);

  if (res.ok) {
    // Refresh user info
    setTimeout(() => inspectUser(), 500);
  }
}

/* =========================
 * Collapsible cards
 * ========================= */

window.toggleCard = function(header) {
  const card = header.closest('.card');
  const body = card.querySelector('.card-body');
  const icon = header.querySelector('.collapse-icon');
  
  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
    if (icon) icon.textContent = '▼';
  } else {
    body.classList.add('collapsed');
    if (icon) icon.textContent = '▶';
  }
};

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
  }
}

els.saveCfgBtn?.addEventListener("click", () => {
  const url = (els.gatewayUrl?.value || "").trim();
  setGatewayUrl(url);
  setOutput({ ok: true, message: "Gateway URL saved" });
});

els.unlockBtn?.addEventListener("click", async () => {
  const code = (els.adminCode?.value || "").trim();
  if (!code) return alert("Enter admin code.");

  adminCode = code;
  sessionStorage.setItem("revops_admin_code", code);

  try {
    const test = await apiCall("ping");
    if (!test.ok) throw new Error(test.error || "Unlock validation failed.");

    els.panel?.classList.remove("hidden");
    setOutput({ ok: true, message: "🎉 Panel unlocked successfully!" });
  } catch (e) {
    sessionStorage.removeItem("revops_admin_code");
    adminCode = null;
    setOutput({ ok: false, error: String(e?.message || e) });
    alert(String(e?.message || e));
  }
});

/* =========================
 * Wire buttons
 * ========================= */

els.refreshTeamsBtn?.addEventListener("click", () =>
  refreshTeams().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.listRolesBtn?.addEventListener("click", () =>
  listRoles().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.inspectBtn?.addEventListener("click", () =>
  inspectUser().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.decipherBtn?.addEventListener("click", () =>
  decipherTeams().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.grantSecondaryBtn?.addEventListener("click", () =>
  grantSecondary().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.grantPrimaryBtn?.addEventListener("click", () =>
  grantPrimary().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.assignRoleBtn?.addEventListener("click", () =>
  assignRoleOnly().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

els.revokeBtn?.addEventListener("click", () =>
  revokeAccess().catch(e => setOutput({ ok: false, error: String(e?.message || e) }))
);

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

// Update button states when team or role is selected
els.teamSelect?.addEventListener("change", () => {
  updateButtonStates();
});

els.roleSelect?.addEventListener("change", () => {
  updateButtonStates();
});

/* =========================
 * Init
 * ========================= */

loadSaved();
