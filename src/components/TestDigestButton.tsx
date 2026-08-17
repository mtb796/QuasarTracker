"use client";

import { useTransition } from "react";
import { sendTestDigest } from "@/app/actions";

export function TestDigestButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn btn-accent"
      disabled={pending}
      onClick={() => startTransition(() => sendTestDigest())}
      type="button"
    >
      {pending ? "Sending…" : "Send me a test digest now"}
    </button>
  );
}
