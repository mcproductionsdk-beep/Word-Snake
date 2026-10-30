import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { categoriesForPair, LANGUAGE_OPTIONS } from "../core/multilingual-vocabulary-v2.js";

const lib=JSON.parse(readFileSync(new URL("../preview/vocabulary-v2.json",import.meta.url),"utf8"));
const locales=LANGUAGE_OPTIONS.map(l=>l.locale);
const categories=new Set(["Animals","Food & Drink","Body","School","Home","Nature","Colours","Common Verbs"]);

test("preview snapshot preserves the central 96-concept V2 schema",()=>{
  assert.equal(lib.schemaVersion,2);
  assert.equal(lib.concepts.length,96);
  assert.deepEqual(new Set(lib.concepts.map(c=>c.category)),categories);
  assert.equal(lib.status,"development-translation-review");
});

test("all 30 language directions have eight complete built-in topics",()=>{
  let tested=0;
  for(const source of locales)for(const target of locales){
    if(source===target)continue;
    const items=categoriesForPair(lib,source,target);
    assert.deepEqual(new Set(Object.keys(items)),categories,source+" → "+target+" missing topics");
    for(const [name,pairs] of Object.entries(items)){
      assert.equal(pairs.length,12,source+" → "+target+" "+name+" should have 12 aligned concepts");
      for(const [prompt,answer] of pairs){
        assert.equal(typeof prompt,"string");
        assert.equal(typeof answer,"string");
        assert.ok(prompt.trim()&&answer.trim());
      }
    }
    tested++;
  }
  assert.equal(tested,30);
});

test("language direction and [prompt,target] order use actual translations, never stale Spanish",()=>{
  function sample(source,target){return categoriesForPair(lib,source,target).Animals[0]}
  assert.deepEqual(sample("en-US","es-ES"),["cat","gato"]);
  assert.deepEqual(sample("en-US","de-DE"),["cat","Katze"]);
  assert.deepEqual(sample("en-US","da-DK"),["cat","kat"]);
  assert.deepEqual(sample("es-ES","en-US"),["gato","cat"]);
  assert.deepEqual(sample("es-ES","de-DE"),["gato","Katze"]);
  assert.deepEqual(sample("de-DE","da-DK"),["Katze","kat"]);
  assert.deepEqual(sample("fr-FR","it-IT"),["chat","gatto"]);
  assert.deepEqual(sample("it-IT","fr-FR"),["gatto","chat"]);
});

test("identical or unsupported languages must be rejected",()=>{
  assert.throws(()=>categoriesForPair(lib,"en-US","en-US"));
  assert.throws(()=>categoriesForPair(lib,"xx-XX","es-ES"));
});
