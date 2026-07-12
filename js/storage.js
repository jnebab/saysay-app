const KEY = "saysay.v1";

const defaults = () => ({
  version: 1,
  lang: "en",
  games: {},
  survivedSets: [],
  stats: { played: 0, won: 0, currentStreak: 0, maxStreak: 0, lastWonDate: null, lastPlayedDate: null },
});

export function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (!parsed || parsed.version !== 1 || typeof parsed.games !== "object" || typeof parsed.stats !== "object") return defaults();
    const store = { ...defaults(), ...parsed };
    if (!Array.isArray(store.survivedSets)) store.survivedSets = [];
    return store;
  } catch {
    return defaults();
  }
}

export function writeStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...store, version: 1 }));
    return true;
  } catch {
    return false;
  }
}

export function saveGame(store, date, game) {
  const next = { ...store, games: { ...store.games, [date]: game } };
  writeStore(next);
  return next;
}

export function recordSurvivedSet(store, words, cap = 12) {
  const survivedSets = [...store.survivedSets, words].slice(-cap);
  const next = { ...store, survivedSets };
  writeStore(next);
  return next;
}

export function saveLanguage(store, lang) {
  const next = { ...store, lang };
  writeStore(next);
  return next;
}
