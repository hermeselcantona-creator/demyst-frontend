import { useState, useRef, useCallback, useEffect } from "react";
import * as d3 from "d3";

/* ── THEME ── */
const TA = {
  bg:        "#f0ebe0",
  card:      "#ffffff",
  cardBorder:"#e8e0d0",
  text:      "#1a1201",
  sub:       "#5a4a2a",
  muted:     "#9a8a6a",
  dim:       "#c4b89a",
  iq:        "#ea580c",
  streak:    "#ea580c",
  safe:      "#16a34a",
  safeBg:    "#f0faf5",
  safeBorder:"#bbf7d0",
  caution:   "#d97706",
  cautionBg: "#fffbeb",
  cautionBorder:"#fde68a",
  danger:    "#dc2626",
  dangerBg:  "#fff5f5",
  dangerBorder:"#fecaca",
  eli5Bg:    "#fffef5",
  eli5Border:"#fef08a",
  analogyBg: "#fff7f0",
  analogyBorder:"#fed7aa",
  tyeBg:     "#f0faf5",
  tyeBorder: "#a7f3d0",
  factBg:    "#f0fdf4",
  factBorder:"#bbf7d0",
  acc:       "#f59e0b",
};
const SM = {
  bg:"#050b14", card:"#070e1a", border:"rgba(0,229,160,0.09)",
  acc:"#00e5a0", blue:"#00b4ff", text:"#e2e8f0", sub:"#475569",
};

/* ── CONSTANTS ── */
const IQ_LEVELS = [
  { min:0,    label:"Blockchain Rookie", color:"#9a8a6a", icon:"🌱" },
  { min:100,  label:"Chain Explorer",   color:"#d97706", icon:"🔍" },
  { min:300,  label:"DeFi Detective",   color:"#7c3aed", icon:"🕵️" },
  { min:600,  label:"Crypto Scholar",   color:"#ea580c", icon:"📚" },
  { min:1000, label:"Blockchain Sage",  color:"#16a34a", icon:"🧙" },
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
  { min:80, label:"SAFE",    color:"#16a34a", bg:"rgba(22,163,74,0.08)"   },
  { min:60, label:"CAUTION", color:"#d97706", bg:"rgba(217,119,6,0.08)"  },
  { min:40, label:"RISKY",   color:"#ea580c", bg:"rgba(234,88,12,0.08)"  },
  { min:20, label:"DANGER",  color:"#dc2626", bg:"rgba(220,38,38,0.08)"  },
  { min:0,  label:"SCAM",    color:"#991b1b", bg:"rgba(153,27,27,0.10)"  },
];

/* ── EDUCATIONAL CONTENT ── */
const EDU = {
  contract: {
    icon: "📜", title: "Smart Contract Reading",
    sub: "Analyzing the contract source code for malicious functions.",
    eli5: "Think of a smart contract like the blueprint of a building. Before you move in, you want to make sure the architect did not hide a trapdoor in the floor or a self-destruct switch behind the wall. When the source code is verified or open source, it means anyone can read the blueprint and check for traps. If it is unverified, the builder is saying just trust me without showing you anything. A proxy contract is even trickier because it means the builder can secretly swap out the entire blueprint while you are living inside. We scan every function, modifier, and external call in the code to flag anything dangerous so you know exactly what you are stepping into.",
    analogy: "Think of it like signing a lease for an apartment you have never visited. The contract could say anything, and if you cannot read it, you are trusting a stranger with your money.",
    fact: "Smart contracts were first proposed by computer scientist Nick Szabo in 1994, nearly 15 years before Bitcoin was invented.",
  },
  honeypot: {
    icon: "🍯", title: "Honeypot Detection",
    sub: "Testing if tokens can be sold after buying.",
    eli5: "Imagine walking into a store where you can buy anything on the shelf, but when you try to return something or sell it back, the door locks behind you and the cashier vanishes. That is exactly what a honeypot token does. The buy function works perfectly, so your purchase goes through without a hitch. But the sell function is rigged. It might revert the transaction, apply a 100% tax, or simply freeze your tokens forever. We simulate both buying and selling the token before you ever touch it, so you can see whether the exit door actually opens.",
    analogy: "Imagine a casino where you can buy chips at the counter, but when you try to cash out, the cashier window is permanently closed. That is a honeypot.",
    fact: "Honeypot scams drain over $20 million from crypto investors every single month, making them one of the most profitable scam types in DeFi.",
  },
  liquidity: {
    icon: "💧", title: "Liquidity Pool Analysis",
    sub: "Checking liquidity depth and lock status.",
    eli5: "Picture a swimming pool at a water park. The water in the pool represents the money backing the token. If there is a deep pool full of water, you can jump in and splash around safely because there is plenty of support. But if the pool is almost empty, even a small jump sends all the water flying and you hit the bottom. Now imagine if the developer has a secret drain plug at the bottom of the pool. They could pull it any moment and drain all the water while you are still swimming. When liquidity is locked, it means someone welded that drain plug shut and threw away the key for a set amount of time, so nobody can drain the pool unexpectedly.",
    analogy: "Imagine a bank where the vault door can be opened by one person with one key at any time. That is unlocked liquidity. A lock means multiple keys and a time delay before anyone can drain it.",
    fact: "The concept of automated liquidity pools was pioneered by Uniswap in 2018 and completely changed how decentralized trading works.",
  },
  holders: {
    icon: "👥", title: "Holder Distribution",
    sub: "Analyzing how tokens are spread across wallets.",
    eli5: "Imagine a pizza company where one person secretly owns 80% of all the shares. They can call all the shots, sell their shares any time they want, and crash the whole business. Healthy token distribution is like a pizza company with thousands of small shareholders. No single person can destroy everything by dumping their stake. When the top 10 wallets hold most of the supply, the token price can be moved dramatically by just a few decisions. We check whether power is spread out or dangerously concentrated.",
    analogy: "It is like a game of musical chairs where a few big players own most of the chairs. When the music stops, small holders are left standing.",
    fact: "The largest Bitcoin wallet holds less than 1% of all Bitcoin in circulation, which is considered extremely healthy distribution for a mature asset.",
  },
  deployer: {
    icon: "🕵️", title: "Deployer Wallet History",
    sub: "Investigating the team behind this token.",
    eli5: "Before buying a used car, you check the vehicle history report to see if it was ever in a crash. We do the same thing for the wallet that created this token. A brand new wallet that launched yesterday with no history is a major red flag, because it means someone created it specifically to launch this token and potentially disappear. A wallet with a long history of legitimate activity is a much better sign. We also check if the same wallet has launched other tokens that turned out to be rug pulls.",
    analogy: "It is like hiring someone with no resume, no references, and no work history. You have no idea if they are trustworthy or have scammed previous employers.",
    fact: "Most rug pull deployers use fresh wallets created within 7 days of the token launch to avoid being traced to previous scams.",
  },
  ownership: {
    icon: "👑", title: "Ownership & Admin Rights",
    sub: "Checking who controls the contract and what they can do.",
    eli5: "When a token owner renounces ownership, it means they permanently give up their special admin powers. Nobody can ever change the rules of the contract again. Think of it like a game that has been officially sealed and published. The rules are fixed forever. But if the owner keeps control, they can potentially change taxes at any time, pause trading, add wallets to blacklists, or even mint new tokens and dilute your holdings. Some of these functions sound useful but they can also be weaponized against investors.",
    analogy: "Renounced ownership is like publishing a law that not even the government can change. Unrenounced ownership is like a landlord who can rewrite your lease at any time.",
    fact: "The first major DeFi rug pull using admin key functions happened in 2020 with SushiSwap, when the anonymous founder sold all developer tokens worth $14 million.",
  },
  social: {
    icon: "🌐", title: "Team Credibility Assessment",
    sub: "Verifying social presence and community signals.",
    eli5: "When a business opens a new restaurant, you expect them to have a website, a social media presence, and a way to contact them. If a new token has no website, no Twitter account, no Telegram group, and no audit, it is the equivalent of a pop-up restaurant with no signage, no menu, and no health inspection certificate. Legitimate projects invest in building their brand and community. Complete anonymity combined with no online footprint is one of the earliest warning signs of a potential exit scam.",
    analogy: "Would you wire money to a company that has no website, no phone number, no reviews, and no way to contact them? That is what buying an unsocial token means.",
    fact: "Over 95% of confirmed rug pull projects had no working website or verifiable team identity at the time they launched.",
  },
  volume: {
    icon: "📈", title: "Volume & Trading Patterns",
    sub: "Detecting manipulation through trading data.",
    eli5: "Real trading activity follows natural patterns. People buy and sell at different times, in different amounts, for different reasons. Fake volume is manufactured by bots trading with themselves to create the illusion of popularity. This is called wash trading. It is the crypto equivalent of a restaurant hiring fake customers to stand in line outside so passers by think the food must be amazing. Sudden massive volume spikes with no news, or perfectly consistent buy and sell patterns, are all red flags that trading may be artificially manipulated to lure real buyers in before a dump.",
    analogy: "Imagine a stock that only ever goes up exactly 1% every single hour like clockwork. That kind of perfect pattern does not happen naturally. Someone is pulling strings.",
    fact: "A 2022 study found that over 70% of trading volume on smaller crypto exchanges was fake wash trading designed to inflate token popularity.",
  },
  market: {
    icon: "📊", title: "Market Structure Health",
    sub: "Overall assessment of market conditions and risks.",
    eli5: "Market health is the combination of everything we have checked. Think of it like a health checkup for a business. Low liquidity means even small trades will cause massive price swings. Concentrated whale holdings mean a few people can crash the price with one sell order. Suspicious volume patterns suggest manipulation. When several of these problems exist together, the conditions are perfect for a coordinated pump and dump or a rug pull. A healthy market has deep liquidity, distributed holders, and organic volume.",
    analogy: "It is like a small town economy where one family owns the bank, the grocery store, and the gas station. They can raise prices or close up any time they want and everyone else is stuck.",
    fact: "The term pump and dump originated in traditional stock markets in the 1920s. The same manipulation tactics moved to crypto markets decades later.",
  },
  risk: {
    icon: "⚡", title: "Active Threat Level",
    sub: "Real-time risk flags that could affect your funds.",
    eli5: "Some dangers are not theoretical. They exist right now in the contract code and can be triggered at any moment. A hidden owner can still control the contract even after apparent renouncement. Mintable tokens can be inflated into worthlessness overnight. Blacklist functions can freeze your wallet. Pausable trading can lock you in during a price crash. These active threats are the difference between a suspicious token and a dangerous one. We flag every function that gives the developer the power to move against investors without warning.",
    analogy: "It is like buying a house and later discovering the previous owner kept a hidden spare key. Even if they seem friendly, the vulnerability is always there.",
    fact: "The Squid Game token rug pull in 2021 used a blacklist function to prevent all selling while allowing one wallet to drain $3.4 million in minutes.",
  },
};

