"use client";

// Deep link to one instrument. The primary surface is the board (/board);
// this route exists so a job can be shared/bookmarked directly.

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Nav from "@/components/Nav";
import JobInstrument from "@/components/JobInstrument";

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const jobId = useMemo(() => {
    try {
      return BigInt(params.id);
    } catch {
      return 0n;
    }
  }, [params.id]);

  return (
    <main className="cs-page flex-1">
      <div className="wrap">
        <Nav />
        <div className="sheet sheet-wide">
          <div className="overlay-bar">
            <span className="overlay-link">
              <Link href="/board">← back to the board</Link>
            </span>
          </div>
          <JobInstrument jobId={jobId} />
        </div>
      </div>
    </main>
  );
}
