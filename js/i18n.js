export const languages = ["en", "tl"];

const strings = {
  en: {
    tagline: "Daily Filipino History Puzzle", dailyGame: "One puzzle every day", aboutTitle: "Find the stories that connect us.",
    aboutBody: "Group sixteen people, places, and ideas from Philippine history into four hidden connections.", howToPlay: "How to play",
    howOne: "Select four related tiles.", howTwo: "Submit your connection.", howThree: "Solve all groups before four mistakes.",
    loading: "Preparing today’s puzzle…", mistakes: "Mistakes", shuffle: "Shuffle", deselect: "Deselect", submit: "Submit",
    oneAway: "One away!", incorrect: "Not quite", won: "You solved it!", lost: "Better luck tomorrow", didYouKnow: "Did you know?",
    played: "Played", wins: "Won", streak: "Streak", share: "Share results", copied: "Copied!", shareFailed: "Couldn’t share results",
    nextPuzzle: "Next puzzle in", unavailable: "Today’s puzzle isn’t ready yet", unavailableBody: "Come back soon, or play the latest available puzzle.",
    playLatest: "Play latest puzzle", revealed: "Revealed", sunProgress: (count) => `${count} of 4 groups solved`, number: "No.", shareTitle: "SAYSAY result",
    newSet: "New full set", setTokens: "tries", earnedSet: "+1 new-set try earned!", noSets: "No other set is available yet",
    reportLink: "Report inaccurate information", reportTitle: "Report an inaccuracy", reportIntro: "Tell us what may be inaccurate and, if possible, include a reliable source.",
    reportGroup: "Related group", wholeSet: "Whole set / other", reportMessage: "What should we review?", reportSource: "Source link (optional)", sendReport: "Share report", reportCopied: "Report copied!",
  },
  tl: {
    tagline: "Araw-araw na Palaisipan sa Kasaysayang Pilipino", dailyGame: "Isang palaisipan bawat araw", aboutTitle: "Hanapin ang mga kuwentong nag-uugnay sa atin.",
    aboutBody: "Pangkatin ang labing-anim na tao, lugar, at ideya mula sa kasaysayan ng Pilipinas sa apat na nakatagong ugnayan.", howToPlay: "Paano laruin",
    howOne: "Pumili ng apat na magkaugnay na tile.", howTwo: "Ipasa ang iyong sagot.", howThree: "Buuin ang lahat bago ang apat na pagkakamali.",
    loading: "Inihahanda ang palaisipan ngayong araw…", mistakes: "Mali", shuffle: "Haluin", deselect: "Alisin", submit: "Ipasa",
    oneAway: "Isa na lang!", incorrect: "Hindi pa", won: "Nakuha mo!", lost: "Bawi bukas", didYouKnow: "Alam mo ba?",
    played: "Nilaro", wins: "Panalo", streak: "Sunod", share: "Ibahagi", copied: "Nakopya!", shareFailed: "Hindi maibahagi",
    nextPuzzle: "Susunod na palaisipan sa", unavailable: "Hindi pa handa ang palaisipan ngayong araw", unavailableBody: "Bumalik mamaya, o laruin ang pinakabagong palaisipan.",
    playLatest: "Laruin ang pinakabago", revealed: "Ipinakita", sunProgress: (count) => `${count} sa 4 na pangkat ang nabuo`, number: "Blg.", shareTitle: "Resulta sa SAYSAY",
    newSet: "Bagong buong set", setTokens: "subok", earnedSet: "+1 subok para sa bagong set!", noSets: "Wala pang ibang set",
    reportLink: "Iulat ang maling impormasyon", reportTitle: "Mag-ulat ng kamalian", reportIntro: "Sabihin kung ano ang maaaring mali at magbigay ng mapagkakatiwalaang sanggunian kung mayroon.",
    reportGroup: "Kaugnay na pangkat", wholeSet: "Buong set / iba pa", reportMessage: "Ano ang dapat naming suriin?", reportSource: "Link ng sanggunian (opsyonal)", sendReport: "Ibahagi ang ulat", reportCopied: "Nakopya ang ulat!",
  },
};

export function t(lang, key, ...args) {
  const value = strings[lang]?.[key] ?? strings.tl[key] ?? strings.en[key] ?? key;
  return typeof value === "function" ? value(...args) : value;
}

export function puzzleText(value, lang) {
  return value?.[lang] || value?.tl || value?.en || "";
}

export function applyStaticLanguage(lang, root = document) {
  root.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(lang, element.dataset.i18n); });
  document.documentElement.lang = lang === "tl" ? "fil" : lang;
}
