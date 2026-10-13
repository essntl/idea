/** Renders stored HTML. It was sanitized by the content pipeline when saved (src/lib/content/pipeline.ts). */
export function Prose({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`prose ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
