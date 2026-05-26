export const COUNTRY_NAMES: Record<string, string> = {
  CA: "Canada",
  FR: "France",
  DE: "Germany",
  NG: "Nigeria",
  AT: "Austria",
  NL: "Netherlands",
  PL: "Poland",
  AU: "Australia",
  BR: "Brazil",
  FI: "Finland",
  CZ: "Czech Republic",
  HK: "Hong Kong",
  NO: "Norway",
  US: "United States",
  JP: "Japan",
  PK: "Pakistan",
  SG: "Singapore",
  CR: "Costa Rica",
  MD: "Moldova",
  VN: "Vietnam",
  AM: "Armenia",
  CH: "Switzerland",
  PT: "Portugal",
  ES: "Spain",
  BD: "Bangladesh",
  GH: "Ghana",
  ZA: "South Africa",
  ID: "Indonesia",
  IN: "India",
  LT: "Lithuania",
  CN: "China",
  IT: "Italy",
  BG: "Bulgaria",
  SE: "Sweden",
  KE: "Kenya",
  MX: "Mexico",
  MT: "Malta",
  DK: "Denmark",
  GB: "United Kingdom",
  RO: "Romania",
  KR: "South Korea",
  TW: "Taiwan",
  IE: "Ireland",
  MY: "Malaysia",
  PH: "Philippines",
  TH: "Thailand",
  TR: "Turkey",
  UA: "Ukraine",
  AR: "Argentina",
  CO: "Colombia",
  PE: "Peru",
  CL: "Chile",
};

function regionalIndicatorToCode(flag: string): string | null {
  if ([...flag].length !== 2) return null;
  const codePoints = [...flag];
  const a = codePoints[0].codePointAt(0);
  const b = codePoints[1].codePointAt(0);
  if (a === undefined || b === undefined) return null;
  const REGIONAL_OFFSET = 0x1f1e6;
  const LETTER_A = 0x41;
  const letterA = a - REGIONAL_OFFSET + LETTER_A;
  const letterB = b - REGIONAL_OFFSET + LETTER_A;
  if (letterA < LETTER_A || letterA > LETTER_A + 25) return null;
  if (letterB < LETTER_A || letterB > LETTER_A + 25) return null;
  return String.fromCodePoint(letterA) + String.fromCodePoint(letterB);
}

export function flagToCountryCode(flag: string | null): string | null {
  if (!flag) return null;
  return regionalIndicatorToCode(flag);
}

export function countryCodeToName(code: string | null): string {
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code] ?? code;
}

export function flagToCountryName(flag: string | null): string {
  if (!flag) return "Unknown";
  const code = regionalIndicatorToCode(flag);
  if (!code) return "Unknown";
  return COUNTRY_NAMES[code] ?? code;
}