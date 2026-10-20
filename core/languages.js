// Inventory pending confirmation against the approved menu.
const LANGUAGES = Object.freeze([
  { locale: "es-ES", label: "Spanish" },
  { locale: "de-DE", label: "German" },
  { locale: "da-DK", label: "Danish" },
  { locale: "en-US", label: "English" }
]);
export function normalizeLocale(value) {
  const raw = String(value ?? "").trim().replace(/_/g, "-");
  const match = LANGUAGES.find(x => x.locale.toLowerCase() === raw.toLowerCase());
  return match?.locale ?? raw;
}
export function getSupportedLanguages() { return LANGUAGES.map(x => ({ ...x })); }
export function isSupportedLocale(value) { return LANGUAGES.some(x => x.locale === normalizeLocale(value)); }
