import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Wordmark } from "@/components/Logo";
import { logout } from "../actions";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/renewals", label: "Renewals" },
  { href: "/properties", label: "Properties" },
  { href: "/tenants", label: "Tenants" },
  { href: "/owners", label: "Owners" },
  { href: "/tasks", label: "Tasks" },
  { href: "/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div>
      {/* The jet gradient as a hairline across the top — the one bright note. */}
      <div className="quasar-gradient h-[3px]" />

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link className="shrink-0" href="/" aria-label="Quasar home">
            <Wordmark size={26} text="text-sm" id="nav" />
          </Link>

          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                className="text-muted hover:text-ink"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted">{user.name}</span>
            <form action={logout}>
              <button className="text-muted hover:text-ink" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