/* ── UTILS ── */
const addrHash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i); return Math.abs(h >>> 0); };
const seededRng = (seed) => { let s = (seed >>> 0) || 1; return (mn, mx) => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return Math.floor(mn + (s / 0xffffffff) * (mx - mn + 1)); }; };
const shortAddr = (a) => a && a.length > 13 ? a.slice(0, 6) + "..." + a.slice(-4) : (a || "");
const fmtUSD = (n) => { if (!n) return "$0"; if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M"; if (n >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K"; return "$" + Number(n).toFixed(0); };
const fmtNum = (n) => { if (!n) return "0"; if (n >= 1e6) return (n / 1e6).toFixed(1) + "M"; if (n >= 1e3) return (n / 1e3).toFixed(1) + "K"; return String(n); };
const getSL  = (s) => SCORE_LEVELS.find((l) => s >= l.min) || SCORE_LEVELS[4];
const getIQL = (iq) => [...IQ_LEVELS].reverse().find((l) => iq >= l.min) || IQ_LEVELS[0];

/* ── SECTION SCORES (out of 10) ── */
function computeSectionScores(sec, mkt) {
  const s  = sec  || {};
  const m  = mkt  || {};
  const fl = s.flags || {};
  const lp = s.lp    || {};
  const social = m.social || {};

  const contract = Math.max(0, 10
    - (s.buyTax  > 10 ? 3 : s.buyTax  > 5 ? 1 : 0)
    - (s.sellTax > 15 ? 4 : s.sellTax > 10 ? 2 : 0)
    - (!fl.isOpenSource ? 2 : 0)
    - (fl.isProxy ? 1 : 0)
  );

  const honeypot = s.isHoneypot ? 0 : 10;

  const liquidity = Math.max(0, 10
    - (lp.lockedPct < 5 ? 6 : lp.lockedPct < 50 ? 3 : 0)
    - (m.liquidity < 50000 ? 3 : m.liquidity < 200000 ? 1 : 0)
  );

  const holders = Math.max(0, 10
    - (s.top10HolderPct > 70 ? 7 : s.top10HolderPct > 50 ? 4 : s.top10HolderPct > 30 ? 2 : 0)
    - (s.holderCount < 100 ? 3 : s.holderCount < 500 ? 1 : 0)
  );

  const deployer = Math.max(0, 10
    - (s.rugHistory > 0 ? 6 : 0)
    - (s.deployerAge < 7 ? 5 : s.deployerAge < 30 ? 3 : 0)
    - (s.prevTokens > 5 ? 2 : 0)
  );

  const ownership = Math.max(0, 10
    - (!s.isRenounced ? 3 : 0)
    - (fl.hasHiddenOwner ? 4 : 0)
    - (fl.canTakeOwnership ? 3 : 0)
    - (fl.isMintable ? 2 : 0)
    - (fl.canSelfDestruct ? 2 : 0)
  );

  const socialScore = Math.max(0, 10
    - (!social.website ? 3 : 0)
    - (!social.twitter ? 3 : 0)
    - (!social.telegram ? 2 : 0)
    - (s.auditStatus === false ? 2 : 0)
  );

  const volume = Math.max(0, 10
    - (m.volume && m.volume.h24 < 10000 ? 4 : m.volume && m.volume.h24 < 50000 ? 2 : 0)
    - (m.priceChange && m.priceChange.h24 < -50 ? 3 : 0)
  );

  const risk = Math.max(0, 10
    - (s.isHoneypot ? 7 : 0)
    - (fl.isBlacklisted ? 3 : 0)
    - (fl.hasTradingCooldown ? 1 : 0)
    - (fl.hasExternalCall ? 1 : 0)
    - (fl.isFakeToken ? 5 : 0)
    - (fl.isAirdropScam ? 4 : 0)
  );

  const market = Math.round((liquidity + holders + volume) / 3);

  return { contract, honeypot, liquidity, holders, deployer, ownership, social: socialScore, volume, risk, market };
}

/* ── RULE-BASED TYE COMMENTARY ── */
function buildTyeComments(sd) {
  const sec = sd.security || {};
  const mkt = sd.market   || {};
  const fl  = sec.flags   || {};
  const lp  = sec.lp      || {};
  const social = mkt.social || {};

  const buyTax  = sec.buyTax  || 0;
  const sellTax = sec.sellTax || 0;
  const top10   = sec.top10HolderPct || 0;
  const liqUSD  = mkt.liquidity || 0;
  const lockedPct = lp.lockedPct || 0;

  return {
    contract: fl.isOpenSource
      ? buyTax <= 5 && sellTax <= 5
        ? "The contract is open source and taxes are clean. Think of this as a restaurant that posts its full recipe publicly — you know exactly what you are getting. No hidden ingredients."
        : "Contract is verified but taxes could be higher than ideal. Adjustable tax functions may exist. Worth watching closely before committing large funds."
      : "This contract is unverified, meaning nobody outside the team can read the code. That is like a chef who refuses to show you the kitchen. Could be fine, could be hiding something serious.",

    honeypot: sec.isHoneypot
      ? "This is a confirmed honeypot. If you buy this token, you will not be able to sell it. Your money will be permanently trapped. Do not interact with this contract under any circumstances."
      : sellTax > 15
        ? "Not a honeypot but the sell tax is high enough to seriously eat into your profits. Even partial sell restrictions like this can significantly reduce your ability to exit a position when needed."
        : "Buy and sell functions are working normally. No honeypot behavior detected. You can enter and exit freely based on current data.",

    liquidity: lockedPct > 80
      ? "Liquidity is well locked. Think of this as the developer welding the pool drain shut and handing the key to a neutral third party. Your funds have meaningful protection from a sudden rug."
      : lockedPct > 30
        ? "Some liquidity is locked but not all of it. Low liquidity means your trade will cause large price swings. Even a small sell can crash the price, and you will get far less than you expected."
        : liqUSD < 50000
          ? "Liquidity is unlocked and the pool is dangerously small. A single medium-sized trade could move the price by 20% or more. This is high-risk territory."
          : "Liquidity exists but is not locked. The developer can drain the pool at any time. Proceed with extreme caution.",

    holders: top10 > 60
      ? "Over " + top10 + "% of the supply sits in just 10 wallets. That means a handful of people have the power to crash this entire market with one sell. You are essentially at their mercy."
      : top10 > 30
        ? "Holder distribution is somewhat concentrated. There are some whale wallets that could influence the price significantly. Not an immediate red flag but worth monitoring."
        : "Holder distribution looks reasonable. No single group controls enough supply to single-handedly manipulate the price. This is one of the healthier signs we look for.",

    deployer: sec.rugHistory > 0
      ? "This deployer wallet has a history of rug pulls. This is the single biggest red flag in this scan. A serial rugger launching a new token is like a con artist opening a new shop. Walk away."
      : sec.deployerAge < 30
        ? "The deployer wallet is brand new, created specifically for this launch. Fresh wallets used to launch tokens are a classic pattern in exit scams. No track record means no accountability."
        : "The deployer wallet has some history, which is a better sign than a fresh wallet. We found no confirmed rug pulls in their history. Still do your own research on the team.",

    ownership: sec.isRenounced
      ? fl.isMintable
        ? "Ownership is renounced but the token is still mintable. Renouncement does not always remove all admin powers. New tokens can still be created and your holdings diluted."
        : "Ownership has been fully renounced. The developer can no longer change taxes, pause trading, or blacklist wallets. The rules are locked in permanently. This is a strong trust signal."
      : fl.hasHiddenOwner
        ? "There is a hidden owner on this contract. This means someone maintains admin control while appearing to have given it up. This is a deliberate deception and a major red flag."
        : "Ownership has not been renounced. The token owner retains administrative privileges including the ability to modify taxes, blacklist wallets, or pause trading. This is a significant risk.",

    social: social.website && social.twitter
      ? "The project has verifiable social presence. A real website and active Twitter are the minimum baseline for any legitimate project. This does not guarantee safety but it does mean there is accountability."
      : !social.website && !social.twitter
        ? "This token has no verified website or social media presence. That is the equivalent of a business with no address, no phone number, and no way to hold them accountable. Extremely concerning."
        : "Partial social presence. Some channels exist but the team is not fully visible. Legitimate projects usually invest heavily in community building before or at launch.",

    volume: mkt.volume && mkt.volume.h24 > 500000
      ? "Strong 24-hour volume suggests genuine trading activity. When volume is organic, it usually follows irregular patterns throughout the day. This does not confirm safety but it is a positive market signal."
      : mkt.volume && mkt.volume.h24 < 10000
        ? "Volume is critically low. This means finding a buyer for your tokens could be extremely difficult. Low volume tokens can also be easily manipulated by anyone with modest funds."
        : "Volume is moderate. It is not enough to confirm organic activity but not so low as to be an immediate concern. Watch for sudden volume spikes that might signal a pump and dump in progress.",

    market: sec.isHoneypot || (lp.lockedPct < 5 && top10 > 50)
      ? "Multiple critical risk factors are stacking up here. Low liquidity, concentrated holdings, and suspicious patterns are all present simultaneously. The on-chain data strongly suggests this market is being manipulated."
      : top10 > 40 || lp.lockedPct < 30
        ? "Market conditions show some concerning patterns. Combined whale concentration and limited liquidity lock means the conditions for a coordinated dump exist, even if it has not happened yet."
        : "Overall market structure looks relatively healthy for a token of this size. No single manipulation risk is at a critical level, though the combination of factors should still be monitored.",

    risk: fl.hasHiddenOwner || fl.canTakeOwnership || fl.isFakeToken
      ? "Active high-level threats exist in this contract right now. A rug pull or fund seizure could happen at any moment without warning. These are not hypothetical risks — they are live capabilities built into the code."
      : fl.isMintable || fl.isBlacklisted
        ? "Some moderate risks are present. The developer retains capabilities that could be used against investors. These functions may never be triggered, but their existence means you are trusting the team completely."
        : "No critical active threats detected in the contract code. The most dangerous admin functions are either absent or have been removed. This is one of the cleaner risk profiles we have seen.",
  };
}

