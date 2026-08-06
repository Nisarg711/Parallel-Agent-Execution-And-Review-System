import { Sidebar } from "@/components/Sidebar";

// Only real app pages (dashboard, task detail) live in this route group, so
// only they get the sidebar — login/signup sit outside it and get just the
// bare root layout, since you're not "in the app" yet on those pages.
export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
