# Design Notes

## Project
Logos International Uptime Leaderboard - single-page static Next.js site.

## Key Decisions

**Parser approach**: Uses string-based field extraction by anchoring on the
Peer ID token (starts with "12D3KooW"). Fields before the Peer ID are
iteratively extracted (flag emoji, medal emoji, rank). Fields after are
parsed right-to-left (uptime%, hours, optional host). This avoids fragile
column-position logic and handles variable-width whitespace robustly.

**Country lookup**: A static mapping of ISO alpha-2 codes to full English
country names in src/lib/countries.ts. Regional indicator emojis are
converted to alpha-2 codes by subtracting the Unicode regional indicator
offset (U+1F1E6). No external geocoding library.

**Ranking**: Standard competition ranking (1, 2, 2, 4 style). Countries
sorted by totalHours desc, then averageUptimePct desc, then nodeCount desc.
Unknown bucket always appended last with rank: null.

**Layout approach**: Three breakpoints (desktop 1024px+, tablet 768-1023px,
mobile <768px) rendered via CSS display toggles on the same data. The
CountryRow component accepts a "table" or "card" layout prop.

**Expand behavior**: Controlled React state using a Set of expanded country
keys. Native <details> is intentionally avoided for consistent styling.

**Font strategy**: Playfair Display italic for the wordmark, Inter for body
text. Both loaded via next/font/google.

**Tailwind v4**: Custom colors defined via @theme in globals.css. Reference
as bg-bg-surface, text-cream, border-rule, etc.

**No client data fetching**: All data parsed at build time from flat text
files in data/. Server component reads files, passes to client component
for the toggle interaction.