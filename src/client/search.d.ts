// public/assets/search.js is served as a static file and imported by URL at runtime, so
// TypeScript cannot resolve it the way it would a relative import. Declaring it here gives the
// dynamic import a real type instead of a cast, so a change to what search.js exports shows up
// as a type error rather than at runtime in a browser.
//
// A wildcard rather than the exact specifier: with moduleResolution "Bundler", a rooted path is
// resolved as a file before ambient declarations are consulted, so `declare module
// "/assets/search.js"` is never reached. The wildcard form is.
declare module "/assets/*" {
  export function openSearch(): void;
}
