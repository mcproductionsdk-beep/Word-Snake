import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"..");
const read=path=>readFileSync(resolve(root,path),"utf8");

test("production includes only the approved set-first launcher and game dependencies",()=>{
  for(const path of ["index.html","snake-game.html","core/sharing.js","core/voice.js","core/vocabulary.js","core/languages.js"]){
    assert.ok(existsSync(resolve(root,path)),"Missing production dependency: "+path);
  }
  assert.equal(existsSync(resolve(root,"preview/index.html")),false,"The experimental vocabulary tester must not be in production");
  assert.equal(existsSync(resolve(root,"preview/vocabulary-v2.json")),false,"A test-only V2 library snapshot must not enter production");
});

test("canonical entry does not duplicate vocabulary editor or student menu",()=>{
  const c=read("index.html");
  assert.match(c,/<iframe[^>]+id="snakeFrame"/);
  assert.match(c,/src="\.\/snake-game\.html\?release=word-snake-set-first-20261030"/);
  assert.match(c,/readStudentSetId\(location\.href\)/);
  assert.match(c,/sharing\.loadSet\(id\)/);
  assert.match(c,/returnHome\(\)/);
  assert.match(c,/https:\/\/boringteacher\.com\//);
  for(const signal of ["BT_SNAKE_READY","BT_SNAKE_START","BT_SNAKE_STARTED","BT_SNAKE_START_FAILED","BT_SNAKE_MENU","BT_SNAKE_SPEAK"]){
    assert.ok(c.includes(signal),"Missing launcher signal: "+signal);
  }
  assert.doesNotMatch(c,/mountTeacherMenu|mountStudentMenu|<textarea|<select|STUDENT LINK|SAVE TO FOLDER|PASTE QUIZLET/);
  assert.doesNotMatch(c,/previewReturn|previewMenuUrl|\/preview\/|demoSet|MIGRATION CANDIDATE|\.pages\.dev/);
});

test("canonical engine preserves [prompt,target] mapping, sound and game lifecycle",()=>{
  const c=read("snake-game.html");
  assert.match(c,/target:p\[1\],prompt:p\[0\]/);
  assert.match(c,/function start\(pairs,locale\)/);
  assert.match(c,/function move\(\)/);
  assert.match(c,/function draw\(\)/);
  assert.match(c,/function pause\(\)/);
  assert.match(c,/function exitToCore\(\)/);
  for(const item of ["BT_SNAKE_READY","BT_SNAKE_PING","BT_SNAKE_START","BT_SNAKE_STARTED","BT_SNAKE_START_FAILED","BT_SNAKE_MENU","BT_SNAKE_SPEAK","BT_SNAKE_CANCEL_SPEECH"]){
    assert.ok(c.includes(item),"Missing engine event: "+item);
  }
  for(const id of ["score","lives","canvas","target","progress","pause","restart","mainMenu","sound","gameOver","again","overMenu"]){
    assert.ok(c.includes('id="'+id+'"'),"Missing gameplay control: "+id);
  }
  for(const locale of ["en-US","es-ES","de-DE","da-DK","fr-FR","it-IT"]){
    assert.ok(c.includes('value="'+locale+'"'),"Missing target language: "+locale);
  }
});

test("mobile board precedes steering and four primary game buttons remain",()=>{
  const c=read("snake-game.html");
  assert.match(c,/#game \.wrap\{order:3/);
  assert.match(c,/#game \.mobile-controls\{order:4/);
  assert.match(c,/#game #fullscreen\{display:none!important\}/);
  assert.match(c,/grid-template-columns:repeat\(4,minmax\(0,76px\)\)/);
  for(const id of ["touchUp","touchDown","touchLeft","touchRight"]){
    assert.ok(c.includes('id="'+id+'"'),"Missing touch steering: "+id);
  }
});

test("teacher-provided vocabulary never becomes executable HTML",()=>{
  const c=read("snake-game.html");
  assert.doesNotMatch(c,/\.innerHTML\s*=/);
  assert.match(c,/bold\.textContent=current\.prompt\.toUpperCase\(\)/);
  assert.match(c,/heading\.replaceChildren\("FIND: ",bold\)/);
});

test("no preview/debug assets injected into canonical runtime",()=>{
  for(const path of ["index.html","snake-game.html"]){
    const c=read(path);
    assert.doesNotMatch(c,/MIGRATION CANDIDATE|MOBILE RELEASE CANDIDATE|demoSet|\/preview\/|test-menu-v1|dev\/central|localhost:8765/);
  }
});
