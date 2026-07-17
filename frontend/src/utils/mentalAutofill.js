// Derives a real, non-fabricated starting answer for the mental questionnaire's
// "How would you describe your drinking habits?" (substance_concern) question
// from the Lifestyle section's already-answered drinking + smoking/tobacco
// questions — both map to the same real-world "substance use" signal, so
// asking a third time from scratch is redundant. This only pre-fills the
// choice; the question itself still shows and stays fully user-editable, so
// nothing is ever silently assumed on a self-report psychological field.
// Keys match LIFESTYLE_DRINKING's `val`s exactly (lowercased) — see
// lifestyleOptions.js. 'quit' ranks alongside 'never' (0): this question
// measures *current* substance-use concern for the relationship, and someone
// who has stopped drinking isn't a current user, same reasoning as the
// chronic-risk LR fix in chronic.controller.js. 'occasionally'/'frequently'
// replace the old 3-tier 'socially'/'regularly'/'heavily' split; 'frequently'
// alone reaching rank 2 (-> 'Elevated' below) matches the old behavior,
// since 'regularly' and 'heavily' both already collapsed into the same
// combined>=2 'Elevated' branch.
const DRINKING_RANK = { never: 0, quit: 0, occasionally: 1, frequently: 2 };
// Keys match LIFESTYLE_SMOKING_TOBACCO's `val`s exactly (lowercased) — see
// lifestyleOptions.js. Same 'quit' ranks with 'never' (0) reasoning as
// DRINKING_RANK above. 'occasionally'/'regularly' replace the old lowercase
// 'occasion'/'regular'/'chain' set; 'regularly' alone reaching rank 2 (->
// 'Elevated' below) matches the old behavior, since 'regular' and 'chain'
// both already collapsed into the same combined>=2 'Elevated' branch.
const SMOKING_RANK = { never: 0, quit: 0, occasionally: 1, regularly: 2 };

export function deriveSubstanceConcern(drinkingHabits, smokingTobaccoHabits) {
  const dRank = DRINKING_RANK[(drinkingHabits || '').toLowerCase()];
  const sRank = SMOKING_RANK[(smokingTobaccoHabits || '').toLowerCase()];
  if (dRank === undefined && sRank === undefined) return null;

  const combined = Math.max(dRank ?? 0, sRank ?? 0);
  if (combined === 0) return 'Low';
  if (combined === 1) return 'Moderate';
  return 'Elevated';
}
