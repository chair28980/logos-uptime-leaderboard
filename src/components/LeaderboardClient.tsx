"use client";

import { useState, useCallback } from "react";
import type { WindowKey, Leaderboard } from "@/lib/leaderboard";
import { formatHours } from "@/lib/format";
import Wordmark from "./Wordmark";
import Rule from "./Rule";
import WindowToggle from "./WindowToggle";
import CountryRowComponent from "./CountryRow";
import DisclaimerBlock from "./DisclaimerBlock";

interface LeaderboardClientProps {
  data7d: Leaderboard;
  data30d: Leaderboard;
}

export default function LeaderboardClient({
  data7d,
  data30d,
}: LeaderboardClientProps) {
  const [window, setWindow] = useState<WindowKey>("7d");
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(
    new Set()
  );

  const active = window === "7d" ? data7d : data30d;

  const toggleCountry = useCallback((countryKey: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(countryKey)) {
        next.delete(countryKey);
      } else {
        next.add(countryKey);
      }
      return next;
    });
  }, []);

  const isExpanded = (countryKey: string) => expandedCountries.has(countryKey);

  return (
    <div className="min-h-screen bg-bg-deep text-cream">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-10 sm:py-16">
        {/* Header */}
        <header className="mb-10 sm:mb-16">
          <Wordmark />
          <Rule />
          <p className="text-muted text-xs tracking-[0.2em] uppercase font-medium mt-2">
            UNOFFICIAL FAN PROJECT
          </p>
        </header>

        {/* Window Toggle & Meta */}
        <section className="mb-8 sm:mb-12">
          <WindowToggle
            value={window}
            onChange={setWindow}
            options={[
              { value: "7d", label: "7 DAYS" },
              { value: "30d", label: "30 DAYS" },
            ]}
          />
          <div className="mt-4 text-sm text-muted space-y-0.5">
            <p>{active.meta.windowRangeUtc}</p>
            <p className="tabular-nums">
              {formatHours(active.meta.totalPeers)} peers seen
            </p>
          </div>
        </section>

        {/* Desktop Table */}
        <section className="hidden lg:block mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule text-muted text-xs uppercase tracking-wider">
                <th className="pb-3 pl-4 text-left font-medium w-12">Rank</th>
                <th className="pb-3 text-left font-medium w-10"></th>
                <th className="pb-3 text-left font-medium">Country</th>
                <th className="pb-3 text-left font-medium tabular-nums">
                  Nodes
                </th>
                <th className="pb-3 text-left font-medium tabular-nums">
                  Total Hours
                </th>
                <th className="pb-3 pr-4 text-right font-medium tabular-nums">
                  Avg Uptime
                </th>
              </tr>
            </thead>
            <tbody>
              {active.countries.map((country) => (
                <CountryRowComponent
                  key={country.countryCode ?? "Unknown"}
                  row={country}
                  expanded={isExpanded(country.countryCode ?? "Unknown")}
                  onToggle={() =>
                    toggleCountry(country.countryCode ?? "Unknown")
                  }
                  layout="table"
                />
              ))}
            </tbody>
          </table>
        </section>

        {/* Tablet View (768-1023px) */}
        <section className="hidden md:block lg:hidden mb-8">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule text-muted text-xs uppercase tracking-wider">
                <th className="pb-3 pl-4 text-left font-medium w-12">Rank</th>
                <th className="pb-3 text-left font-medium w-10"></th>
                <th className="pb-3 text-left font-medium">Country</th>
                <th className="pb-3 text-left font-medium tabular-nums">
                  Nodes
                </th>
                <th className="pb-3 text-left font-medium tabular-nums">
                  Total Hours
                </th>
                <th className="pb-3 pr-4 text-right font-medium tabular-nums">
                  Avg Uptime
                </th>
              </tr>
            </thead>
            <tbody>
              {active.countries.map((country) => (
                <CountryRowComponent
                  key={country.countryCode ?? "Unknown"}
                  row={country}
                  expanded={isExpanded(country.countryCode ?? "Unknown")}
                  onToggle={() =>
                    toggleCountry(country.countryCode ?? "Unknown")
                  }
                  layout="table"
                />
              ))}
            </tbody>
          </table>
        </section>

        {/* Mobile Cards (< 768px) */}
        <section className="md:hidden mb-8 space-y-3">
          {active.countries.map((country) => (
            <CountryRowComponent
              key={country.countryCode ?? "Unknown"}
              row={country}
              expanded={isExpanded(country.countryCode ?? "Unknown")}
              onToggle={() =>
                toggleCountry(country.countryCode ?? "Unknown")
              }
              layout="card"
            />
          ))}
        </section>

        {/* Divider */}
        <hr className="border-0 h-px bg-rule my-10 sm:my-16" />

        {/* About & Footer */}
        <footer className="mb-8">
          <DisclaimerBlock />
        </footer>
      </div>
    </div>
  );
}