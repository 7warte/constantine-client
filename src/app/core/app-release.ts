/**
 * Whether the iOS app is publicly released on the App Store.
 *
 * Until it is, the app is TestFlight-only and its store listing 404s — so the
 * Downloads page is hidden completely: no menu entry, and the route itself
 * redirects home. Flip this to `true` on launch day and the page, its menu
 * links and the store button all come back on together.
 */
export const APP_RELEASED = false;

/** The App Store listing (App Store Connect id 6791914126). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6791914126';
