import { useState, useRef, useCallback, useEffect } from "react";
import * as d3 from "d3";

/* ── THEME ── */
const TA = {
  bg:"#15100b", card:"#1e1710", cardAlt:"#231c12",
  border:"rgba(245,158,11,0.13)", borderHi:"rgba(251,191,36,0.30)",
  acc:"#f59e0b", accDim:"rgba(245,158,11,0.10)",
  text:"#fef3c7", sub:"#c4943a", muted:"#6b4f25", dim:"#3d2e14",
  red:"#f87171", green:"#6ee7b7", yellow:"#fcd34d", purple:"#c084fc",
};
const SM = {
  bg:"#050b14", card:"#070e1a", border:"rgba(0,229,160,0.09)",
  acc:"#00e5a0", blue:"#00b4ff", text:"#e2e8f0", sub:"#475569",
};

/* ── CONSTANTS ── */
const IQ_LEVELS = [
  { min:0,    label:"Blockchain Rookie", color:"#a8a29e", icon:"🌱" },
  { min:100,  label:"Chain Explorer",   color:"#fbbf24", icon:"🔍" },
  { min:300,  label:"DeFi Detective",   color:"#c084fc", icon:"🕵️" },
  { min:600,  label:"Crypto Scholar",   color:"#fb923c", icon:"📚" },
  { min:1000, label:"Blockchain Sage",  color:"#00e5a0", icon:"🧙" },
];
const SCAN_STAGES = [
  { id:"contract",  label:"Reading Smart Contract",        icon:"📜", iq:8  },
  { id:"holders",   label:"Analyzing Holder Distribution", icon:"👥", iq:12 },
  { id:"liquidity", label:"Checking Liquidity Locks",      icon:"🔐", iq:12 },
  { id:"deployer",  label:"Scanning Deployer History",     icon:"🕵️", iq:15 },
  { id:"whales",    label:"Detecting Whale Activity",      icon:"🐋", iq:12 },
  { id:"honeypot",  label:"Running Honeypot Simulation",   icon:"🍯", iq:18 },
  { id:"social",    label:"Verifying Social Presence",     icon:"🌐", iq:8  },
  { id:"volume",    label:"Analyzing Trading Patterns",    icon:"📈", iq:10 },
  { id:"riskmap",   label:"Building Wallet Risk Map",      icon:"🗺️", iq:15 },
  { id:"tye",       label:"Tye is analyzing...",           icon:"🧠", iq:25 },
];
const SCORE_LEVELS = [
  { min:80, label:"SAFE",    color:"#22c55e", glow:"#22c55e55", bg:"rgba(34,197,94,0.08)"   },
  { min:60, label:"CAUTION", color:"#f59e0b", glow:"#f59e0b55", bg:"rgba(245,158,11,0.08)" },
  { min:40, label:"RISKY",   color:"#f97316", glow:"#f9731655", bg:"rgba(249,115,22,0.08)" },
  { min:20, label:"DANGER",  color:"#ef4444", glow:"#ef444455", bg:"rgba(239,68,68,0.08)"  },
  { min:0,  label:"SCAM",    color:"#dc2626", glow:"#dc262655", bg:"rgba(220,38,38,0.10)"  },
];

/* ── UTILS ── */
const addrHash = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h >>> 0);
};
const seededRng = (seed) => {
  let s = (seed >>> 0) || 1;
  return (mn, mx) => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return Math.floor(mn + (s / 0xffffffff) * (mx - mn + 1));
  };
};
const shortAddr = (a) => a && a.length > 13 ? a.slice(0, 6) + "..." + a.slice(-4) : (a || "");
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
const getSL  = (s) => SCORE_LEVELS.find((l) => s >= l.min) || SCORE_LEVELS[4];
const getIQL = (iq) => [...IQ_LEVELS].reverse().find((l) => iq >= l.min) || IQ_LEVELS[0];

function mockWallets(address, realHolders) {
  if (realHolders && realHolders.length > 0) {
    return realHolders.map((h, i) => ({
      id: shortAddr(h.address || ("0x" + addrHash(address + i).toString(16).slice(0, 8))),
      pct: h.percent,
      risk: h.percent > 14 ? "high" : h.percent > 7 ? "medium" : "low",
      label: h.tag || (i === 0 ? "Top Holder" : i < 3 ? "Whale" : i < 6 ? "Early Buyer" : "Holder"),
      txCount: Math.floor(Math.random() * 80) + 2,
    }));
  }
  const r = seededRng(addrHash(address));
  return Array.from({ length: r(9, 14) }, (_, i) => {
    const wr = seededRng(addrHash(address + "w" + i));
    const pct = wr(1, i === 0 ? 24 : i < 3 ? 13 : 7);
    return {
      id: "0x" + addrHash(address + i).toString(16).slice(0, 6) + "..." + (addrHash(address + i + "x") % 9999).toString(16).padStart(4, "0"),
      pct,
      risk: pct > 14 ? "high" : pct > 7 ? "medium" : "low",
      label: i === 0 ? "Top Holder" : i < 3 ? "Whale" : i < 6 ? "Early Buyer" : "Holder",
      txCount: wr(1, 90),
    };
  });
}

