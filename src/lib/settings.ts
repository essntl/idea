import { z } from "zod";
import { unstable_cache } from "next/cache";
import { prisma } from "./db";
import { TAGS } from "./cache-tags";

export const settingsSchema = z.object({
  siteTitle: z.string().trim().min(1).max(120),
  siteDescription: z.string().trim().max(300),
  authorName: z.string().trim().min(1).max(120),
  portfolioUrl: z.string().trim().url().or(z.literal("")),
  contactEmail: z.string().trim().email().or(z.literal("")),
  githubUrl: z.string().trim().url().or(z.literal("")),
  /** Extra footer/social links. */
  socialLinks: z.array(z.object({ label: z.string().trim().min(1).max(40), url: z.string().trim().url() })).max(10),
  /** null = use CAPTCHA_PROVIDER from the environment. */
  captchaProvider: z.enum(["turnstile", "recaptcha"]).nullable(),
  commentsRequireApproval: z.boolean(),
  commentsEnabled: z.boolean(),
  /** GitHub profile, contribution graph and streaks on /projects (account taken from githubUrl). */
  showGithubActivity: z.boolean(),
  /** AI assistant (editor actions, project drafts from a repository). The API key is stored separately, encrypted. */
  aiEnabled: z.boolean(),
  aiProvider: z.enum(["anthropic", "openai"]),
  aiModel: z.string().trim().max(120),
  /** OpenAI-compatible endpoint, e.g. https://api.openai.com/v1 or http://ollama:11434/v1. */
  aiBaseUrl: z.string().trim().url().or(z.literal("")),
  postsPerPage: z.number().int().min(3).max(100),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  siteTitle: "idea",
  siteDescription: "Diary notes and long-form articles about technology.",
  authorName: "Artem",
  portfolioUrl: "https://artemk.dev",
  contactEmail: "contact@artemk.dev",
  githubUrl: "https://github.com/essntl",
  socialLinks: [],
  captchaProvider: null,
  commentsRequireApproval: false,
  commentsEnabled: true,
  showGithubActivity: true,
  aiEnabled: false,
  aiProvider: "anthropic",
  aiModel: "claude-sonnet-5-5",
  aiBaseUrl: "",
  postsPerPage: 10,
};

export async function loadSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const raw: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) raw[row.key] = row.value;
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export const getSettings = unstable_cache(loadSettings, ["settings"], { tags: [TAGS.settings] });

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await loadSettings();
  const next = settingsSchema.parse({ ...current, ...patch });
  await prisma.$transaction(
    Object.entries(next).map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } }),
    ),
  );
  return next;
}
