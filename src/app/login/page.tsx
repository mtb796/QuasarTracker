import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");

  return (
    <main className="flex min-h-screen flex-col">
      <div className="quasar-gradient h-1" />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center text-center">
            <Logo size={64} id="login" />
            <h1 className="wordmark mt-4 text-2xl text-ink">Quasar</h1>
            <p className="mt-2 text-sm text-muted">
              Shared workspace for properties, tenants and owners.
            </p>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