async function fetchTye(sd) {
  const sec = sd.security || {};
  const mkt = sd.market || {};
  const fl  = sec.flags || {};
  const prompt = [
    "You are Tye, DEMYST's blockchain security expert. Sharp, friendly, real-world analogies. 2-3 sentences per field. Respond ONLY with valid JSON, no markdown.",
    "",
    "Token: " + sd.token.name + " (" + sd.token.symbol + ") on " + sd.chain + " | Score: " + sd.score + "/100",
    "Honeypot: " + (sec.isHoneypot ? "YES WARNING" : "NO OK") + " | Buy: " + (sec.buyTax || 0) + "% | Sell: " + (sec.sellTax || 0) + "%",
    "Liquidity: " + ((sec.lp && sec.lp.lockedPct > 5) ? (sec.lp.lockedPct + "% locked") : "NOT LOCKED WARNING") + " (" + fmtUSD(mkt.liquidity) + ")",
    "Ownership: " + (sec.isRenounced ? "Renounced OK" : "NOT renounced WARNING"),
    "Top10 holders: " + (sec.top10HolderPct || 0) + "% | Total holders: " + fmtNum(sec.holderCount),
    "Creator: " + shortAddr(sec.creatorAddress || ""),
    "Socials: Web:" + (mkt.social && mkt.social.website ? "YES" : "NO") + " TW:" + (mkt.social && mkt.social.twitter ? "YES" : "NO"),
    "Vol 24h: " + fmtUSD(mkt.volume && mkt.volume.h24) + " | Change: " + ((mkt.priceChange && mkt.priceChange.h24) || 0) + "%",
    "Score reasons: " + (sd.reasons || []).join(", "),
    "",
    'Return JSON: {"contractAnalysis":"...","holderAnalysis":"...","liquidityAnalysis":"...","deployerAnalysis":"...","whaleAnalysis":"...","honeypotAnalysis":"...","socialAnalysis":"...","volumeAnalysis":"...","verdictTitle":"3-5 word catchy title","verdictEmoji":"emoji","finalVerdict":"4-5 sentences + clear buy/avoid call"}',
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error("Tye API error");
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || "").join("").replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

/* ── LOGO ── */
function Logo({ size }) {
  const s = size || 44;
  return (
    <div style={{
      width: s, height: s, borderRadius: "50%", flexShrink: 0,
      background: "radial-gradient(circle at 35% 35%, #1a3a6b, #050c1a)",
      border: "2px solid rgba(77,184,255,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 0 20px rgba(0,140,255,0.3)",
    }}>
      <span style={{ fontSize: s * 0.42, fontWeight: 900, color: "#4db8ff", letterSpacing: -1 }}>D</span>
    </div>
  );
}

/* ── SHARED UI ── */
function LiveBadge({ live }) {
  return live ? (
    <span style={{ fontSize: 8, fontWeight: 700, background: "rgba(34,197,94,0.14)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 3, padding: "1px 5px", marginLeft: 4, letterSpacing: 0.8, whiteSpace: "nowrap" }}>LIVE</span>
  ) : (
    <span style={{ fontSize: 8, fontWeight: 700, background: "rgba(107,79,37,0.15)", color: "#6b4f25", border: "1px solid rgba(107,79,37,0.2)", borderRadius: 3, padding: "1px 5px", marginLeft: 4, letterSpacing: 0.8, whiteSpace: "nowrap" }}>EST</span>
  );
}

function SourceBanner({ sources }) {
  if (!sources) return null;
  const dex = sources.dexscreener;
  const gp  = sources.goplus;
  const color = dex && gp ? "#22c55e" : (!dex && !gp) ? "#ef4444" : "#f59e0b";
  const bg    = dex && gp ? "rgba(34,197,94,0.07)" : (!dex && !gp) ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.07)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 6, background: bg, border: "1px solid " + color + "30", fontSize: 11, color, fontWeight: 600, marginBottom: 14, flexWrap: "wrap" }}>
      {dex && gp ? "🟢" : (!dex && !gp) ? "🔴" : "🟡"}
      {dex && <span>DexScreener <span style={{ opacity: 0.5, fontSize: 9 }}>LIVE</span></span>}
      {dex && gp && <span style={{ opacity: 0.3 }}>·</span>}
      {gp  && <span>GoPlus Security <span style={{ opacity: 0.5, fontSize: 9 }}>LIVE</span></span>}
      {!dex && !gp && <span>Backend offline — check your Replit URL</span>}
      {dex  && !gp && <span style={{ opacity: 0.5, fontSize: 10 }}>· GoPlus unavailable</span>}
      {!dex && gp  && <span style={{ opacity: 0.5, fontSize: 10 }}>· DexScreener unavailable</span>}
    </div>
  );
}

function ScoreGauge({ score, mode }) {
  const info = getSL(score);
  const W = 190, r = 70, sw = 11, cx = W / 2, cy = 90;
  const circ  = Math.PI * r;
  const offset = circ * (1 - score / 100);
  const arcD  = "M " + (cx - r) + " " + cy + " A " + r + " " + r + " 0 0 0 " + (cx + r) + " " + cy;
  const textColor = mode === "training" ? TA.text : "white";
  return (
    <svg width={W} height={100} viewBox={"0 0 " + W + " 100"} style={{ overflow: "visible", maxWidth: "100%" }}>
      <defs>
        <linearGradient id="scoreGrad">
          <stop offset="0%"   stopColor="#dc2626" />
          <stop offset="35%"  stopColor="#f97316" />
          <stop offset="65%"  stopColor="#eab308" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <path d={arcD} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={sw} strokeLinecap="round" />
      <path d={arcD} fill="none" stroke="url(#scoreGrad)" strokeWidth={sw} strokeLinecap="round" opacity={0.16} />
      {score > 0 && (
        <path d={arcD} fill="none" stroke="url(#scoreGrad)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ + " " + (circ + 4)}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 8px " + info.glow + ")" }}
        />
      )}
      <text x={cx} y={cy - 20} textAnchor="middle" fill={textColor} fontSize="36" fontWeight="900">{score}</text>
      <text x={cx} y={cy - 4}  textAnchor="middle" fill={info.color} fontSize="10" fontWeight="700">{info.label}</text>
    </svg>
  );
}

