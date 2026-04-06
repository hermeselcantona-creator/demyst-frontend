// api/tye.js
// Vercel Serverless Function — calls Anthropic API server-side
//
// SETUP (one time, takes 2 minutes):
// 1. Go to console.anthropic.com → API Keys → Create Key → copy it
// 2. Go to Vercel dashboard → your project → Settings → Environment Variables
// 3. Add: ANTHROPIC_API_KEY = your key
// 4. Vercel auto-redeploys — done

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      verdict: null,
      error: "ANTHROPIC_API_KEY not set in Vercel environment variables",
    });
  }

  try {
    const { scanData } = req.body;
    if (!scanData) return res.status(400).json({ error: "Missing scanData" });

    const sec = scanData.security || {};
    const mkt = scanData.market   || {};
    const lp  = sec.lp            || {};
    const fl  = sec.flags         || {};

    const fmtUSD = (n) => {
      if (!n) return "$0";
      if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
      if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
      return "$" + Number(n).toFixed(0);
    };
    const fmtNum = (n) => {
      if (!n) return "0";
      if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
      if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
      return String(n);
    };

    const prompt = `You are Tye — DEMYST's blockchain security expert and educator. You have a sharp, direct, friendly personality. You speak in plain English with zero jargon. You genuinely care about protecting people from crypto scams.

You just completed a full security scan of a token. Here is the data:

TOKEN: ${scanData.token.name} (${scanData.token.symbol}) on ${scanData.chain}
SAFETY SCORE: ${scanData.score}/100
HONEYPOT: ${sec.isHoneypot ? "YES - CONFIRMED HONEYPOT" : "No"}
BUY TAX: ${sec.buyTax || 0}%
SELL TAX: ${sec.sellTax || 0}%
OWNERSHIP: ${sec.isRenounced ? "Renounced (good)" : "NOT renounced (risky)"}
LIQUIDITY: ${lp.lockedPct > 5 ? lp.lockedPct + "% locked" : "NOT locked"} | Total: ${fmtUSD(mkt.liquidity)}
TOP 10 HOLDERS: ${sec.top10HolderPct || 0}% of supply
TOTAL HOLDERS: ${fmtNum(sec.holderCount)}
CREATOR WALLET: ${scanData.security?.creatorAddress || "Unknown"}
WEBSITE: ${mkt.social?.website ? "Yes - " + mkt.social.website : "None"}
TWITTER: ${mkt.social?.twitter ? "Yes" : "None"}
TELEGRAM: ${mkt.social?.telegram ? "Yes" : "None"}
24H VOLUME: ${fmtUSD(mkt.volume?.h24)}
PRICE CHANGE 24H: ${(mkt.priceChange?.h24 || 0).toFixed(1)}%
CONTRACT FLAGS: ${[
  fl.isOpenSource ? "Open Source ✓" : "Unverified Code ✗",
  fl.isMintable ? "MINTABLE ✗" : null,
  fl.isProxy ? "PROXY CONTRACT ✗" : null,
  fl.hasHiddenOwner ? "HIDDEN OWNER ✗" : null,
  fl.canTakeOwnership ? "CAN RECLAIM OWNERSHIP ✗" : null,
  fl.canSelfDestruct ? "SELF DESTRUCT ✗" : null,
  fl.isBlacklisted ? "BLACKLIST FUNCTION ✗" : null,
  fl.isAntiWhale ? "Anti-whale ✓" : null,
].filter(Boolean).join(", ") || "No major flags"}
SCORE REASONS: ${(scanData.reasons || []).join(", ") || "No deductions"}
DATA SOURCES: DexScreener=${scanData.sources?.dexscreener}, GoPlus=${scanData.sources?.goplus}

Write Tye's Final Verdict. It must have exactly THREE sections, formatted as JSON:

1. "summary" — 3-4 sentences. Summarize what this scan actually found. Be specific about THIS token's data, not generic. Name the actual numbers. Tell the investor what stands out most — good and bad.

2. "positiveRoute" — 2-3 sentences. The realistic, positive path forward given these results. If safe: what to watch for before buying. If risky: how to protect yourself or what would need to change for this to become worth considering. If honeypot: what to do instead. Always end with something constructive and empowering — the user should feel informed, not just scared.

3. "oneLineTake" — One punchy sentence. Tye's gut verdict in plain language. Maximum 20 words. Should sound like advice from a smart friend, not a robot.

Respond ONLY with valid JSON. No markdown, no backticks, no extra text.
{"summary":"...","positiveRoute":"...","oneLineTake":"..."}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", errText);
      return res.status(200).json({ verdict: null, error: "Anthropic API error: " + response.status });
    }

    const data = await response.json();
    const text = (data.content || []).map((b) => b.text || "").join("").replace(/```json|```/g, "").trim();

    let verdict;
    try {
      verdict = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error:", text);
      return res.status(200).json({ verdict: null, error: "Could not parse Tye response" });
    }

    return res.status(200).json({ verdict });

  } catch (err) {
    console.error("Tye handler error:", err);
    return res.status(200).json({ verdict: null, error: err.message });
  }
}
