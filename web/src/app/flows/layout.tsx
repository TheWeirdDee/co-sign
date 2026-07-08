import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The four flows",
  description:
    "Drive all four Co-Sign flows end-to-end on Stacks testnet — every write returns a transaction id with an explorer link.",
};

export default function FlowsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
