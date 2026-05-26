import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  parseLeaderboardFile,
  aggregateByCountry,
  buildLeaderboard,
} from "../src/lib/leaderboard";
import { formatUptime, truncatePeerId } from "../src/lib/format";

const DATA_DIR = path.join(import.meta.dirname, "..", "data");

describe("Parser - 7-day file", () => {
  const filePath = path.join(DATA_DIR, "last-7-days.txt");

  it("parses the correct number of rows matching N peers seen", () => {
    const { meta, rows } = parseLeaderboardFile(filePath, "7d");
    expect(rows.length).toBe(meta.totalPeers);
  });

  it("extracts meta fields correctly", () => {
    const { meta } = parseLeaderboardFile(filePath, "7d");
    expect(meta.windowKey).toBe("7d");
    expect(meta.windowHours).toBeGreaterThan(0);
    expect(meta.windowRangeUtc).toContain("UTC");
    expect(meta.totalPeers).toBeGreaterThan(0);
  });

  it("parses all rows without throwing", () => {
    const { rows } = parseLeaderboardFile(filePath, "7d");
    for (const row of rows) {
      expect(row.peerId).toMatch(/^12D3KooW/);
      expect(typeof row.hours).toBe("number");
      expect(typeof row.uptimePct).toBe("number");
    }
  });
});

describe("Parser - 30-day file", () => {
  const filePath = path.join(DATA_DIR, "last-30-days.txt");

  it("parses the correct number of rows matching N peers seen", () => {
    const { meta, rows } = parseLeaderboardFile(filePath, "30d");
    expect(rows.length).toBe(meta.totalPeers);
  });

  it("extracts meta fields correctly", () => {
    const { meta } = parseLeaderboardFile(filePath, "30d");
    expect(meta.windowKey).toBe("30d");
    expect(meta.windowHours).toBeGreaterThan(0);
    expect(meta.windowRangeUtc).toContain("UTC");
    expect(meta.totalPeers).toBeGreaterThan(0);
  });
});

describe("Aggregator", () => {
  const filePath = path.join(DATA_DIR, "last-7-days.txt");

  it("sum of nodeCount across countries equals total parsed rows", () => {
    const { rows } = parseLeaderboardFile(filePath, "7d");
    const countries = aggregateByCountry(rows);
    const sumNodes = countries.reduce((s, c) => s + c.nodeCount, 0);
    expect(sumNodes).toBe(rows.length);
  });

  it("country ranking is monotonically non-decreasing by totalHours", () => {
    const { rows } = parseLeaderboardFile(filePath, "7d");
    const countries = aggregateByCountry(rows);
    const ranked = countries.filter((c) => c.rank !== null);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].totalHours).toBeLessThanOrEqual(
        ranked[i - 1].totalHours
      );
    }
  });

  it("Unknown bucket appears last with rank: null", () => {
    const { rows } = parseLeaderboardFile(filePath, "7d");
    const countries = aggregateByCountry(rows);
    const last = countries[countries.length - 1];
    expect(last.countryName).toBe("Unknown");
    expect(last.rank).toBeNull();
  });
});

describe("Formatter", () => {
  it("formatUptime returns one decimal place with percent sign", () => {
    expect(formatUptime(100)).toBe("100.0%");
    expect(formatUptime(82.8)).toBe("82.8%");
    expect(formatUptime(0.1)).toBe("0.1%");
  });

  it("truncatePeerId shows first 8 chars, ellipsis, last 6 chars", () => {
    const id = "12D3KooW9tKQDM3pX4YfNVnFfgmohZtXJttdGhbPkWZ4N5c2Y2BN";
    const result = truncatePeerId(id);
    expect(result).toBe("12D3KooW...c2Y2BN");
  });
});

describe("Integration - buildLeaderboard", () => {
  it("builds a leaderboard from the 7-day file with valid structure", () => {
    const lb = buildLeaderboard(
      path.join(DATA_DIR, "last-7-days.txt"),
      "7d"
    );
    expect(lb.meta.windowKey).toBe("7d");
    expect(lb.countries.length).toBeGreaterThan(0);
    expect(lb.countries[0].rank).toBe(1);
  });

  it("builds a leaderboard from the 30-day file with valid structure", () => {
    const lb = buildLeaderboard(
      path.join(DATA_DIR, "last-30-days.txt"),
      "30d"
    );
    expect(lb.meta.windowKey).toBe("30d");
    expect(lb.countries.length).toBeGreaterThan(0);
    expect(lb.countries[0].rank).toBe(1);
  });
});