/* ── WALLET RISK MAP ── */
function WalletRiskMap({ wallets, token, accent }) {
  const svgRef = useRef();
  const [tip, setTip] = useState(null);

  useEffect(() => {
    if (!wallets || wallets.length === 0 || !svgRef.current) return;
    const W = 560, H = 260;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const tokenSym = (token && token.symbol) || "TOKEN";
    const acc2 = accent || TA.acc;

    const nodes = [
      { id: "__t__", label: tokenSym, isToken: true, size: 20 },
      ...wallets.map((w) => ({ id: w.id, label: w.pct + "%", isToken: false, size: 5 + w.pct * 0.5, risk: w.risk, wallet: w })),
    ];
    const links = wallets.map((w) => ({ source: w.id, target: "__t__", value: w.pct / 10 }));

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-110))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide().radius((d) => d.size + 5));

    nodes[0].fx = W / 2;
    nodes[0].fy = H / 2;

    const eg = svg.append("g");
    const ng = svg.append("g");

    const ls = eg.selectAll("line").data(links).join("line")
      .attr("stroke-width", (d) => Math.max(0.5, d.value))
      .attr("stroke", (d) => {
        const src = d.source.id || d.source;
        const n = nodes.find((nd) => nd.id === src);
        if (!n) return "rgba(255,255,255,0.07)";
        if (n.risk === "high")   return "rgba(239,68,68,0.27)";
        if (n.risk === "medium") return "rgba(245,158,11,0.24)";
        return "rgba(34,197,94,0.18)";
      });

    const ns = ng.selectAll("g").data(nodes).join("g")
      .style("cursor", "pointer")
      .on("click", (evt, d) => {
        if (d.wallet) {
          const rc = svgRef.current.getBoundingClientRect();
          setTip((prev) => (prev && prev.id === d.wallet.id) ? null : Object.assign({}, d.wallet, { x: Math.min(evt.clientX - rc.left, 300), y: Math.max(0, evt.clientY - rc.top - 30) }));
        } else {
          setTip(null);
        }
      });

    ns.append("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => d.isToken ? acc2 : d.risk === "high" ? "#ef4444" : d.risk === "medium" ? "#f59e0b" : "#22c55e")
      .attr("fill-opacity", (d) => d.isToken ? 0.95 : 0.55)
      .attr("stroke", (d) => d.isToken ? "rgba(255,255,255,0.4)" : d.risk === "high" ? "#fca5a5" : d.risk === "medium" ? "#fcd34d" : "#86efac")
      .attr("stroke-width", (d) => d.isToken ? 2 : 1.5);

    ns.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => d.isToken ? "9px" : "7px")
      .attr("font-weight", "bold")
      .attr("fill", "#fff")
      .attr("pointer-events", "none")
      .text((d) => d.label);

    sim.on("tick", () => {
      ls.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      ns.attr("transform", (d) => "translate(" + Math.max(d.size, Math.min(W - d.size, d.x)) + "," + Math.max(d.size, Math.min(H - d.size, d.y)) + ")");
    });

    return () => sim.stop();
  }, [wallets, accent, token]);

  return (
    <div style={{ position: "relative", background: "rgba(0,0,0,0.3)", borderRadius: 10, overflow: "hidden" }}>
      <svg ref={svgRef} width="100%" viewBox="0 0 560 260" style={{ display: "block" }} />
      {tip && (
        <div style={{ position: "absolute", left: Math.min(tip.x + 8, 200), top: Math.max(0, tip.y), background: "#1e1508", border: "1px solid " + (accent || TA.acc) + "44", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: TA.text, zIndex: 20, minWidth: 145, boxShadow: "0 8px 28px rgba(0,0,0,0.8)" }}>
          <div style={{ color: accent || TA.acc, fontFamily: "monospace", fontSize: 9, marginBottom: 6, fontWeight: 700 }}>{tip.id}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div><div style={{ color: TA.muted, fontSize: 8, marginBottom: 1 }}>HELD</div><div style={{ fontWeight: 700, fontSize: 11 }}>{tip.pct}%</div></div>
            <div><div style={{ color: TA.muted, fontSize: 8, marginBottom: 1 }}>RISK</div><div style={{ fontWeight: 700, fontSize: 11, color: tip.risk === "high" ? "#ef4444" : tip.risk === "medium" ? "#f59e0b" : "#22c55e" }}>{tip.risk.toUpperCase()}</div></div>
            <div><div style={{ color: TA.muted, fontSize: 8, marginBottom: 1 }}>LABEL</div><div style={{ fontWeight: 700, fontSize: 10 }}>{tip.label}</div></div>
            <div><div style={{ color: TA.muted, fontSize: 8, marginBottom: 1 }}>TXS</div><div style={{ fontWeight: 700, fontSize: 11 }}>{tip.txCount}</div></div>
          </div>
          <div onClick={() => setTip(null)} style={{ marginTop: 8, fontSize: 9, color: TA.muted, textAlign: "right", cursor: "pointer" }}>close x</div>
        </div>
      )}
      <div style={{ position: "absolute", bottom: 5, right: 8, display: "flex", gap: 8, fontSize: 9, color: "rgba(255,255,255,0.2)" }}>
        <span>🔴 &gt;14%</span>
        <span>🟡 7-14%</span>
        <span>🟢 &lt;7%</span>
      </div>
    </div>
  );
}

