import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const base=process.env.SNAKE_TEST_BASE||"http://127.0.0.1:8765";
const chrome=process.env.CHROME_BIN;
assert.ok(chrome,"CHROME_BIN must identify the browser");
const app=await chromium.launch({executablePath:chrome,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
const page=await app.newPage({viewport:{width:1280,height:900}});
await mkdir("tests/artifacts",{recursive:true});
const errors=[];
page.on("pageerror",e=>errors.push(e.message));
await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype;
  const original=proto.fillText;
  proto.fillText=function(text,...args){
    (window.__BT_DRAW_LABELS??=[]).push(String(text));
    if(window.__BT_DRAW_LABELS.length>1000)window.__BT_DRAW_LABELS.splice(0,500);
    return original.call(this,text,...args);
  };
});
const cases={
  "es":{title:"English to Spanish",promptLanguage:"en-US",language:"es-ES",pairs:[
    ["cat","gato"],["dog","perro"],["bird","pájaro"],["fish","pez"],["cow","vaca"],["rabbit","conejo"]]},
  "de":{title:"English to German",promptLanguage:"en-US",language:"de-DE",pairs:[
    ["cat","Katze"],["dog","Hund"],["bird","Vogel"],["fish","Fisch"],["cow","Kuh"],["rabbit","Kaninchen"]]},
  "da-es":{title:"Danish to Spanish",promptLanguage:"da-DK",language:"es-ES",pairs:[
    ["kat","gato"],["hund","perro"],["fugl","pájaro"],["fisk","pez"],["ko","vaca"],["kanin","conejo"]]},
  "de-da":{title:"German to Danish",promptLanguage:"de-DE",language:"da-DK",pairs:[
    ["Katze","kat"],["Hund","hund"],["Vogel","fugl"],["Fisch","fisk"],["Kuh","ko"],["Kaninchen","kanin"]]},
  "fr-it":{title:"French to Italian",promptLanguage:"fr-FR",language:"it-IT",pairs:[
    ["chat","gatto"],["chien","cane"],["oiseau","uccello"],["poisson","pesce"],["vache","mucca"],["lapin","coniglio"]]}
};

await page.route("https://boringteacher-vocabulary-api.mcproductionsdk.workers.dev/sets/**",async route=>{
  const id=new URL(route.request().url()).pathname.split("/").pop();
  if(!Object.hasOwn(cases,id)){
    return route.fulfill({status:404,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({error:"Not found"})});
  }
  await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({set:cases[id]})});
});
await page.route("https://boringteacher.com/",route=>route.fulfill({status:200,contentType:"text/html",body:"<!doctype html><html><title>Word Games</title><body><h1>WORD GAMES HOME</h1></body></html>"}));

