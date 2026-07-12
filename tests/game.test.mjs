import assert from "node:assert/strict";
import { adaptiveGroups, buildSetPlan, createGame, classifyGuess, groupsFromIds, guessEmojis, setKey, submitGuess, updateStats, validatePuzzle } from "../js/game.js";
import { readFile } from "node:fs/promises";

const puzzle = JSON.parse(await readFile(new URL("../puzzles/2026-07-11.json", import.meta.url)));
assert.equal(validatePuzzle(puzzle, "2026-07-11"), true);
const plan = buildSetPlan(puzzle, 1000);
assert.equal(plan.length, 1000);
assert.equal(new Set(plan.map((ids) => [...ids].sort().join("|"))).size, 1000);
for (const streak of [0, 3, 6]) {
  const groups = adaptiveGroups(puzzle, 17, streak, plan);
  assert.equal(groups.length, 4);
  assert.equal(new Set(groups.flatMap((group) => group.words)).size, 16);
}
const rank = (groups) => groups.reduce((sum, group) => sum + group.rank, 0);
assert.ok(rank(adaptiveGroups(puzzle, 17, 0, plan)) <= rank(adaptiveGroups(puzzle, 17, 3, plan)));
assert.ok(rank(adaptiveGroups(puzzle, 17, 3, plan)) <= rank(adaptiveGroups(puzzle, 17, 6, plan)));

// A survived set's 16 words never appear in the next set, and no set key ever repeats.
for (const streak of [0, 3, 6]) {
  let survivedWords = [];
  const usedSetKeys = [];
  for (let round = 0; round < 6; round += 1) {
    const groups = adaptiveGroups(puzzle, round, streak, plan, { excludedWords: survivedWords, usedSetKeys });
    const words = groups.flatMap((group) => group.words);
    assert.equal(new Set(words).size, 16);
    assert.ok(words.every((word) => !survivedWords.includes(word)), `round ${round} repeats a survived word`);
    const key = setKey(groups.map((group) => group.id));
    assert.ok(!usedSetKeys.includes(key), `round ${round} repeats set ${key}`);
    usedSetKeys.push(key);
    survivedWords = words;
  }
}

// Even when every word is excluded, selection degrades gracefully to an unseen set.
const allWords = [...Object.values(puzzle.levels), ...Object.values(puzzle.bonusLevels)].flat().flatMap((group) => group.words);
const seenKeys = [];
for (let round = 0; round < 3; round += 1) {
  const groups = adaptiveGroups(puzzle, 0, 0, plan, { excludedWords: allWords, usedSetKeys: seenKeys });
  assert.equal(groups.length, 4);
  const key = setKey(groups.map((group) => group.id));
  assert.ok(!seenKeys.includes(key));
  seenKeys.push(key);
}

// Stored group ids restore the identical board.
const chosen = adaptiveGroups(puzzle, 17, 0, plan);
const restored = groupsFromIds(puzzle, chosen.map((group) => group.id));
assert.deepEqual(restored, chosen);
assert.equal(groupsFromIds(puzzle, ["levels-easy-0", "missing", "levels-easy-1", "levels-easy-2"]), null);

const activePuzzle = { id: puzzle.id, date: puzzle.date, groups: puzzle.levels.easy };

const game = createGame(activePuzzle, () => 0.5);
assert.equal(game.remainingWords.length, 16);
assert.equal(new Set(game.remainingWords).size, 16);
assert.equal(classifyGuess(activePuzzle, activePuzzle.groups[0].words).kind, "correct");
assert.equal(classifyGuess(activePuzzle, [...activePuzzle.groups[0].words.slice(0, 3), activePuzzle.groups[1].words[0]]).kind, "oneAway");
assert.deepEqual(guessEmojis(activePuzzle, [activePuzzle.groups[3].words[0], activePuzzle.groups[0].words[0], activePuzzle.groups[2].words[0], activePuzzle.groups[1].words[0]]), ["🟨", "🟩", "🟦", "🟪"]);

let state = game;
for (const group of activePuzzle.groups) state = submitGuess(activePuzzle, state, group.words).game;
assert.equal(state.status, "won");
assert.equal(state.solvedKeys.length, 4);

const initialStats = { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastWonDate: null, lastPlayedDate: null };
const firstWin = updateStats(initialStats, "won", "2026-07-10");
const secondWin = updateStats(firstWin, "won", "2026-07-11");
assert.equal(secondWin.currentStreak, 2);
assert.equal(updateStats(secondWin, "lost", "2026-07-12").currentStreak, 0);

console.log("game tests passed");
