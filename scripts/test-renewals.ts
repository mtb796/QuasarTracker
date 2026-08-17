/**
 * Tests for renewal milestone maths.
 *
 * This logic decides when a rent-increase notice must go out. An off-by-one
 * here is silent and expensive, so the boundaries are pinned explicitly.
 *
 *   npm run test:renewals
 */
import { currentWindow, daysUntil, startOfDay, stepState } from "../src/lib/renewal-rules";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok ? "" : ` — got ${actual}, want ${expected}`}`);
}

const pending = (milestone: number) => ({ milestone, status: "pending" });

console.log("\n— daysUntil counts calendar days —");
const noon = new Date("2026-03-10T12:00:00");
check("same day is 0", daysUntil(new Date("2026-03-10T23:30:00"), noon), 0);
check("tomorrow is 1", daysUntil(new Date("2026-03-11T00:30:00"), noon), 1);
check("yesterday is -1", daysUntil(new Date("2026-03-09T23:00:00"), noon), -1);
check("late-evening now still counts whole days", daysUntil(new Date("2026-03-20T01:00:00"), new Date("2026-03-10T23:59:00")), 10);
// Spring-forward in most US zones is 2026-03-08; a 23-hour day must not shift the count.
check("DST boundary does not shift the count", daysUntil(new Date("2026-03-09T00:00:00"), new Date("2026-03-07T00:00:00")), 2);

console.log("\n— each milestone opens exactly on its day —");
check("150 not yet at 151 out", stepState(pending(150), 151), "upcoming");
check("150 opens at 150 out", stepState(pending(150), 150), "due");
check("150 still due at 121", stepState(pending(150), 121), "due");
check("120 not yet at 121 out", stepState(pending(120), 121), "upcoming");
check("120 opens at 120 out", stepState(pending(120), 120), "due");
check("100 opens at 100 out", stepState(pending(100), 100), "due");
check("90 not yet at 91 out", stepState(pending(90), 91), "upcoming");

console.log("\n— a missed window goes late once the next one opens —");
check("150 goes late at 120 out", stepState(pending(150), 120), "late");
check("150 still late at 95", stepState(pending(150), 95), "late");
check("120 goes late at 100 out", stepState(pending(120), 100), "late");
check("100 goes late at 90 out", stepState(pending(100), 90), "late");

console.log("\n— 90 is the hard line: critical the moment it lands —");
check("90 is critical at exactly 90", stepState(pending(90), 90), "critical");
check("90 stays critical at 45", stepState(pending(90), 45), "critical");
check("90 stays critical at 1 day out", stepState(pending(90), 1), "critical");
check("90 critical on the day itself", stepState(pending(90), 0), "critical");

console.log("\n— expired and completed —");
check("pending step on an ended lease is expired", stepState(pending(90), -1), "expired");
check("150 on an ended lease is expired", stepState(pending(150), -5), "expired");
check("done stays done past the line", stepState({ milestone: 90, status: "done" }, 10), "done");
check("done stays done after expiry", stepState({ milestone: 150, status: "done" }, -30), "done");
check("skipped is respected", stepState({ milestone: 120, status: "skipped" }, 5), "skipped");

console.log("\n— current window —");
check("beyond 150 has no window", currentWindow(200), null);
check("exactly 150 enters the 150 window", currentWindow(150), 150);
check("121 is still the 150 window", currentWindow(121), 150);
check("120 enters the 120 window", currentWindow(120), 120);
check("101 is still the 120 window", currentWindow(101), 120);
check("100 enters the 100 window", currentWindow(100), 100);
check("91 is still the 100 window", currentWindow(91), 100);
check("90 enters the hard window", currentWindow(90), 90);
check("0 is the hard window", currentWindow(0), 90);

console.log("\n— startOfDay —");
check("floors to midnight", startOfDay(new Date("2026-03-10T18:45:12")).getHours(), 0);

console.log(failures === 0 ? "\nAll renewal checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
