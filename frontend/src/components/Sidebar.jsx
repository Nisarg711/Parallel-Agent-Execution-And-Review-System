"use client";

import { useState } from "react";
import Link from "next/link";
import { BranchIcon } from "@/components/BrandMark";

// Static nav for now — no routing logic needed since there's only one real
// page today. Swap `disabled` items for real routes as they get built.
const NAV_ITEMS = [
  { label: "Tasks", href: "/", disabled: false },
  { label: "Workers", href: "/#workers", disabled: false },
  { label: "Settings", href: "#", disabled: true },
];

// Persistent left rail, shared by every "real" app page via the (app) route
// group's layout — deliberately excluded from /login and /signup, since you
// aren't "in the app" yet on those. Collapses to a slim icon rail; state is
// local (resets on full reload) rather than persisted, since this is still
// a visual placeholder ahead of real auth/preferences.
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="sticky top-0 hidden h-screen w-14 shrink-0 flex-col items-center border-r border-[#181D27] bg-[#0B0E14] py-6 sm:flex">
        <Link href="/" aria-label="Agent Tasks">
          <BranchIcon className="h-4 w-4 text-[#E8A33D]" />
        </Link>
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="mt-8 flex h-6 w-6 items-center justify-center rounded-md text-[#7C8494] transition hover:bg-[#12161F] hover:text-[#E6E8EB]"
        >
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#181D27] bg-[#0B0E14] px-4 py-6 sm:flex">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 px-2 font-mono text-sm font-semibold text-[#E6E8EB]">
          <BranchIcon className="h-4 w-4 text-[#E8A33D]" />
          Agent Tasks
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#7C8494] transition hover:bg-[#12161F] hover:text-[#E6E8EB]"
        >
          ‹
        </button>
      </div>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-disabled={item.disabled}
            className={`flex items-center justify-between rounded-md px-2.5 py-1.5 font-mono text-xs transition ${
              item.disabled
                ? "pointer-events-none text-[#4B5563]"
                : "text-[#9AA1AC] hover:bg-[#12161F] hover:text-[#E6E8EB]"
            }`}
          >
            {item.label}
            {item.disabled && (
              <span className="rounded-full border border-[#232935] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#4B5563]">
                Soon
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-auto rounded-lg border border-dashed border-[#232935] p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#232935] font-mono text-xs text-[#9AA1AC]">
            ?
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs text-[#E6E8EB]">Guest</p>
            <p className="truncate text-[10px] text-[#4B5563]">No account yet</p>
          </div>
        </div>
        <Link
          href="/login"
          className="mt-3 block w-full rounded-md border border-[#232935] py-1.5 text-center font-mono text-[11px] text-[#9AA1AC] transition hover:border-[#3A4150] hover:text-[#E6E8EB]"
        >
          Sign in
        </Link>
      </div>
    </aside>
  );
}
