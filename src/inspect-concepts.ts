export type InspectConcept = 'structure' | 'fair-value-gap';
export const INSPECT_CONCEPTS = [
  { id: 'structure', name: 'Market Structure', description: 'Swing levels · BOS · CHOCH' },
  { id: 'fair-value-gap', name: 'Fair Value Gaps', description: 'Imbalance zones · midpoint · fills' },
] as const;
export const conceptName = (id: InspectConcept) => INSPECT_CONCEPTS.find(c => c.id === id)!.name;
export const FVG_SOURCE = 'https://www.luxalgo.com/library/concept/fair-value-gap/';
