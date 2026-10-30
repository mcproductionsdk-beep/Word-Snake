# Word Snake — release and rollback runbook

**Created:** 2026-10-30  
**Scope:** `mcproductionsdk-beep/Word-Snake` only. This runbook is on `develop`; it has **not** been promoted to production.  
**Status:** Procedure documented; production rollback **not executed**; browser CI must pass before it can be called verified.

## 1. Production boundary and source mapping

- **Public entry:** `https://boringteacher.com/word-snake/` (Cloudflare route to GitHub Pages `mcproductionsdk-beep/Word-Snake`, serving the `main` branch). Reinspect route and GitHub Pages deployment if it changes.
- **Production source:** `main/index.html`, `main/snake-game.html`, `main/core/`, `main/styles/`. Some experimental folders also exist under `main`; they are **not** approvals for promotion.
- **Development source:** `develop`; do not edit `main` directly.
- **Independent preview:** Cloudflare Pages project `bt-word-snake-vocab-pilot`, with preview deployments for `develop`; use the specific deployment URL and commit, not a guessed path. Its project-level production branch is `dev/central-vocabulary-pilot`, *not* GitHub production `main`.
- **Shared dependency:** `https://boringteacher-vocabulary-api.mcproductionsdk.workers.dev`. The game also references central libraries on `boringteacher.com`. This runbook does not authorize changes to Workers, D1, routing, library JSON, other games or the homepage.

## 2. Exact recovery checkpoints

- **Current GitHub production checkpoint as audited on 2026-10-30:** `e85035fa623f384efd56d8b22a34abb74bbfdafd`.
- **Branch pinned to that checkpoint:** `recovery/word-snake-production-2026-10-30`. Recheck the branch head before relying on it; the commit SHA above is the identity of the snapshot.
- **Earlier historical recovery branch:** `recovery/pre-menu-standardization-2026-10-28` at `8e1d7ebf8107085cb7d984b165f754cf19aa718c`. **Do not assume this older checkpoint is equivalent to the latest production.**
- **Current release baseline is not a claim of comprehensive gameplay acceptance.** Record the user-approved candidate commit and its tested preview separately for each future release.

## 3. Gate for every release

1. Create a `feature/...` branch from `develop`, implement narrowly, open a PR back to `develop`.
2. Verify the GitHub Actions workflow `Word Snake — development safety checks`: the **static** and **real headless-browser smoke** jobs must pass. Inspect logs; a green build does not prove all devices, set types or languages work.
3. Test the actual Cloudflare Pages preview at its exact deployment URL. Include a teacher-set and a student shared-set case when changes affect them, and confirm restart, controls, voice, return-to-menu, narrow mobile viewport and failure handling as applicable. **The automated demo test does not cover the live API.**
4. Diff the *entire* candidate against the exact approved production baseline; explicitly check demo banners, development redirects, staging dependencies, fake/test sets, changed links and unexpected changes to `core/` or game engine.
5. Request explicit **user approval for the exact candidate commit and production destination**.
6. Open a PR to **`main`**, review the diff, wait for passing required checks, and merge. Never push directly to protected `main`, never force push or reset history. Merge creates a new production checkpoint.
7. After merge, verify both GitHub Pages origin and `https://boringteacher.com/word-snake/` (Cloudflare path), including critical gameplay, student launch and cached/fresh behavior. Record observed commit, URL and test results.
8. Save the new known-good production commit SHA in this runbook or the canonical release registry. Retain previous checkpoints.

## 4. Roll back a bad *frontend code* release (no destructive reset)

1. **Stop new merges** into `main`; record the affected URL, time, failing behavior, latest production SHA, last known-good SHA and relevant PR(s).
2. Determine whether the regression came from Word Snake source, Cloudflare routing/cache, shared libraries or a Worker. **Do not revert GitHub game code for unrelated backend failures.**
3. Create `rollback/<incident-id>` from the current `main` head. Revert **only the offending release commit(s)**. Use GitHub's **Revert** action on the merged PR when available; otherwise use `git revert <commit-sha>` on the rollback branch. For a merge commit use `git revert -m 1 <merge-commit-sha>` only after confirming its parent structure.
4. Open a **new pull request** `rollback/... → main`. Require checks, review the exact affected files, obtain the user's emergency-release approval, and merge through normal branch protections.
5. Wait for GitHub Pages deployment, then verify the public `/word-snake/` path, direct-origin behavior, actual iframe/gameplay assets, student shared links, and a fresh/cached session. If cache delays delivery, diagnose cache keys rather than changing routing blindly.
6. Log old SHA, reverted SHA(s), new rollback commit, GitHub Pages status, Cloudflare observations and any unresolved defects. A revert creates a **new commit**; it does not move `main` backwards.

### If the entire production directory needs recovery

Use commit `e85035fa623f384efd56d8b22a34abb74bbfdafd` (or the latest approved known-good checkpoint) as the source for a **scoped restoration PR** of the production entrypoint and dependencies. Review all changed paths. Do **not** blindly replace the full repository, because it also includes separate preview/prototype folders.

### If the problem is Cloudflare or the vocabulary API

Do not change game code or D1 as a shortcut. Record the active Worker version and bindings, check compatible old deployments, restore a previously verified Worker version only with explicit approval, and verify API/DB compatibility. A code revert does not undo data changes. D1 Time Travel bookmarks are **not independent long-term backups**.

## 5. CI limitations and the next protection gate

The new workflow checks:
- Node syntax for `core/*.js`.
- Static invariants for the canonical entrypoint, candidate launcher and mobile engine.
- A **real Chrome** end-to-end test using a localhost development server and `?demo=1`: game started, canvas and target rendered, lives visible, pause/resume, keyboard and touch event handling, restart.

It does **not** test Cloudflare's live public routing, cross-origin server sharing, TTS voice quality, all languages, screen sizes, keyboard accessibility or backend migrations. Those remain separate acceptance checks.

**Do not require a GitHub status-check context in the production ruleset until the first real workflow run is green and the exact check name is confirmed.** Then enable the corresponding mandatory status check for `main`. Until then, the rule requiring PRs protects the release path, but it does not block merges based on test failure.

## 6. Emergency decision record (copy for each incident)

- Incident / affected public route:
- Last confirmed good production commit:
- Faulty commit(s) and affected files:
- Preview URL, commit, static and browser tests:
- User approval for production rollback:
- Rollback PR and new commit:
- GitHub Pages origin verification:
- Cloudflare public route verification:
- Student shared-set verification:
- Worker / D1 / shared-library impact (if any):
- Remaining risks:
