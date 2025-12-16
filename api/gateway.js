export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { gasUrl, payload } = req.body || {};
    if (!gasUrl) return res.status(400).json({ ok: false, error: "Missing gasUrl" });
    if (!payload) return res.status(400).json({ ok: false, error: "Missing payload" });

    // Allow both:
    // https://script.google.com/macros/s/.../exec
    // https://script.google.com/a/macros/<domain>/s/.../exec
    const u = String(gasUrl || "").trim();
    const isAppsScript =
      u.startsWith("https://script.google.com/") &&
      u.includes("/macros/") &&
      (u.endsWith("/exec") || u.includes("/exec?"));

    if (!isAppsScript) {
      return res.status(400).json({ ok: false, error: "Invalid gasUrl" });
    }

    const resp = await fetch(u, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();

    // Forward status + body back to browser
    res.status(resp.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
