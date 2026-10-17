import { loadSettings } from "@/lib/settings";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { aiKeyStatus } from "@/lib/ai/client";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, aiKey] = await Promise.all([loadSettings(), aiKeyStatus()]);
  const e = env();
  return (
    <div>
      <PageHeader title="Settings" />
      <SettingsForm
        initial={settings}
        envCaptcha={e.CAPTCHA_PROVIDER}
        githubToken={!!process.env.GITHUB_TOKEN?.trim()}
        aiKey={aiKey}
        captchaKeys={{ turnstile: !!(e.TURNSTILE_SITE_KEY && e.TURNSTILE_SECRET_KEY), recaptcha: !!(e.RECAPTCHA_SITE_KEY && e.RECAPTCHA_SECRET_KEY) }}
      />
    </div>
  );
}
