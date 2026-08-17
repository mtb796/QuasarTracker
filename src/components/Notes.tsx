import Link from "next/link";
import { addNote, deleteNote, togglePin } from "@/app/actions";
import { formatWhen } from "./ui";

export type NoteTarget = {
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  ownerId?: string;
};

export type NoteRecord = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  author: { id: string; name: string };
  property?: { id: string; name: string } | null;
  unit?: { id: string; name: string; property: { id: string; name: string } } | null;
};

export function NoteComposer({
  target,
  returnTo,
  placeholder = "Share an update…",
}: {
  target: NoteTarget;
  returnTo: string;
  placeholder?: string;
}) {
  return (
    <form action={addNote} className="card p-3">
      {Object.entries(target).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <input type="hidden" name="returnTo" value={returnTo} />
      <textarea
        className="input min-h-[72px] resize-y"
        name="body"
        placeholder={placeholder}
        required
      />
      <div className="mt-2 flex justify-end">
        <button className="btn btn-primary" type="submit">
          Post update
        </button>
      </div>
    </form>
  );
}

export function NoteFeed({
  notes,
  currentUserId,
  returnTo,
  showContext = false,
}: {
  notes: NoteRecord[];
  currentUserId: string;
  returnTo: string;
  showContext?: boolean;
}) {
  if (notes.length === 0) {
    return <p className="px-1 py-4 text-sm text-muted">No updates yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className={`card p-3 ${note.pinned ? "border-amber-300 bg-amber-50/40" : ""}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{note.author.name}</span>
            <span className="shrink-0 text-xs text-muted">
              {formatWhen(note.createdAt)}
            </span>
          </div>

          {showContext && <NoteContext note={note} />}

          <p className="mt-1 whitespace-pre-wrap text-sm">{note.body}</p>

          <div className="mt-2 flex gap-3 text-xs">
            <form action={togglePin}>
              <input type="hidden" name="id" value={note.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button className="text-muted hover:text-ink" type="submit">
                {note.pinned ? "Unpin" : "Pin"}
              </button>
            </form>
            {note.author.id === currentUserId && (
              <form action={deleteNote}>
                <input type="hidden" name="id" value={note.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button className="text-muted hover:text-accent-strong" type="submit">
                  Delete
                </button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** On the dashboard a note needs to say what it's about. */
function NoteContext({ note }: { note: NoteRecord }) {
  if (note.unit) {
    return (
      <Link className="text-xs text-accent hover:underline" href={`/units/${note.unit.id}`}>
        {note.unit.property.name} · Unit {note.unit.name}
      </Link>
    );
  }
  if (note.property) {
    return (
      <Link
        className="text-xs text-accent hover:underline"
        href={`/properties/${note.property.id}`}
      >
        {note.property.name}
      </Link>
    );
  }
  return <span className="text-xs text-muted">General</span>;
}
