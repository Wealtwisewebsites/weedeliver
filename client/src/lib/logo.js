// The logo is served from /public so the browser caches it as a real image, instead of
// inlining ~270KB of base64 into the JS bundle. The previous inline copy was a lossy
// re-encode, which is what produced the artefacts around the helmet brim.
export const LOGO_URL = "/logo.png";