/* ── FINAL VERDICT ── */
function buildVerdict(sd, scores) {
  const score = sd.score;
  const sec   = sd.security || {};
  if (sec.isHoneypot) {
    return { emoji: "🚨", title: "Confirmed Honeypot — Do Not Buy", text: "This is a confirmed honeypot trap. If you purchase this token, you will not be able to sell it. Your money will be permanently locked with no way to recover it. No further analysis is needed — walk away immediately and do not interact with this contract under any circumstances." };
  }
  if (score >= 80) {
    return { emoji: "✅", title: "Looks Clean — Proceed With Caution", text: "This token passed most of our safety checks and shows relatively healthy fundamentals. Liquidity appears adequate, ownership signals are reasonable, and no critical threats were detected. That said, no scan can guarantee a token is safe. Only invest what you can afford to lose entirely, and continue monitoring for any changes in the contract or team behavior." };
  }
  if (score >= 60) {
    return { emoji: "⚠️", title: "Yellow Flags — Tread Carefully", text: "This token scored " + score + " out of 100. It is not immediately dangerous but has a few concerning signals worth noting. " + (sec.lp && sec.lp.lockedPct < 30 ? "Liquidity is not well secured. " : "") + (sec.top10HolderPct > 40 ? "Whale concentration is elevated. " : "") + "Think of it like a restaurant with 3.5 stars. Not terrible, but maybe not your first choice either. If you decide to proceed, use a small position size and set a clear exit plan before buying." };
  }
  if (score >= 40) {
    return { emoji: "🔴", title: "High Risk — Strong Caution Advised", text: "Multiple red flags were detected in this scan. Score: " + score + "/100. The combination of risks present here — " + [sec.isHoneypot ? "honeypot" : null, sec.lp && sec.lp.lockedPct < 5 ? "no liquidity lock" : null, !sec.isRenounced ? "active ownership" : null, (sec.flags && sec.flags.hasHiddenOwner) ? "hidden owner" : null].filter(Boolean).join(", ") + " — means this token has the structural ingredients for a major loss event. Avoid unless you fully understand and accept the risks." };
  }
  return { emoji: "💀", title: "Extreme Risk — Likely Scam", text: "This token failed nearly every safety check with a score of " + score + "/100. The on-chain data strongly indicates this is either a scam, a rug pull setup, or a manipulated token designed to extract money from buyers. Do not invest in this token. Share this scan result with others in your community to protect them from the same risk." };
}

/* ── AI TYE VERDICT ── */
async function fetchAIVerdict(scanData) {
  try {
    const res = await fetch("/api/tye", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanData }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.verdict || null;
  } catch (e) {
    console.warn("AI verdict unavailable:", e.message);
    return null;
  }
}

