// Average seconds a person takes to answer one step, calibrated by input
// type — a single tap on a choice card is faster than typing a field,
// searching a city list, or dragging a measurement slider. Upload steps
// aren't "answered" in seconds, so they're excluded from the estimate.
export const SECONDS_BY_KIND = {
  choice: 6,
  field: 14,
  city: 16,
  measurement: 9,
  upload: 0
};
const DEFAULT_STEP_SECONDS = 10;

function roundSeconds(totalSeconds) {
  if (totalSeconds < 60) {
    return { value: Math.max(5, Math.round(totalSeconds / 5) * 5), unit: 'sec' };
  }
  return { value: Math.max(1, Math.round(totalSeconds / 60)), unit: 'min' };
}

export function secondsForSteps(steps) {
  return (steps || []).reduce((sum, s) => sum + (SECONDS_BY_KIND[s?.kind] ?? DEFAULT_STEP_SECONDS), 0);
}

// Plain "N sec" / "N min" for a duration, no framing — the shared basis for
// both the live in-flow countdown below and any static "this section takes
// about..." hint (e.g. category cards), so the two never drift apart the
// way a hand-guessed constant eventually does.
export function formatDuration(totalSeconds) {
  const { value, unit } = roundSeconds(totalSeconds);
  return `${value} ${unit}`;
}

// Live "how much longer" read for a mixed-kind step list (About/Lifestyle mix
// choice/field/measurement/city steps) — recomputed every step so it shrinks
// in real time, framed as a concrete countdown rather than a percentage.
// Exact remaining time reads as less abstract than "80% done" and pulls
// harder the closer the visible finish line gets (the goal-gradient effect).
// The final step gets its own line rather than a trivial "~5 sec left".
export function estimateTimeLeft(remainingSteps) {
  if (!remainingSteps || remainingSteps.length === 0) return null;
  if (remainingSteps.length === 1) return 'Almost there — last one!';
  return `~${formatDuration(secondsForSteps(remainingSteps))} left`;
}

// Same estimate for a uniform-kind block (e.g. mental-health sub-hub cards,
// all single-tap choice questions) where only a remaining *count* is known,
// not a step list. `compact` shortens the copy for tight card real estate.
export function estimateTimeLeftForCount(remainingCount, { kind = 'choice', compact = false } = {}) {
  if (!remainingCount || remainingCount <= 0) return null;
  if (remainingCount === 1) return compact ? 'Last one' : 'Almost there — last one!';
  const { value, unit } = roundSeconds(remainingCount * (SECONDS_BY_KIND[kind] ?? DEFAULT_STEP_SECONDS));
  return compact ? `~${value}${unit === 'sec' ? 's' : 'm'}` : `~${value} ${unit} left`;
}
