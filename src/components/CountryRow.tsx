"use client";

import type { CountryRow } from "@/lib/leaderboard";
import { formatHours, formatUptime } from "@/lib/format";
import MedalBadge from "./MedalBadge";
import PeerSubRow from "./PeerSubRow";

interface CountryRowProps {
  row: CountryRow;
  expanded: boolean;
  onToggle: () => void;
  layout: "table" | "card";
}

export default function CountryRowComponent({
  row,
  expanded,
  onToggle,
  layout,
}: CountryRowProps) {
  const isUnknown = row.rank === null;

  if (layout === "card") {
    return (
      <div
        onClick={onToggle}
        className={`border border-green/20 rounded-lg cursor-pointer transition-colors duration-150 ${
          expanded ? "bg-bg-elevated" : "bg-bg-surface hover:bg-bg-elevated"
        }`}
      >
        <div className="flex items-center gap-3 p-3">
          <div className="flex items-center justify-center w-10 shrink-0">
            {row.rank !== null ? (
              <MedalBadge rank={row.rank} />
            ) : (
              <span className="text-muted text-xs italic">--</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {row.flag && (
                <span className="text-lg leading-none">{row.flag}</span>
              )}
              <span
                className={`font-medium text-sm truncate ${
                  isUnknown ? "text-muted italic" : "text-cream"
                }`}
              >
                {row.countryName}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5">
              <span className="text-muted text-xs">
                Nodes:{" "}
                <span className="text-cream tabular-nums">
                  {row.nodeCount}
                </span>
              </span>
              <span className="text-muted text-xs">
                Avg:{" "}
                <span className="text-cream tabular-nums">
                  {formatUptime(row.averageUptimePct)}
                </span>
              </span>
              <span className="text-muted text-xs">
                Hours:{" "}
                <span className="text-cream tabular-nums">
                  {formatHours(row.totalHours)}
                </span>
              </span>
            </div>
          </div>
          <span className="text-muted text-lg shrink-0">
            {expanded ? "−" : "+"}
          </span>
        </div>
        {expanded && (
          <div className="border-t border-green/20 px-3 pb-2 pt-1">
            {row.peers.slice(0, 20).map((peer, i) => (
              <PeerSubRow key={peer.peerId + i} peer={peer} />
            ))}
            {row.peers.length > 20 && (
              <p className="text-muted text-xs text-center pt-2 italic">
                +{row.peers.length - 20} more
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Table layout (desktop)
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer transition-colors duration-150 border-b border-green/10 ${
          expanded
            ? "bg-bg-elevated"
            : isUnknown
              ? "bg-bg-surface/40"
              : "bg-bg-surface hover:bg-bg-elevated"
        }`}
      >
        <td className="py-3 pl-4 w-12 align-middle">
          {row.rank !== null ? (
            <MedalBadge rank={row.rank} />
          ) : (
            <span className="text-muted text-xs italic">--</span>
          )}
        </td>
        <td className="py-3 align-middle">
          {row.flag ? (
            <span className="text-xl leading-none">{row.flag}</span>
          ) : null}
        </td>
        <td className="py-3 align-middle">
          <span
            className={`text-sm font-medium ${
              isUnknown ? "text-muted italic" : "text-cream"
            }`}
          >
            {row.countryName}
          </span>
        </td>
        <td className="py-3 align-middle tabular-nums text-sm text-cream">
          {row.nodeCount}
        </td>
        <td className="py-3 align-middle tabular-nums text-sm text-cream">
          {formatHours(row.totalHours)}
        </td>
        <td className="py-3 pr-4 align-middle tabular-nums text-sm text-cream text-right">
          {formatUptime(row.averageUptimePct)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-bg-elevated border-b border-green/10">
          <td colSpan={6} className="p-0">
            <div className="px-4 pb-3">
              {row.peers.slice(0, 20).map((peer, i) => (
                <PeerSubRow key={peer.peerId + i} peer={peer} />
              ))}
              {row.peers.length > 20 && (
                <p className="text-muted text-xs text-center pt-2 italic">
                  +{row.peers.length - 20} more
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}