import { adaptiveGroups, buildSetPlan, createGame, reshuffle, submitGuess, updateStats, validatePuzzle } from "./game.js";
import { applyStaticLanguage, languages, puzzleText, t } from "./i18n.js";
import { readStore, saveGame, saveLanguage, writeStore } from "./storage.js";

const gameRegion = document.querySelector("#game-region");
const statusRegion = document.querySelector("#status-region");
const toast = document.querySelector("#toast");
const helpDialog = document.querySelector("#help-dialog");
const reviewDialog = document.querySelector("#review-dialog");

let store = readStore();
let lang = languages.includes(store.lang) ? store.lang : "en";
let sourcePuzzle = null;
let puzzle = null;
let game = null;
let setPlan = [];
let selected = new Set();
let expanded = new Set();
let isFallback = false;
let toastTimer;
let countdownTimer;

function manilaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function sunMarkup(solved, won) {
  const rays = Array.from({ length: 8 }, (_, index) => {
    const angle = index * 45;
    const lit = index < solved * 2 ? " is-lit" : "";
    return `<rect class="sun-ray${lit}" x="23" y="1" width="4" height="12" rx="2" transform="rotate(${angle} 25 25)"/>`;
  }).join("");
  return `<svg class="sun-svg" viewBox="0 0 50 50" aria-hidden="true">${rays}<circle class="sun-core${won ? " is-lit" : ""}" cx="25" cy="25" r="9"/></svg>`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function renderLanguages() {
  document.querySelectorAll("[data-lang]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.lang === lang)));
}

function gameKey() {
  return sourcePuzzle.date;
}

function groupsForSet(setIndex, streak = store.stats.currentStreak) {
  return adaptiveGroups(sourcePuzzle, setIndex, streak, setPlan);
}

function freshSetGame(setIndex = 0, tokens = 1, solvedBlocks = 0) {
  const groups = groupsForSet(setIndex);
  const active = { id: sourcePuzzle.id, date: sourcePuzzle.date, groups };
  return { ...createGame(active), setIndex, adaptiveStreak: store.stats.currentStreak, groupIds: groups.map((group) => group.id), newSetTokens: tokens, solvedBlocks };
}

function restoreGame() {
  game = store.games[gameKey()] || freshSetGame();
  game = { setIndex: 0, newSetTokens: 1, solvedBlocks: 0, ...game };
  const catalog = sourcePuzzle ? groupsForSet(game.setIndex, game.adaptiveStreak ?? store.stats.currentStreak) : [];
  puzzle = { id: sourcePuzzle.id, date: sourcePuzzle.date, groups: catalog };
  selected.clear();
  expanded.clear();
  if (!store.games[gameKey()]) persistGame();
  renderBoard();
  if (game.status !== "playing") startCountdown();
}

function renderSun() {
  const solved = game?.solvedKeys.length || 0;
  const sun = document.querySelector("#sun");
  sun.innerHTML = sunMarkup(solved, game?.status === "won");
  sun.setAttribute("aria-label", t(lang, "sunProgress", solved));
}

function renderBand(group, revealed = false) {
  const open = expanded.has(group.color);
  return `<article class="band${revealed ? " is-revealed" : ""}" data-color="${group.color}">
    <button class="band-button" type="button" data-band="${group.color}" aria-expanded="${open}">
      <span class="band-name">${escapeHtml(puzzleText(group.name, lang))}${revealed ? ` · ${escapeHtml(t(lang, "revealed"))}` : ""}</span>
      <span class="band-words">${group.words.map(escapeHtml).join(" · ")}</span>
    </button>
    ${open ? `<p class="band-fact"><strong>${escapeHtml(t(lang, "didYouKnow"))}</strong><br>${escapeHtml(puzzleText(group.fact, lang))}</p>` : ""}
  </article>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function renderBoard() {
  const solvedBands = game.solvedKeys.map((key) => renderBand(puzzle.groups.find((group) => group.color === key))).join("");
  const revealedBands = game.status === "lost"
    ? puzzle.groups.filter((group) => !game.solvedKeys.includes(group.color)).sort((a, b) => a.difficulty - b.difficulty).map((group) => renderBand(group, true)).join("")
    : "";
  const tiles = game.status === "playing" ? `<div class="tile-grid" aria-label="Puzzle tiles">${game.remainingWords.map((word) => `
    <button class="tile" type="button" data-word="${escapeHtml(word)}" aria-pressed="${selected.has(word)}">${escapeHtml(word)}</button>`).join("")}</div>` : "";

  statusRegion.innerHTML = `<div class="mistakes"><span>${escapeHtml(t(lang, "mistakes"))}</span><span class="mistake-dots" aria-label="${game.mistakes} ${escapeHtml(t(lang, "mistakes"))}">${Array.from({ length: 4 }, (_, index) => `<i class="mistake-dot${index < game.mistakes ? " is-lost" : ""}" aria-hidden="true"></i>`).join("")}</span></div>`;
  gameRegion.innerHTML = `<div class="bands">${solvedBands}${revealedBands}</div>${tiles}${game.status === "playing" ? `
    <div class="controls">
      <button class="secondary-button" id="shuffle" type="button">${escapeHtml(t(lang, "shuffle"))}</button>
      <button class="secondary-button" id="deselect" type="button">${escapeHtml(t(lang, "deselect"))}</button>
      <button class="primary-button" id="submit" type="button" ${selected.size === 4 ? "" : "disabled"}>${escapeHtml(t(lang, "submit"))}</button>
    </div>
    <button class="new-set-button" id="new-set" type="button" ${game.newSetTokens > 0 ? "" : "disabled"}>${escapeHtml(t(lang, "newSet"))} · <span>${game.newSetTokens} ${escapeHtml(t(lang, "setTokens"))}</span></button>
    <button class="review-button" id="open-review" type="button">${escapeHtml(t(lang, "reportLink"))}</button>` : renderEndPanel()}`;
  renderSun();
}

function renderEndPanel() {
  const win = game.status === "won";
  return `<section class="end-panel">
    <h2>${escapeHtml(t(lang, win ? "won" : "lost"))}</h2>
    <div class="result-grid" aria-label="Share grid">${game.guesses.map((guess) => `<div>${guess.join("")}</div>`).join("")}</div>
    <div class="stats">
      <div class="stat"><strong>${store.stats.played}</strong><span>${escapeHtml(t(lang, "played"))}</span></div>
      <div class="stat"><strong>${store.stats.won}</strong><span>${escapeHtml(t(lang, "wins"))}</span></div>
      <div class="stat"><strong>${store.stats.currentStreak}</strong><span>${escapeHtml(t(lang, "streak"))}</span></div>
    </div>
    <button class="share-button" id="share" type="button">${escapeHtml(t(lang, "share"))}</button>
    ${game.newSetTokens > 0 ? `<button class="new-set-button" id="new-set" type="button">${escapeHtml(t(lang, "newSet"))} · <span>${game.newSetTokens} ${escapeHtml(t(lang, "setTokens"))}</span></button>` : ""}
    <button class="review-button" id="open-review" type="button">${escapeHtml(t(lang, "reportLink"))}</button>
    <p class="countdown"><span>${escapeHtml(t(lang, "nextPuzzle"))}</span> <strong id="countdown">--:--:--</strong></p>
  </section>`;
}

function renderUnavailable(latestDate) {
  sourcePuzzle = null;
  puzzle = null;
  game = null;
  renderSun();
  statusRegion.innerHTML = "";
  gameRegion.innerHTML = `<section class="empty-state"><h2>${escapeHtml(t(lang, "unavailable"))}</h2><p>${escapeHtml(t(lang, "unavailableBody"))}</p>${latestDate ? `<button class="fallback-button" data-fallback="${latestDate}" type="button">${escapeHtml(t(lang, "playLatest"))}</button>` : ""}</section>`;
}

function persistGame() {
  store = saveGame(store, gameKey(), game);
}

function finishIfNeeded(previousStatus) {
  if (previousStatus === "playing" && game.status !== "playing" && !isFallback) {
    store = { ...store, stats: updateStats(store.stats, game.status, puzzle.date) };
    writeStore(store);
  }
}

function onTile(word) {
  if (selected.has(word)) selected.delete(word);
  else if (selected.size < 4) selected.add(word);
  renderBoard();
}

function onSubmit() {
  const previousStatus = game.status;
  const previousSolved = game.solvedKeys.length;
  const outcome = submitGuess(puzzle, game, [...selected]);
  game = outcome.game;
  if (game.solvedKeys.length > previousSolved) {
    const solvedBlocks = game.solvedBlocks + 1;
    const earned = solvedBlocks % 2 === 0;
    game = { ...game, solvedBlocks, newSetTokens: game.newSetTokens + (earned ? 1 : 0) };
    if (earned) setTimeout(() => showToast(t(lang, "earnedSet")), 120);
  }
  selected.clear();
  persistGame();
  finishIfNeeded(previousStatus);
  renderBoard();
  if (outcome.result === "oneAway") showToast(t(lang, "oneAway"));
  if (outcome.result === "incorrect") showToast(t(lang, "incorrect"));
  if (game.status !== "playing") startCountdown();
}

function loadNewSet() {
  if (game.newSetTokens < 1) return;
  const nextIndex = (game.setIndex + 1) % 1000;
  const tokens = game.newSetTokens - 1;
  const solvedBlocks = game.solvedBlocks;
  game = { ...freshSetGame(nextIndex, tokens, solvedBlocks), adaptiveStreak: store.stats.currentStreak };
  puzzle = { id: sourcePuzzle.id, date: sourcePuzzle.date, groups: groupsForSet(nextIndex) };
  selected.clear();
  expanded.clear();
  persistGame();
  renderBoard();
}

function toggleBand(key) {
  expanded.has(key) ? expanded.delete(key) : expanded.add(key);
  renderBoard();
}

function shareText() {
  const symbol = game.status === "won" ? "☀️" : "🌑";
  const streak = store.stats.currentStreak >= 2 ? ` 🔥 ${store.stats.currentStreak}` : "";
  return `SAYSAY ${t(lang, "number")} ${puzzle.id} · Set ${game.setIndex + 1} ${symbol}${streak}\n${game.guesses.map((guess) => guess.join("")).join("\n")}\n\nsaysay.ph`;
}

async function shareResults() {
  const text = shareText();
  try {
    if (navigator.share) await navigator.share({ title: t(lang, "shareTitle"), text });
    else {
      await navigator.clipboard.writeText(text);
      showToast(t(lang, "copied"));
    }
  } catch (error) {
    if (error?.name !== "AbortError") showToast(t(lang, "shareFailed"));
  }
}

function openReview() {
  const select = document.querySelector("#review-group");
  select.innerHTML = `<option value="">${escapeHtml(t(lang, "wholeSet"))}</option>${puzzle.groups.map((group) => `<option value="${escapeHtml(puzzleText(group.name, lang))}">${escapeHtml(puzzleText(group.name, lang))}</option>`).join("")}`;
  reviewDialog.showModal();
}

async function submitReview(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const text = `SAYSAY content review\nPuzzle ${puzzle.id}, set ${game.setIndex + 1}\nGroup: ${data.get("group") || "Whole set / other"}\n\n${data.get("message")}\n${data.get("source") ? `\nSource: ${data.get("source")}` : ""}`;
  try {
    if (navigator.share) await navigator.share({ title: "SAYSAY content review", text });
    else { await navigator.clipboard.writeText(text); showToast(t(lang, "reportCopied")); }
    reviewDialog.close();
    event.currentTarget.reset();
  } catch (error) {
    if (error?.name !== "AbortError") showToast(t(lang, "shareFailed"));
  }
}

function startCountdown() {
  clearInterval(countdownTimer);
  const update = () => {
    const targetText = `${manilaDate(new Date(Date.now() + 86400000))}T00:00:00+08:00`;
    const remaining = Math.max(0, new Date(targetText).getTime() - Date.now());
    const hours = String(Math.floor(remaining / 3600000)).padStart(2, "0");
    const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, "0");
    const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");
    const node = document.querySelector("#countdown");
    if (node) node.textContent = `${hours}:${minutes}:${seconds}`;
  };
  update();
  countdownTimer = setInterval(update, 1000);
}

async function fetchPuzzle(date, fallback = false) {
  const response = await fetch(`puzzles/${date}.json`);
  if (!response.ok) throw new Error("Puzzle unavailable");
  const candidate = await response.json();
  if (!validatePuzzle(candidate, date)) throw new Error("Invalid puzzle");
  sourcePuzzle = candidate;
  setPlan = buildSetPlan(sourcePuzzle, 1000);
  isFallback = fallback;
  restoreGame();
}

async function loadToday() {
  statusRegion.innerHTML = "";
  gameRegion.innerHTML = `<p class="loading">${escapeHtml(t(lang, "loading"))}</p>`;
  const today = manilaDate();
  try {
    await fetchPuzzle(today);
  } catch {
    try {
      const response = await fetch("puzzles/index.json");
      const manifest = await response.json();
      const latest = manifest.puzzles.filter((entry) => !entry.draft && entry.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
      renderUnavailable(latest?.date);
    } catch {
      renderUnavailable(null);
    }
  }
}

document.addEventListener("click", async (event) => {
  const languageButton = event.target.closest("[data-lang]");
  if (languageButton) {
    lang = languageButton.dataset.lang;
    store = saveLanguage(store, lang);
    applyStaticLanguage(lang);
    renderLanguages();
    if (game) renderBoard();
    return;
  }
  const tile = event.target.closest("[data-word]");
  if (tile) return onTile(tile.dataset.word);
  const band = event.target.closest("[data-band]");
  if (band) return toggleBand(band.dataset.band);
  if (event.target.closest("#shuffle")) { game = reshuffle(game); selected.clear(); persistGame(); renderBoard(); return; }
  if (event.target.closest("#deselect")) { selected.clear(); renderBoard(); return; }
  if (event.target.closest("#submit")) return onSubmit();
  if (event.target.closest("#new-set")) return loadNewSet();
  if (event.target.closest("#share")) return shareResults();
  if (event.target.closest("#open-review")) return openReview();
  if (event.target.closest("[data-close-review]")) return reviewDialog.close();
  const fallback = event.target.closest("[data-fallback]");
  if (fallback) await fetchPuzzle(fallback.dataset.fallback, true);
});

document.querySelector("#help-button").addEventListener("click", () => helpDialog.showModal());
document.querySelector("#review-form").addEventListener("submit", submitReview);
applyStaticLanguage(lang);
renderLanguages();
renderSun();
loadToday();

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