/* ── SCANNING OVERLAY ── */
function ScanningScreen({ address, stage, iqEarned, mode }) {
  const isT  = mode === "training";
  const acc  = isT ? TA.acc : SM.acc;
  const bg   = isT ? "#110b06" : "#030812";
  const pct  = (stage / SCAN_STAGES.length) * 100;
  const lvl  = getIQL(iqEarned);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "20px 16px", overflowY: "auto" }}>
      <style>{".sIn{animation:sIn .25s ease both} @keyframes sIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:none}} @keyframes rSpin{to{transform:rotate(360deg)}} @keyframes rPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.5}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}"}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 380 }}>
        <Logo size={44} />
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 4, color: isT ? TA.text : "#fff" }}>DEMYST</div>
        <div style={{ fontSize: 9, letterSpacing: 4, color: acc, opacity: 0.6, textTransform: "uppercase", marginTop: -8 }}>{isT ? "Training Arc" : "Sage Mode"}</div>
        <div style={{ position: "relative", width: 130, height: 130 }}>
          {[1, 0.7, 0.44, 0.22].map((sv, i) => (
            <div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: sv * 122, height: sv * 122, transform: "translate(-50%,-50%)", borderRadius: "50%", border: "1px solid " + acc + ["16", "11", "0c", "07"][i] }} />
          ))}
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 61, height: 1, background: "linear-gradient(90deg," + acc + "90,transparent)", transformOrigin: "0 50%", animation: "rSpin 2s linear infinite" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 8, height: 8, borderRadius: "50%", background: acc, transform: "translate(-50%,-50%)", boxShadow: "0 0 12px " + acc }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 65, height: 65, borderRadius: "50%", border: "2px solid " + acc, transform: "translate(-50%,-50%)", animation: "rPulse 2s ease-out infinite" }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: isT ? TA.muted : "#64748b", background: "rgba(255,255,255,0.03)", padding: "5px 12px", borderRadius: 4, maxWidth: "95%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</div>
        <div style={{ width: "90%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: isT ? TA.muted : "#475569", marginBottom: 4, letterSpacing: 2 }}>
            <span>SCANNING</span>
            <span>{Math.round(pct)}%</span>
          </div>
          <div style={{ height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg," + acc + "55," + acc + ")", transition: "width .4s ease", boxShadow: "0 0 6px " + acc }} />
          </div>
        </div>
        {stage < SCAN_STAGES.length && (
          <div style={{ fontSize: 11, color: isT ? TA.sub : "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}>
            <span>{SCAN_STAGES[stage].icon}</span>
            <span>{SCAN_STAGES[stage].label}</span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 16px", border: "1px solid rgba(255,255,255,0.06)", width: "90%", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: isT ? TA.text : "#fff", lineHeight: 1 }}>+{iqEarned}</div>
            <div style={{ fontSize: 9, color: acc, letterSpacing: 2 }}>IQ POINTS</div>
          </div>
          <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.06)" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, marginBottom: 2 }}>{lvl.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: lvl.color }}>{lvl.label}</div>
          </div>
        </div>
        <div style={{ width: "90%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px" }}>
          {SCAN_STAGES.map((s, i) => {
            const done   = i < stage;
            const active = i === stage;
            return (
              <div key={s.id} className={done ? "sIn" : ""} style={{ display: "flex", alignItems: "center", gap: 5, opacity: done || active ? 1 : 0.18 }}>
                <div style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, background: done ? acc : "transparent", border: (done ? "none" : active ? "2px" : "1px") + " solid " + (done ? "transparent" : active ? acc : "rgba(255,255,255,0.10)"), color: done ? "#000" : active ? acc : (isT ? TA.muted : "#475569"), transition: "all .25s" }}>
                  {done ? "✓" : active ? "◌" : i + 1}
                </div>
                <div style={{ fontSize: 9, color: done ? (isT ? TA.text : "#cbd5e1") : active ? acc : (isT ? TA.muted : "#4b5563"), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                {done && <div style={{ marginLeft: "auto", fontSize: 8, color: acc, fontWeight: 700, flexShrink: 0 }}>+{s.iq}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── MODE SELECT ── */
function ModeSelect({ onSelect }) {


  return (
    <div style={{ minHeight: "100vh", background: "#0e0904", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "system-ui, sans-serif", padding: "24px 16px 48px", overflowY: "auto" }}>
      <style>{".ms-tap{transition:transform .2s ease,box-shadow .2s ease} .ms-tap:active{transform:scale(0.98)}"}</style>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Logo size={72} />
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#6b4f25", fontWeight: 700, marginTop: 12, marginBottom: 4, textTransform: "uppercase" }}>Welcome to</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.05 }}>
          <span style={{ background: "linear-gradient(135deg,#fffbf0,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>DE</span>
          <span style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>MYST</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#5a3e1c", marginTop: 5, textTransform: "uppercase" }}>Blockchain Intelligence Platform</div>
      </div>

      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Training Arc card */}
        <div className="ms-tap" onClick={() => onSelect("training")} style={{ borderRadius: 16, overflow: "hidden", cursor: "pointer", background: "linear-gradient(150deg,#2a1f0e,#1e1508,#19130a)", border: "1px solid rgba(245,158,11,0.18)", boxShadow: "0 6px 24px rgba(0,0,0,0.55)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#d97706,#fbbf24,#d97706,transparent)" }} />
          <div style={{ padding: "20px 18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg,#7c3000,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 6px 20px rgba(217,119,6,0.4)" }}>🎓</div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 4, color: "#d97706", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Mode 01</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: TA.text }}>Training Arc</div>
                <div style={{ fontSize: 11, color: "#7c5020" }}>Learn while you scan</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
              {[["🧠", "Tye explains everything"], ["📊", "Live security data"], ["🏆", "IQ rank system"], ["🗺️", "Wallet risk map"]].map(([ic, t]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.06)", borderRadius: 7, padding: "6px 9px" }}>
                  <span style={{ fontSize: 13 }}>{ic}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#e8c97a" }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 11, borderRadius: 9, background: "linear-gradient(135deg,#92400e,#d97706,#f59e0b)", color: "#fff8e7", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", boxShadow: "0 5px 18px rgba(217,119,6,0.4)" }}>
              Start Training →
            </div>
          </div>
        </div>

        {/* Sage Mode card */}
        <div className="ms-tap" onClick={() => onSelect("sage")} style={{ borderRadius: 16, overflow: "hidden", cursor: "pointer", background: "linear-gradient(150deg,#0d0d08,#080806,#050503)", border: "1px solid rgba(212,175,55,0.18)", boxShadow: "0 6px 24px rgba(0,0,0,0.75)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#9d7c0a,#d4af37,#9d7c0a,transparent)" }} />
          <div style={{ padding: "20px 18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg,#151200,#2e2800)", border: "1px solid rgba(212,175,55,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 6px 20px rgba(212,175,55,0.18)" }}>⚡</div>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 4, color: "#b8960c", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Mode 02</div>
                <div style={{ fontSize: 20, fontWeight: 900, background: "linear-gradient(135deg,#c9a227,#f0d060,#c9a227)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Sage Mode</div>
                <div style={{ fontSize: 11, color: "#4a3e10" }}>Raw on-chain intelligence</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
              {[["🔬", "Terminal data view"], ["⚠️", "Full GoPlus audit"], ["📡", "DexScreener live"], ["🕸️", "Force-graph map"]].map(([ic, t]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(212,175,55,0.05)", borderRadius: 7, padding: "6px 9px" }}>
                  <span style={{ fontSize: 13 }}>{ic}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#c9a227" }}>{t}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 11, borderRadius: 9, background: "linear-gradient(135deg,#151200,#252000)", border: "1px solid rgba(212,175,55,0.45)", color: "#d4af37", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Enter Sage Mode →
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── TRAINING ARC ── */
function TAChip({ label, value, color }) {
  const c = color || TA.acc;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 4, background: c + "12", border: "1px solid " + c + "28", whiteSpace: "nowrap" }}>
      <span style={{ color: TA.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</span>
      <span style={{ color: c, fontWeight: 700, fontSize: 11 }}>{value}</span>
    </div>
  );
}

function TyeCard({ icon, title, chips, tyeText, loading }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: TA.card, borderRadius: 12, overflow: "hidden", border: "1px solid " + TA.border, marginBottom: 10 }}>
      <div onClick={() => setOpen((o) => !o)} style={{ padding: "10px 14px", borderBottom: open ? "1px solid " + TA.border : "none", display: "flex", alignItems: "center", gap: 7, background: TA.cardAlt, cursor: "pointer" }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: TA.text, flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: TA.muted }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "11px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
          {chips && <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{chips}</div>}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff", boxShadow: "0 0 10px rgba(124,58,237,0.35)" }}>T</div>
            <div style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: "0 8px 8px 8px", padding: "8px 11px", flex: 1, fontSize: 12.5, color: TA.sub, lineHeight: 1.75, fontStyle: loading ? "italic" : "normal" }}>
              {loading ? <span style={{ color: TA.muted }}>Tye is thinking...</span> : tyeText || <span style={{ color: TA.muted }}>Analysis unavailable</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrainingArcView({ sd, wallets, tye, tyeLoading }) {
  const sl = getSL(sd.score);
  const lv = sd.sources || {};
  const sec = sd.security || {};
  const mkt = sd.market   || {};

  return (
    <div style={{ color: TA.text }}>
      <SourceBanner sources={sd.sources} />

      <div style={{ background: TA.card, border: "1px solid " + TA.border, borderRadius: 14, padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <ScoreGauge score={sd.score} mode="training" />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontSize: 17, fontWeight: 900 }}>{sd.token.name}</span>
              <span style={{ background: TA.acc + "18", border: "1px solid " + TA.acc + "30", borderRadius: 3, padding: "1px 6px", fontSize: 9, color: TA.acc, fontWeight: 700 }}>{sd.token.symbol}</span>
              <span style={{ background: "rgba(255,255,255,0.04)", borderRadius: 3, padding: "1px 6px", fontSize: 9, color: TA.muted }}>{sd.chain}</span>
            </div>
            {sd.token.priceUsd && (
              <div style={{ fontSize: 12, fontWeight: 700, color: TA.green, marginBottom: 3 }}>
                {"$" + parseFloat(sd.token.priceUsd).toFixed(6)}
                <LiveBadge live={lv.dexscreener} />
              </div>
            )}
            <div style={{ fontSize: 9, color: TA.dim, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4 }}>{sd.address}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: sec.isHoneypot ? 9 : 0 }}>
          <TAChip label="Holders" value={fmtNum(sec.holderCount)} />
          <TAChip label="Vol 24h" value={fmtUSD(mkt.volume && mkt.volume.h24)} color={lv.dexscreener ? TA.green : TA.acc} />
          <TAChip label="Liq" value={fmtUSD(mkt.liquidity)} color={lv.dexscreener ? TA.green : TA.acc} />
          <TAChip label="24h" value={(((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? "+" : "") + ((mkt.priceChange && mkt.priceChange.h24) || 0).toFixed(1) + "%"} color={((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? TA.green : TA.red} />
        </div>
        {sec.isHoneypot && (
          <div style={{ background: "rgba(239,68,68,0.09)", border: "1px solid rgba(239,68,68,0.28)", borderRadius: 8, padding: "8px 11px", fontSize: 11, color: "#fca5a5", display: "flex", alignItems: "center", gap: 6 }}>
            🍯 <strong>HONEYPOT DETECTED — Do not buy.</strong>
            {lv.goplus && <span style={{ fontSize: 9, opacity: 0.6 }}>(GoPlus confirmed)</span>}
          </div>
        )}
      </div>

      {sd.reasons && sd.reasons.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
          {sd.reasons.map((r) => (
            <div key={r} style={{ fontSize: 9, color: TA.red, background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 4, padding: "2px 7px" }}>{r}</div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
        {[
          { l: "Liquidity",   v: sec.lp && sec.lp.lockedPct > 5 ? "Locked " + sec.lp.lockedPct + "%" : "Unlocked", ok: !!(sec.lp && sec.lp.lockedPct > 5), live: lv.goplus },
          { l: "Ownership",   v: sec.isRenounced ? "Renounced" : "Active", ok: !!sec.isRenounced, live: lv.goplus },
          { l: "Honeypot",    v: sec.isHoneypot ? "YES" : "NO",            ok: !sec.isHoneypot,   live: lv.goplus },
          { l: "Open Source", v: sec.flags && sec.flags.isOpenSource ? "Yes" : "No", ok: !!(sec.flags && sec.flags.isOpenSource), live: lv.goplus },
          { l: "Website",     v: mkt.social && mkt.social.website ? "Live" : "None", ok: !!(mkt.social && mkt.social.website), live: lv.dexscreener },
          { l: "Twitter",     v: mkt.social && mkt.social.twitter ? "Active" : "None", ok: !!(mkt.social && mkt.social.twitter), live: lv.dexscreener },
        ].map(({ l, v, ok, live }) => (
          <div key={l} style={{ background: ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)", border: "1px solid " + (ok ? "rgba(34,197,94,0.17)" : "rgba(239,68,68,0.17)"), borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 8, color: TA.muted, letterSpacing: 1.5, marginBottom: 3, textTransform: "uppercase", display: "flex", alignItems: "center" }}>
              {l}
              <LiveBadge live={live} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: ok ? TA.green : TA.red }}>{v} {ok ? "✓" : "✗"}</div>
          </div>
        ))}
      </div>

      {sec.flags && (
        <div style={{ background: TA.card, border: "1px solid " + TA.border, borderRadius: 10, padding: "10px 13px", marginBottom: 12 }}>
          <div style={{ fontSize: 8, letterSpacing: 3, color: TA.acc, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
            GoPlus Flags
            <LiveBadge live={true} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {[
              { k: "Open Source",    v: sec.flags.isOpenSource,        g: true  },
              { k: "Mintable",       v: sec.flags.isMintable,          g: false },
              { k: "Proxy",          v: sec.flags.isProxy,             g: false },
              { k: "Hidden Owner",   v: sec.flags.hasHiddenOwner,      g: false },
              { k: "Anti-Whale",     v: sec.flags.isAntiWhale,         g: true  },
              { k: "Cooldown",       v: sec.flags.hasTradingCooldown,  g: false },
              { k: "Take Ownership", v: sec.flags.canTakeOwnership,    g: false },
              { k: "Self-Destruct",  v: sec.flags.canSelfDestruct,     g: false },
            ].map(({ k, v, g }) => {
              const safe = g ? v : !v;
              return (
                <div key={k} style={{ padding: "2px 7px", borderRadius: 4, background: safe ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)", border: "1px solid " + (safe ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)"), fontSize: 10, color: safe ? TA.green : TA.red, fontWeight: 600 }}>
                  {v ? "✓" : "✗"} {k}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mkt.social && (mkt.social.website || mkt.social.twitter || mkt.social.telegram) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {mkt.social.website  && <a href={mkt.social.website}  target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, background: TA.accDim, border: TA.borderHi, color: TA.acc, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>🌐 Website</a>}
          {mkt.social.twitter  && <a href={mkt.social.twitter}  target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, background: TA.accDim, border: TA.borderHi, color: TA.acc, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>🐦 Twitter</a>}
          {mkt.social.telegram && <a href={mkt.social.telegram} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, background: TA.accDim, border: TA.borderHi, color: TA.acc, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>✈️ Telegram</a>}
          {mkt.pairUrl         && <a href={mkt.pairUrl}         target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, background: TA.accDim, border: TA.borderHi, color: TA.acc, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>📈 Chart</a>}
        </div>
      )}

      <TyeCard icon="📜" title="Smart Contract"
        chips={[<TAChip key="b" label="Buy" value={(sec.buyTax || 0) + "%"} color={(sec.buyTax || 0) > 10 ? TA.red : TA.green} />, <TAChip key="s" label="Sell" value={(sec.sellTax || 0) + "%"} color={(sec.sellTax || 0) > 15 ? TA.red : (sec.sellTax || 0) > 5 ? TA.yellow : TA.green} />]}
        tyeText={tye && tye.contractAnalysis} loading={tyeLoading} />
      <TyeCard icon="👥" title="Holder Analysis"
        chips={[<TAChip key="t" label="Total" value={fmtNum(sec.holderCount)} />, <TAChip key="p" label="Top 10" value={(sec.top10HolderPct || 0) + "%"} color={(sec.top10HolderPct || 0) > 50 ? TA.red : TA.green} />]}
        tyeText={tye && tye.holderAnalysis} loading={tyeLoading} />
      <TyeCard icon="🔐" title="Liquidity Lock"
        chips={[<TAChip key="l" label="Locked" value={sec.lp && sec.lp.lockedPct > 5 ? sec.lp.lockedPct + "%" : "NO"} color={sec.lp && sec.lp.lockedPct > 5 ? TA.green : TA.red} />, <TAChip key="u" label="Total" value={fmtUSD(mkt.liquidity)} color={lv.dexscreener ? TA.green : TA.acc} />]}
        tyeText={tye && tye.liquidityAnalysis} loading={tyeLoading} />
      <TyeCard icon="🕵️" title="Deployer History"
        chips={[<TAChip key="c" label="Creator" value={shortAddr(sec.creatorAddress || "Unknown")} />]}
        tyeText={tye && tye.deployerAnalysis} loading={tyeLoading} />
      <TyeCard icon="🐋" title="Whale Distribution"
        chips={wallets.slice(0, 3).map((w, i) => <TAChip key={i} label={w.label} value={w.pct + "%"} color={w.risk === "high" ? TA.red : w.risk === "medium" ? TA.yellow : TA.green} />)}
        tyeText={tye && tye.whaleAnalysis} loading={tyeLoading} />
      <TyeCard icon="🍯" title="Honeypot Detection"
        chips={[<TAChip key="h" label="Status" value={sec.isHoneypot ? "DETECTED" : "CLEAN"} color={sec.isHoneypot ? TA.red : TA.green} />, <TAChip key="s" label="Sell Tax" value={(sec.sellTax || 0) + "%"} color={(sec.sellTax || 0) > 20 ? TA.red : TA.acc} />]}
        tyeText={tye && tye.honeypotAnalysis} loading={tyeLoading} />
      <TyeCard icon="🌐" title="Social Verification"
        chips={[<TAChip key="w" label="Website" value={mkt.social && mkt.social.website ? "Yes" : "No"} color={mkt.social && mkt.social.website ? TA.green : TA.red} />, <TAChip key="t" label="Twitter" value={mkt.social && mkt.social.twitter ? "Yes" : "No"} color={mkt.social && mkt.social.twitter ? TA.green : TA.red} />]}
        tyeText={tye && tye.socialAnalysis} loading={tyeLoading} />
      <TyeCard icon="📈" title="Trading Patterns"
        chips={[<TAChip key="24" label="Vol 24h" value={fmtUSD(mkt.volume && mkt.volume.h24)} color={lv.dexscreener ? TA.green : TA.acc} />, <TAChip key="tx" label="TXs" value={fmtNum(((mkt.txns && mkt.txns.buys) || 0) + ((mkt.txns && mkt.txns.sells) || 0))} />]}
        tyeText={tye && tye.volumeAnalysis} loading={tyeLoading} />

      <div style={{ background: TA.card, border: "1px solid " + TA.border, borderRadius: 12, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid " + TA.border, display: "flex", alignItems: "center", gap: 7, background: TA.cardAlt }}>
          <span style={{ fontSize: 14 }}>🗺️</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: TA.text, flex: 1 }}>Wallet Risk Map</span>
          <span style={{ fontSize: 9, color: TA.muted }}>Tap nodes</span>
        </div>
        <div style={{ padding: 11 }}>
          <WalletRiskMap wallets={wallets} token={sd.token} accent={TA.acc} />
        </div>
      </div>

      <div style={{ background: tyeLoading ? "rgba(124,58,237,0.04)" : sl.bg, border: "1px solid " + (tyeLoading ? "rgba(124,58,237,0.16)" : sl.color + "33"), borderRadius: 13, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: tyeLoading ? "rgba(124,58,237,0.35)" : "linear-gradient(90deg," + sl.color + "44," + sl.color + "cc)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff", flexShrink: 0, boxShadow: "0 0 14px rgba(124,58,237,0.45)" }}>T</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: 3, color: TA.purple, fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Tye's Final Verdict</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: TA.text }}>
              {tyeLoading ? "Analyzing..." : tye ? (tye.verdictEmoji + " " + tye.verdictTitle) : "Verdict unavailable"}
            </div>
          </div>
          {!tyeLoading && (
            <div style={{ fontSize: 20, fontWeight: 900, color: sl.color, background: sl.bg, border: "1px solid " + sl.color + "44", borderRadius: 7, padding: "5px 10px", flexShrink: 0 }}>{sd.score}</div>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: TA.sub, lineHeight: 1.85, fontStyle: tyeLoading ? "italic" : "normal", borderTop: "1px solid " + TA.border, paddingTop: 11 }}>
          {tyeLoading ? "Tye is putting it all together..." : (tye && tye.finalVerdict) || "Could not generate verdict."}
        </div>
      </div>
    </div>
  );
}

/* ── SAGE MODE ── */
function SRow({ label, value, sub, color, live }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 7 }}>
      <div style={{ flex: "0 0 42%", fontSize: 9, color: "#475569", letterSpacing: 1.5, fontFamily: "monospace", textTransform: "uppercase", display: "flex", alignItems: "center", flexWrap: "wrap", paddingRight: 4 }}>
        {label}
        {live !== undefined && <LiveBadge live={live} />}
      </div>
      <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: color || SM.acc, fontFamily: "monospace", wordBreak: "break-all" }}>
        {value}
        {sub && <span style={{ fontSize: 8, color: "#334155", marginLeft: 4 }}>{sub}</span>}
      </div>
    </div>
  );
}

function SBlock({ title, children }) {
  return (
    <div style={{ background: SM.card, border: "1px solid " + SM.border, borderRadius: 8, overflow: "hidden", marginBottom: 9 }}>
      <div style={{ padding: "6px 12px", background: "rgba(0,229,160,0.04)", borderBottom: "1px solid " + SM.border, fontSize: 8, letterSpacing: 3, color: SM.acc, fontWeight: 700, textTransform: "uppercase", fontFamily: "monospace" }}>{title}</div>
      <div style={{ padding: "2px 12px 5px" }}>{children}</div>
    </div>
  );
}

function SageModeView({ sd, wallets }) {
  const sl  = getSL(sd.score);
  const lv  = sd.sources  || {};
  const sec = sd.security || {};
  const mkt = sd.market   || {};

  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0" }}>
      <SourceBanner sources={sd.sources} />
      <div style={{ background: SM.card, border: "1px solid " + SM.border, borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{sd.token.name}</span>
          <span style={{ fontSize: 10, color: SM.blue }}>${sd.token.symbol}</span>
          <span style={{ fontSize: 9, color: "#334155" }}>{sd.chain}</span>
          {sd.token.priceUsd && (
            <span style={{ fontSize: 11, fontWeight: 700, color: SM.acc }}>
              {"$" + parseFloat(sd.token.priceUsd).toFixed(6)}
              <LiveBadge live={true} />
            </span>
          )}
        </div>
        <div style={{ fontSize: 9, color: "#334155", marginBottom: 9, wordBreak: "break-all" }}>{sd.address}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ background: sl.color + "16", border: "1px solid " + sl.color + "40", borderRadius: 4, padding: "3px 10px", fontSize: 10, color: sl.color, fontWeight: 700, letterSpacing: 1.5 }}>{sl.label} · {sd.score}/100</div>
          {sec.isHoneypot && <div style={{ background: "rgba(239,68,68,0.11)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "3px 10px", fontSize: 10, color: "#ef4444", fontWeight: 700 }}>HONEYPOT</div>}
        </div>
        <ScoreGauge score={sd.score} mode="sage" />
        {mkt.social && (mkt.social.website || mkt.social.twitter || mkt.social.telegram || mkt.pairUrl) && (
          <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            {mkt.social.website  && <a href={mkt.social.website}  target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>🌐 Web</a>}
            {mkt.social.twitter  && <a href={mkt.social.twitter}  target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>🐦 TW</a>}
            {mkt.social.telegram && <a href={mkt.social.telegram} target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>✈️ TG</a>}
            {mkt.pairUrl         && <a href={mkt.pairUrl}         target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>📈 Chart</a>}
          </div>
        )}
      </div>

      <SBlock title="contract">
        <SRow label="buy_tax"   value={(sec.buyTax  || 0) + "%"} color={(sec.buyTax  || 0) > 10 ? "#ef4444" : SM.acc} live={lv.goplus} />
        <SRow label="sell_tax"  value={(sec.sellTax || 0) + "%"} color={(sec.sellTax || 0) > 15 ? "#ef4444" : (sec.sellTax || 0) > 5 ? "#f59e0b" : SM.acc} live={lv.goplus} />
        <SRow label="renounced" value={sec.isRenounced ? "TRUE" : "FALSE"} color={sec.isRenounced ? SM.acc : "#ef4444"} live={lv.goplus} />
        <SRow label="honeypot"  value={sec.isHoneypot ? "DETECTED" : "CLEAN"} color={sec.isHoneypot ? "#ef4444" : SM.acc} live={lv.goplus} />
        <SRow label="owner"     value={shortAddr(sec.ownerAddress  || "BURNED")} color={SM.blue} live={lv.goplus} />
        <SRow label="creator"   value={shortAddr(sec.creatorAddress || "")}      color={SM.blue} live={lv.goplus} />
      </SBlock>

      {sec.flags && (
        <SBlock title="goplus_flags">
          {[["open_source", sec.flags.isOpenSource, true], ["mintable", sec.flags.isMintable, false], ["proxy", sec.flags.isProxy, false], ["hidden_owner", sec.flags.hasHiddenOwner, false], ["anti_whale", sec.flags.isAntiWhale, true], ["cooldown", sec.flags.hasTradingCooldown, false], ["take_ownership", sec.flags.canTakeOwnership, false], ["self_destruct", sec.flags.canSelfDestruct, false]].map(([k, v, g]) => {
            const safe = g ? v : !v;
            return <SRow key={k} label={k} value={v ? "TRUE" : "FALSE"} color={safe ? SM.acc : "#ef4444"} live={true} />;
          })}
        </SBlock>
      )}

      <SBlock title="liquidity">
        <SRow label="locked"    value={sec.lp && sec.lp.lockedPct > 5 ? "TRUE" : "FALSE"} color={sec.lp && sec.lp.lockedPct > 5 ? SM.acc : "#ef4444"} live={lv.goplus} />
        <SRow label="lock_pct"  value={((sec.lp && sec.lp.lockedPct) || 0) + "%"} color={(sec.lp && sec.lp.lockedPct > 80) ? SM.acc : (sec.lp && sec.lp.lockedPct > 50) ? "#f59e0b" : "#ef4444"} live={lv.goplus} />
        <SRow label="total_usd" value={fmtUSD(mkt.liquidity)} live={lv.dexscreener} />
      </SBlock>

      <SBlock title="holders">
        <SRow label="count"      value={fmtNum(sec.holderCount)} />
        <SRow label="top_10_pct" value={(sec.top10HolderPct || 0) + "%"} color={(sec.top10HolderPct || 0) > 50 ? "#ef4444" : SM.acc} />
        {wallets.slice(0, 5).map((w, i) => (
          <SRow key={i} label={"h" + (i + 1)} value={w.pct + "%"} color={w.risk === "high" ? "#ef4444" : w.risk === "medium" ? "#f59e0b" : SM.acc} sub={w.id} />
        ))}
      </SBlock>

      <SBlock title="market">
        <SRow label="price"     value={sd.token.priceUsd ? "$" + parseFloat(sd.token.priceUsd).toFixed(8) : "N/A"} live={lv.dexscreener} />
        <SRow label="vol_24h"   value={fmtUSD(mkt.volume && mkt.volume.h24)}   live={lv.dexscreener} />
        <SRow label="liquidity" value={fmtUSD(mkt.liquidity)}                  live={lv.dexscreener} />
        <SRow label="price_chg" value={(((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? "+" : "") + ((mkt.priceChange && mkt.priceChange.h24) || 0).toFixed(2) + "%"} color={((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? SM.acc : "#ef4444"} live={lv.dexscreener} />
        <SRow label="buys"      value={fmtNum(mkt.txns && mkt.txns.buys)}  color={SM.acc}    live={lv.dexscreener} />
        <SRow label="sells"     value={fmtNum(mkt.txns && mkt.txns.sells)} color="#ef4444" live={lv.dexscreener} />
      </SBlock>

      <SBlock title="wallet_risk_map — tap nodes to inspect">
        <div style={{ padding: "4px 0" }}>
          <WalletRiskMap wallets={wallets} token={sd.token} accent={SM.acc} />
        </div>
      </SBlock>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const [screen,     setScreen]     = useState("select");

  const [addr,       setAddr]       = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [scanStage,  setScanStage]  = useState(0);
  const [iqEarned,   setIqEarned]   = useState(0);
  const [totalIQ,    setTotalIQ]    = useState(0);
  const [scanData,   setScanData]   = useState(null);
  const [wallets,    setWallets]    = useState([]);
  const [tye,        setTye]        = useState(null);
  const [tyeLoading, setTyeLoading] = useState(false);
  const [error,      setError]      = useState(null);
  const inputRef = useRef();

  const isT   = screen === "training";
  const acc   = isT ? TA.acc : SM.acc;
  const iqLvl = getIQL(totalIQ);

  const handleScan = useCallback(async () => {
    const a = addr.trim();
    if (!a || a.length < 10) return;
    if (inputRef.current) inputRef.current.blur();
    setScanning(true); setScanStage(0); setIqEarned(0);
    setTye(null); setScanData(null); setError(null);

    // Calls /api/scan/ADDRESS — Vercel routes this to api/scan/[address].js
    const apiPromise = fetch("/api/scan/" + a).then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });

    let earned = 0;
    for (let i = 0; i < SCAN_STAGES.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 450 + Math.random() * 220));
      earned += SCAN_STAGES[i].iq;
      setScanStage(i + 1);
      setIqEarned(earned);
    }

    try {
      const data = await Promise.race([
        apiPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 20000)),
      ]);
      const wl = mockWallets(a, data.security && data.security.holders);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTotalIQ((p) => p + earned);
      setScanData(data);
      setWallets(wl);
      setScanning(false);
      if (isT) {
        setTyeLoading(true);
        fetchTye(data)
          .then(setTye)
          .catch(() => setTye(null))
          .finally(() => setTyeLoading(false));
      }
    } catch (err) {
      setScanning(false);
      setError(err.message === "timeout" ? "Scan timed out. Is your Replit backend running?" : "Backend error: " + err.message);
    }
  }, [addr, isT, apiBase]);

  if (screen === "select") {
    return <ModeSelect onSelect={(m) => setScreen(m)} />;
  }

  const bg     = isT ? TA.bg  : SM.bg;
  const hdr    = isT ? "rgba(21,16,11,0.96)" : "rgba(5,11,20,0.96)";
  const border = isT ? TA.border : SM.border;

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "system-ui, sans-serif", transition: "background .4s" }}>
      <style>{"*{box-sizing:border-box;-webkit-tap-highlight-color:transparent} input,button{-webkit-appearance:none;} button{touch-action:manipulation;} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>

      {scanning && <ScanningScreen address={addr.trim()} stage={scanStage} iqEarned={iqEarned} mode={screen} />}

      {/* Header */}
      <div style={{ borderBottom: "1px solid " + border, padding: "0 12px", display: "flex", alignItems: "center", height: 50, gap: 9, position: "sticky", top: 0, zIndex: 100, background: hdr, backdropFilter: "blur(14px)" }}>
        <button onClick={() => { setScreen("select"); setScanData(null); setTye(null); }} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
          <Logo size={28} />
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2, color: isT ? TA.text : "#fff" }}>DEMYST</span>
        </button>
        <div style={{ padding: "2px 8px", borderRadius: 4, background: isT ? "rgba(245,158,11,0.10)" : "rgba(0,229,160,0.07)", border: "1px solid " + acc + "2e", fontSize: 9, fontWeight: 700, color: acc, flexShrink: 0 }}>
          {isT ? "TRAINING" : "SAGE"}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", borderRadius: 6, padding: "3px 9px", border: "1px solid " + (isT ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.06)"), flexShrink: 0 }}>
          <span style={{ fontSize: 12 }}>{iqLvl.icon}</span>
          <div style={{ fontSize: 12, fontWeight: 900, color: iqLvl.color }}>{totalIQ}</div>
        </div>
        <button onClick={() => { setScreen(isT ? "sage" : "training"); setScanData(null); setTye(null); }} style={{ fontSize: 9, color: isT ? TA.muted : "#334155", background: "none", border: "1px solid " + border, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          {isT ? "⚡ Sage" : "🎓 Train"}
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "12px 12px 0", borderBottom: "1px solid " + border }}>
        <div style={{ display: "flex", gap: 7 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "rgba(255,255,255,0.04)", border: "1px solid " + (addr ? acc + "44" : border), borderRadius: 9, padding: "0 11px", gap: 7, transition: "border-color .2s" }}>
            <span style={{ fontSize: 12, opacity: 0.35, flexShrink: 0 }}>🔍</span>
            <input
              ref={inputRef}
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScan()}
              placeholder="Paste contract address..."
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: isT ? TA.text : "#e2e8f0", fontSize: 13, padding: "12px 0", fontFamily: "monospace", minWidth: 0 }}
            />
            {addr && <button onClick={() => setAddr("")} style={{ background: "none", border: "none", color: isT ? TA.muted : "#475569", cursor: "pointer", fontSize: 15, padding: 0, flexShrink: 0 }}>×</button>}
          </div>
          <button
            onClick={handleScan}
            disabled={!addr.trim() || scanning}
            style={{ padding: "0 16px", borderRadius: 9, border: "none", cursor: addr.trim() && !scanning ? "pointer" : "not-allowed", background: addr.trim() && !scanning ? (isT ? "linear-gradient(135deg,#7c3000,#f59e0b)" : "linear-gradient(135deg,#065f46,#00e5a0)") : "rgba(255,255,255,0.04)", color: addr.trim() && !scanning ? "#fff" : (isT ? TA.muted : "#334155"), fontWeight: 800, fontSize: 12, letterSpacing: 1, fontFamily: "inherit", transition: "all .2s", textTransform: "uppercase", flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {scanning ? "..." : "SCAN"}
          </button>
        </div>
        <div style={{ fontSize: 9, color: isT ? TA.muted : "#334155", padding: "7px 0 10px", letterSpacing: 0.5 }}>
          ETH · BSC · Base · Polygon · Solana · Arbitrum
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 12px 60px", animation: scanData ? "fadeUp .4s ease" : "none" }}>
        {error && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 14px", marginBottom: 12, color: "#fca5a5", fontSize: 11, lineHeight: 1.7 }}>
            <strong>{error}</strong>
            <div style={{ marginTop: 7, fontSize: 10, color: "rgba(252,165,165,0.6)" }}>Check your backend URL in the home screen setup panel.</div>
            <button onClick={() => { setScreen("select"); setScanData(null); setError(null); }} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 6, border: "none", background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              Go to Setup
            </button>
          </div>
        )}

        {!scanData && !scanning && !error && (
          <div style={{ textAlign: "center", padding: "44px 16px" }}>
            <Logo size={56} />
            <div style={{ fontSize: 15, fontWeight: 800, color: isT ? TA.sub : "#334155", marginBottom: 7, marginTop: 14 }}>
              {isT ? "Ready to learn." : "Awaiting address."}
            </div>
            <div style={{ fontSize: 11, color: isT ? TA.muted : "#1e3a5f", maxWidth: 320, margin: "0 auto", lineHeight: 1.75 }}>
              {isT ? "Paste any contract address and Tye will explain every risk in plain English." : "Enter an address for raw on-chain security data."}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 16, flexWrap: "wrap" }}>
              {["0x2170ed0880ac9a755fd29b2688956bd959f933f8", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"].map((a) => (
                <button key={a} onClick={() => setAddr(a)} style={{ background: isT ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.03)", border: "1px solid " + (isT ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.07)"), borderRadius: 6, padding: "5px 11px", fontSize: 10, color: isT ? TA.muted : "#475569", cursor: "pointer", fontFamily: "monospace" }}>
                  {shortAddr(a)}
                </button>
              ))}
            </div>
          </div>
        )}

        {scanData && isT  && <TrainingArcView sd={scanData} wallets={wallets} tye={tye} tyeLoading={tyeLoading} />}
        {scanData && !isT && <SageModeView    sd={scanData} wallets={wallets} />}
      </div>
    </div>
  );
}
