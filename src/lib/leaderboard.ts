import * as fs from "node:fs";
import { flagToCountryCode, countryCodeToName } from "./countries";

export type WindowKey = "7d" | "30d";

export interface PeerRow {
  flag: string | null;
  countryCode: string | null;
  countryName: string;
  medal: "gold" | "silver" | "bronze" | null;
  rank: number;
  peerId: string;
  host: string | null;
  hours: number;
  uptimePct: number;
}

export interface LeaderboardMeta {
  windowKey: WindowKey;
  windowLabel: string;
  windowHours: number;
  windowRangeUtc: string;
  totalPeers: number;
}

export interface CountryRow {
  rank: number | null;
  countryCode: string | null;
  countryName: string;
  flag: string | null;
  nodeCount: number;
  totalHours: number;
  averageUptimePct: number;
  topNode: PeerRow;
  peers: PeerRow[];
}

export interface Leaderboard {
  meta: LeaderboardMeta;
  countries: CountryRow[];
}

function isRegionalIndicator(cp: number): boolean {
  return cp >= 0x1f1e6 && cp <= 0x1f1ff;
}

function extractFlagFromStart(line: string): { flag: string | null; rest: string } {
  const trimmed = line.trimStart();
  const first = [...trimmed];
  if (first.length >= 2) {
    const cp0 = first[0].codePointAt(0);
    const cp1 = first[1].codePointAt(0);
    if (
      cp0 !== undefined &&
      cp1 !== undefined &&
      isRegionalIndicator(cp0) &&
      isRegionalIndicator(cp1)
    ) {
      const flag = first[0] + first[1];
      const rest = [...trimmed].slice(2).join("");
      return { flag, rest };
    }
  }
  return { flag: null, rest: trimmed };
}

function extractMedal(rest: string): {
  medal: "gold" | "silver" | "bronze" | null;
  rest: string;
} {
  const trimmed = rest.trimStart();
  const first = [...trimmed];
  if (first.length > 0) {
    const cp = first[0].codePointAt(0);
    if (cp === 0x1f947) {
      return { medal: "gold", rest: [...trimmed].slice(1).join("") };
    }
    if (cp === 0x1f948) {
      return { medal: "silver", rest: [...trimmed].slice(1).join("") };
    }
    if (cp === 0x1f949) {
      return { medal: "bronze", rest: [...trimmed].slice(1).join("") };
    }
  }
  return { medal: null, rest: trimmed };
}

function extractRank(line: string): { rank: number; rest: string } {
  const match = line.match(/^\s*(\d+)\s+/);
  if (!match) throw new Error("Could not extract rank from: " + line);
  return { rank: parseInt(match[1], 10), rest: line.slice(match[0].length) };
}

function parseRow(line: string): PeerRow {
  const { flag, rest: afterFlag } = extractFlagFromStart(line);
  const { medal, rest: afterMedal } = extractMedal(afterFlag);
  const { rank, rest: afterRank } = extractRank(afterMedal);

  const trimmed = afterRank.trimStart();

  // Find the Peer ID (starts with 12D3KooW)
  const peerIdMatch = trimmed.match(/(12D3KooW\S+)\s*/);
  if (!peerIdMatch) throw new Error("Could not extract peer ID from: " + line);
  const peerId = peerIdMatch[1];
  const afterPeerId = trimmed.slice(peerIdMatch.index! + peerIdMatch[0].length).trim();

  // Parse remaining: optional host, then hours, then uptime%
  // The last two tokens should be hours (integer) and uptime (percentage)
  // Everything between the peer ID and hours is host

  // Work backwards: last token is uptime%, second-to-last is hours
  const tokens = afterPeerId.trim().split(/\s+/);
  if (tokens.length < 2) {
    throw new Error("Not enough tokens after peer ID in: " + line);
  }

  const uptimeStr = tokens[tokens.length - 1];
  const uptimePct = parseFloat(uptimeStr.replace("%", ""));
  const hours = parseInt(tokens[tokens.length - 2], 10);
  const host =
    tokens.length > 2
      ? tokens.slice(0, tokens.length - 2).join(" ")
      : null;

  const countryCode = flagToCountryCode(flag);
  const countryName = countryCodeToName(countryCode);

  return {
    flag,
    countryCode,
    countryName,
    medal: medal,
    rank,
    peerId,
    host: host && host.length > 0 ? host : null,
    hours,
    uptimePct,
  };
}

export interface ParsedFile {
  meta: LeaderboardMeta;
  rows: PeerRow[];
}

