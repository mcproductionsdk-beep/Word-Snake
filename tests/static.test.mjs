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

test("set-first launcher no longer mounts duplicate teacher or student menus", () => {
  const html = read("index.html");
  assert.match(html, /<iframe[^>]+id="snakeFrame"/);
  for (const signal of ["BT_SNAKE_START", "BT_SNAKE_READY", "BT_SNAKE_STARTED", "BT_SNAKE_MENU", "BT_SNAKE_START_FAILED"]) {
    assert.ok(html.includes(signal), `Missing launch protocol ${signal}`);
  }
  assert.match(html, /readStudentSetId/);
  assert.match(html, /sharing\.loadSet\(id\)/);
  assert.match(html, /returnHome/);
  assert.match(html, /snake-game\.html/);
  assert.doesNotMatch(html, /mountTeacherMenu|mountStudentMenu/);
  assert.doesNotMatch(html, /id=["'](category|words|shareStudentLink)["']/);
});

test("migration preview remains isolated and clearly labeled", () => {
  const html = read("launcher-migration-candidate/index.html");
  assert.match(html, /<base href="\.\.\/"/);
  assert.match(html, /MIGRATION CANDIDATE · DEMO SET/);
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\("demo"\)==="1"/);
  assert.match(html, /snake-game\.html\?candidate=universal-launcher-mobile-v1/);
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

test("real entry uses the promoted mobile engine with distinct language direction", () => {
  const html = read("snake-game.html");
  assert.match(html, /mobile-controls/);
  assert.match(html, /touchUp/);
  assert.match(html, /touchDown/);
  assert.match(html, /#game \.mobile-controls\{order:4/);
  assert.match(html, /#game \.wrap\{order:3/);
  assert.match(html, /target:p\[1\],prompt:p\[0\]/);
  assert.match(html, /value="fr-FR"/);
  assert.match(html, /value="it-IT"/);
  assert.doesNotMatch(html, /if\(expanded\(\)\)/);
});

test("demo fixture uses homepage [prompt,target] order", () => {
  const html=read("launcher-migration-candidate/index.html");
  assert.match(html, /\["cat","gato"\]/);
  assert.doesNotMatch(html, /\["gato","cat"\]/);
});

test("preview-only tester supplies vocabulary selection and Main Menu recovery", () => {
  const html=read("preview/index.html");
  for(const item of ["id=\"promptLanguage\"","id=\"language\"","id=\"category\"","id=\"words\"","id=\"play\"","id=\"save\"","id=\"gameFrame\""]) {
    assert.ok(html.includes(item), "Missing test menu control: "+item);
  }
  assert.match(html,/WAREHOUSE_CATEGORIES/);
  assert.match(html,/validateSet/);
  assert.match(html,/sharing\.saveSet\(set\)/);
  assert.match(html,/BT_SNAKE_MENU/);
  assert.match(html,/frame\.classList\.remove\("playing"\)/);
  assert.match(html,/location\.hostname\.endsWith\("\.pages\.dev"\)/);
  assert.match(read("index.html"),/previewReturn/);
  assert.match(read("launcher-migration-candidate\/index.html"),/new URL\("\.\.\/preview\/",location\.href\)/);
});