/* ── MOCK WALLETS ── */
function mockWallets(address, realHolders) {
  if (realHolders && realHolders.length > 0) {
    return realHolders.map((h, i) => ({ id: shortAddr(h.address || ("0x" + addrHash(address + i).toString(16).slice(0, 8))), pct: h.percent, risk: h.percent > 14 ? "high" : h.percent > 7 ? "medium" : "low", label: h.tag || (i === 0 ? "Top Holder" : i < 3 ? "Whale" : i < 6 ? "Early Buyer" : "Holder"), txCount: Math.floor(Math.random() * 80) + 2 }));
  }
  const r = seededRng(addrHash(address));
  return Array.from({ length: r(9, 14) }, (_, i) => { const wr = seededRng(addrHash(address + "w" + i)); const pct = wr(1, i === 0 ? 24 : i < 3 ? 13 : 7); return { id: "0x" + addrHash(address + i).toString(16).slice(0, 6) + "..." + (addrHash(address + i + "x") % 9999).toString(16).padStart(4, "0"), pct, risk: pct > 14 ? "high" : pct > 7 ? "medium" : "low", label: i === 0 ? "Top Holder" : i < 3 ? "Whale" : i < 6 ? "Early Buyer" : "Holder", txCount: wr(1, 90) }; });
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
    const acc2 = accent || "#f59e0b";
    const nodes = [{ id: "__t__", label: tokenSym, isToken: true, size: 20 }, ...wallets.map((w) => ({ id: w.id, label: w.pct + "%", isToken: false, size: 5 + w.pct * 0.5, risk: w.risk, wallet: w }))];
    const links = wallets.map((w) => ({ source: w.id, target: "__t__", value: w.pct / 10 }));
    const sim = d3.forceSimulation(nodes).force("link", d3.forceLink(links).id((d) => d.id).distance(90)).force("charge", d3.forceManyBody().strength(-110)).force("center", d3.forceCenter(W / 2, H / 2)).force("collide", d3.forceCollide().radius((d) => d.size + 5));
    nodes[0].fx = W / 2; nodes[0].fy = H / 2;
    const eg = svg.append("g"), ng = svg.append("g");
    const ls = eg.selectAll("line").data(links).join("line").attr("stroke-width", (d) => Math.max(0.5, d.value)).attr("stroke", (d) => { const src = d.source.id || d.source; const n = nodes.find((nd) => nd.id === src); if (!n) return "rgba(0,0,0,0.1)"; if (n.risk === "high") return "rgba(220,38,38,0.3)"; if (n.risk === "medium") return "rgba(217,119,6,0.25)"; return "rgba(22,163,74,0.2)"; });
    const ns = ng.selectAll("g").data(nodes).join("g").style("cursor", "pointer").on("click", (evt, d) => { if (d.wallet) { const rc = svgRef.current.getBoundingClientRect(); setTip((prev) => (prev && prev.id === d.wallet.id) ? null : Object.assign({}, d.wallet, { x: Math.min(evt.clientX - rc.left, 300), y: Math.max(0, evt.clientY - rc.top - 30) })); } else setTip(null); });
    ns.append("circle").attr("r", (d) => d.size).attr("fill", (d) => d.isToken ? acc2 : d.risk === "high" ? "#ef4444" : d.risk === "medium" ? "#f59e0b" : "#22c55e").attr("fill-opacity", (d) => d.isToken ? 0.95 : 0.6).attr("stroke", (d) => d.isToken ? "rgba(0,0,0,0.2)" : "none").attr("stroke-width", 2);
    ns.append("text").attr("text-anchor", "middle").attr("dy", "0.35em").attr("font-size", (d) => d.isToken ? "9px" : "7px").attr("font-weight", "bold").attr("fill", (d) => d.isToken ? "#fff" : "#1a1a1a").attr("pointer-events", "none").text((d) => d.label);
    sim.on("tick", () => { ls.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y).attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y); ns.attr("transform", (d) => "translate(" + Math.max(d.size, Math.min(W - d.size, d.x)) + "," + Math.max(d.size, Math.min(H - d.size, d.y)) + ")"); });
    return () => sim.stop();
  }, [wallets, accent, token]);
  return (
    <div style={{ position: "relative", background: "rgba(0,0,0,0.04)", borderRadius: 10, overflow: "hidden", border: "1px solid " + TA.cardBorder }}>
      <svg ref={svgRef} width="100%" viewBox="0 0 560 260" style={{ display: "block" }} />
      {tip && (<div style={{ position: "absolute", left: Math.min(tip.x + 8, 200), top: Math.max(0, tip.y), background: "#fff", border: "1px solid " + TA.cardBorder, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: TA.text, zIndex: 20, minWidth: 145, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
        <div style={{ fontFamily: "monospace", fontSize: 9, marginBottom: 6, color: TA.muted }}>{tip.id}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div><div style={{ color: TA.muted, fontSize: 8, marginBottom: 1 }}>HELD</div><div style={{ fontWeight: 700, fontSize: 11, color: TA.text }}>{tip.pct}%</div></div>
          <div><div style={{ color: TA.muted, fontSize: 8, marginBottom: 1 }}>RISK</div><div style={{ fontWeight: 700, fontSize: 11, color: tip.risk === "high" ? "#dc2626" : tip.risk === "medium" ? "#d97706" : "#16a34a" }}>{tip.risk.toUpperCase()}</div></div>
        </div>
        <div onClick={() => setTip(null)} style={{ marginTop: 8, fontSize: 9, color: TA.muted, textAlign: "right", cursor: "pointer" }}>close ×</div>
      </div>)}
      <div style={{ position: "absolute", bottom: 5, right: 8, display: "flex", gap: 8, fontSize: 9, color: TA.muted }}>
        <span>🔴 &gt;14%</span><span>🟡 7-14%</span><span>🟢 &lt;7%</span>
      </div>
    </div>
  );
}

/* ── SCANNING OVERLAY ── */
function ScanningScreen({ address, stage, iqEarned, mode }) {
  const isT = mode === "training";
  const acc  = isT ? "#f59e0b" : SM.acc;
  const bg   = isT ? "#f0ebe0" : "#030812";
  const pct  = (stage / SCAN_STAGES.length) * 100;
  const lvl  = getIQL(iqEarned);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: "20px 16px", overflowY: "auto" }}>
      <style>{".sIn{animation:sIn .25s ease both} @keyframes sIn{from{opacity:0;transform:translateX(-5px)}to{opacity:1;transform:none}} @keyframes rSpin{to{transform:rotate(360deg)}} @keyframes rPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.6}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}"}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 380 }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #1a3a6b, #050c1a)", border: "2px solid rgba(77,184,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(0,140,255,0.4)" }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#4db8ff" }}>D</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 4, color: isT ? TA.text : "#fff" }}>DEMYST</div>
        <div style={{ fontSize: 9, letterSpacing: 4, color: acc, opacity: 0.7, textTransform: "uppercase", marginTop: -8 }}>{isT ? "Training Arc" : "Sage Mode"}</div>
        <div style={{ position: "relative", width: 130, height: 130 }}>
          {[1, 0.7, 0.44, 0.22].map((sv, i) => (<div key={i} style={{ position: "absolute", top: "50%", left: "50%", width: sv * 122, height: sv * 122, transform: "translate(-50%,-50%)", borderRadius: "50%", border: "1px solid " + acc + ["25", "18", "12", "08"][i] }} />))}
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 61, height: 1, background: "linear-gradient(90deg," + acc + "99,transparent)", transformOrigin: "0 50%", animation: "rSpin 2s linear infinite" }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 8, height: 8, borderRadius: "50%", background: acc, transform: "translate(-50%,-50%)", boxShadow: "0 0 10px " + acc }} />
          <div style={{ position: "absolute", top: "50%", left: "50%", width: 65, height: 65, borderRadius: "50%", border: "2px solid " + acc, transform: "translate(-50%,-50%)", animation: "rPulse 2s ease-out infinite" }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: isT ? TA.muted : "#64748b", background: isT ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)", padding: "5px 12px", borderRadius: 4, border: "1px solid " + (isT ? TA.cardBorder : "rgba(255,255,255,0.06)"), maxWidth: "95%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</div>
        <div style={{ width: "90%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: isT ? TA.muted : "#475569", marginBottom: 4, letterSpacing: 2 }}><span>SCANNING</span><span>{Math.round(pct)}%</span></div>
          <div style={{ height: 3, background: isT ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: pct + "%", background: "linear-gradient(90deg," + acc + "66," + acc + ")", transition: "width .4s ease" }} />
          </div>
        </div>
        {stage < SCAN_STAGES.length && <div style={{ fontSize: 11, color: isT ? TA.sub : "#94a3b8", display: "flex", alignItems: "center", gap: 6 }}><span>{SCAN_STAGES[stage].icon}</span><span>{SCAN_STAGES[stage].label}</span></div>}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: isT ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 16px", border: "1px solid " + (isT ? TA.cardBorder : "rgba(255,255,255,0.06)"), width: "90%", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 32, fontWeight: 900, color: TA.iq, lineHeight: 1 }}>+{iqEarned}</div><div style={{ fontSize: 9, color: acc, letterSpacing: 2, marginTop: 2 }}>CRYPTO IQ</div></div>
          <div style={{ width: 1, height: 36, background: isT ? TA.cardBorder : "rgba(255,255,255,0.06)" }} />
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, marginBottom: 2 }}>{lvl.icon}</div><div style={{ fontSize: 10, fontWeight: 700, color: lvl.color }}>{lvl.label}</div></div>
        </div>
        <div style={{ width: "90%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 10px" }}>
          {SCAN_STAGES.map((s, i) => { const done = i < stage, active = i === stage; return (<div key={s.id} className={done ? "sIn" : ""} style={{ display: "flex", alignItems: "center", gap: 5, opacity: done || active ? 1 : 0.2 }}><div style={{ width: 15, height: 15, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, background: done ? acc : "transparent", border: (done ? "none" : active ? "2px" : "1px") + " solid " + (done ? "transparent" : active ? acc : (isT ? TA.cardBorder : "rgba(255,255,255,0.10)")), color: done ? "#fff" : active ? acc : TA.muted }}>{done ? "✓" : active ? "◌" : i + 1}</div><div style={{ fontSize: 9, color: done ? TA.text : active ? acc : TA.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>{done && <div style={{ marginLeft: "auto", fontSize: 8, color: acc, fontWeight: 700, flexShrink: 0 }}>+{s.iq}</div>}</div>); })}
        </div>
      </div>
    </div>
  );
}

