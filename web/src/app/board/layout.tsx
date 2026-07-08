import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The board",
  description:
    "Every live instrument on the Co-Sign coordinator: open jobs seeking a backer, running bonds, settlements, and slashes — read live from Stacks testnet.",
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
