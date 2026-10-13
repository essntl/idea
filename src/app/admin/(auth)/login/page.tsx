import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/guard";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  if (await getAdmin()) redirect("/admin");
  const { callbackUrl } = await searchParams;
  const target = typeof callbackUrl === "string" && callbackUrl.startsWith("/admin") ? callbackUrl : "/admin";
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 mb-8 text-sm text-muted">Admin area</p>
        <LoginForm callbackUrl={target} />
      </div>
    </main>
  );
}