/* ── MODE SELECT ── */
function ModeSelect({ onSelect, apiBase, setApiBase }) {
  const [showSetup, setShowSetup] = useState(false);
  const [urlInput, setUrlInput]   = useState(apiBase);
  const hasBackend = apiBase && apiBase !== "http://localhost:3001" && apiBase.startsWith("http");
  return (
    <div style={{ minHeight: "100vh", background: "#0e0904", display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "system-ui, sans-serif", padding: "24px 16px 48px", overflowY: "auto" }}>
      <style>{".ms-tap:active{transform:scale(0.98)}"}</style>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #1a3a6b, #050c1a)", border: "3px solid rgba(77,184,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 0 30px rgba(0,140,255,0.35)" }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: "#4db8ff" }}>D</span>
        </div>
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#6b4f25", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Welcome to</div>
        <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1.05 }}>
          <span style={{ background: "linear-gradient(135deg,#fffbf0,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>DE</span>
          <span style={{ background: "linear-gradient(135deg,#f59e0b,#fb923c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>MYST</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: 3, color: "#5a3e1c", marginTop: 5, textTransform: "uppercase" }}>Blockchain Intelligence Platform</div>
      </div>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="ms-tap" onClick={() => setShowSetup((s) => !s)} style={{ background: hasBackend ? "rgba(34,197,94,0.07)" : "rgba(245,158,11,0.05)", border: "1px solid " + (hasBackend ? "rgba(34,197,94,0.22)" : "rgba(245,158,11,0.18)"), borderRadius: 12, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{hasBackend ? "🟢" : "🟡"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: hasBackend ? "#22c55e" : "#f59e0b", marginBottom: 2 }}>{hasBackend ? "Backend connected — live data active" : "Backend not set — tap to configure"}</div>
            <div style={{ fontSize: 10, color: hasBackend ? "rgba(34,197,94,0.6)" : "#5a3e1c", wordBreak: "break-all" }}>{hasBackend ? apiBase : "Set your Vercel or Replit URL for live data"}</div>
          </div>
          <span style={{ fontSize: 14, color: hasBackend ? "rgba(34,197,94,0.5)" : "#6b4f25" }}>{showSetup ? "▲" : "▼"}</span>
        </div>
        {showSetup && (
          <div style={{ background: "#1a1208", border: "1px solid rgba(245,158,11,0.20)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fef3c7", borderBottom: "1px solid rgba(245,158,11,0.13)", paddingBottom: 10 }}>Setup Live Data</div>
            <div style={{ fontSize: 11, color: "#c4943a", lineHeight: 1.7 }}>If you deployed the Vercel Functions version, live data works automatically — no backend URL needed. Only set this if you have a separate backend running on Replit or another service.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#c4943a", fontWeight: 600 }}>Optional backend URL:</div>
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://your-backend.replit.dev" inputMode="url" autoCorrect="off" autoCapitalize="off" spellCheck={false} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.13)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#fef3c7", outline: "none", fontFamily: "monospace", WebkitAppearance: "none" }} />
              <button onClick={() => { setApiBase(urlInput.trim().replace(/\/$/, "")); setShowSetup(false); }} style={{ padding: 11, borderRadius: 8, border: "none", background: "linear-gradient(135deg,#92400e,#f59e0b)", color: "#fff8e7", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Save URL</button>
            </div>
          </div>
        )}
        <div className="ms-tap" onClick={() => onSelect("training")} style={{ borderRadius: 16, overflow: "hidden", cursor: "pointer", background: "linear-gradient(150deg,#2a1f0e,#1e1508,#19130a)", border: "1px solid rgba(245,158,11,0.18)", boxShadow: "0 6px 24px rgba(0,0,0,0.55)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#d97706,#fbbf24,#d97706,transparent)" }} />
          <div style={{ padding: "20px 18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg,#7c3000,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0, boxShadow: "0 6px 20px rgba(217,119,6,0.4)" }}>🎓</div>
              <div><div style={{ fontSize: 9, letterSpacing: 4, color: "#d97706", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Mode 01</div><div style={{ fontSize: 20, fontWeight: 900, color: "#fef3c7" }}>Training Arc</div><div style={{ fontSize: 11, color: "#7c5020" }}>Learn while you scan</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
              {[["🧠", "ELI5 explanations"], ["🎯", "Real-life analogies"], ["🏆", "Crypto IQ system"], ["💡", "Fun facts per topic"]].map(([ic, t]) => (<div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,0.06)", borderRadius: 7, padding: "6px 9px" }}><span style={{ fontSize: 13 }}>{ic}</span><span style={{ fontSize: 10, fontWeight: 600, color: "#e8c97a" }}>{t}</span></div>))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 11, borderRadius: 9, background: "linear-gradient(135deg,#92400e,#d97706,#f59e0b)", color: "#fff8e7", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", boxShadow: "0 5px 18px rgba(217,119,6,0.4)" }}>Start Training →</div>
          </div>
        </div>
        <div className="ms-tap" onClick={() => onSelect("sage")} style={{ borderRadius: 16, overflow: "hidden", cursor: "pointer", background: "linear-gradient(150deg,#0d0d08,#080806,#050503)", border: "1px solid rgba(212,175,55,0.18)", boxShadow: "0 6px 24px rgba(0,0,0,0.75)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#9d7c0a,#d4af37,#9d7c0a,transparent)" }} />
          <div style={{ padding: "20px 18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 13, background: "linear-gradient(135deg,#151200,#2e2800)", border: "1px solid rgba(212,175,55,0.45)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>⚡</div>
              <div><div style={{ fontSize: 9, letterSpacing: 4, color: "#b8960c", fontWeight: 700, textTransform: "uppercase", marginBottom: 2 }}>Mode 02</div><div style={{ fontSize: 20, fontWeight: 900, background: "linear-gradient(135deg,#c9a227,#f0d060,#c9a227)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Sage Mode</div><div style={{ fontSize: 11, color: "#4a3e10" }}>Raw on-chain intelligence</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
              {[["🔬", "Terminal data view"], ["⚠️", "Full GoPlus audit"], ["📡", "DexScreener live"], ["🕸️", "Force-graph map"]].map(([ic, t]) => (<div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(212,175,55,0.05)", borderRadius: 7, padding: "6px 9px" }}><span style={{ fontSize: 13 }}>{ic}</span><span style={{ fontSize: 10, fontWeight: 600, color: "#c9a227" }}>{t}</span></div>))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 11, borderRadius: 9, background: "linear-gradient(135deg,#151200,#252000)", border: "1px solid rgba(212,175,55,0.45)", color: "#d4af37", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>Enter Sage Mode →</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── EDU CARD (core Training Arc component) ── */
function EduCard({ sectionKey, score10, tyeComment, iqEarned, onIQEarned, isLive }) {
  const [showFact, setShowFact] = useState(false);
  const [factEarned, setFactEarned] = useState(false);
  const edu = EDU[sectionKey];
  if (!edu) return null;

  const rating = score10 >= 8 ? { label: "SAFE",      color: TA.safe,    borderColor: TA.safeBorder,    bg: TA.safeBg    }
               : score10 >= 5 ? { label: "CAUTION",   color: TA.caution, borderColor: TA.cautionBorder, bg: TA.cautionBg }
               : score10 >= 3 ? { label: "HIGH-RISK", color: TA.danger,  borderColor: TA.dangerBorder,  bg: TA.dangerBg  }
               :                { label: "CRITICAL",  color: "#991b1b",  borderColor: "#fca5a5",         bg: "#fff0f0"    };

  function handleShowFact() {
    setShowFact(s => !s);
    if (!showFact && !factEarned) {
      setFactEarned(true);
      onIQEarned(5);
    }
  }

  return (
    <div style={{ background: TA.card, borderRadius: 14, border: "1.5px solid " + rating.borderColor, overflow: "hidden", marginBottom: 14 }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", background: rating.bg }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{edu.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: TA.text, lineHeight: 1.2 }}>{edu.title}</div>
              <div style={{ fontSize: 11, color: TA.muted, marginTop: 3 }}>{edu.sub}</div>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: rating.color, lineHeight: 1 }}>{score10}/10</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: rating.color, letterSpacing: 1 }}>{rating.label}</div>
          </div>
        </div>
        {isLive && <div style={{ marginTop: 6, display: "inline-block", fontSize: 8, fontWeight: 700, background: "rgba(34,197,94,0.15)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 3, padding: "1px 6px", letterSpacing: 1 }}>LIVE DATA</div>}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* ELI5 */}
        <div style={{ background: TA.eli5Bg, border: "1px solid " + TA.eli5Border, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.75 }}>
            <span style={{ fontWeight: 700 }}>💡 ELI5: </span>{edu.eli5}
          </div>
        </div>

        {/* Real Life Analogy */}
        <div style={{ background: TA.analogyBg, border: "1px solid " + TA.analogyBorder, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.75 }}>
            <span style={{ fontWeight: 700 }}>🎯 Real Life Analogy: </span>{edu.analogy}
          </div>
        </div>

        {/* Tye Says */}
        <div style={{ background: TA.tyeBg, border: "1px solid " + TA.tyeBorder, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.75 }}>
            <span style={{ fontWeight: 700 }}>🧠 Tye says: </span>{tyeComment || "Analyzing..."}
          </div>
        </div>

        {/* Fun Fact toggle */}
        <div>
          <button onClick={handleShowFact} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: TA.iq, fontWeight: 700, padding: "4px 0", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            📖 {showFact ? "Hide Fun Fact" : "Show Fun Fact"}
          </button>
          {showFact && (
            <div style={{ background: TA.factBg, border: "1px solid " + TA.factBorder, borderRadius: 10, padding: "12px 14px", marginTop: 6 }}>
              <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.75 }}>
                <span style={{ fontWeight: 700 }}>📚 Did you know? </span>{edu.fact}
              </div>
              {factEarned && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: TA.iq }}>+5 Crypto IQ 🧠</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── TRAINING ARC VIEW ── */
function TrainingArcView({ sd, wallets, totalIQ, onIQEarned, aiVerdict, aiLoading }) {
  const sec    = sd.security || {};
  const mkt    = sd.market   || {};
  const lv     = sd.sources  || {};
  const scores = computeSectionScores(sec, mkt);
  const tye    = buildTyeComments(sd);
  const verdict = buildVerdict(sd, scores);
  const iqLvl  = getIQL(totalIQ);

  const SECTION_GRID = [
    { key: "contract",  scoreKey: "contract",  tyeKey: "contract"  },
    { key: "honeypot",  scoreKey: "honeypot",  tyeKey: "honeypot"  },
    { key: "liquidity", scoreKey: "liquidity", tyeKey: "liquidity" },
    { key: "holders",   scoreKey: "holders",   tyeKey: "holders"   },
    { key: "deployer",  scoreKey: "deployer",  tyeKey: "deployer"  },
    { key: "ownership", scoreKey: "ownership", tyeKey: "ownership" },
    { key: "social",    scoreKey: "social",    tyeKey: "social"    },
    { key: "volume",    scoreKey: "volume",    tyeKey: "volume"    },
    { key: "market",    scoreKey: "market",    tyeKey: "market"    },
    { key: "risk",      scoreKey: "risk",      tyeKey: "risk"      },
  ];

  const scoreEntries = [
    { icon: "📜", score: scores.contract  },
    { icon: "🍯", score: scores.honeypot  },
    { icon: "💧", score: scores.liquidity },
    { icon: "👥", score: scores.holders   },
    { icon: "👑", score: scores.ownership },
    { icon: "🕵️", score: scores.deployer  },
    { icon: "🌐", score: scores.social    },
    { icon: "📈", score: scores.volume    },
    { icon: "📊", score: scores.market    },
    { icon: "⚡", score: scores.risk      },
  ];

  return (
    <div style={{ color: TA.text, fontFamily: "system-ui, sans-serif" }}>

      {/* IQ + Streak header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: TA.sub, fontWeight: 600 }}>
          🧠 Crypto IQ: <span style={{ color: TA.iq, fontWeight: 800, fontSize: 16 }}>{totalIQ}</span>
        </div>
        <div style={{ fontSize: 12, color: TA.sub, fontWeight: 600 }}>
          {iqLvl.icon} {iqLvl.label}
        </div>
      </div>

      {/* Token header */}
      <div style={{ background: TA.card, borderRadius: 12, border: "1px solid " + TA.cardBorder, padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: TA.text }}>{sd.token.name}</span>
              <span style={{ background: TA.cautionBg, border: "1px solid " + TA.cautionBorder, borderRadius: 4, padding: "1px 7px", fontSize: 10, color: TA.caution, fontWeight: 700 }}>{sd.token.symbol}</span>
              <span style={{ background: "rgba(0,0,0,0.06)", borderRadius: 4, padding: "1px 7px", fontSize: 10, color: TA.muted }}>{sd.chain}</span>
            </div>
            {sd.token.priceUsd && <div style={{ fontSize: 13, fontWeight: 700, color: TA.safe, marginBottom: 3 }}>${parseFloat(sd.token.priceUsd).toFixed(6)} {lv.dexscreener && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(22,163,74,0.12)", color: TA.safe, border: "1px solid rgba(22,163,74,0.2)", borderRadius: 3, padding: "1px 5px", marginLeft: 4 }}>LIVE</span>}</div>}
            <div style={{ fontSize: 9, color: TA.muted, fontFamily: "monospace", wordBreak: "break-all" }}>{sd.address}</div>
          </div>
          {/* Overall score circle */}
          <div style={{ width: 64, height: 64, borderRadius: "50%", border: "3px solid " + getSL(sd.score).color, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: getSL(sd.score).bg, flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: getSL(sd.score).color, lineHeight: 1 }}>{sd.score}</div>
            <div style={{ fontSize: 7, fontWeight: 700, color: getSL(sd.score).color, letterSpacing: 0.5 }}>/ 100</div>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[["Vol 24h", fmtUSD(mkt.volume && mkt.volume.h24), lv.dexscreener], ["Liquidity", fmtUSD(mkt.liquidity), lv.dexscreener], ["Holders", fmtNum(sec.holderCount), lv.goplus], ["24h Δ", (((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? "+" : "") + ((mkt.priceChange && mkt.priceChange.h24) || 0).toFixed(1) + "%", lv.dexscreener]].map(([l, v, live]) => (
            <div key={l} style={{ background: "rgba(0,0,0,0.04)", borderRadius: 6, padding: "4px 9px", border: "1px solid " + TA.cardBorder }}>
              <div style={{ fontSize: 8, color: TA.muted, letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: TA.sub, display: "flex", alignItems: "center", gap: 3 }}>{v}{live && <span style={{ fontSize: 7, background: "rgba(22,163,74,0.12)", color: TA.safe, borderRadius: 2, padding: "0 3px" }}>L</span>}</div>
            </div>
          ))}
        </div>
        {sec.isHoneypot && <div style={{ marginTop: 10, background: TA.dangerBg, border: "1px solid " + TA.dangerBorder, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: TA.danger, fontWeight: 700 }}>🍯 HONEYPOT DETECTED — Do not buy this token.</div>}
        {sd.reasons && sd.reasons.length > 0 && <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 5 }}>{sd.reasons.map((r) => <div key={r} style={{ fontSize: 9, color: TA.danger, background: TA.dangerBg, border: "1px solid " + TA.dangerBorder, borderRadius: 4, padding: "2px 7px" }}>{r}</div>)}</div>}
        {mkt.social && (mkt.social.website || mkt.social.twitter || mkt.social.telegram) && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {mkt.social.website  && <a href={mkt.social.website}  target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>🌐 Website</a>}
            {mkt.social.twitter  && <a href={mkt.social.twitter}  target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>🐦 Twitter</a>}
            {mkt.social.telegram && <a href={mkt.social.telegram} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>✈️ Telegram</a>}
            {mkt.pairUrl         && <a href={mkt.pairUrl}         target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>📈 Chart</a>}
          </div>
        )}
      </div>

      {/* Summary insight cards */}
      <div style={{ fontSize: 10, letterSpacing: 3, color: TA.muted, fontWeight: 700, textTransform: "uppercase", marginBottom: 10 }}>Quick Insights</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {[
          { icon: "🔗", title: "Contract & Honeypot Correlation", tag: "CODE ANALYSIS", text: sec.isHoneypot ? "Confirmed honeypot. The sell function is disabled. This token is designed to trap buyers." : scores.contract >= 7 && scores.honeypot === 10 ? "The contract code is clean and passes all buy/sell simulations. No honeypot behavior detected." : "The contract has some unusual elements but passes basic buy/sell simulations. There may be adjustable tax functions or conditional logic that could change behavior later. Monitor closely.", sources: ["Smart Contract Reading", "Honeypot Detection"], score: Math.round((scores.contract + scores.honeypot) / 2) },
          { icon: "📊", title: "Market Structure Health", tag: "MARKET INTEGRITY", text: scores.market < 4 ? "This token has critically weak market fundamentals. Low liquidity means even small trades will cause massive price swings. Combined with concentrated whale holdings and suspicious volume patterns, the conditions are perfect for a coordinated dump." : scores.market < 7 ? "Market conditions show some areas of concern. Liquidity depth and holder distribution could be stronger. Monitor whale wallet activity closely." : "Market structure looks relatively healthy. Liquidity is adequate, distribution is reasonable, and volume patterns appear organic.", sources: ["Liquidity Pool Analysis", "Whale & Holder Distribution", "Volume & Trading Patterns"], score: scores.market },
          { icon: "🎭", title: "Team Credibility Assessment", tag: "TRUST SIGNALS", text: scores.deployer < 3 ? "The team credibility signals are deeply concerning. The deployer has a history of rug pulls or is a brand new wallet. This is the most dangerous combination in DeFi." : scores.deployer < 6 ? "The team credibility signals are mixed. The deployer may have limited history and social presence, while existing, could be more established. This does not necessarily mean scam, but it does mean less accountability if something goes wrong." : "The deployer wallet shows legitimate history and social presence is verifiable. Team accountability signals are relatively strong.", sources: ["Deployer Wallet History", "Social & Website Verification"], score: Math.round((scores.deployer + scores.social) / 2) },
          { icon: "⚡", title: "Active Threat Level", tag: "REAL TIME RISK", text: scores.risk < 3 ? "The token owner retains dangerous administrative privileges including the ability to modify balances, blacklist wallets, or pause trading, and there are active warning flags on chain. A rug pull or fund seizure could happen at any moment without warning." : scores.risk < 7 ? "Some moderate administrative risks exist in the contract. The developer retains certain capabilities that could affect your funds. Proceed with awareness." : "No critical active threats were detected. The most dangerous admin functions are absent or have been removed. This is a positive safety signal.", sources: ["Ownership & Admin Rights", "Real-Time Alerts"], score: scores.risk },
        ].map(({ icon, title, tag, text, sources, score }) => {
          const c = score >= 7 ? TA.safe : score >= 4 ? TA.caution : TA.danger;
          const bg = score >= 7 ? TA.safeBg : score >= 4 ? TA.cautionBg : TA.dangerBg;
          const border = score >= 7 ? TA.safeBorder : score >= 4 ? TA.cautionBorder : TA.dangerBorder;
          return (
            <div key={title} style={{ background: bg, border: "1.5px solid " + border, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: TA.text, lineHeight: 1.3 }}>{title}</div>
                </div>
                <div style={{ fontSize: 8, fontWeight: 700, color: TA.muted, letterSpacing: 2, textTransform: "uppercase", flexShrink: 0, paddingTop: 3 }}>{tag}</div>
              </div>
              <div style={{ fontSize: 13, color: TA.sub, lineHeight: 1.7, marginBottom: 10 }}>{text}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sources.map((s) => <span key={s} style={{ fontSize: 10, color: TA.muted, background: "rgba(0,0,0,0.04)", borderRadius: 4, padding: "2px 7px", border: "1px solid " + TA.cardBorder }}>{s}</span>)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Breakdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ height: 1, flex: 1, background: TA.cardBorder }} />
        <div style={{ fontSize: 10, letterSpacing: 3, color: TA.muted, fontWeight: 700, textTransform: "uppercase" }}>Detailed Breakdown</div>
        <div style={{ height: 1, flex: 1, background: TA.cardBorder }} />
      </div>

      {SECTION_GRID.map((s, i) => (
        <EduCard
          key={s.key}
          sectionKey={s.key}
          score10={scores[s.scoreKey]}
          tyeComment={tye[s.tyeKey]}
          iqEarned={totalIQ}
          onIQEarned={onIQEarned}
          isLive={["contract","honeypot","liquidity","ownership","deployer"].includes(s.key) ? !!lv.goplus : !!lv.dexscreener}
        />
      ))}

      {/* Wallet Risk Map */}
      <div style={{ background: TA.card, borderRadius: 12, border: "1px solid " + TA.cardBorder, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + TA.cardBorder, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🗺️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: TA.text, flex: 1 }}>Wallet Risk Map</span>
          <span style={{ fontSize: 9, color: TA.muted }}>Tap nodes to inspect</span>
        </div>
        <div style={{ padding: 12 }}>
          <WalletRiskMap wallets={wallets} token={sd.token} accent={TA.caution} />
        </div>
      </div>

      {/* Tye's Final Verdict */}
      <div style={{ background: TA.card, borderRadius: 14, border: "1px solid " + TA.cardBorder, padding: "20px 16px", marginBottom: 14 }}>

        {/* Header */}
        <div style={{ fontSize: 22, fontWeight: 900, color: TA.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          🎯 Tye's Final Verdict
        </div>

        {/* AI Summary — or fallback rule-based */}
        {aiLoading ? (
          <div style={{ background: TA.tyeBg, border: "1px solid " + TA.tyeBorder, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: TA.muted, fontStyle: "italic" }}>🧠 Tye is writing your personalised verdict...</div>
          </div>
        ) : aiVerdict ? (
          <>
            {/* One-line take */}
            <div style={{ background: getSL(sd.score).bg, border: "1.5px solid " + getSL(sd.score).color + "55", borderRadius: 10, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{verdict.emoji}</span>
              <div style={{ fontSize: 15, fontWeight: 800, color: getSL(sd.score).color, lineHeight: 1.4 }}>{aiVerdict.oneLineTake}</div>
            </div>

            {/* Summary */}
            <div style={{ background: "#f8f5f0", border: "1px solid " + TA.cardBorder, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TA.muted, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>📋 What Tye found</div>
              <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.8 }}>{aiVerdict.summary}</div>
            </div>

            {/* Positive route */}
            <div style={{ background: TA.safeBg, border: "1.5px solid " + TA.safeBorder, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TA.safe, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>🚀 The positive route</div>
              <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.8 }}>{aiVerdict.positiveRoute}</div>
            </div>
          </>
        ) : (
          /* Fallback rule-based verdict */
          <div style={{ background: "#f8f5f0", borderRadius: 10, padding: "14px 16px", marginBottom: 14, border: "1px solid " + TA.cardBorder }}>
            <div style={{ fontSize: 13, color: TA.text, lineHeight: 1.8 }}>{verdict.text}</div>
          </div>
        )}

        {/* Score grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
          {scoreEntries.map(({ icon, score }, i) => {
            const c = score >= 8 ? TA.safe : score >= 5 ? TA.caution : TA.danger;
            return (
              <div key={i} style={{ background: "#f8f5f0", borderRadius: 8, padding: "8px 4px", textAlign: "center", border: "1px solid " + TA.cardBorder }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: c }}>{score}/10</div>
              </div>
            );
          })}
        </div>

        {/* IQ summary */}
        <div style={{ background: "#f8f5f0", borderRadius: 10, padding: "12px 16px", border: "1px solid " + TA.cardBorder, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🧠</span>
          <div>
            <div style={{ fontSize: 11, color: TA.muted, marginBottom: 2 }}>Your Crypto IQ</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: TA.iq }}>{totalIQ} pts</div>
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: getIQL(totalIQ).color }}>{getIQL(totalIQ).icon} {getIQL(totalIQ).label}</div>
            <div style={{ fontSize: 10, color: TA.muted, marginTop: 2 }}>Reveal fun facts to earn more IQ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── SAGE MODE ── */
function LiveBadge({ live }) {
  return live
    ? <span style={{ fontSize: 8, fontWeight: 700, background: "rgba(34,197,94,0.14)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 3, padding: "1px 5px", marginLeft: 4, letterSpacing: 0.8, whiteSpace: "nowrap" }}>LIVE</span>
    : <span style={{ fontSize: 8, fontWeight: 700, background: "rgba(150,150,150,0.1)", color: "#888", border: "1px solid rgba(150,150,150,0.2)", borderRadius: 3, padding: "1px 5px", marginLeft: 4, letterSpacing: 0.8, whiteSpace: "nowrap" }}>EST</span>;
}
function SRow({ label, value, sub, color, live }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 7 }}>
      <div style={{ flex: "0 0 42%", fontSize: 9, color: "#475569", letterSpacing: 1.5, fontFamily: "monospace", textTransform: "uppercase", display: "flex", alignItems: "center", flexWrap: "wrap", paddingRight: 4 }}>{label}{live !== undefined && <LiveBadge live={live} />}</div>
      <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: color || SM.acc, fontFamily: "monospace", wordBreak: "break-all" }}>{value}{sub && <span style={{ fontSize: 8, color: "#334155", marginLeft: 4 }}>{sub}</span>}</div>
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
  const sl = getSL(sd.score), lv = sd.sources || {}, sec = sd.security || {}, mkt = sd.market || {};
  return (
    <div style={{ fontFamily: "monospace", color: "#e2e8f0" }}>
      <div style={{ background: SM.card, border: "1px solid " + SM.border, borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: 900 }}>{sd.token.name}</span>
          <span style={{ fontSize: 10, color: SM.blue }}>${sd.token.symbol}</span>
          <span style={{ fontSize: 9, color: "#334155" }}>{sd.chain}</span>
          {sd.token.priceUsd && <span style={{ fontSize: 11, fontWeight: 700, color: SM.acc }}>${parseFloat(sd.token.priceUsd).toFixed(6)}<LiveBadge live={true} /></span>}
        </div>
        <div style={{ fontSize: 9, color: "#334155", marginBottom: 9, wordBreak: "break-all" }}>{sd.address}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ background: sl.color + "16", border: "1px solid " + sl.color + "40", borderRadius: 4, padding: "3px 10px", fontSize: 10, color: sl.color, fontWeight: 700 }}>{sl.label} · {sd.score}/100</div>
          {sec.isHoneypot && <div style={{ background: "rgba(239,68,68,0.11)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "3px 9px", fontSize: 10, color: "#ef4444", fontWeight: 700 }}>HONEYPOT</div>}
        </div>
        {mkt.social && (mkt.social.website || mkt.social.twitter || mkt.social.telegram || mkt.pairUrl) && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {mkt.social.website  && <a href={mkt.social.website}  target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>🌐</a>}
            {mkt.social.twitter  && <a href={mkt.social.twitter}  target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>🐦</a>}
            {mkt.social.telegram && <a href={mkt.social.telegram} target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>✈️</a>}
            {mkt.pairUrl         && <a href={mkt.pairUrl}         target="_blank" rel="noreferrer" style={{ color: SM.acc, fontSize: 11, textDecoration: "none" }}>📈 Chart</a>}
          </div>
        )}
      </div>
      {sd.reasons && sd.reasons.length > 0 && <SBlock title="score_deductions">{sd.reasons.map((r) => <SRow key={r} label={r.split("(")[0].trim().toLowerCase().replace(/\s+/g, "_")} value={r.match(/\((.+)\)/)?.[1] || "flag"} color="#ef4444" />)}</SBlock>}
      <SBlock title="contract">
        <SRow label="buy_tax"   value={(sec.buyTax  || 0) + "%"} color={(sec.buyTax  || 0) > 10 ? "#ef4444" : SM.acc} live={lv.goplus} />
        <SRow label="sell_tax"  value={(sec.sellTax || 0) + "%"} color={(sec.sellTax || 0) > 15 ? "#ef4444" : (sec.sellTax || 0) > 5 ? "#f59e0b" : SM.acc} live={lv.goplus} />
        <SRow label="renounced" value={sec.isRenounced ? "TRUE" : "FALSE"} color={sec.isRenounced ? SM.acc : "#ef4444"} live={lv.goplus} />
        <SRow label="honeypot"  value={sec.isHoneypot ? "DETECTED" : "CLEAN"} color={sec.isHoneypot ? "#ef4444" : SM.acc} live={lv.goplus} />
        <SRow label="owner"     value={shortAddr(sec.ownerAddress || "BURNED")} color={SM.blue} live={lv.goplus} />
        <SRow label="creator"   value={shortAddr(sec.creatorAddress || "")} color={SM.blue} live={lv.goplus} />
      </SBlock>
      {sec.flags && <SBlock title="goplus_flags">
        {[["open_source", sec.flags.isOpenSource, true], ["mintable", sec.flags.isMintable, false], ["proxy", sec.flags.isProxy, false], ["hidden_owner", sec.flags.hasHiddenOwner, false], ["anti_whale", sec.flags.isAntiWhale, true], ["cooldown", sec.flags.hasTradingCooldown, false], ["take_ownership", sec.flags.canTakeOwnership, false], ["self_destruct", sec.flags.canSelfDestruct, false]].map(([k, v, g]) => { const safe = g ? v : !v; return <SRow key={k} label={k} value={v ? "TRUE" : "FALSE"} color={safe ? SM.acc : "#ef4444"} live={true} />; })}
      </SBlock>}
      <SBlock title="liquidity">
        <SRow label="locked"    value={(sec.lp && sec.lp.lockedPct > 5) ? "TRUE" : "FALSE"} color={(sec.lp && sec.lp.lockedPct > 5) ? SM.acc : "#ef4444"} live={lv.goplus} />
        <SRow label="lock_pct"  value={(sec.lp && sec.lp.lockedPct || 0) + "%"} color={(sec.lp && sec.lp.lockedPct > 80) ? SM.acc : (sec.lp && sec.lp.lockedPct > 50) ? "#f59e0b" : "#ef4444"} live={lv.goplus} />
        <SRow label="total_usd" value={fmtUSD(mkt.liquidity)} live={lv.dexscreener} />
      </SBlock>
      <SBlock title="holders">
        <SRow label="count"      value={fmtNum(sec.holderCount)} />
        <SRow label="top_10_pct" value={(sec.top10HolderPct || 0) + "%"} color={(sec.top10HolderPct || 0) > 50 ? "#ef4444" : SM.acc} />
        {wallets.slice(0, 5).map((w, i) => <SRow key={i} label={"h" + (i + 1)} value={w.pct + "%"} color={w.risk === "high" ? "#ef4444" : w.risk === "medium" ? "#f59e0b" : SM.acc} sub={w.id} />)}
      </SBlock>
      <SBlock title="market">
        <SRow label="price"     value={sd.token.priceUsd ? "$" + parseFloat(sd.token.priceUsd).toFixed(8) : "N/A"} live={lv.dexscreener} />
        <SRow label="vol_24h"   value={fmtUSD(mkt.volume && mkt.volume.h24)} live={lv.dexscreener} />
        <SRow label="liquidity" value={fmtUSD(mkt.liquidity)} live={lv.dexscreener} />
        <SRow label="price_chg" value={(((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? "+" : "") + ((mkt.priceChange && mkt.priceChange.h24) || 0).toFixed(2) + "%"} color={((mkt.priceChange && mkt.priceChange.h24) || 0) > 0 ? SM.acc : "#ef4444"} live={lv.dexscreener} />
        <SRow label="buys"      value={fmtNum(mkt.txns && mkt.txns.buys)}  color={SM.acc}    live={lv.dexscreener} />
        <SRow label="sells"     value={fmtNum(mkt.txns && mkt.txns.sells)} color="#ef4444" live={lv.dexscreener} />
      </SBlock>
      <SBlock title="wallet_risk_map — tap nodes">
        <div style={{ padding: "4px 0" }}><WalletRiskMap wallets={wallets} token={sd.token} accent={SM.acc} /></div>
      </SBlock>
    </div>
  );
}

/* ── MAIN APP ── */
export default function App() {
  const [screen,     setScreen]     = useState("select");
  const [apiBase,    setApiBase]    = useState("/");
  const [addr,       setAddr]       = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [scanStage,  setScanStage]  = useState(0);
  const [iqEarned,   setIqEarned]   = useState(0);
  const [totalIQ,    setTotalIQ]    = useState(0);
  const [scanData,   setScanData]   = useState(null);
  const [wallets,    setWallets]    = useState([]);
  const [aiVerdict,  setAiVerdict]  = useState(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [error,      setError]      = useState(null);
  const inputRef = useRef();

  const isT   = screen === "training";
  const iqLvl = getIQL(totalIQ);

  function handleIQEarned(pts) {
    setTotalIQ((p) => p + pts);
  }

  const handleScan = useCallback(async () => {
    const a = addr.trim();
    if (!a || a.length < 10) return;
    if (inputRef.current) inputRef.current.blur();
    setScanning(true); setScanStage(0); setIqEarned(0); setScanData(null); setError(null); setAiVerdict(null); setAiLoading(false);

    const base = apiBase === "/" ? "" : apiBase;
    const apiPromise = fetch(base + "/api/scan/" + a).then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); });

    let earned = 0;
    for (let i = 0; i < SCAN_STAGES.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 450 + Math.random() * 220));
      earned += SCAN_STAGES[i].iq; setScanStage(i + 1); setIqEarned(earned);
    }

    try {
      const data = await Promise.race([apiPromise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 20000))]);
      const wl = mockWallets(a, data.security && data.security.holders);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setTotalIQ((p) => p + earned); setScanData(data); setWallets(wl); setScanning(false);
      // Fetch AI verdict in background (Training Arc only)
      if (screen === "training") {
        setAiLoading(true);
        fetchAIVerdict(data)
          .then((v) => setAiVerdict(v))
          .catch(() => setAiVerdict(null))
          .finally(() => setAiLoading(false));
      }
    } catch (err) {
      setScanning(false);
      setError(err.message === "timeout" ? "Scan timed out. Check your connection." : "Scan error: " + err.message);
    }
  }, [addr, apiBase]);

  if (screen === "select") return <ModeSelect onSelect={(m) => setScreen(m)} apiBase={apiBase} setApiBase={setApiBase} />;

  const bg     = isT ? TA.bg     : SM.bg;
  const hdr    = isT ? "rgba(240,235,224,0.96)" : "rgba(5,11,20,0.96)";
  const border = isT ? TA.cardBorder : SM.border;
  const acc    = isT ? TA.acc : SM.acc;

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "system-ui, sans-serif", transition: "background .4s" }}>
      <style>{"*{box-sizing:border-box;-webkit-tap-highlight-color:transparent} input,button{-webkit-appearance:none;} button{touch-action:manipulation;} @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}"}</style>
      {scanning && <ScanningScreen address={addr.trim()} stage={scanStage} iqEarned={iqEarned} mode={screen} />}

      {/* Header */}
      <div style={{ borderBottom: "1px solid " + border, padding: "0 12px", display: "flex", alignItems: "center", height: 50, gap: 9, position: "sticky", top: 0, zIndex: 100, background: hdr, backdropFilter: "blur(14px)" }}>
        <button onClick={() => { setScreen("select"); setScanData(null); }} style={{ display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #1a3a6b, #050c1a)", border: "2px solid rgba(77,184,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: "#4db8ff" }}>D</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2, color: isT ? TA.text : "#fff" }}>DEMYST</span>
        </button>
        <div style={{ padding: "2px 8px", borderRadius: 4, background: isT ? "rgba(245,158,11,0.12)" : "rgba(0,229,160,0.07)", border: "1px solid " + acc + "2e", fontSize: 9, fontWeight: 700, color: acc, flexShrink: 0 }}>{isT ? "TRAINING" : "SAGE"}</div>
        <div style={{ flex: 1 }} />
        {isT && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: TA.iq, flexShrink: 0 }}>🧠 {totalIQ}</div>}
        <button onClick={() => { setScreen(isT ? "sage" : "training"); setScanData(null); }} style={{ fontSize: 9, color: isT ? TA.muted : "#334155", background: "none", border: "1px solid " + border, borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>{isT ? "⚡ Sage" : "🎓 Train"}</button>
      </div>

      {/* Search */}
      <div style={{ padding: "12px 12px 0", borderBottom: "1px solid " + border }}>
        <div style={{ display: "flex", gap: 7 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: isT ? "#fff" : "rgba(255,255,255,0.04)", border: "1.5px solid " + (addr ? acc + "66" : border), borderRadius: 9, padding: "0 11px", gap: 7, transition: "border-color .2s", boxShadow: isT ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
            <span style={{ fontSize: 12, opacity: 0.4, flexShrink: 0 }}>🔍</span>
            <input ref={inputRef} value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScan()} placeholder="Paste contract address..." inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} style={{ flex: 1, background: "none", border: "none", outline: "none", color: isT ? TA.text : "#e2e8f0", fontSize: 13, padding: "12px 0", fontFamily: "monospace", minWidth: 0 }} />
            {addr && <button onClick={() => setAddr("")} style={{ background: "none", border: "none", color: TA.muted, cursor: "pointer", fontSize: 15, padding: 0, flexShrink: 0 }}>×</button>}
          </div>
          <button onClick={handleScan} disabled={!addr.trim() || scanning} style={{ padding: "0 16px", borderRadius: 9, border: "none", cursor: addr.trim() && !scanning ? "pointer" : "not-allowed", background: addr.trim() && !scanning ? (isT ? "linear-gradient(135deg,#92400e,#f59e0b)" : "linear-gradient(135deg,#065f46,#00e5a0)") : (isT ? TA.cardBorder : "rgba(255,255,255,0.04)"), color: addr.trim() && !scanning ? "#fff" : TA.muted, fontWeight: 800, fontSize: 12, letterSpacing: 1, fontFamily: "inherit", transition: "all .2s", textTransform: "uppercase", flexShrink: 0, whiteSpace: "nowrap", boxShadow: addr.trim() && !scanning && isT ? "0 2px 8px rgba(217,119,6,0.35)" : "none" }}>
            {scanning ? "..." : "SCAN"}
          </button>
        </div>
        <div style={{ fontSize: 9, color: TA.muted, padding: "7px 0 10px", letterSpacing: 0.5 }}>ETH · BSC · Base · Polygon · Solana · Arbitrum</div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 12px 60px", animation: scanData ? "fadeUp .4s ease" : "none" }}>
        {error && <div style={{ background: TA.dangerBg, border: "1px solid " + TA.dangerBorder, borderRadius: 10, padding: "12px 14px", marginBottom: 12, color: TA.danger, fontSize: 11, lineHeight: 1.7 }}>
          <strong>{error}</strong>
          <button onClick={() => { setScreen("select"); setError(null); }} style={{ display: "block", marginTop: 8, padding: "6px 12px", borderRadius: 6, border: "none", background: TA.dangerBorder, color: TA.danger, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Go to Setup</button>
        </div>}

        {!scanData && !scanning && !error && <div style={{ textAlign: "center", padding: "44px 16px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #1a3a6b, #050c1a)", border: "2px solid rgba(77,184,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", boxShadow: "0 0 20px rgba(0,140,255,0.25)" }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: "#4db8ff" }}>D</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: isT ? TA.sub : "#334155", marginBottom: 7 }}>{isT ? "Ready to learn." : "Awaiting address."}</div>
          <div style={{ fontSize: 11, color: TA.muted, maxWidth: 320, margin: "0 auto", lineHeight: 1.75 }}>{isT ? "Paste any contract address for a full educational breakdown with ELI5 explanations, real-life analogies, and Tye's analysis." : "Enter an address for raw on-chain security data."}</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 16, flexWrap: "wrap" }}>
            {["0x2170ed0880ac9a755fd29b2688956bd959f933f8", "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"].map((a) => (<button key={a} onClick={() => setAddr(a)} style={{ background: isT ? "#fff" : "rgba(255,255,255,0.03)", border: "1px solid " + (isT ? TA.cardBorder : "rgba(255,255,255,0.07)"), borderRadius: 6, padding: "5px 11px", fontSize: 10, color: TA.muted, cursor: "pointer", fontFamily: "monospace", boxShadow: isT ? "0 1px 3px rgba(0,0,0,0.06)" : "none" }}>{shortAddr(a)}</button>))}
          </div>
        </div>}

        {scanData && isT  && <TrainingArcView sd={scanData} wallets={wallets} totalIQ={totalIQ} onIQEarned={handleIQEarned} aiVerdict={aiVerdict} aiLoading={aiLoading} />}
        {scanData && !isT && <SageModeView    sd={scanData} wallets={wallets} />}
      </div>
    </div>
  );
}
