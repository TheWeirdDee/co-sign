import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Draft a job",
  description:
    "Open a job on Co-Sign: name the worker, the pay, and the deadline — the escrow locks in a FlowVault vault owned by the contract.",
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
