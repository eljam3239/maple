const ADJACENCY: Record<string, string[]> = {
  "British Columbia": ["Alberta", "Yukon", "Northwest Territories"],
  Alberta: ["British Columbia", "Saskatchewan", "Northwest Territories"],
  Saskatchewan: ["Alberta", "Manitoba", "Northwest Territories", "Nunavut"],
  Manitoba: ["Saskatchewan", "Ontario", "Nunavut", "Northwest Territories"],
  Ontario: ["Manitoba", "Quebec", "Nunavut"],
  Quebec: ["Ontario", "New Brunswick", "Newfoundland and Labrador", "Nunavut"],
  "New Brunswick": ["Quebec", "Nova Scotia", "Prince Edward Island"],
  "Nova Scotia": ["New Brunswick", "Prince Edward Island"],
  "Prince Edward Island": ["New Brunswick", "Nova Scotia"],
  "Newfoundland and Labrador": ["Quebec", "Nunavut"],
  Yukon: ["British Columbia", "Northwest Territories"],
  "Northwest Territories": [
    "Yukon",
    "British Columbia",
    "Alberta",
    "Saskatchewan",
    "Manitoba",
    "Nunavut",
  ],
  Nunavut: [
    "Northwest Territories",
    "Saskatchewan",
    "Manitoba",
    "Ontario",
    "Quebec",
    "Newfoundland and Labrador",
  ],
};

export function computeProvinceDistance(from: string, to: string): number {
  if (from === to) return 0;
  const visited = new Set<string>([from]);
  const queue: Array<{ name: string; dist: number }> = [
    { name: from, dist: 0 },
  ];
  while (queue.length) {
    const { name, dist } = queue.shift()!;
    for (const neighbour of ADJACENCY[name] ?? []) {
      if (neighbour === to) return dist + 1;
      if (!visited.has(neighbour)) {
        visited.add(neighbour);
        queue.push({ name: neighbour, dist: dist + 1 });
      }
    }
  }
  return 99;
}
