import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function page(name: string): string {
  return readFileSync(join(root, name), "utf8");
}

test("scorekeeper copies stay identical", () => {
  assert.equal(page("SHUFL.html"), page("public/index.html"));
});

test("primary flow is one page with on-board scoring", () => {
  const html = page("public/index.html");
  assert.equal(html.includes('class="tabs"'), false);
  assert.equal(html.includes("data-tab="), false);
  assert.equal(html.includes('id="for1"'), false);
  assert.equal(html.includes('id="for2"'), false);
  assert.equal(html.includes(">Team A<"), false);
  assert.equal(html.includes(">Team B<"), false);
  assert.equal(html.split('value="TEAM A"').length - 1, 1);
  assert.equal(html.split('value="TEAM B"').length - 1, 1);
  assert.equal(html.includes('placeholder="TEAM A"'), true);
  assert.equal(html.includes('placeholder="TEAM B"'), true);
  assert.equal(html.includes("this.value || 'Team A'"), false);
  assert.equal(html.includes("this.value || 'Team B'"), false);
  assert.match(html, /state\.names\[0\] = upperName\(this\);/);
  assert.match(html, /state\.names\[1\] = upperName\(this\);/);
  assert.equal(html.includes('data-team="0"'), true);
  assert.equal(html.includes('data-team="1"'), true);
  assert.equal(html.includes('class="score-dock for-p1"'), true);
  assert.equal(html.includes("shuffleboard-scoreboard-v1"), true);
  for (const id of ["btnUndo", "btnEndRound", "btnClearRound", "btnHistory", "btnNewGame", "btnResetGame", "roundLog"]) {
    assert.equal(html.includes(`id="${id}"`), true, id);
  }
  for (const pts of ["1", "2", "3", "4"]) {
    assert.equal(html.includes(`data-pts="${pts}"`), true, pts);
  }
  assert.equal(html.includes('data-pts="5"'), false);
  assert.match(html, /<button type="button" class="zone-btn z4" data-pts="4">\+4<\/button>/);
  assert.equal(/<small>\s*end\s*<\/small>/i.test(html), false);
  assert.equal(html.includes("zone-btn z5"), false);
  assert.equal(/<button[^>]*>\s*Hanger/.test(html), false);
  assert.match(html, /\.zones\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.equal(/\.zones\s*\{[^}]*repeat\(5,/.test(html), false);
  const dockBlocks = html.match(/\.score-dock\s*\{[^}]*\}/g) || [];
  assert.ok(dockBlocks.length >= 1);
  for (const block of dockBlocks) {
    assert.equal(block.includes("position: fixed"), false);
  }
  assert.equal(html.includes("syncDockPad"), false);
  assert.equal(html.includes('src="'), false);
});

test("in-app confirm, team colours, and round cards", () => {
  const html = page("public/index.html");
  assert.equal(/\bconfirm\s*\(/.test(html), false);
  assert.equal(html.includes("window.confirm"), false);
  assert.equal(html.includes('id="confirmModal"'), true);
  assert.equal(html.includes('id="confirmTitle"'), true);
  assert.equal(html.includes('id="confirmMessage"'), true);
  assert.equal(html.includes('id="confirmCancel">Cancel</button>'), true);
  assert.equal(html.includes('id="confirmOk">Confirm</button>'), true);
  assert.equal(html.includes('class="btn neutral" id="btnClearRound"'), true);
  assert.equal(html.includes('class="btn danger" id="btnResetGame"'), true);
  assert.equal(html.includes("btnClearHistory"), false);
  assert.ok(html.indexOf('id="btnNewGame"') < html.indexOf('id="btnResetGame"'));
  assert.ok(html.indexOf('id="btnResetGame"') < html.indexOf('id="targetSeg"'));
  assert.equal(html.includes("round-item"), false);
  assert.equal(html.includes('class="round-card"'), true);
  assert.equal(html.includes("navigator.vibrate"), true);
  assert.equal(html.includes("AudioContext"), true);
  assert.equal(html.includes("playRipple"), true);
  assert.equal(html.includes("#a8324c"), true);
  assert.equal(html.includes("#1f4f96"), true);
  assert.match(html, /\.btn\.neutral\s*\{[^}]*color:\s*#111/);
  assert.match(html, /\.btn\.danger\s*\{[^}]*color:\s*#fff/);
  assert.match(html, /\.btn\.danger\s*\{[^}]*background:\s*#c0392b/);
  assert.match(html, /\.btn\.neutral\s*\{[^}]*background:\s*#9a9a9a/);
});

test("rules button opens an in-app rules modal", () => {
  const html = page("public/index.html");
  assert.equal(html.includes('id="btnRules"'), true);
  assert.match(html, /<header>[\s\S]*id="btnRules"[^>]*>Rules<\/button>[\s\S]*<\/header>/);
  assert.ok(html.indexOf('id="btnRules"') > html.indexOf("<h1>SHUFL</h1>"));
  assert.equal(html.includes('id="rulesModal"'), true);
  assert.equal(html.includes('id="rulesTitle">Rules</h2>'), true);
  assert.equal(html.includes('id="rulesDone">Done</button>'), true);
  assert.equal(html.includes("openRules"), true);
  assert.equal(html.includes("closeRules"), true);
  assert.equal(html.includes('window.alert'), false);
  const rules = [
    "Each player (or team) has 4 weights. Players alternate shots until all 8 have been played. That is one round.",
    "A weight must fully clear the foul line to stay in play. Anything short is removed.",
    "Weights that fall off the table or into the gutter are out for that round.",
    "Only one side scores each round: the side whose weight is closest to the far end.",
    "That side scores every one of its weights that sits farther than the opponent’s farthest weight.",
    "Scoring zones (weight fully past the line, viewed from above):",
    "Zone 1: 1 point",
    "Zone 2: 2 points",
    "Zone 3: 3 points",
    "Zone 4: 4 points",
    "A weight touching a zone line counts as the lower zone.",
    "A hanger (any part hanging over the far end, not the side, without falling) scores +1 on top of that weight’s zone score (e.g. zone 1 hanger = 2; zone 4 hanger = 5).",
    "After the round is scored, play the next round from the other end.",
    "First to the agreed total (usually 15 or 21) wins.",
    "The hammer is the last weight of the round. Either the round winner keeps it, or the teams take turns.",
  ];
  let cursor = html.indexOf('id="rulesBody"');
  assert.ok(cursor > 0);
  for (const line of rules) {
    const at = html.indexOf(line, cursor);
    assert.ok(at > cursor, line);
    cursor = at + line.length;
  }
  assert.ok(html.indexOf('id="rulesModal"') > html.indexOf('id="confirmModal"'));
  assert.equal(html.includes('id="confirmCancel">Cancel</button>'), true);
  assert.equal(html.includes('id="confirmOk">Confirm</button>'), true);
});

test("coin toss sits left of the banner and only covers the board while it flips", () => {
  const html = page("public/index.html");
  const header = html.slice(html.indexOf("<header>"), html.indexOf("</header>"));
  assert.ok(header.indexOf('id="btnCoinToss"') >= 0);
  assert.ok(header.indexOf('id="btnCoinToss"') < header.indexOf("<h1>SHUFL</h1>"));
  assert.ok(header.indexOf("<h1>SHUFL</h1>") < header.indexOf('id="btnRules"'));
  assert.match(header, />Toss<\/button>/);
  assert.equal(html.includes("Coin Toss"), false);
  assert.match(html, /id="coinOverlay" hidden/);
  assert.match(html, /\.coin-overlay\s*\{[^}]*z-index:\s*140/);
  assert.match(html, /\.coin-overlay\[hidden\]\s*\{\s*display:\s*none !important/);
  assert.match(html, /Math\.random\(\) < 0\.5 \? 'heads' : 'tails'/);
  assert.match(html, /navigator\.vibrate\(16\)/);
  assert.match(html, /coinDismissTimer = setTimeout\(closeCoin, 1200\)/);
  assert.match(html, /if \(!coinSettled\) return;/);
  const tossStart = html.indexOf("function tossCoin()");
  const tossEnd = html.indexOf("$('name1').addEventListener");
  assert.ok(tossStart > 0 && tossEnd > tossStart);
  assert.equal(html.slice(tossStart, tossEnd).includes("noteScoringStarted"), false);
  assert.equal(html.slice(tossStart, tossEnd).includes("setupLocked"), false);
});

test("hammer mode defaults to take turns and can keep the winner", () => {
  const html = page("public/index.html");
  assert.equal(html.includes('id="hammerModeSeg"'), true);
  assert.equal(html.includes('data-hammer-mode="winner"'), true);
  assert.equal(html.includes('data-hammer-mode="turns"'), true);
  assert.match(html, />Winner<\/button>/);
  assert.match(html, />Take Turns<\/button>/);
  assert.match(html, /hammerMode:\s*'turns'/);
  assert.match(html, /hammerMode: state\.hammerMode/);
  assert.match(html, /hammerMode === 'winner' \? 'winner' : 'turns'/);
  const fnStart = html.indexOf("function nextHammer(r0, r1)");
  const fnEnd = html.indexOf("function undo()");
  assert.ok(fnStart > 0 && fnEnd > fnStart);
  const fn = html.slice(fnStart, fnEnd);
  assert.match(fn, /state\.hammerMode === 'winner'/);
  assert.match(fn, /if \(r0 > r1\) return 0;/);
  assert.match(fn, /if \(r1 > r0\) return 1;/);
  assert.match(fn, /return state\.hammer;/);
  assert.match(fn, /return state\.hammer === 0 \? 1 : 0;/);
  assert.match(html, /state\.hammer = nextHammer\(r0, r1\);/);
  assert.ok(html.indexOf('id="hammerModeSeg"') > html.indexOf('id="targetSeg"'));
  assert.ok(html.indexOf('id="hammerModeSeg"') < html.indexOf('id="panel-stats"'));
  const controls = html.slice(html.indexOf('class="row spread controls-row"'), html.indexOf('id="panel-stats"'));
  assert.ok(controls.includes('id="targetSeg"'));
  assert.ok(controls.includes('id="hammerModeSeg"'));
  assert.equal(controls.includes("hammer-mode-row"), false);
  assert.match(html, /\.controls-row\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(html, /@media \(max-width: 340px\)[\s\S]*\.controls-row\s*\{[^}]*flex-wrap:\s*wrap/);
});

test("round cards call out hanger bonuses apart from zone points", () => {
  const html = page("public/index.html");
  assert.match(html, /<button type="button" class="zone-btn z1" data-pts="1">\+1<\/button>/);
  assert.equal((html.match(/data-hanger=/g) || []).length, 0);
  assert.match(html, /roundHangers:\s*\[0,\s*0\]/);
  assert.match(html, /roundHangers: state\.roundHangers/);
  assert.match(html, /state\.roundHangers = normalizePair\(data\.current\.roundHangers\)/);
  assert.match(html, /b\.hasAttribute\('data-hanger'\)/);

  const addStart = html.indexOf("function addPoints(pts, hanger)");
  const addEnd = html.indexOf("function clearRound");
  assert.ok(addStart > 0 && addEnd > addStart);
  const add = html.slice(addStart, addEnd);
  assert.match(add, /if \(hanger && pts > 0\) state\.roundHangers\[who\] \+= pts;/);
  assert.match(add, /hanger: !!\(hanger && pts > 0\)/);
  assert.match(add, /if \(pts > 0\) noteScoringStarted\(\);/);

  const clearStart = html.indexOf("function clearRound");
  const clearEnd = html.indexOf("function endRound()");
  const clear = html.slice(clearStart, clearEnd);
  assert.match(clear, /prevHangers: state\.roundHangers\.slice\(\)/);
  assert.match(clear, /state\.roundHangers = \[0, 0\]/);

  const endStart = html.indexOf("function endRound()");
  const endEnd = html.indexOf("function nextHammer");
  const end = html.slice(endStart, endEnd);
  assert.match(end, /hangers: \[h0, h1\]/);
  assert.match(end, /state\.roundHangers = \[0, 0\]/);

  const undoStart = html.indexOf("function undo()");
  const undoEnd = html.indexOf("function newGame");
  const undo = html.slice(undoStart, undoEnd);
  assert.match(undo, /if \(action\.hanger\)/);
  assert.match(undo, /state\.roundHangers\[action\.who\] = Math\.max\(0, state\.roundHangers\[action\.who\] - action\.pts\)/);
  assert.match(undo, /state\.roundHangers = normalizePair\(action\.prevHangers\)/);
  assert.match(undo, /state\.roundHangers = normalizePair\(action\.hangers\)/);

  assert.match(html, /<span class="rc-hang">Hanger \+' \+ n \+ '<\/span>/);
  assert.match(html, /\.rc-side\.a \.rc-hang\s*\{[^}]*color:\s*#e7a0b0/);
  assert.match(html, /\.rc-side\.b \.rc-hang\s*\{[^}]*color:\s*#9dbeff/);
  assert.match(html, /\.round-log\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(html.slice(html.indexOf("function startNewGame()"), html.indexOf("function resetScores()")), /state\.roundHangers = \[0, 0\]/);
  assert.match(html.slice(html.indexOf("function resetScores()"), html.indexOf("function formatDate")), /state\.roundHangers = \[0, 0\]/);
});

test("round card running totals use the team board colours", () => {
  const html = page("public/index.html");
  assert.match(
    html,
    /<span class="tot-a">' \+ r\.totals\[0\] \+ '<\/span><span class="tot-sep">–<\/span><span class="tot-b">' \+ r\.totals\[1\] \+ '<\/span>/
  );
  assert.match(html, /\.round-card-tot \.tot-a\s*\{[^}]*color:\s*#e7a0b0/);
  assert.match(html, /\.round-card-tot \.tot-sep\s*\{[^}]*color:\s*var\(--accent\)/);
  assert.match(html, /\.round-card-tot \.tot-b\s*\{[^}]*color:\s*#9dbeff/);
  assert.match(html, /\.team\.p1\s*\{[^}]*border-color:\s*#e7a0b0/);
  assert.match(html, /\.team\.p2\s*\{[^}]*border-color:\s*#9dbeff/);
});

test("round cards sit three across and the selected side keeps rippling", () => {
  const html = page("public/index.html");
  assert.match(html, /\.round-log\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(html, /\.team\.selected::after\s*\{[^}]*animation:\s*selected-ripple[^}]*infinite/);
  assert.match(html, /@keyframes selected-ripple/);
  assert.match(html, /prefers-reduced-motion[\s\S]*\.team\.selected::after/);
});

test("history is a modal with per-game delete", () => {
  const html = page("public/index.html");
  assert.equal(html.includes("Clear All History"), false);
  assert.equal(html.includes("Clear Recent History"), false);
  assert.equal(html.includes("View Old History"), false);
  assert.equal(html.includes('id="btnClearHistory"'), false);
  assert.equal(html.includes('id="historyList"'), false);
  assert.equal(html.includes('id="panel-history"'), false);
  assert.equal(html.includes('id="btnHistory"'), true);
  assert.match(html, />History<\/button>/);
  assert.equal(html.includes('id="historyModal"'), true);
  assert.equal(html.includes('id="historyTitle">History</h2>'), true);
  assert.equal(html.includes("Loading history…"), true);
  assert.equal(html.includes("No games yet."), true);
  assert.match(html, /class="hist-x"/);
  assert.match(html, /aria-label="Delete this game"/);
  assert.match(html, /Delete this game from history\?/);
  assert.match(html, /title: 'Are you sure\?'/);
  assert.equal(/\bconfirm\s*\(/.test(html), false);
  assert.match(html, /method: 'DELETE'/);
  assert.match(html, /\/api\/games\/' \+ encodeURIComponent\(id\)/);
  assert.match(html, /fetchJson\('\/api\/games\?limit=40'\)/);
  assert.match(html, /fetchJson\('\/api\/leaderboard\?limit=8'\)/);
  assert.match(html, /if \(!row\.remote\)/);
  assert.ok(html.indexOf('id="btnHistory"') > html.indexOf('id="panel-play"'));
  assert.ok(html.indexOf('id="btnHistory"') < html.indexOf('id="panel-stats"'));
  const archiveStart = html.indexOf("function archiveIfWon()");
  const archiveEnd = html.indexOf("function publishGame");
  assert.ok(archiveStart > 0 && archiveEnd > archiveStart);
  assert.match(html.slice(archiveStart, archiveEnd), /publishGame\(entry\)/);
});

test("target and hammer lock after the first points and unlock on a fresh match", () => {
  const html = page("public/index.html");
  assert.match(html, /function scoringStarted\(\)/);
  assert.match(html, /function matchSetupLocked\(\)/);
  assert.match(html, /function noteScoringStarted\(\)/);
  assert.match(html, /setupLocked: false/);
  assert.match(html, /setupLocked: state\.setupLocked === true/);
  const addStart = html.indexOf("function addPoints(pts, hanger)");
  const addEnd = html.indexOf("function clearRound");
  assert.match(html.slice(addStart, addEnd), /if \(pts > 0\) noteScoringStarted\(\);/);
  const endStart = html.indexOf("function endRound()");
  const endEnd = html.indexOf("function nextHammer");
  assert.match(html.slice(endStart, endEnd), /noteScoringStarted\(\);/);
  const newStart = html.indexOf("function startNewGame()");
  const newEnd = html.indexOf("function resetScores()");
  assert.match(html.slice(newStart, newEnd), /state\.setupLocked = false/);
  const resetStart = html.indexOf("function resetScores()");
  const resetEnd = html.indexOf("function formatDate");
  assert.match(html.slice(resetStart, resetEnd), /state\.setupLocked = false/);
  assert.match(html, /b\.disabled = setupLocked/);
  assert.match(html, /\$\('customTarget'\)\.disabled = setupLocked/);
  assert.match(html, /controls\.classList\.toggle\('is-locked', setupLocked\)/);
  assert.match(html, /\.controls-row\.is-locked\s*\{[^}]*opacity:\s*0\.45/);
  assert.match(html, /\.controls-row\.is-locked button,\s*\.controls-row\.is-locked input\s*\{[^}]*pointer-events:\s*none/);
  assert.match(html, /if \(matchSetupLocked\(\)\) return;/);
  const nameStart = html.indexOf("$('name1').addEventListener");
  const nameEnd = html.indexOf("document.querySelectorAll('#targetSeg button')");
  assert.equal(html.slice(nameStart, nameEnd).includes("noteScoringStarted"), false);
  const historyStart = html.indexOf("function openHistory()");
  const historyEnd = html.indexOf("function closeHistory()");
  assert.equal(html.slice(historyStart, historyEnd).includes("noteScoringStarted"), false);
  assert.equal(html.slice(historyStart, historyEnd).includes("setupLocked"), false);
});

test("play button in the header opens the 3D game in the same tab", () => {
  const html = page("public/index.html");
  const header = html.slice(html.indexOf("<header>"), html.indexOf("</header>"));
  assert.match(
    header,
    /<a class="btn primary header-btn play-btn" id="btnPlay" href="https:\/\/shuffle\.cybush\.uk"[^>]*>Play<\/a>/
  );
  assert.ok(header.indexOf('id="btnRules"') < header.indexOf('id="btnPlay"'));
  const play = header.slice(header.indexOf('id="btnPlay"'), header.indexOf("</a>", header.indexOf('id="btnPlay"')));
  assert.equal(play.includes("target="), false);
  assert.equal(html.includes("shuttle.cybush.uk"), false);
  assert.match(html, /\.btn\.play-btn\s*\{[^}]*display:\s*inline-flex[^}]*text-decoration:\s*none/);
});

test("copy, cut, and paste are disabled across the page", () => {
  const html = page("public/index.html");
  assert.match(html, /body\s*\{\s*-webkit-user-select:\s*none;\s*user-select:\s*none;\s*-webkit-touch-callout:\s*none;/);
  assert.match(html, /input\s*\{\s*-webkit-user-select:\s*text;\s*user-select:\s*text;/);
  assert.match(
    html,
    /\['copy', 'cut', 'paste', 'contextmenu', 'dragstart', 'drop'\]\.forEach\(function \(type\) \{\s*document\.addEventListener\(type, blockClipboard, true\);/
  );
  assert.match(html, /function blockClipboard\(e\) \{\s*e\.preventDefault\(\);/);
  assert.match(html, /e\.inputType === 'insertFromPaste'/);
  assert.match(html, /e\.inputType === 'insertFromDrop'/);
});

test("confirm dialog stacks above the history modal", () => {
  const html = page("public/index.html");
  assert.match(html, /#rulesModal,\s*#historyModal\s*\{\s*z-index:\s*200/);
  assert.match(html, /#confirmModal\s*\{\s*z-index:\s*400/);
  assert.ok(html.indexOf('id="confirmModal"') < html.indexOf('id="historyModal"'));
  assert.match(html, /function pinConfirmOnTop\(on\)/);
  assert.match(html, /el\.inert = !!\(on && !el\.hidden\)/);
  const askStart = html.indexOf("function askConfirm");
  const askEnd = html.indexOf("function pinConfirmOnTop");
  assert.match(html.slice(askStart, askEnd), /pinConfirmOnTop\(true\)/);
  const closeStart = html.indexOf("function closeConfirm");
  const closeEnd = html.indexOf("function rulesOpen");
  assert.match(html.slice(closeStart, closeEnd), /pinConfirmOnTop\(false\)/);
  const histClick = html.indexOf("$('historyModal').addEventListener('click'");
  assert.match(html.slice(histClick, histClick + 280), /if \(!\$\('confirmModal'\)\.hidden\) return;/);
});
