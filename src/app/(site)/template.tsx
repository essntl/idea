/** Re-mounts on navigation, giving each page a short fade-in (disabled with prefers-reduced-motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-fade">{children}</div>;
}
