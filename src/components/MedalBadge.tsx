interface MedalBadgeProps {
  rank: number | null;
}

export default function MedalBadge({ rank }: MedalBadgeProps) {
  if (rank === null) return null;

  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow text-bg-deep text-sm font-bold leading-none">
        {rank}
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-cream text-cream text-sm font-bold leading-none">
        {rank}
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-muted text-muted text-sm font-bold leading-none">
        {rank}
      </span>
    );
  }

  return (
    <span className="text-muted text-sm font-medium tabular-nums w-7 text-center inline-block">
      {rank}
    </span>
  );
}