## Bug audit — Vuzora

Typecheck (`tsgo`) passes. ESLint reports only prettier formatting nits and two errors inside `.workspace/skills/` (not our code). The real defects are behavioural.

### 1. Hydration mismatch on `<html>` — console warning on every page load
**Where:** `src/routes/__root.tsx` → `RootShell`
**Problem:** SSR emits `<html class="dark">`. The inline `<script>` in `<head>` runs *before* React hydrates and adds `js`, so by the time React reconciles the client tree it sees `class="dark js"` while the server HTML said `class="dark"`. React logs a hydration mismatch and refuses to patch the attribute. Confirmed in current console logs.
**Fix:** Add `suppressHydrationWarning` on the `<html>` element. That attribute is designed exactly for this "we intentionally mutate before hydration" case and doesn't leak past the html/body boundary.

### 2. Uncleared `setTimeout` in the calculator share flow
**Where:** `src/components/vuzora/calculator/useCalculator.ts` → `flash()`
**Problem:** `setTimeout(() => setShared("idle"), 2200)` is fired without tracking the id. Rapid re-clicks stack timers (one can reset "shared" back to "idle" while a newer share is still in progress) and a timer that fires after the component unmounts triggers a React state-update-on-unmounted warning.
**Fix:** Store the timeout id in a `useRef`, clear it at the top of `flash()` and in a `useEffect` cleanup on unmount.

### 3. In-page anchor scroll silently breaks off the home route
**Where:** `src/components/vuzora/NavBar.tsx` → `handleNavClick`
**Problem:** For `/#faq` links clicked from `/blog`, `document.getElementById("faq")` returns `null` (we haven't navigated yet), so the "section-flash" branch is skipped and the browser jumps to the new URL without any highlight. Also, when we *are* on `/`, the handler runs before the browser's native hash-scroll, so the flash class is added but the target hasn't moved into view yet.
**Fix:** If the target exists on the current page, run the flash animation *and* call `scrollIntoView({ behavior: "smooth", block: "start" })` ourselves (the anchor still updates the URL hash). If it doesn't exist, let the browser navigate and skip the flash — no error, no dead code path.

### 4. Mobile menu links stay in the tab order when the menu is closed
**Where:** `src/components/vuzora/nav/MobileMenu.tsx`
**Problem:** When `open` is false the panel uses `opacity-0` + `pointer-events-none` and sets `aria-hidden={!open}`, but the `<a>` elements remain keyboard-focusable. A user tabbing through the page lands on invisible links and screen-reader focus disagrees with `aria-hidden`. This also violates ARIA (focusable descendants of an `aria-hidden` region).
**Fix:** Add the `inert` attribute on the wrapper `<div>` when `!open`. `inert` removes the subtree from tab order, hit-testing, and the a11y tree in one property, with full modern-browser support and a graceful no-op fallback.

### 5. Mobile menu closes on link click but header stays "open" for its own click
**Where:** `src/components/vuzora/NavBar.tsx`
**Problem:** `handleNavClick` calls `closeMenu()` only when a nav link is used, but `<a href="/blog">` inside `MobileMenu` calls `onClose` (fine). Clicking the logo (`onClick={closeMenu}`) also fine. However, tapping *outside* the panel (backdrop) does not close it — there's no backdrop listener and Escape only works when focus is inside the panel because the `keydown` handler is bound to `document` only while `open` is true (that part is fine), but a click on the page behind the floating pill won't dismiss the menu.
**Fix:** Add a click-outside handler on `document` (mousedown) while `open` is true that closes the menu when the click target is outside both the toggle button and the panel. Small addition, keeps the existing focus-trap intact.

## Verification

After each fix:
- `bunx tsgo --noEmit` — must stay clean.
- Reload the preview and confirm the hydration warning is gone from the console.
- Manual smoke: open/close mobile menu with keyboard (Tab should not enter it while closed), click backdrop to close, click `/#faq` from `/blog` to confirm scroll + flash, spam the calculator "Поделиться" button to confirm no stacked timers.

## Out of scope

Prettier auto-fixes across the codebase (6.9k formatting nits) — cosmetic-only, unrelated to bugs; can be handled by a single `bunx prettier -w .` in a dedicated cleanup pass if you want.
