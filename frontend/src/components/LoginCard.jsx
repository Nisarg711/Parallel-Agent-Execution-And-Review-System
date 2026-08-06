import Link from "next/link";
import { BranchIcon } from "@/components/BrandMark";

// Visual-only for now — no auth wired up yet, hence the disabled submit.
// Styled to match the composer/sidebar: same card, input, and label
// conventions used everywhere else in the app.
export function LoginCard() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-[#232935] bg-[#12161F] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="mb-6 flex items-center gap-2">
        <BranchIcon className="h-4 w-4 text-[#E8A33D]" />
        <h1 className="font-mono text-lg font-semibold text-[#E6E8EB]">Log in</h1>
      </div>

      <form className="space-y-4">
        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-[#7C8494]">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-[#232935] bg-[#0B0E14] px-3 py-2 text-sm text-[#E6E8EB] placeholder:text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#E8A33D]/60"
          />
        </div>

        <div>
          <label className="mb-1.5 block font-mono text-xs uppercase tracking-widest text-[#7C8494]">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full rounded-md border border-[#232935] bg-[#0B0E14] px-3 py-2 text-sm text-[#E6E8EB] placeholder:text-[#4B5563] focus:outline-none focus:ring-1 focus:ring-[#E8A33D]/60"
          />
        </div>

        <button
          type="submit"
          disabled
          className="w-full cursor-not-allowed rounded-md border border-[#232935] py-2 font-mono text-sm text-[#4B5563]"
        >
          Log in — coming soon
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[#7C8494]">
        Don't have an account?{" "}
        <Link href="/signup" className="text-[#E8A33D] hover:text-[#F0B15A]">
          Sign up
        </Link>
      </p>
    </div>
  );
}
