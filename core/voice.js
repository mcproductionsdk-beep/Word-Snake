import { normalizeLocale } from "./languages.js";
export function createVoiceService({ speechSynthesis = globalThis.speechSynthesis, utteranceFactory = text => new SpeechSynthesisUtterance(text) } = {}) {
  let current = null;
  const listVoices = () => speechSynthesis?.getVoices?.() ?? [];
  function cancel() { if (current) { const finish = current; current = null; finish("cancelled"); } speechSynthesis?.cancel?.(); }
  function speak(text, locale) {
    cancel();
    if (!speechSynthesis?.speak || !String(text ?? "").trim()) return Promise.resolve({ status: "unavailable" });
    return new Promise(resolve => {
      let settled = false;
      const done = (status, detail) => { if (settled) return; settled = true; if (current === finish) current = null; resolve({ status, ...(detail ? { detail } : {}) }); };
      const finish = status => done(status);
      current = finish;
      try {
        const utterance = utteranceFactory(String(text));
        const lang = normalizeLocale(locale);
        utterance.lang = lang;
        const voices = listVoices();
        const base = lang.split("-")[0].toLowerCase();
        const voice = voices.find(v => v.lang?.toLowerCase() === lang.toLowerCase()) ?? voices.find(v => v.lang?.split("-")[0]?.toLowerCase() === base);
        if (voice) utterance.voice = voice;
        utterance.onend = () => done("ended");
        utterance.onerror = event => done("error", event?.error ?? "Speech failed.");
        speechSynthesis.speak(utterance);
      } catch (cause) { done("error", String(cause)); }
    });
  }
  return { speak, cancel, listVoices };
}
