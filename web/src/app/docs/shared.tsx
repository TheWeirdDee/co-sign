// Shared docs chrome: the section map (drives the sidebar + prev/next),
// on-chain constants, and the PrevNext pager. Not a route (only page/layout
// files are routes).

import Link from "next/link";

export const COSIGN = "ST31DYZV2SMJHDWQ39T8MWBW8N0AKDR0PVM43D6T2.cosign-v2";
export const FLOWVAULT = "STD7QG84VQQ0C35SZM2EYTHZV4M8FQ0R7YNSQWPD.flowvault-v2";
export const USDCX = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usdcx";
export const SPLIT_PROOF =
  "https://explorer.hiro.so/txid/0x695af90092644672be11794f0cda9fa3040f18cc165917361e0190335d9e73c7?chain=testnet";

export interface DocPage {
  slug: string; // route under /docs ("" = index)
  title: string;
  group: string;
}

export const DOC_PAGES: DocPage[] = [
  { slug: "", title: "What is Co-Sign?", group: "Overview" },
  { slug: "flowvault", title: "What is FlowVault?", group: "Overview" },
  { slug: "trust-model", title: "The trust model", group: "Overview" },
  { slug: "setup", title: "One-time setup", group: "Guide" },
  { slug: "walkthrough", title: "Full walkthrough", group: "Guide" },
  { slug: "flows", title: "The four flows", group: "Guide" },
  { slug: "numbers", title: "Understanding the numbers", group: "Guide" },
  { slug: "developers", title: "For developers", group: "Protocol" },
  { slug: "reference", title: "Contract reference", group: "Protocol" },
  { slug: "troubleshooting", title: "Troubleshooting", group: "Protocol" },
];

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : "/docs");

/** Bottom-of-page pager: previous / next section. */
export function PrevNext({ slug }: { slug: string }) {
  const i = DOC_PAGES.findIndex((p) => p.slug === slug);
  const prev = i > 0 ? DOC_PAGES[i - 1] : null;
  const next = i < DOC_PAGES.length - 1 ? DOC_PAGES[i + 1] : null;
  return (
    <nav className="doc-pn" aria-label="Documentation pages">
      {prev ? (
        <Link href={docHref(prev.slug)} className="doc-pn-card">
          <span className="k">← Previous</span>
          <span className="t">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={docHref(next.slug)} className="doc-pn-card next">
          <span className="k">Next →</span>
          <span className="t">{next.title}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Page header: group eyebrow + title + optional lede. */
export function DocHead({
  slug,
  lede,
}: {
  slug: string;
  lede?: string;
}) {
  const page = DOC_PAGES.find((p) => p.slug === slug);
  return (
    <>
      <div className="doc-eyebrow">{page?.group ?? "Documentation"}</div>
      <h1>{page?.title}</h1>
      {lede && (
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {lede}
        </p>
      )}
    </>
  );
}
