// Cache headers for the /api/og/* routes.
//
// Every OG image is rendered from the build-time snapshot (ogSnapshot / counts /
// categories), so a given URL produces the same PNG until the next deploy — and
// Vercel drops its CDN cache on deploy. Without these headers each request re-runs
// satori, which is the one genuinely CPU-expensive thing this site does and the
// only endpoint a traffic wave can make expensive.

/** Rendered image: long edge cache (purged on deploy), short browser cache. */
export const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

/** Unknown slug: cached briefly, so a slug that becomes valid later isn't stuck. */
export const OG_NOT_FOUND_CACHE_CONTROL = "public, max-age=300, s-maxage=3600";
