export function generateId(seq: number): string {
  return `INC-${String(seq).padStart(5, "0")}`;
}

export function shortId(id: string): string {
  return id;
}
