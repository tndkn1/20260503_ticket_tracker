let seq = 0;

export function generateId(): string {
  const now = Date.now();
  seq = (seq + 1) % 10000;
  return `INC-${now}-${String(seq).padStart(4, "0")}`;
}

export function shortId(id: string): string {
  // "INC-1234567890123-0001" -> "INC-0001"
  const parts = id.split("-");
  return `INC-${parts[parts.length - 1]}`;
}
