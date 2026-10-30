import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (name) => readFileSync(resolve(root, name), "utf8");

test("canonical production files and game dependencies exist", () => {
  for (const path of [
    "index.html",
    "snake-game.html",
    "core/menu.js",
    "core/sharing.js",
    "core/voice.js",
    "core/vocabulary.js",
    "core/languages.js",
    "styles/menu.css",
    "launcher-migration-candidate/index.html",
    "mobile-release-candidate/snake-game.html",
  ]) {
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
  }
});

test("production entrypoint retains its currently approved launcher", () => {
  const html = read("index.html");
  assert.match(html, /mountTeacherMenu\s*,\s*mountStudentMenu/);
  assert.match(html, /<iframe[^>]+id="snakeFrame"/);
  assert.match(html, /BT_SNAKE_START/);
  assert.match(html, /BT_SNAKE_READY/);
  assert.match(html, /BT_SNAKE_MENU/);
  assert.match(html, /readStudentSetId/);
});

test("migration preview remains isolated and clearly labeled", () => {
  const html = read("launcher-migration-candidate/index.html");
  assert.match(html, /<base href="\.\.\/"/);
  assert.match(html, /MIGRATION CANDIDATE · DEMO SET/);
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\("demo"\)==="1"/);
  assert.match(html, /mobile-release-candidate\/snake-game\.html/);
  assert.match(html, /BT_SNAKE_START/);
  assert.match(html, /BT_SNAKE_STARTED/);
  assert.match(html, /BT_SNAKE_START_FAILED/);
  assert.doesNotMatch(html, /mountTeacherMenu/);
});

test("embedded game keeps lifecycle, gameplay, and mobile controls", () => {
  const html = read("mobile-release-candidate/snake-game.html");
  for (const id of ["canvas", "score", "lives", "target", "pause", "restart", "mainMenu", "touchUp", "touchDown", "touchLeft", "touchRight"]) {
    assert.ok(html.includes(`id="${id}"`), `Missing control ${id}`);
  }
  for (const message of ["BT_SNAKE_READY", "BT_SNAKE_PING", "BT_SNAKE_START", "BT_SNAKE_STARTED", "BT_SNAKE_START_FAILED", "BT_SNAKE_MENU"]) {
    assert.ok(html.includes(message), `Missing message ${message}`);
  }
});

test("no development-only demo banner appears in the live launcher", () => {
  assert.doesNotMatch(read("index.html"), /MIGRATION CANDIDATE · DEMO SET/);
});
