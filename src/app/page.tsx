import path from "node:path";
import { buildLeaderboard } from "@/lib/leaderboard";
import LeaderboardClient from "@/components/LeaderboardClient";

export default function Home() {
  const dataDir = path.join(process.cwd(), "data");
  const data7d = buildLeaderboard(
    path.join(dataDir, "last-7-days.txt"),
    "7d"
  );
  const data30d = buildLeaderboard(
    path.join(dataDir, "last-30-days.txt"),
    "30d"
  );

  return <LeaderboardClient data7d={data7d} data30d={data30d} />;
}