try{
  await page.goto(base+"/");
  assert.match(await page.locator("#message").innerText(),/Select your vocabulary/i);
  assert.equal(await page.locator("select,textarea").count(),0);
  assert.equal(await page.locator("#snakeFrame.playing").count(),0);
  assert.equal(await page.locator("#home").getAttribute("href"),"https://boringteacher.com/");
  console.log("PASS: no-set recovery, no duplicate teacher menu");

  await page.goto(base+"/?autoplay=1#set=missing-id");
  await page.waitForFunction(()=>document.querySelector("#message")?.textContent.includes("Unable to load"));
  assert.equal(await page.locator("select,textarea").count(),0);
  assert.equal(await page.locator("#snakeFrame.playing").count(),0);
  console.log("PASS: invalid student ID fails safely");

  const frame=page.frameLocator("#snakeFrame");
  for(const [id,data] of Object.entries(cases)){
    // A hash-only navigation does not reload the same document. Simulate the
    // actual homepage -> game transition for each independent language set.
    await page.goto(base+"/");
    await page.goto(base+"/?autoplay=1&returnTo=dashboard#set="+id);
    await frame.locator("#game.active").waitFor({timeout:15000});
    await page.waitForFunction(locale=>{const engine=document.querySelector("#snakeFrame")?.contentDocument;return engine?.getElementById("game")?.classList.contains("active")&&engine?.getElementById("language")?.value===locale;},data.language,{timeout:15000});
    assert.equal(await page.locator("#app[hidden]").count(),1,id);
    assert.equal(await frame.locator("#language").inputValue(),data.language,id+" locale");
    assert.equal(await frame.locator("#score").innerText(),"0");
    assert.equal(await frame.locator("#lives").innerText(),"❤❤❤");
    const target=(await frame.locator("#target").innerText()).replace(/\s+/g," ").toLowerCase();
    assert.ok(data.pairs.some(([prompt])=>target.includes(prompt.toLowerCase())),id+" prompt must be in the source language");
    const labels=await frame.locator("#canvas").evaluate(()=>window.__BT_DRAW_LABELS||[]);
    assert.ok(data.pairs.some(([,target])=>labels.some(x=>x.toLowerCase()===target.toLowerCase())),id+" must render target translations on canvas: "+labels.join(","));
    console.log("PASS: "+data.title+" actual prompts, answers and target locale");
  }

  // Both the teacher and student dashboard pass valid word sets by #set=.
  await frame.locator("#pause").click();
  assert.equal(await frame.locator("#pauseOverlay").evaluate(e=>e.classList.contains("show")),true);
  await frame.locator("#pause").click();
  assert.equal(await frame.locator("#pauseOverlay").evaluate(e=>e.classList.contains("show")),false);
  await frame.locator("#sound").click();
  assert.match(await frame.locator("#sound").innerText(),/OFF/);
  await frame.locator("#sound").click();
  assert.match(await frame.locator("#sound").innerText(),/ON/);
  await frame.locator("#restart").click();
  assert.equal(await frame.locator("#score").innerText(),"0");
  assert.equal(await frame.locator("#lives").innerText(),"❤❤❤");
  console.log("PASS: pause, resume, restart, sound toggle");

  await page.setViewportSize({width:390,height:844});
  const board=await frame.locator("#wrap").boundingBox();
  const controls=await frame.locator("#touchUp").boundingBox();
  assert.ok(board&&controls&&controls.y>=board.y+board.height-1,"steering must remain below the mobile game board");
  for(const id of ["touchUp","touchDown","touchLeft","touchRight"]){
    assert.equal(await frame.locator("#"+id).isVisible(),true,id+" visible");
  }
  assert.equal(await frame.locator("#fullscreen").isVisible(),false,"mobile expand button must stay hidden");
  assert.ok(await frame.locator("#target").evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=18));
  await frame.locator("#touchLeft").dispatchEvent("pointerdown",{pointerId:1,pointerType:"touch",bubbles:true});
  await frame.locator("#restart").click();
  await page.screenshot({path:"tests/artifacts/word-snake-release-mobile.png",fullPage:true});
  console.log("PASS: phone controls under board, larger prompt, no EXPAND button");

  await frame.locator("#mainMenu").click();
  await page.waitForURL("https://boringteacher.com/#set=fr-it",{timeout:15000});
  console.log("PASS: Main Menu returns to central student launcher with same set ID");

  const malicious="<img src=x onerror=window.__BT_XSS_TEST=1>";
  cases.html={title:"Untrusted vocabulary",promptLanguage:"en-US",language:"es-ES",pairs:Array.from({length:6},(_,i)=>[malicious+i,"respuesta"+i])};
  await page.goto(base+"/?autoplay=1#set=html");
  await frame.locator("#game.active").waitFor({timeout:15000});
  assert.equal(await frame.locator("#target img").count(),0,"untrusted vocabulary must not be parsed as markup");
  assert.equal(await frame.locator("#target").evaluate(el=>el.textContent.toLowerCase().includes("<img")),true);
  assert.equal(await frame.locator("#target").evaluate(()=>window.__BT_XSS_TEST||0),0);
  console.log("PASS: untrusted vocabulary is rendered as text only");

  assert.deepEqual(errors,[],"Browser page errors: "+errors.join(" | "));
  console.log("ALL PRODUCTION WORD SNAKE BROWSER CHECKS PASSED");
}finally{
  await app.close();
}
