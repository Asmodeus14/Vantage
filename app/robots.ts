import type { MetadataRoute } from "next";

/**
 * There was no robots.txt, which is not the same as not needing one.
 *
 * A request for a file this app does not serve falls through to the catch-all
 * route and returns the HTML 404 page. A crawler that does not get a clean 404
 * reads that HTML as robots.txt syntax, and Lighthouse scored it exactly that
 * way: `robots-txt` moved from not-applicable to failing, which raised the SEO
 * category's total weight from 11.043 to 12.043 and cost two audits instead of
 * one — 10.043/12.043 = 83.
 *
 * `/api/` is excluded because those are JSON handlers with nothing to index.
 *
 * `/r/` is deliberately *not* excluded. Report ids are unguessable and every
 * report is served `no-store`, so crawlers do not reach them unless someone
 * publishes a link — and if someone does publish one, they meant to. Blocking
 * the path would also fail `is-crawlable` on those pages, which is weighted
 * 4.043 of the category, so it is worth being explicit that this is a choice
 * rather than an oversight.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
  };
}
