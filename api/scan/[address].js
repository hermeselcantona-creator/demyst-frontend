// api/scan/[address].js
// Vercel Serverless Function — replaces the entire Express backend
// Runs on Vercel's free tier, always on, no cold starts on paid plan
// Free tier: 100,000 invocations/day — more than enough

const GOPLUS_CHAIN_IDS = {
  ethereum: 1, eth: 1, bsc: 56, bnb: 56,
  polygon: 137, matic: 137, arbitrum: 42161,
  optimism: 10, base: 8453, avalanche: 43114,
  fantom: 250, cronos: 25,
};

function detectChain(address, dexChainId) {
  if (dexChainId) {
    const id = dexChainId.toLowerCase();
    if (id === "solana") return "solana";
    return GOPLUS_CHAIN_IDS[id] || 1;
  }
  if (!address.startsWith("0x") && address.length >= 32) return "solana";
  return 1;
}

async function safeFetch(url, timeoutMs = 8000) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "DEMYST/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

async function getDexScreener(address) {
  try {
    const data = await safeFetch(
      "https://api.dexscreener.com/latest/dex/tokens/" + address
    );
    if (!data || !data.pairs || data.pairs.length === 0) return null;
    const pair = [...data.pairs].sort(
      (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
    )[0];
    const socials = pair.info?.socials || [];
    return {
      name:        pair.baseToken?.name    || null,
      symbol:      pair.baseToken?.symbol  || null,
      chainId:     pair.chainId            || null,
      priceUsd:    pair.priceUsd           || null,
      priceChange: { h1: pair.priceChange?.h1 || null, h6: pair.priceChange?.h6 || null, h24: pair.priceChange?.h24 || null },
      volume:      { h1: pair.volume?.h1 || null, h6: pair.volume?.h6 || null, h24: pair.volume?.h24 || null },
      liquidity:   pair.liquidity?.usd || null,
      fdv:         pair.fdv || null,
      marketCap:   pair.marketCap || null,
      txns:        { buys: pair.txns?.h24?.buys || 0, sells: pair.txns?.h24?.sells || 0 },
      social: {
        website:  pair.info?.websites?.[0]?.url || null,
        twitter:  socials.find((s) => s.type === "twitter")?.url  || null,
        telegram: socials.find((s) => s.type === "telegram")?.url || null,
        discord:  socials.find((s) => s.type === "discord")?.url  || null,
      },
      pairAddress: pair.pairAddress || null,
      dexId:       pair.dexId       || null,
      pairUrl:     pair.url         || null,
    };
  } catch (e) {
    console.warn("DexScreener error:", e.message);
    return null;
  }
}

async function getGoPlus(address, chainId) {
  try {
    const url = chainId === "solana"
      ? "https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=" + address.toLowerCase()
      : "https://api.gopluslabs.io/api/v1/token_security/" + chainId + "?contract_addresses=" + address.toLowerCase();

    const data = await safeFetch(url, 10000);
    if (!data || !data.result) return null;
    const key = Object.keys(data.result)[0];
    const gp  = data.result[key];
    if (!gp) return null;

    const parsePct = (v) => v != null ? Math.round(parseFloat(v) * 100) : null;
    const lpHolders = gp.lp_holders || [];
    const lockedLPs = lpHolders.filter((h) => h.is_locked === 1 || h.is_locked === "1");
    const lockedPct = lockedLPs.length > 0
      ? Math.round(lockedLPs.reduce((s, h) => s + parseFloat(h.percent || 0), 0) * 100)
      : 0;
    const holders = (gp.holders || []).map((h) => ({
      address:    h.address,
      tag:        h.tag,
      percent:    Math.round(parseFloat(h.percent || 0) * 100),
      isLocked:   h.is_locked === 1 || h.is_locked === "1",
      isContract: h.is_contract === 1,
    }));
    const ownerAddr   = gp.owner_address || "";
    const isRenounced = !ownerAddr || ownerAddr === "0x0000000000000000000000000000000000000000";

    return {
      isHoneypot:     gp.is_honeypot === "1",
      buyTax:         parsePct(gp.buy_tax),
      sellTax:        parsePct(gp.sell_tax),
      transferTax:    parsePct(gp.transfer_tax),
      isRenounced,
      ownerAddress:   ownerAddr || null,
      creatorAddress: gp.creator_address || null,
      totalSupply:    gp.total_supply    || null,
      holderCount:    parseInt(gp.holder_count || 0),
      lp: { lockedPct, lockedCount: lockedLPs.length },
      holders: holders.slice(0, 10),
      top10HolderPct: holders.slice(0, 10).reduce((s, h) => s + h.percent, 0),
      flags: {
        isOpenSource:       gp.is_open_source          === "1",
        isMintable:         gp.is_mintable             === "1",
        isProxy:            gp.is_proxy                === "1",
        isBlacklisted:      gp.is_blacklist            === "1",
        isAntiWhale:        gp.is_anti_whale           === "1",
        hasTradingCooldown: gp.trading_cooldown        === "1",
        hasHiddenOwner:     gp.hidden_owner            === "1",
        canSelfDestruct:    gp.self_destruct           === "1",
        canTakeOwnership:   gp.can_take_back_ownership === "1",
        hasExternalCall:    gp.external_call           === "1",
        isFakeToken:        gp.fake_token              === "1",
        isAirdropScam:      gp.airdrop_scam            === "1",
      },
    };
  } catch (e) {
    console.warn("GoPlus error:", e.message);
    return null;
  }
}

function computeScore(gp, dex) {
  if (!gp && !dex) return { score: 50, reasons: ["Insufficient data"] };
  let score = 100;
  const reasons = [];
  if (gp) {
    if (gp.isHoneypot)                    { score -= 50; reasons.push("Honeypot detected (-50)");        }
    if (!gp.isRenounced)                  { score -= 8;  reasons.push("Ownership not renounced (-8)");   }
    if (gp.lp.lockedPct < 5)             { score -= 14; reasons.push("Liquidity not locked (-14)");     }
    else if (gp.lp.lockedPct < 50)       { score -= 7;  reasons.push("Liquidity partially locked (-7)");}
    if ((gp.sellTax || 0) > 10)          { score -= Math.min(18, gp.sellTax - 10); reasons.push("High sell tax (-" + Math.min(18, gp.sellTax - 10) + ")"); }
    if (gp.top10HolderPct > 50)          { score -= 12; reasons.push("Top 10 hold >50% (-12)");         }
    if (gp.flags.hasHiddenOwner)         { score -= 10; reasons.push("Hidden owner (-10)");              }
    if (gp.flags.canTakeOwnership)       { score -= 8;  reasons.push("Can reclaim ownership (-8)");     }
    if (gp.flags.isMintable)             { score -= 6;  reasons.push("Token is mintable (-6)");         }
    if (gp.flags.isAirdropScam)          { score -= 15; reasons.push("Airdrop scam flag (-15)");        }
    if (gp.flags.isFakeToken)            { score -= 20; reasons.push("Fake token flag (-20)");          }
    if (gp.flags.canSelfDestruct)        { score -= 8;  reasons.push("Self-destruct capable (-8)");     }
  }
  if (!dex || (!dex.social.website && !dex.social.twitter)) {
    score -= 5;
    reasons.push("No verified socials (-5)");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export default async function handler(req, res) {
  // CORS headers — allow any origin
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { address } = req.query;

  if (!address || address.length < 10) {
    return res.status(400).json({ error: "Invalid address" });
  }

  console.log("[SCAN]", address);

  try {
    // Fire both in parallel
    const dexPromise = getDexScreener(address);
    const dexData    = await dexPromise;

    const chainId = detectChain(address, dexData?.chainId);
    const gpData  = await getGoPlus(address, chainId);

    const { score, reasons } = computeScore(gpData, dexData);

    const chainName = dexData?.chainId?.toUpperCase() ||
      (typeof chainId === "number"
        ? (Object.entries(GOPLUS_CHAIN_IDS).find(([, v]) => v === chainId)?.[0] || "eth").toUpperCase()
        : chainId.toUpperCase());

    return res.status(200).json({
      address,
      chain:   chainName,
      sources: { dexscreener: !!dexData, goplus: !!gpData },
      token: {
        name:      dexData?.name      || "Unknown",
        symbol:    dexData?.symbol    || "???",
        priceUsd:  dexData?.priceUsd  || null,
        fdv:       dexData?.fdv       || null,
        marketCap: dexData?.marketCap || null,
      },
      score,
      reasons,
      security: gpData ? {
        isHoneypot:     gpData.isHoneypot,
        buyTax:         gpData.buyTax,
        sellTax:        gpData.sellTax,
        isRenounced:    gpData.isRenounced,
        ownerAddress:   gpData.ownerAddress,
        creatorAddress: gpData.creatorAddress,
        holderCount:    gpData.holderCount,
        top10HolderPct: gpData.top10HolderPct,
        holders:        gpData.holders,
        lp:             gpData.lp,
        flags:          gpData.flags,
      } : null,
      market: dexData ? {
        priceChange: dexData.priceChange,
        volume:      dexData.volume,
        liquidity:   dexData.liquidity,
        txns:        dexData.txns,
        social:      dexData.social,
        pairAddress: dexData.pairAddress,
        dexId:       dexData.dexId,
        pairUrl:     dexData.pairUrl,
      } : null,
    });
  } catch (err) {
    console.error("[ERROR]", err);
    return res.status(500).json({ error: "Scan failed", detail: err.message });
  }
}
