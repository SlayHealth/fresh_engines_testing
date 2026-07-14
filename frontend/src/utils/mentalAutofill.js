// Derives a real, non-fabricated starting answer for the mental questionnaire's
// "How would you describe your drinking habits?" (substance_concern) question
// from the Lifestyle section's already-answered drinking + smoking/tobacco
// questions — both map to the same real-world "substance use" signal, so
// asking a third time from scratch is redundant. This only pre-fills the
// choice; the question itself still shows and stays fully user-editable, so
// nothing is ever silently assumed on a self-report psychological field.
const DRINKING_RANK = { never: 0, socially: 1, regularly: 2, heavily: 3 };
const SMOKING_RANK = { never: 0, occasion: 1, regular: 2, chain: 3 };

export function deriveSubstanceConcern(drinkingHabits, smokingTobaccoHabits) {
  const dRank = DRINKING_RANK[(drinkingHabits || '').toLowerCase()];
  const sRank = SMOKING_RANK[(smokingTobaccoHabits || '').toLowerCase()];
  if (dRank === undefined && sRank === undefined) return null;

  const combined = Math.max(dRank ?? 0, sRank ?? 0);
  if (combined === 0) return 'Low';
  if (combined === 1) return 'Moderate';
  return 'Elevated';
}
