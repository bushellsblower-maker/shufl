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
  for (const id of ["btnUndo", "btnEndRound", "btnClearRound", "btnNewGame", "btnResetGame", "btnClearHistory", "roundLog", "historyList"]) {
    assert.equal(html.includes(`id="${id}"`), true, id);
  }
  for (const pts of ["1", "2", "3", "4"]) {
    assert.equal(html.includes(`data-pts="${pts}"`), true, pts);
  }
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
  assert.equal(html.includes('class="btn danger" id="btnClearHistory"'), true);
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
    "A hanger (any part hanging over the far end, not the side, without falling) scores 5 points.",
    "After the round is scored, play the next round from the other end.",
    "First to the agreed total (usually 15 or 21) wins.",
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
