type TccIdType = "TRD" | "ADM" | "OWN";

export function generateTccId(type: TccIdType = "TRD"): string {
  const num = Math.floor(10_000_000 + Math.random() * 90_000_000);
  return `TCC-GL-${type}-${String(num).padStart(8, "0")}`;
}