export function StackList({ stack, limit, className = "" }: { stack: string[]; limit?: number; className?: string }) {
  if (!stack.length) return null;
  const shown = limit ? stack.slice(0, limit) : stack;
  const rest = stack.length - shown.length;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Stack">
      {shown.map((s) => (
        <li key={s} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
          {s}
        </li>
      ))}
      {rest > 0 && <li className="px-1 py-0.5 text-xs text-subtle">+{rest}</li>}
    </ul>
  );
}
