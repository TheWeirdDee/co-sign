import type { Metadata } from "next";
import Nav from "@/components/Nav";
import DocsSidebar from "@/components/DocsSidebar";

export const metadata: Metadata = {
  title: {
    template: "%s · Co-Sign Docs",
    default: "Documentation",
  },
  description:
    "Co-Sign from zero: wallet setup, the full walkthrough, the four flows, the trust model, and the contract reference.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />
        <div className="docs">
          <DocsSidebar />
          <div className="doc-body">{children}</div>
        </div>
        <footer>
          <div className="foot-mark">CO·SIGN</div>
          <div className="foot-note">Stacks testnet · FlowVault Builder Bounty</div>
        </footer>
      </div>
    </main>
  );
}
