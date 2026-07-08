import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live instrument",
  description:
    "One on-chain trust position: the client's escrow, the backer's stake, the worker's cycle — and the deadline block that settles them all.",
};

export default function JobLayout({ children }: { children: React.ReactNode }) {
  return children;
}
