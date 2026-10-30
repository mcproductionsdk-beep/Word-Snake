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
    if(req.url().endsWith("/ci-html-prompt")){
      const hostile='<img src=x onerror="window.__btInjected=1">';
      await route.fulfill({
        status:200, contentType:"application/json",
        headers:{"access-control-allow-origin":"*"},
        body:JSON.stringify({set:{title:"Shared text safety",language:"es-ES",promptLanguage:"en-US",pairs:
          ["a","b","c","d","e","f"].map((x)=>[hostile,x])}}),
      });
    }else if(req.url().endsWith("/"+id)){
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
  await page.route("https://boringteacher-vocabulary-api.mcproductionsdk.workers.dev/sets", async route=>{
    const request=route.request();
    assert.equal(request.method(),"POST");
    const data=request.postDataJSON();
    assert.equal(data.promptLanguage,"en-US");
    assert.equal(data.language,"es-ES");
    assert.ok(data.pairs.some(p=>p[0]==="cat"&&p[1]==="gato"));
    await route.fulfill({
      status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"*"},
      body:JSON.stringify({id}),
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


  // The preview has its own teacher-only tester. It never appears in the actual game.
  await page.goto(base+"/preview/");
  try {
    await page.waitForFunction(()=>document.querySelector("#promptLanguage")?.value==="en-US"&&document.querySelector("#category")?.value==="Animals",{},{timeout:12000});
  }catch(err){
    console.error("PREVIEW MENU DIAGNOSTIC",await page.evaluate(()=>({
      url:location.href,host:location.hostname,
      prompt:document.querySelector("#promptLanguage")?.value,
      languages:document.querySelector("#promptLanguage")?.options.length,
      category:document.querySelector("#category")?.value,
      categories:document.querySelector("#category")?.options.length,
      status:document.querySelector("#status")?.textContent,
      body:document.body?.innerText.slice(0,220)
    })),errors);
    throw err;
  }
  assert.equal(await page.locator("#promptLanguage").inputValue(),"en-US");
  assert.equal(await page.locator("#language").inputValue(),"es-ES");
  assert.equal(await page.locator("#category").inputValue(),"Animals");
  assert.match(await page.locator("#words").inputValue(),/cat\tgato/);
  assert.match(await page.locator("#preview").innerText(),/12 vocabulary pairs/);
  await page.locator("#play").click();
  const testerGame=page.frameLocator("#gameFrame");
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await page.locator("#menu[hidden]").count(),1);
  assert.match(await testerGame.locator("#target").innerText(),/^FIND:\s*[A-Z]+$/);
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  assert.match(await page.locator("#words").inputValue(),/cat\tgato/);
  console.log("PASS: preview vocabulary menu → game → same menu, preserving selections");

  // Every menu language change must regenerate the actual vocabulary rather
  // than merely relabeling the original English–Spanish pairs.
  await page.locator("#language").selectOption("de-DE");
  assert.match(await page.locator("#words").inputValue(),/cat\tKatze/);
  assert.doesNotMatch(await page.locator("#words").inputValue(),/cat\tgato/);
  assert.match(await page.locator("#preview").innerText(),/English → German/);
  await page.locator("#play").click();
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await testerGame.locator("#language").inputValue(),"de-DE");
  assert.match(await testerGame.locator("#target").innerText(),/^FIND:\s*(CAT|DOG|BIRD|FISH|HORSE|COW|PIG|SHEEP|MOUSE|RABBIT|DUCK|CHICKEN)$/);
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  console.log("PASS: English → German word pairs actually reach the game");

  await page.locator("#promptLanguage").selectOption("es-ES");
  assert.match(await page.locator("#words").inputValue(),/gato\tKatze/);
  assert.match(await page.locator("#preview").innerText(),/Spanish → German/);
  await page.locator("#play").click();
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await testerGame.locator("#language").inputValue(),"de-DE");
  assert.match(await testerGame.locator("#target").innerText(),/^FIND:\s*(GATO|PERRO|PÁJARO|PEZ|CABALLO|VACA|CERDO|OVEJA|RATÓN|CONEJO|PATO|POLLO)$/);
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  console.log("PASS: Spanish → German uses source Spanish and German answers");

  await page.locator("#language").selectOption("en-US");
  assert.match(await page.locator("#words").inputValue(),/gato\tcat/);
  await page.locator("#play").click();
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await testerGame.locator("#language").inputValue(),"en-US");
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  console.log("PASS: Spanish → English reverse direction works");

  await page.locator("#promptLanguage").selectOption("fr-FR");
  await page.locator("#language").selectOption("it-IT");
  assert.match(await page.locator("#words").inputValue(),/chat\tgatto/);
  assert.match(await page.locator("#preview").innerText(),/French → Italian/);
  await page.locator("#play").click();
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await testerGame.locator("#language").inputValue(),"it-IT");
  assert.match(await testerGame.locator("#target").innerText(),/^FIND:\s*(CHAT|CHIEN|OISEAU|POISSON|CHEVAL|VACHE|COCHON|MOUTON|SOURIS|LAPIN|CANARD|POULET)$/);
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  console.log("PASS: French → Italian pairs play with correct locales");

  await page.locator("#promptLanguage").selectOption("en-US");
  await page.locator("#language").selectOption("da-DK");
  assert.match(await page.locator("#words").inputValue(),/cat\tkat/);
  await page.locator("#play").click();
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await testerGame.locator("#language").inputValue(),"da-DK");
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  console.log("PASS: English → Danish uses Danish answers");

  await page.locator("#words").fill("red\trød\nblue\tblå\ngreen\tgrøn\nyellow\tgul\nblack\tsort");
  assert.equal(await page.locator("#category").inputValue(),"");
  await page.locator("#language").selectOption("de-DE");
  await page.locator("#play").click();
  assert.match(await page.locator("#status").innerText(),/languages changed after this custom vocabulary/i);
  assert.equal(await page.locator("#menu[hidden]").count(),0);
  // Revising the custom pairs deliberately confirms the new language direction.
  await page.locator("#words").fill("red\trot\nblue\tblau\ngreen\tgrün\nyellow\tgelb\nblack\tschwarz");
  await page.locator("#play").click();
  await testerGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await testerGame.locator("#language").inputValue(),"de-DE");
  await testerGame.locator("#mainMenu").click();
  await page.locator("#menu:not([hidden])").waitFor();
  console.log("PASS: stale custom pairs are blocked until edited for the new language");

  // Restore the original English → Spanish built-in set for sharing checks.
  await page.locator("#promptLanguage").selectOption("en-US");
  await page.locator("#language").selectOption("es-ES");
  await page.locator("#category").selectOption("Animals");
  assert.match(await page.locator("#words").inputValue(),/cat\tgato/);


  // Save and load through the real API contract (mocked here) and return to preview.
  await page.locator("#save").click();
  await page.waitForURL(base+"/?returnTo=preview#set="+id,{timeout:15000});
  const sharedGame=page.frameLocator("#snakeFrame");
  await sharedGame.locator("#game.active").waitFor({timeout:15000});
  await sharedGame.locator("#mainMenu").click();
  await page.waitForURL(base+"/preview/",{timeout:15000});
  assert.equal(await page.locator("#category").inputValue(),"Animals");
  assert.match(await page.locator("#words").inputValue(),/cat\tgato/);
  console.log("PASS: save shared set → canonical launcher → preview menu, preserving vocabulary");

  // Older demo link should also recover into the preview tester, not production.
  await page.goto(base+"/launcher-migration-candidate/?demo=1");
  const demoGame=page.frameLocator("#snakeFrame");
  await demoGame.locator("#game.active").waitFor({timeout:15000});
  await demoGame.locator("#mainMenu").click();
  await page.waitForURL(base+"/preview/",{timeout:15000});
  console.log("PASS: legacy demo's MAIN MENU returns to preview tester");


  // Shared vocabulary is public user-supplied text, never executable markup.
  await page.goto(base+"/?autoplay=1#set=ci-html-prompt");
  const injectionGame=page.frameLocator("#snakeFrame");
  await injectionGame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await injectionGame.locator("#target img").count(),0,"Untrusted prompt must not create HTML elements");
  assert.match(await injectionGame.locator("#target b").innerText(),/<IMG SRC=X ONERROR=/);
  assert.equal(await injectionGame.locator("body").evaluate(()=>window.__btInjected===1),false);
  console.log("PASS: shared vocabulary cannot inject executable markup into the prompt");

  assert.deepEqual(errors,[],"Page JavaScript errors: "+errors.join("; "));
  console.log("ALL WORD SNAKE LAUNCHER CHECKS PASSED");
}finally{
  await browser.close();
}
