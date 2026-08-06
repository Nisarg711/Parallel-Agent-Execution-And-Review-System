// Git-branch glyph: two nodes on the trunk plus one branch node peeling off —
// the product mark, since "isolated branch per task" is the whole idea.
// Shared between the sidebar and the dashboard header.
export function BranchIcon({ className }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <circle cx="4" cy="3" r="1.6" fill="currentColor" />
      <circle cx="4" cy="13" r="1.6" fill="currentColor" />
      <circle cx="12" cy="9" r="1.6" fill="currentColor" />
      <path d="M4 4.6V11.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 7C4 8.4 5 9 6.5 9H10.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
