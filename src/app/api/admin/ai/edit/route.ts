import { adminRoute, readJson } from "@/lib/guard";
import { aiStream } from "@/lib/ai/client";
import { aiAnswerToContent, prepareAiEdit } from "@/lib/ai/editing";

/**
 * Streams an AI edit as newline-delimited JSON: `{"t":"d","v":"text"}` per chunk, then
 * `{"t":"done","content":<editor JSON>}`, or `{"t":"error","v":"message"}`. Nothing is saved.
 * Setup and provider errors before the first chunk are normal JSON error responses.
 */
export const POST = adminRoute(async (req) => {
  const { cfg, request } = await prepareAiEdit(await readJson(req));
  const deltas = await aiStream(cfg, request, req.signal);
  const encoder = new TextEncoder();
  const line = (v: unknown) => encoder.encode(`${JSON.stringify(v)}\n`);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      try {
        for await (const d of deltas) {
          text += d;
          controller.enqueue(line({ t: "d", v: d }));
        }
        if (!text.trim()) throw new Error("The AI returned an empty answer.");
        controller.enqueue(line({ t: "done", content: aiAnswerToContent(text) }));
      } catch (err) {
        if (!req.signal.aborted) controller.enqueue(line({ t: "error", v: (err as Error).message }));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void deltas.return(undefined);
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
  });
});
