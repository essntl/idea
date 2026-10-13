import { formatDate } from "@/lib/format";

export function DateText({ iso, className, style = "long" }: { iso: string; className?: string; style?: "long" | "short" }) {
  return (
    <time dateTime={iso} className={className}>
      {formatDate(iso, style)}
    </time>
  );
}
