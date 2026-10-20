import { validateSet } from "./vocabulary.js";
import { isSupportedLocale } from "./languages.js";
const error = (code, message, cause) => Object.assign(new Error(message), { code, cause });
function validId(id) { return typeof id === "string" && !!id.trim() && id.length <= 512; }
export function buildStudentUrl(canonicalGameUrl, id) {
  if (!validId(id)) throw error("VALIDATION", "Invalid shared set ID.");
  const url = new URL(canonicalGameUrl);
  if (!/^https?:$/.test(url.protocol)) throw error("VALIDATION", "Invalid game URL.");
  url.search = ""; url.hash = "set=" + encodeURIComponent(id);
  return url.toString();
}
export function readStudentSetId(url) {
  const hash = new URL(url).hash;
  if (!hash.startsWith("#set=")) return null;
  try { const id = decodeURIComponent(hash.slice(5)); return validId(id) ? id : null; }
  catch { return null; }
}
export function createSharingClient({ apiBaseUrl, timeoutMs = 12000, fetchImpl = globalThis.fetch } = {}) {
  if (!apiBaseUrl || typeof fetchImpl !== "function") throw error("VALIDATION", "Sharing configuration is incomplete.");
  const base = apiBaseUrl.replace(/\/+$/, "");
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      let response;
      try { response = await fetchImpl(base + path, { ...options, signal: controller.signal }); }
      catch (cause) { throw error(controller.signal.aborted ? "TIMEOUT" : "NETWORK", controller.signal.aborted ? "Sharing request timed out." : "Could not reach the sharing service.", cause); }
      if (!response.ok) throw error("HTTP", "Sharing service returned HTTP " + response.status + ".");
      try { return await response.json(); }
      catch (cause) { throw error("MALFORMED_RESPONSE", "Sharing service returned invalid JSON.", cause); }
    } finally { clearTimeout(timer); }
  }
  return {
    async saveSet(set) {
      const checked = validateSet(set);
      if (!checked.ok) throw error(checked.error.code, checked.error.message);
      if (!isSupportedLocale(checked.value.language)) throw error("VALIDATION", "Unsupported language.");
      const data = await request("/sets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checked.value) });
      const id = data?.id ?? data?.setId ?? data?.set?.id;
      if (!validId(id)) throw error("MALFORMED_RESPONSE", "Sharing service did not return a valid set ID.");
      return { id };
    },
    async loadSet(id) {
      if (!validId(id)) throw error("VALIDATION", "Invalid shared set ID.");
      const data = await request("/sets/" + encodeURIComponent(id));
      const payload = data?.set ?? data;
      const checked = validateSet(payload);
      if (!checked.ok || !isSupportedLocale(payload?.language)) throw error("MALFORMED_RESPONSE", "Shared vocabulary is invalid.");
      return { ...checked.value, id };
    }
  };
}
