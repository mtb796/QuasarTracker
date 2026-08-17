import Link from "next/link";

// The two states that need attention get the two brand accents: amber for
// vacant, crimson for on-notice. Occupied — the state needing nothing — stays
// calm and green so the accents keep their urgency.
const OCCUPANCY_STYLES: Record<string, string> = {
  occupied: "bg-emerald-50 text-emerald-700",
  vacant: "bg-ember-tint text-amber-800",
  notice: "bg-crimson-tint text-accent-strong",
  unknown: "bg-gray-100 text-gray-600",
};

const OCCUPANCY_LABELS: Record<string, string> = {
  occupied: "Occupied",
  vacant: "Vacant",
  notice: "On notice",
  unknown: "Unknown",
};

export function OccupancyPill({ value }: { value: string }) {
  return (
    <span className={`pill ${OCCUPANCY_STYLES[value] ?? OCCUPANCY_STYLES.unknown}`}>
      {OCCUPANCY_LABELS[value] ?? value}
    </span>
  );
}

const TENANT_STYLES: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-700",
  future: "bg-ember-tint text-amber-800",
  past: "bg-gray-100 text-gray-600",
  unknown: "bg-gray-100 text-gray-600",
};

export function TenantStatusPill({ value }: { value: string }) {
  return (
    <span className={`pill ${TENANT_STYLES[value] ?? TENANT_STYLES.unknown}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}

/**
 * Our own workflow marker. Deliberately slate rather than a semantic colour —
 * it reads as "written by us" instead of competing with AppFolio's statuses.
 */
export function WorkStatusPill({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span className="pill bg-ink/8 text-ink ring-1 ring-ink/10" data-work-status>
      {value}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children ?? <span className="text-muted">—</span>}</dd>
    </div>
  );
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted">
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link className="hover:text-ink hover:underline" href={item.href}>
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatWhen(value: Date): string {
  const minutes = Math.round((Date.now() - value.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
