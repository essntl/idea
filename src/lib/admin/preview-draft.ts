import type { JSONContent } from "@tiptap/core";
import type { ProjectPhase } from "../projects";

/** Unsaved editor state handed from the editor tab to its preview tab (same browser only). */
export type PreviewDraft = {
  title: string;
  description: string;
  contentJson: JSONContent;
  tags: string[];
  publishedAt: string | null;
  categoryId: string | null;
  previewImage: { url: string; width: number; height: number; alt: string } | null;
  /** Project-only fields. */
  project?: { phase: ProjectPhase; repoUrl: string; siteUrl: string; packageUrl: string; stack: string[] };
  at: number;
};

export const previewKey = (kind: string, id: string) => `preview-draft:${kind}:${id}`;
export const previewChannel = (kind: string, id: string) => `preview:${kind}:${id}`;

export function publishPreviewDraft(kind: string, id: string, draft: PreviewDraft) {
  try {
    localStorage.setItem(previewKey(kind, id), JSON.stringify(draft));
  } catch {
    // storage full or blocked: the BroadcastChannel below still updates an open preview
  }
  try {
    const ch = new BroadcastChannel(previewChannel(kind, id));
    ch.postMessage(draft);
    ch.close();
  } catch {
    // BroadcastChannel unsupported
  }
}

export function readPreviewDraft(kind: string, id: string): PreviewDraft | null {
  try {
    const raw = localStorage.getItem(previewKey(kind, id));
    return raw ? (JSON.parse(raw) as PreviewDraft) : null;
  } catch {
    return null;
  }
}
