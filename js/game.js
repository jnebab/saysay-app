export const EMOJI = { g1: "🟨", g2: "🟩", g3: "🟦", g4: "🟪" };
export const GROUP_ORDER = ["g1", "g2", "g3", "g4"];
const LEVEL_RANK = { easy: 0, medium: 1, hard: 2 };

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createGame(puzzle, random = Math.random) {
  return {
    status: "playing",
    mistakes: 0,
    guesses: [],
    solvedKeys: [],
    remainingWords: shuffle(puzzle.groups.flatMap((group) => group.words), random),
  };
}

export function groupForWord(puzzle, word) {
  return puzzle.groups.find((group) => group.words.includes(word));
}

export function classifyGuess(puzzle, selectedWords) {
  if (selectedWords.length !== 4) return { kind: "invalid", group: null };
  const counts = new Map();
  selectedWords.forEach((word) => {
    const group = groupForWord(puzzle, word);
    if (group) counts.set(group.color, (counts.get(group.color) || 0) + 1);
  });
  const match = [...counts.entries()].find(([, count]) => count === 4);
  if (match) return { kind: "correct", group: puzzle.groups.find((group) => group.color === match[0]) };
  return { kind: [...counts.values()].includes(3) ? "oneAway" : "incorrect", group: null };
}

export function guessEmojis(puzzle, selectedWords) {
  return selectedWords
    .map((word) => groupForWord(puzzle, word)?.color)
    .filter(Boolean)
    .sort((a, b) => GROUP_ORDER.indexOf(a) - GROUP_ORDER.indexOf(b))
    .map((key) => EMOJI[key]);
}

export function submitGuess(puzzle, game, selectedWords) {
  if (game.status !== "playing" || selectedWords.length !== 4) return { game, result: "invalid" };
  const classification = classifyGuess(puzzle, selectedWords);
  const guesses = [...game.guesses, guessEmojis(puzzle, selectedWords)];
  let next = { ...game, guesses };

  if (classification.kind === "correct") {
    const key = classification.group.color;
    const solvedKeys = [...game.solvedKeys, key];
    next = {
      ...next,
      solvedKeys,
      remainingWords: game.remainingWords.filter((word) => !classification.group.words.includes(word)),
      status: solvedKeys.length === 4 ? "won" : "playing",
    };
  } else {
    const mistakes = game.mistakes + 1;
    next = { ...next, mistakes, status: mistakes >= 4 ? "lost" : "playing" };
  }
  return { game: next, result: classification.kind };
}

export function reshuffle(game, random = Math.random) {
  return game.status === "playing" ? { ...game, remainingWords: shuffle(game.remainingWords, random) } : game;
}

