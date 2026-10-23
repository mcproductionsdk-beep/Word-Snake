import { parsePairs, swapPairs, validateSet } from "./vocabulary.js?release=multilingual-20261023b";
import { getSupportedLanguages } from "./languages.js?release=multilingual-20261023b";
import { buildStudentUrl, readStudentSetId } from "./sharing.js?release=multilingual-20261023b";
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
const add=(parent,...children)=>{parent.append(...children);return parent;};
const button=(text,cls="")=>{const b=el("button",cls,text);b.type="button";return b;};
function details(help){const d=el("details","teacherHowTo"),s=el("summary","", "▶ HOW TO PLAY");add(d,s,el("div","",help));return d;}
const APPROVED_MENU = "<div id=\"studentIntro\" hidden></div>\n<div class=\"teacherMenu warehouseCols\">\n  <div class=\"card settingsCard warehousePanel\">\n    <h2>TEACHER · GAME SETTINGS</h2>\n    <label class=\"fieldLabel\" for=\"promptLanguage\">Prompt language</label>\n    <select id=\"promptLanguage\"></select>\n    <label class=\"fieldLabel\" for=\"language\">Target language</label>\n    <select id=\"language\"></select>\n    <label class=\"fieldLabel\" for=\"category\">Category</label>\n    <select id=\"category\"></select>\n    <p class=\"help\">Choose a vocabulary category or paste your own word pairs.</p>\n    <div id=\"voiceCheck\" class=\"preview\">VOICE: ready to test</div>\n    <button id=\"testVoice\" class=\"menuButton\" type=\"button\">🔊 TEST VOICE</button>\n    <details class=\"teacherHowTo\"><summary>HOW TO PLAY</summary><div>Select the correct translation. Each correct answer earns one point.</div></details>\n  </div>\n  <div class=\"card vocabCard warehousePanel\">\n    <h2>PASTE QUIZLET WORDS</h2>\n    <p class=\"help\">Paste target-language words and prompt-language translations separated by TAB, one pair per line.</p>\n    <textarea id=\"words\"></textarea>\n    <div class=\"warehouseActions\">\n      <button id=\"swap\" type=\"button\">⇄ SWAP SIDES</button>\n      <button id=\"shareStudentLink\" type=\"button\">🔗 SHARE WITH STUDENTS</button>\n      <button id=\"play\" class=\"primary\" type=\"button\">▶ PLAY</button>\n    </div>\n    <div id=\"preview\" class=\"preview\"></div>\n    <div id=\"error\" class=\"error\"></div>\n    <div id=\"shareStatus\" class=\"stepHint\">Creates a student link for the vocabulary shown above.</div>\n  </div>\n</div>";
function shell(root,title){root.replaceChildren();root.classList.add("bt-core");const logo=el("div","bt-logo",title);root.append(logo);return()=>{root.replaceChildren();root.classList.remove("bt-core");};}
export function mountTeacherMenu(root,services,options={}){
  const clean=shell(root,options.title??"BORING TEACHER");
  const abort=new AbortController(),signal=abort.signal;
  // Preserve the complete approved Word Racer menu markup and IDs; bind Core services below.
  const menuSection=el("section");menuSection.id="menu";menuSection.className="screen active";menuSection.innerHTML=APPROVED_MENU;
  root.append(menuSection);
  const byId=id=>menuSection.querySelector("#"+id);
  const promptLang=byId("promptLanguage"),lang=byId("language"),category=byId("category"),words=byId("words"),preview=byId("preview"),error=byId("error"),voiceStatus=byId("voiceCheck");
  const testVoice=byId("testVoice"),swap=byId("swap"),share=byId("shareStudentLink"),play=byId("play"),shareStatus=byId("shareStatus");
  const title={value:options.defaultSetTitle??"My vocabulary"};
  const titleInput=el("input","setTitleInput");titleInput.id="setTitle";titleInput.type="text";titleInput.maxLength=100;titleInput.placeholder="e.g. Unit 3 – My Family";titleInput.value=title.value;
  const titleLabel=el("label","fieldLabel","Vocabulary list name");titleLabel.htmlFor="setTitle";words.before(titleLabel,titleInput);
  let customTitle=title.value;
  function setTitleFromCategory(){if(category.value){titleInput.value=category.value;}else{titleInput.value=customTitle;}title.value=titleInput.value.trim();}
  titleInput.addEventListener("input",()=>{shareStatus.textContent="Creates a student link for the vocabulary shown above.";title.value=titleInput.value.trim();if(!category.value)customTitle=titleInput.value;},{signal});
  menuSection.querySelector(".teacherHowTo div").textContent=options.instructions??"Select the correct translation.";
  const cats=options.categories??{};
  const multilingual=Boolean(options.multilingualLibrary&&options.getCategoriesForPair);
  const languageOptions=options.languageOptions??getSupportedLanguages();
  const pairCategories=()=>multilingual?options.getCategoriesForPair(promptLang.value,lang.value):(cats[lang.value]??{});
  function excludeSame(){for(const opt of lang.options)opt.disabled=opt.value===promptLang.value;if(lang.value===promptLang.value)lang.value=languageOptions.find(l=>l.locale!==promptLang.value)?.locale??"";}
  let customDraft=options.defaultText??"";
  for(const l of languageOptions){for(const select of [promptLang,lang]){const opt=el("option","",l.label);opt.value=l.locale;select.append(opt);}}
  promptLang.value=options.defaultPromptLanguage??"en-US";
  lang.value=options.defaultLanguage??"es-ES";
  if(!multilingual){promptLang.value="en-US";promptLang.disabled=true;}
  excludeSame();
  function setCategories(){category.replaceChildren();const custom=el("option","","Custom vocabulary");custom.value="";category.append(custom);for(const key of Object.keys(pairCategories())){const opt=el("option","",key);opt.value=key;category.append(opt);}}
  function current(){const parsed=parsePairs(words.value);const checked=validateSet({title:title.value,language:lang.value,promptLanguage:promptLang.value,pairs:parsed.pairs},{minPairs:options.minPairs??5});return {parsed,checked};}
  function refresh(){const {parsed}=current();preview.textContent=parsed.pairs.length+" vocabulary pairs"+(parsed.rejectedLines.length?" · Invalid lines: "+parsed.rejectedLines.join(", "):"");}
  function loadCategory(){setTitleFromCategory();const pairs=pairCategories()[category.value];if(pairs){words.value=pairs.map(p=>p.join("\t")).join("\n");refresh();}else{words.value=customDraft;refresh();}}
  setCategories();words.value=customDraft;const initialCategory=options.defaultCategory??Object.keys(cats[lang.value]??{})[0];if(initialCategory&&pairCategories()[initialCategory]){category.value=initialCategory;loadCategory();}else refresh();
  function onLanguageChange(){shareStatus.textContent="Creates a student link for the vocabulary shown above.";error.textContent="";excludeSame();const wasCustom=category.value==="";const previous=category.value;setCategories();if(!wasCustom&&pairCategories()[previous]){category.value=previous;loadCategory();}else{category.value="";words.value=customDraft;setTitleFromCategory();refresh();}}
  lang.addEventListener("change",onLanguageChange,{signal});
  promptLang.addEventListener("change",onLanguageChange,{signal});
  category.addEventListener("change",()=>{shareStatus.textContent="Creates a student link for the vocabulary shown above.";loadCategory();},{signal});
  words.addEventListener("input",()=>{shareStatus.textContent="Creates a student link for the vocabulary shown above.";category.value="";customDraft=words.value;setTitleFromCategory();refresh();},{signal});
  swap.addEventListener("click",()=>{const {parsed}=current();if(parsed.rejectedLines.length){error.textContent="Correct invalid lines before swapping.";return;}words.value=swapPairs(parsed.pairs).map(p=>p.join("\t")).join("\n");const previousPrompt=promptLang.value;promptLang.value=lang.value;lang.value=previousPrompt;excludeSame();error.textContent="";category.value="";customDraft=words.value;setTitleFromCategory();shareStatus.textContent="Creates a student link for the vocabulary shown above.";refresh();},{signal});
  testVoice.addEventListener("click",async()=>{const examples={"es-ES":"Hola, buenos días","de-DE":"Hallo, guten Morgen","da-DK":"Hej, godmorgen","en-US":"Hello, good morning","fr-FR":"Bonjour, comment allez-vous","it-IT":"Ciao, buongiorno"};const phrase=examples[lang.value]??"Hello, good morning";voiceStatus.textContent="VOICE: testing…";try{const result=await services.voice.speak(phrase,lang.value);if(!signal.aborted)voiceStatus.textContent="VOICE: "+result.status;}catch{if(!signal.aborted)voiceStatus.textContent="VOICE: unavailable";}},{signal});
  play.addEventListener("click",async()=>{const {parsed,checked}=current();if(parsed.rejectedLines.length||!checked.ok){error.textContent=parsed.rejectedLines.length?"Correct invalid vocabulary lines.":checked.error.message;return;}error.textContent="";await options.onPlay?.(checked.value);},{signal});
  share.addEventListener("click",async()=>{
    const {parsed,checked}=current();
    if(parsed.rejectedLines.length||!checked.ok){error.textContent=parsed.rejectedLines.length?"Correct invalid vocabulary lines.":checked.error.message;return;}
    error.textContent="";share.disabled=true;shareStatus.textContent="Saving vocabulary…";
    try{
      const {id}=await services.sharing.saveSet(checked.value);
      if(signal.aborted)return;
      const url=buildStudentUrl(options.previewGameUrl??location.href,id);
      const link=el("a","",url);link.href=url;link.target="_blank";link.rel="noopener";
      const copy=button("COPY LINK","yellow");
      copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(url);copy.textContent="COPIED";}catch{copy.textContent="Select the link above to copy."; }},{signal});
      shareStatus.replaceChildren(link,el("div","", " "),copy);
    }catch(e){if(!signal.aborted)shareStatus.textContent=e.message??"Could not share vocabulary.";}
    finally{if(!signal.aborted)share.disabled=false;}
  },{signal});
  return{destroy(){abort.abort();clean();},getCurrentSet(){const {parsed,checked}=current();return parsed.rejectedLines.length||!checked.ok?null:checked.value;}};
}
export function mountStudentMenu(root,services,options={}){
  const clean=shell(root,options.title??"BORING TEACHER"),abort=new AbortController(),signal=abort.signal;
  const card=el("div","studentIntro"),heading=el("div","studentTitle","LOADING VOCABULARY"),meta=el("div","studentMeta","Please wait…"),play=button("PLAY","primary");
  play.disabled=true;add(card,heading,meta,play,details(options.instructions??"Select the correct translation."));root.append(card);
  const games=[["🐍","Word Snake","/word-snake/"],["🏎️","Word Racer","/word-racer/"],["🏃","Word Jumper","/word-jumper/"],["👾","Word Invaders","/word-invaders/"],["🐸","Word Frog","/frog-river/"],["🔗","Word Match","/matching-columns/"],["🟡","Word Eater","/word-eater/"],["📦","Word Warehouse","/word-warehouse/"]];
  const headingGames=el("h2","","CHOOSE A GAME"),grid=el("div","studentGameGrid");
  for(const [icon,name,path] of games){const link=el("a","studentGameTile");link.href=new URL(path,location.origin).toString();link.target="_self";link.append(el("span","studentGameIcon",icon),el("span","studentGameName",name));grid.append(link);}
  card.append(headingGames,grid);grid.hidden=true;
  const updateGameLinks=id=>{for(const link of grid.querySelectorAll("a")){const url=new URL(link.href);url.hash="set="+encodeURIComponent(id);url.searchParams.set("autoplay","1");link.href=url.toString();}};
  let set=null;
  play.addEventListener("click",()=>{if(set)options.onPlay?.(set);},{signal});
  const id=readStudentSetId(options.studentUrl??location.href);
  const recover=button("RETURN TO TEACHER MENU","menuButton");
  recover.addEventListener("click",()=>options.onRecover?.(),{signal});
  function showRecovery(){if(!recover.isConnected)card.append(recover);}
  if(!id){heading.textContent="INVALID LINK";meta.textContent="This student link has no valid set ID.";showRecovery();}
  else services.sharing.loadSet(id).then(value=>{if(signal.aborted)return;set=value;updateGameLinks(id);grid.hidden=false;heading.textContent=value.title;meta.textContent=(value.promptLanguage??"en-US")+" → "+value.language+" · "+value.pairs.length+" words";play.disabled=false;if(new URL(location.href).searchParams.get("autoplay")==="1"){const u=new URL(location.href);u.searchParams.delete("autoplay");history.replaceState(null,"",u);options.onPlay?.(value);}}).catch(e=>{if(signal.aborted)return;heading.textContent="UNABLE TO LOAD";meta.textContent=e.message??"Could not load vocabulary.";showRecovery();});
  return{destroy(){abort.abort();clean();}};
}
