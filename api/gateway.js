export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { gasUrl, payload } = req.body || {};
    if (!gasUrl) return res.status(400).json({ ok: false, error: "Missing gasUrl" });
    if (!payload) return res.status(400).json({ ok: false, error: "Missing payload" });

    const u = String(gasUrl || "").trim();
    const isAppsScript =
      u.startsWith("https://script.google.com/") &&
      u.includes("/macros/") &&
      (u.endsWith("/exec") || u.includes("/exec?"));

    if (!isAppsScript) {
      return res.status(400).json({ ok: false, error: "Invalid gasUrl (must be a Web App /exec URL)" });
    }

    const resp = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const contentType = resp.headers.get("content-type") || "";
    const text = await resp.text();

    // If Apps Script returned HTML (login, redirect, error page), wrap it as JSON
    if (!contentType.includes("application/json")) {
      return res.status(200).json({
        ok: false,
        error: "Apps Script did not return JSON. Most likely wrong URL (not /exec) or access/auth page.",
        status: resp.status,
        contentType,
        preview: text.slice(0, 400),
      });
    }

    // Otherwise forward JSON text
    res.status(resp.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
