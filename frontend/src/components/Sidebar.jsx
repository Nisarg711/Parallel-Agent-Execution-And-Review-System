"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BranchIcon } from "@/components/BrandMark";

function TasksIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function WorkersIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SettingsIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="8" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.4 3.6l-1.4 1.4M5 9.6l-1.4 1.4M12.4 12.4l-1.4-1.4M5 6.4L3.6 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Static nav for now — no routing logic needed since there's only one real
// page today. Swap `disabled` items for real routes as they get built.
const NAV_ITEMS = [
  { label: "Tasks", href: "/", disabled: false, Icon: TasksIcon },
  { label: "Workers", href: "/#workers", disabled: false, Icon: WorkersIcon },
  { label: "Settings", href: "#", disabled: true, Icon: SettingsIcon },
];

// Persistent left rail, shared by every "real" app page via the (app) route
// group's layout — deliberately excluded from /login and /signup, since you
// aren't "in the app" yet on those. Collapses to a slim icon rail; state is
// local (resets on full reload) rather than persisted, since this is still
// a visual placeholder ahead of real auth/preferences.
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [onWorkersSection, setOnWorkersSection] = useState(false);
  const pathname = usePathname();

  // Scroll-spy: "Tasks" and "Workers" are the same route (/), just different
  // scroll positions on it — usePathname() alone can't tell them apart, so
  // both would show active at once. Track whether #workers is actually in
  // view instead, so exactly one nav item lights up at a time.
  useEffect(() => {
    const el = document.getElementById("workers");
    if (!el) {
      setOnWorkersSection(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setOnWorkersSection(entry.isIntersecting),
      { rootMargin: "-96px 0px -70% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pathname]);

  const isActive = (href) => {
    const path = href.split("#")[0];
    if (path !== pathname) return false;
    return href.includes("#workers") ? onWorkersSection : !onWorkersSection;
  };

  if (collapsed) {
    return (
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center gap-6 border-r border-[#181D27] bg-[#0B0E14] py-7 sm:flex">
        <Link href="/" aria-label="Agent Tasks">
          <BranchIcon className="h-5 w-5 text-[#E8A33D]" />
        </Link>
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#7C8494] transition hover:bg-[#12161F] hover:text-[#E6E8EB]"
        >
          ›
        </button>
        <nav className="mt-2 flex flex-col gap-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-disabled={item.disabled}
              title={item.label}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                item.disabled
                  ? "pointer-events-none text-[#3A414D]"
                  : isActive(item.href)
                    ? "bg-[#1A1610] text-[#E8A33D]"
                    : "text-[#7C8494] hover:bg-[#12161F] hover:text-[#E6E8EB]"
              }`}
            >
              <item.Icon className="h-4 w-4" />
            </Link>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-[#181D27] bg-[#0B0E14] px-5 py-7 sm:flex">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 font-mono text-base font-semibold text-[#E6E8EB]">
          <BranchIcon className="h-5 w-5 text-[#E8A33D]" />
          Agent Tasks
        </Link>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#7C8494] transition hover:bg-[#12161F] hover:text-[#E6E8EB]"
        >
          ‹
        </button>
      </div>
      <p className="ml-7.5 mt-0.5 text-xs text-[#4B5563]">Parallel agent orchestrator</p>

      <nav className="mt-9 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = !item.disabled && isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-disabled={item.disabled}
              className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition ${
                item.disabled
                  ? "pointer-events-none border-transparent text-[#4B5563]"
                  : active
                    ? "border-[#E8A33D] bg-[#1A1610] text-[#E6E8EB]"
                    : "border-transparent text-[#9AA1AC] hover:bg-[#12161F] hover:text-[#E6E8EB]"
              }`}
            >
              <item.Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.disabled && (
                <span className="rounded-full border border-[#232935] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[#4B5563]">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-lg border border-[#232935] bg-[#12161F] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#232935] font-mono text-sm text-[#9AA1AC]">
            ?
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-[#E6E8EB]">Guest</p>
            <p className="truncate text-xs text-[#4B5563]">No account yet</p>
          </div>
        </div>
        <Link
          href="/login"
          className="mt-3 block w-full rounded-md border border-[#232935] py-2 text-center text-sm text-[#9AA1AC] transition hover:border-[#3A4150] hover:text-[#E6E8EB]"
        >
          Sign in
        </Link>
      </div>
    </aside>
  );
}