function dateToUtc(date) {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function dayDifference(laterDate, earlierDate) {
  return Math.round((dateToUtc(laterDate) - dateToUtc(earlierDate)) / 86400000);
}

export function updateStats(stats, status, puzzleDate) {
  const current = { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastWonDate: null, lastPlayedDate: null, ...stats };
  if (current.lastPlayedDate === puzzleDate) return current;
  const won = status === "won";
  const streak = won
    ? (current.lastWonDate && dayDifference(puzzleDate, current.lastWonDate) === 1 ? current.currentStreak + 1 : 1)
    : 0;
  return {
    ...current,
    played: current.played + 1,
    won: current.won + (won ? 1 : 0),
    currentStreak: streak,
    maxStreak: Math.max(current.maxStreak, streak),
    lastWonDate: won ? puzzleDate : current.lastWonDate,
    lastPlayedDate: puzzleDate,
  };
}

export function validatePuzzle(puzzle, expectedDate) {
  if (!puzzle || puzzle.date !== expectedDate || !Number.isInteger(puzzle.id) || !puzzle.levels) return false;
  const validLevel = (groups) => {
    if (!Array.isArray(groups) || groups.length !== 4) return false;
    const words = groups.flatMap((group) => group.words || []);
    const colors = groups.map((group) => group.color).sort();
    const difficulties = groups.map((group) => group.difficulty).sort();
    return groups.every((group) => group.words?.length === 4 && group.name?.en && group.fact?.en)
      && words.length === 16 && new Set(words).size === 16
      && colors.join() === GROUP_ORDER.join()
      && difficulties.join() === "1,2,3,4";
  };
  return ["easy", "medium", "hard"].every((level) => validLevel(puzzle.levels[level]) && validLevel(puzzle.bonusLevels?.[level]));
}

export function buildGroupCatalog(puzzle) {
  const catalog = [];
  for (const collection of ["levels", "bonusLevels"]) {
    for (const level of ["easy", "medium", "hard"]) {
      puzzle[collection][level].forEach((group, index) => {
        catalog.push({ ...group, id: `${collection}-${level}-${index}`, rank: LEVEL_RANK[level] });
      });
    }
  }
  return catalog;
}

export function buildSetPlan(puzzle, count = 1000) {
  const catalog = buildGroupCatalog(puzzle);
  const candidates = [];
  for (let a = 0; a < catalog.length - 3; a += 1) {
    for (let b = a + 1; b < catalog.length - 2; b += 1) {
      for (let c = b + 1; c < catalog.length - 1; c += 1) {
        for (let d = c + 1; d < catalog.length; d += 1) {
          const groups = [catalog[a], catalog[b], catalog[c], catalog[d]];
          const words = groups.flatMap((group) => group.words);
          if (new Set(words).size !== 16) continue;
          candidates.push({ ids: groups.map((group) => group.id), score: groups.reduce((sum, group) => sum + group.rank, 0) });
        }
      }
    }
  }
  candidates.sort((left, right) => left.score - right.score || left.ids.join().localeCompare(right.ids.join()));
  if (candidates.length < count) throw new Error(`Only ${candidates.length} valid sets can be generated`);
  return Array.from({ length: count }, (_, index) => candidates[Math.floor(index * (candidates.length - 1) / (count - 1))].ids);
}

export function setKey(ids) {
  return [...ids].sort().join("|");
}

export function groupsFromIds(puzzle, ids) {
  if (!Array.isArray(ids) || ids.length !== 4) return null;
  const byId = new Map(buildGroupCatalog(puzzle).map((group) => [group.id, group]));
  if (!ids.every((id) => byId.has(id))) return null;
  return ids.map((id, index) => ({ ...byId.get(id), difficulty: index + 1, color: GROUP_ORDER[index] }));
}

export function adaptiveGroups(puzzle, setNumber, streak, plan = buildSetPlan(puzzle), history = {}) {
  const catalog = buildGroupCatalog(puzzle);
  const byId = new Map(catalog.map((group) => [group.id, group]));
  const survivedWordSets = history.survivedWordSets || [];
  const usedSetKeys = new Set(history.usedSetKeys || []);
  const tier = Math.min(2, Math.floor(Math.max(0, streak) / 3));
  const start = Math.floor(plan.length * tier / 3);
  const end = Math.floor(plan.length * (tier + 1) / 3);
  const size = Math.max(1, end - start);
  const offset = setNumber % size;
  const order = Array.from({ length: size }, (_, step) => start + (offset + step) % size);
  for (let step = 0; step < plan.length; step += 1) {
    const index = (start + offset + step) % plan.length;
    if (index < start || index >= end) order.push(index);
  }
  const candidates = order.map((index) => plan[index]);
  const unused = (candidate) => !usedSetKeys.has(setKey(candidate));
  const disjoint = (candidate, excluded) => candidate.every((id) => byId.get(id).words.every((word) => !excluded.has(word)));
  let ids = null;
  for (let dropped = 0; !ids && dropped <= survivedWordSets.length; dropped += 1) {
    const excluded = new Set(survivedWordSets.slice(dropped).flat());
    ids = candidates.find((candidate) => unused(candidate) && disjoint(candidate, excluded));
  }
  ids = ids || plan[start + offset];
  return ids.map((id, index) => ({ ...byId.get(id), difficulty: index + 1, color: GROUP_ORDER[index] }));
}
