export function formatHours(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatUptime(pct: number): string {
  return pct.toFixed(1) + "%";
}

export function truncatePeerId(id: string): string {
  return id.slice(0, 8) + "..." + id.slice(-6);
}