// Boring Teacher multilingual vocabulary V2 adapter (development only).
// Preserves Word Snake's existing [target, prompt] pair order.
export const LANGUAGE_OPTIONS = Object.freeze([
  {locale:"en-US",key:"en",label:"English"},
  {locale:"es-ES",key:"es-ES",label:"Spanish"},
  {locale:"de-DE",key:"de-DE",label:"German"},
  {locale:"da-DK",key:"da-DK",label:"Danish"},
  {locale:"fr-FR",key:"fr-FR",label:"French"},
  {locale:"it-IT",key:"it-IT",label:"Italian"}
]);
const keyFor = locale => LANGUAGE_OPTIONS.find(x=>x.locale===locale)?.key;
export function categoriesForPair(library,promptLocale="en-US",targetLocale="es-ES"){
  if(library?.schemaVersion!==2||!Array.isArray(library.concepts))throw new Error("Unsupported multilingual vocabulary schema");
  if(promptLocale===targetLocale)throw new Error("Prompt and target languages must differ");
  const promptKey=keyFor(promptLocale),targetKey=keyFor(targetLocale);
  if(!promptKey||!targetKey)throw new Error("Unsupported language selection");
  const categories={};
  for(const concept of library.concepts){
    if(!concept||typeof concept.category!=="string"||!concept.translations)continue;
    const prompt=concept.translations[promptKey],target=concept.translations[targetKey];
    if(typeof prompt!=="string"||!prompt.trim()||typeof target!=="string"||!target.trim())continue;
    (categories[concept.category]??=[]).push([target.trim(),prompt.trim()]);
  }
  return Object.fromEntries(Object.entries(categories).filter(([,pairs])=>pairs.length>=5));
}
