"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setSubsidized } from "@/app/(app)/board/actions";

export type BoardCard = {
  id: string;
  tenant: string;
  property: string;
  unitId: string | null;
  unitName: string | null;
  rent: number | null;
  leaseEnd: string | null;
  subsidized: boolean | null;
};

type LaneKey = "subsidized" | "market" | "unset";

const LANES: { key: LaneKey; title: string; blurb: string; accent: string }[] = [
  {
    key: "subsidized",
    title: "Subsidised",
    blurb: "Increase capped by the programme",
    accent: "bg-sky-tint border-sky/30",
  },
  {
    key: "market",
    title: "Market rate",
    blurb: "Increase set by comps",
    accent: "bg-leaf-tint border-leaf/30",
  },
  {
    key: "unset",
    title: "Not sorted yet",
    blurb: "Drag these into a lane",
    accent: "bg-ember-tint border-ember/30",
  },
];

const laneOf = (value: boolean | null): LaneKey =>
  value === true ? "subsidized" : value === false ? "market" : "unset";

const valueOf = (lane: LaneKey): boolean | null =>
  lane === "subsidized" ? true : lane === "market" ? false : null;

/**
 * Drag a tenancy between programme lanes.
 *
 * Uses the browser's own drag-and-drop rather than a library — three lanes and
 * a flat list don't need one, and it keeps the bundle honest. Every card also
 * has plain buttons, because HTML5 drag events don't fire on touch screens and
 * this needs to work from a phone.
 */
export function SubsidyBoard({ cards }: { cards: BoardCard[] }) {
  const [, startTransition] = useTransition();
  const [optimistic, move] = useOptimistic(
    cards,
    (state: BoardCard[], change: { id: string; lane: LaneKey }) =>
      state.map((card) =>
        card.id === change.id ? { ...card, subsidized: valueOf(change.lane) } : card,
      ),
  );
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LaneKey | null>(null);
  const [query, setQuery] = useState("");

  const visible = query.trim()
    ? optimistic.filter((c) =>
        `${c.tenant} ${c.property} ${c.unitName ?? ""}`.toLowerCase().includes(query.toLowerCase()),
      )
    : optimistic;

  function apply(id: string, lane: LaneKey) {
    startTransition(async () => {
      move({ id, lane });
      await setSubsidized(id, valueOf(lane));
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by tenant, property or unit…"
          type="search"
          value={query}
        />
        <p className="text-sm text-muted">
          {optimistic.filter((c) => c.subsidized === null).length} still unsorted
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {LANES.map((lane) => {
          const items = visible.filter((card) => laneOf(card.subsidized) === lane.key);
          return (
            <section
              className={`lane ${lane.accent} ${over === lane.key ? "lane-over" : ""}`}
              key={lane.key}
              onDragLeave={() => setOver((c) => (c === lane.key ? null : c))}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(lane.key);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain") || dragging;
                if (id) apply(id, lane.key);
                setDragging(null);
              }}
            >
              <header className="mb-3 px-1">
                <h2 className="text-sm font-semibold">
                  {lane.title}{" "}
                  <span className="font-normal text-muted">({items.length})</span>
                </h2>
                <p className="text-xs text-muted">{lane.blurb}</p>
              </header>

              <ul className="space-y-2">
                {items.map((card) => (
                  <li
                    className={`chip ${dragging === card.id ? "chip-dragging" : ""}`}
                    draggable
                    key={card.id}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", card.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(card.id);
                    }}
                  >
                    <div className="text-sm font-medium">{card.tenant}</div>
                    <div className="text-xs text-muted">
                      {card.unitId ? (
                        <Link className="text-accent hover:underline" href={`/units/${card.unitId}`}>
                          {card.property}
                        </Link>
                      ) : (
                        card.property
                      )}
                      {card.rent !== null && ` · $${card.rent.toLocaleString("en-US")}`}
                    </div>
                    {card.leaseEnd && (
                      <div className="text-xs text-muted">
                        Ends{" "}
                        {new Date(card.leaseEnd).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    )}

                    {/* Touch fallback — drag events never fire on a phone. */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {LANES.filter((other) => other.key !== lane.key).map((other) => (
                        <button
                          className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-accent"
                          key={other.key}
                          onClick={() => apply(card.id, other.key)}
                          type="button"
                        >
                          → {other.title}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}

                {items.length === 0 && (
                  <li className="rounded-[12px] border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                    Drop here
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
