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
  const extra = puzzle.extraGroups ?? [];
  const validExtra = Array.isArray(extra) && extra.length % 4 === 0
    && extra.every((group) => group.words?.length === 4 && new Set(group.words).size === 4
      && group.name?.en && group.fact?.en && LEVEL_RANK[group.level] !== undefined);
  return validExtra && ["easy", "medium", "hard"].every((level) => validLevel(puzzle.levels[level]) && validLevel(puzzle.bonusLevels?.[level]));
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
  (puzzle.extraGroups || []).forEach((group, index) => {
    catalog.push({ ...group, id: `extra-${index}`, rank: LEVEL_RANK[group.level] });
  });
  return catalog;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSetPlan(puzzle, count = 1000) {
  const catalog = buildGroupCatalog(puzzle);
  const candidates = [];
  const pushCandidate = (groups) => {
    if (new Set(groups.flatMap((group) => group.words)).size !== 16) return;
    candidates.push({ ids: groups.map((group) => group.id), score: groups.reduce((sum, group) => sum + group.rank, 0) });
  };
  if (catalog.length <= 32) {
    for (let a = 0; a < catalog.length - 3; a += 1) {
      for (let b = a + 1; b < catalog.length - 2; b += 1) {
        for (let c = b + 1; c < catalog.length - 1; c += 1) {
          for (let d = c + 1; d < catalog.length; d += 1) {
            pushCandidate([catalog[a], catalog[b], catalog[c], catalog[d]]);
          }
        }
      }
    }
  } else {
    // Enumerating every combination of a large bank is too slow on load, so draw a
    // deterministic sample instead. The seed is fixed, so every device builds the
    // same plan for the same puzzle.
    const random = mulberry32(catalog.length * 2654435761 + count);
    const seen = new Set();
    const target = count * 4;
    for (let attempt = 0; attempt < target * 40 && candidates.length < target; attempt += 1) {
      const picks = new Set();
      while (picks.size < 4) picks.add(Math.floor(random() * catalog.length));
      const indices = [...picks].sort((left, right) => left - right);
      const key = indices.join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      pushCandidate(indices.map((index) => catalog[index]));
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
  const usedSetKeys = history.usedSetKeys || [];
  const usedKeySet = new Set(usedSetKeys);
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
  const wordsOf = (ids) => ids.flatMap((id) => byId.get(id).words);
  const valid = (ids, usedGroups, excluded) => !usedKeySet.has(setKey(ids))
    && ids.every((id) => !usedGroups.has(id))
    && wordsOf(ids).every((word) => !excluded.has(word));

  // Whether the given unused groups can still be dealt out as full word-valid
  // boards, so a pick never strands conflicting groups together.
  const partitionMemo = new Map();
  const canPartition = (pool) => {
    if (pool.length === 0) return true;
    if (pool.length % 4) return true;
    const memoKey = pool.join(",");
    if (partitionMemo.has(memoKey)) return partitionMemo.get(memoKey);
    const [head, ...rest] = pool;
    let ok = false;
    for (let a = 0; a < rest.length - 2 && !ok; a += 1) {
      for (let b = a + 1; b < rest.length - 1 && !ok; b += 1) {
        for (let c = b + 1; c < rest.length && !ok; c += 1) {
          if (new Set(wordsOf([head, rest[a], rest[b], rest[c]])).size !== 16) continue;
          ok = canPartition(rest.filter((_, index) => index !== a && index !== b && index !== c));
        }
      }
    }
    partitionMemo.set(memoKey, ok);
    return ok;
  };

  const poolWithout = (usedGroups, ids) => catalog.filter((group) => !usedGroups.has(group.id) && !ids.includes(group.id)).map((group) => group.id);

  // Exhaustive search over every combination of unused groups, so a conflict-free
  // board is found whenever one exists even if the sampled plan missed it. Groups
  // carrying an excluded word can never appear in a fitting board, so they are
  // dropped before combinations are enumerated.
  const searchPool = (usedGroups, excluded, fits) => {
    const pool = catalog
      .filter((group) => !usedGroups.has(group.id) && group.words.every((word) => !excluded.has(word)))
      .map((group) => group.id);
    for (let a = 0; a < pool.length - 3; a += 1) {
      for (let b = a + 1; b < pool.length - 2; b += 1) {
        for (let c = b + 1; c < pool.length - 1; c += 1) {
          for (let d = c + 1; d < pool.length; d += 1) {
            const ids = [pool[a], pool[b], pool[c], pool[d]];
            if (new Set(wordsOf(ids)).size === 16 && fits(ids)) return ids;
          }
        }
      }
    }
    return null;
  };

  // Never repeat a dealt group; on top of that, avoid every word from survived
  // sets. Constraints relax in priority order: survived-word history drops
  // oldest-first, then the partition lookahead, and dealt groups are forgiven
  // (oldest boards first) only once the bank is truly exhausted.
  let ids = null;
  for (let dropKeys = 0; !ids && dropKeys <= usedSetKeys.length; dropKeys += 1) {
    const usedGroups = new Set(usedSetKeys.slice(dropKeys).flatMap((key) => key.split("|")));
    for (const lookahead of [true, false]) {
      for (let dropWords = 0; !ids && dropWords <= survivedWordSets.length; dropWords += 1) {
        const excluded = new Set(survivedWordSets.slice(dropWords).flat());
        const fits = (candidate) => valid(candidate, usedGroups, excluded)
          && (!lookahead || canPartition(poolWithout(usedGroups, candidate)));
        ids = candidates.find(fits) || searchPool(usedGroups, excluded, fits);
      }
      if (ids) break;
    }
  }
  ids = ids || plan[start + offset];
  return ids.map((id, index) => ({ ...byId.get(id), difficulty: index + 1, color: GROUP_ORDER[index] }));
}
