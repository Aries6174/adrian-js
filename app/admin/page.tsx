import { Suspense } from "react";
import { AdminApp, LoginForm } from "@/components/admin/AdminApp";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { listMessages, loadContent } from "@/lib/store";

async function AdminGate() {
  const content = await loadContent();
  if (!adminConfigured()) {
    return (
      <p className="copy mx-auto max-w-md p-10 text-center">
        Admin is switched off. Set ADMIN_PASSWORD to at least 16 characters in the site&apos;s
        environment settings to use it.
      </p>
    );
  }
  if (!(await isAdmin())) return <LoginForm />;
  const messages = await listMessages().catch((error) => {
    console.error("Could not read messages.", error);
    return [];
  });
  return <AdminApp initial={content} initialMessages={messages} />;
}

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminGate />
    </Suspense>
  );
}
