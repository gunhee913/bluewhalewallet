const npcPositions = new Map<string, { x: number; y: number; z: number }>();

export function updateNPCPosition(id: string, x: number, y: number, z: number) {
  npcPositions.set(id, { x, y, z });
}

export function getNPCPosition(id: string) {
  return npcPositions.get(id);
}

export function removeNPCPosition(id: string) {
  npcPositions.delete(id);
}

export function clearNPCPositions() {
  npcPositions.clear();
}
