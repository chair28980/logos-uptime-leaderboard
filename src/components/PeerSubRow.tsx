import type { PeerRow } from "@/lib/leaderboard";
import { formatHours, formatUptime } from "@/lib/format";

interface PeerSubRowProps {
  peer: PeerRow;
}

export default function PeerSubRow({ peer }: PeerSubRowProps) {
  return (
    <div className="flex items-center justify-between py-2 px-3 text-sm border-b border-green/10 last:border-b-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-xs text-muted tabular-nums whitespace-nowrap">
          {peer.peerId.slice(0, 8)}...{peer.peerId.slice(-6)}
        </span>
        {peer.host && (
          <span className="text-muted text-xs hidden sm:inline truncate max-w-[120px]">
            {peer.host}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-muted text-xs tabular-nums">
          {formatHours(peer.hours)}h
        </span>
        <span className="text-cream text-xs font-medium tabular-nums w-14 text-right">
          {formatUptime(peer.uptimePct)}
        </span>
      </div>
    </div>
  );
}