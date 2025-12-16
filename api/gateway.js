export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { gasUrl, payload } = req.body || {};
    if (!gasUrl) return res.status(400).json({ ok: false, error: "Missing gasUrl" });
    if (!payload) return res.status(400).json({ ok: false, error: "Missing payload" });

    // Basic safety: ensure we only proxy to Apps Script webapps
    if (!String(gasUrl).includes("script.google.com/macros/")) {
      return res.status(400).json({ ok: false, error: "Invalid gasUrl" });
    }

    const resp = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();

    // Forward the response as-is
    res.status(resp.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
