"use client";

// Fixed docs sidebar with active-route highlighting.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_PAGES, docHref } from "@/app/docs/shared";

export default function DocsSidebar() {
  const pathname = usePathname();
  const groups = Array.from(new Set(DOC_PAGES.map((p) => p.group)));
  return (
    <aside className="doc-side" aria-label="Documentation sections">
      {groups.map((g) => (
        <div key={g}>
          <h6>{g}</h6>
          {DOC_PAGES.filter((p) => p.group === g).map((p) => {
            const href = docHref(p.slug);
            const on = pathname === href;
            return (
              <Link key={p.slug} href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
                {p.title}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
