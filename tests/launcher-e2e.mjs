import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const base = process.env.SNAKE_TEST_BASE || "http://127.0.0.1:8765";
const executablePath = process.env.CHROME_BIN;
const id = "ci-word-snake-mocked-set";
const payload = {
  set: {
    title: "Automated Word Snake Test",
    language: "es-ES",
    promptLanguage: "en-US",
    pairs: [
      ["cat", "gato"],
      ["dog", "perro"],
      ["bird", "pájaro"],
      ["fish", "pez"],
      ["cow", "vaca"],
      ["rabbit", "conejo"],
    ],
  }
};
assert.ok(executablePath, "Set CHROME_BIN to a Chromium/Chrome executable");
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({viewport:{width:1280,height:900}});
const errors = [];
page.on("pageerror",error=>errors.push(error.message));
await mkdir("tests/artifacts",{recursive:true});
try {
  await page.route("https://boringteacher-vocabulary-api.mcproductionsdk.workers.dev/sets/**", async route=>{
    const req=route.request();
    if(req.url().endsWith("/"+id)){
      await route.fulfill({
        status:200,
        contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify(payload),
      });
    }else await route.fulfill({
      status:404,
      contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},
      body:JSON.stringify({error:"Not found"}),
    });
  });
  await page.route("https://boringteacher.com/",route=>route.fulfill({
    status:200,contentType:"text/html",body:"<!doctype html><title>Word Games home</title><h1>WORD GAMES HOME</h1>"
  }));

  // Missing set must not open a legacy menu or redirect without warning.
  await page.goto(base+"/");
  assert.match(await page.locator("#message").innerText(),/select your vocabulary/i);
  assert.equal(await page.locator("select").count(),0);
  assert.equal(await page.locator("#snakeFrame.playing").count(),0);
  console.log("PASS: no-set recovery without legacy teacher menu");

  // An inaccessible set must show a recoverable error instead of starting a game.
  await page.goto(base+"/?autoplay=1#"+ "set=invalid-ci-set");
  await page.waitForFunction(()=>document.querySelector("#message")?.textContent.includes("Unable to load"));
  assert.equal(await page.locator("#home").getAttribute("href"),"https://boringteacher.com/");
  console.log("PASS: invalid shared-set recovery");

  // Real root entry with a mocked worker response: no test-specific code on production page.
  await page.goto(base+"/?autoplay=1&returnTo=dashboard#set="+id);
  const game=page.frameLocator("#snakeFrame");
  await game.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await page.locator("#snakeFrame.playing").count(),1);
  assert.equal(await page.locator("#app[hidden]").count(),1);
  assert.equal(await game.locator("#score").innerText(),"0");
  assert.equal(await game.locator("#lives").innerText(),"❤❤❤");
  assert.match(await game.locator("#target").innerText(),/^FIND:\s*(CAT|DOG|BIRD|FISH|COW|RABBIT)$/);
  assert.equal(await game.locator("#canvas").evaluate(el=>el.width>0&&el.height>0),true);
  assert.equal(await page.locator("select").count(),0);
  console.log("PASS: canonical homepage launch, prompt-target direction, lives, canvas, no menus");

  await game.locator("#pause").click();
  assert.equal(await game.locator("#pauseOverlay").evaluate(el=>el.classList.contains("show")),true);
  await game.locator("#pause").click();
  assert.equal(await game.locator("#pauseOverlay").evaluate(el=>el.classList.contains("show")),false);
  await game.locator("body").press("ArrowUp");
  await game.locator("#restart").click();
  assert.equal(await game.locator("#score").innerText(),"0");
  assert.equal(await game.locator("#lives").innerText(),"❤❤❤");
  console.log("PASS: pause, resume, keyboard and restart");

  await page.setViewportSize({width:390,height:844});
  assert.equal(await game.locator("#touchUp").isVisible(),true);
  const arrow=await game.locator("#touchUp").boundingBox();
  const board=await game.locator("#wrap").boundingBox();
  assert.ok(arrow&&board&&arrow.y>=board.y+board.height-1,"Mobile arrow controls must appear below the game board");
  assert.ok(await game.locator("#target").evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=18),"Mobile vocabulary target is too small");
  for(const control of ["touchUp","touchDown","touchLeft","touchRight"]) {
    assert.equal(await game.locator("#"+control).isVisible(),true,control+" not visible");
  }
  await game.locator("#touchLeft").dispatchEvent("pointerdown",{pointerId:1,pointerType:"touch",bubbles:true});
  await game.locator("#restart").click();
  assert.equal(await game.locator("#game.active").count(),1);
  await page.screenshot({path:"tests/artifacts/word-snake-mobile.png",fullPage:true});
  console.log("PASS: mobile arrows below board, larger vocabulary prompt, steering and restart");

  await game.locator("#mainMenu").click();
  await page.waitForURL("https://boringteacher.com/#set="+id,{timeout:15000});
  console.log("PASS: main menu returns to central student set launcher when direct-opened");

  assert.deepEqual(errors,[],"Page JavaScript errors: "+errors.join("; "));
  console.log("ALL WORD SNAKE LAUNCHER CHECKS PASSED");
}finally{
  await browser.close();
}
