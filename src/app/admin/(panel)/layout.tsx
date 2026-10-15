import type { Metadata } from "next";
import { PageTransition } from "@/components/ui/page-transition";
import { requireAdminPage } from "@/lib/guard";
import { prisma } from "@/lib/db";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s — Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const pending = await prisma.comment.count({ where: { status: "pending" } });
  return (
    <div className="min-h-dvh lg:flex">
      <AdminNav email={admin.email} pendingComments={pending} />
      <main id="main" className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pt-10">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
