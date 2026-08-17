"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Debounced search box that writes `q` into the URL, keeping other params. */
export function SearchBar({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params}`));
    }, 250);

    return () => clearTimeout(timer);
  }, [value, searchParams, pathname, router]);

  return (
    <input
      aria-label={placeholder}
      className="input max-w-xs"
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  );
}