export function parseLeaderboardFile(filePath: string, windowKey: WindowKey): ParsedFile {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim().length > 0);

  // Parse header
  // Line 0: 🏆 UPTIME OLYMPICS — Last 7d (169h window)
  // Line 1: =====...
  // Line 2: Window: 2026-05-18 13:00 → 2026-05-25 14:00 UTC
  // Line 3: 116 peers seen — showing top 116
  // Line 4: Flag  Rank ...
  // Line 5: =====...

  let dataStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Flag")) {
      dataStartIdx = i + 2; // skip column separator line
      break;
    }
  }

  const windowLabelMatch = lines[0].match(/Last\s+\d+d/);
  const windowLabel = windowLabelMatch ? windowLabelMatch[0] : "Last 7d";

  const windowHoursMatch = lines[0].match(/\((\d+)h\s+window\)/);
  const windowHours = windowHoursMatch ? parseInt(windowHoursMatch[1], 10) : 0;

  const windowRangeMatch = lines[2].match(/Window:\s+(.+)/);
  const windowRangeUtc = windowRangeMatch ? windowRangeMatch[1].trim() : "";

  const totalPeersMatch = lines[3].match(/(\d+)\s+peers\s+seen/);
  const totalPeers = totalPeersMatch ? parseInt(totalPeersMatch[1], 10) : 0;

  // Parse data rows
  const rows: PeerRow[] = [];
  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i];
    // Skip separator lines
    if (line.startsWith("---") || line.startsWith("===")) continue;
    // Skip empty lines
    if (line.trim().length === 0) continue;
    // Skip header-like lines
    if (line.startsWith("Flag") || line.startsWith("🏆")) continue;

    try {
      const row = parseRow(line);
      rows.push(row);
    } catch (e) {
      console.warn("Skipping unparseable row:", line, e);
    }
  }

  return {
    meta: {
      windowKey,
      windowLabel,
      windowHours,
      windowRangeUtc,
      totalPeers,
    },
    rows,
  };
}

function getTopNode(peers: PeerRow[]): PeerRow {
  return peers.reduce((best, p) => {
    if (p.uptimePct > best.uptimePct) return p;
    if (p.uptimePct === best.uptimePct && p.hours > best.hours) return p;
    return best;
  }, peers[0]);
}

function standardCompetitionRank(sorted: { totalHours: number; averageUptimePct: number; nodeCount: number }[]): number[] {
  if (sorted.length === 0) return [];
  const ranks: number[] = [1];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (
      curr.totalHours === prev.totalHours &&
      curr.averageUptimePct === prev.averageUptimePct &&
      curr.nodeCount === prev.nodeCount
    ) {
      ranks.push(ranks[i - 1]);
    } else {
      ranks.push(i + 1);
    }
  }
  return ranks;
}

export function aggregateByCountry(rows: PeerRow[]): CountryRow[] {
  const countryMap = new Map<string, PeerRow[]>();

  for (const row of rows) {
    const key = row.countryCode ?? "Unknown";
    if (!countryMap.has(key)) {
      countryMap.set(key, []);
    }
    countryMap.get(key)!.push(row);
  }

  const countryRows: CountryRow[] = [];

  for (const [code, peers] of countryMap.entries()) {
    const isUnknown = code === "Unknown";
    const firstPeer = peers[0];
    peers.sort((a, b) => {
      if (b.uptimePct !== a.uptimePct) return b.uptimePct - a.uptimePct;
      return b.hours - a.hours;
    });

    const totalHours = peers.reduce((sum, p) => sum + p.hours, 0);
    const averageUptimePct =
      peers.reduce((sum, p) => sum + p.uptimePct, 0) / peers.length;

    countryRows.push({
      rank: null,
      countryCode: isUnknown ? null : code,
      countryName: isUnknown ? "Unknown" : firstPeer.countryName,
      flag: isUnknown ? null : firstPeer.flag,
      nodeCount: peers.length,
      totalHours,
      averageUptimePct,
      topNode: getTopNode(peers),
      peers,
    });
  }

  // Sort: Unknown goes last, everything else sorted by totalHours desc
  const known = countryRows.filter((c) => c.countryCode !== null);
  const unknown = countryRows.filter((c) => c.countryCode === null);

  known.sort((a, b) => {
    if (b.totalHours !== a.totalHours) return b.totalHours - a.totalHours;
    if (b.averageUptimePct !== a.averageUptimePct)
      return b.averageUptimePct - a.averageUptimePct;
    return b.nodeCount - a.nodeCount;
  });

  // Assign ranks (standard competition ranking)
  const rankValues = known.map((c) => ({
    totalHours: c.totalHours,
    averageUptimePct: c.averageUptimePct,
    nodeCount: c.nodeCount,
  }));
  const ranks = standardCompetitionRank(rankValues);
  for (let i = 0; i < known.length; i++) {
    known[i].rank = ranks[i];
  }

  return [...known, ...unknown];
}

export function buildLeaderboard(filePath: string, windowKey: WindowKey): Leaderboard {
  const { meta, rows } = parseLeaderboardFile(filePath, windowKey);
  const countries = aggregateByCountry(rows);
  return { meta, countries };
}