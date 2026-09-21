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
  assert.equal(html.split('value="Team A"').length - 1, 1);
  assert.equal(html.split('value="Team B"').length - 1, 1);
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
