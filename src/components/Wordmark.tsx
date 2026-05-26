import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: "italic",
  weight: "400",
});

interface WordmarkProps {
  className?: string;
}

export default function Wordmark({ className = "" }: WordmarkProps) {
  return (
    <h1
      className={`${playfair.className} italic text-cream text-[clamp(1.5rem,4vw,2.25rem)] leading-tight ${className}`}
    >
      Logos International Uptime Leaderboard
    </h1>
  );
}