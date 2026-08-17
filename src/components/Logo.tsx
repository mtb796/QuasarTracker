/**
 * The Quasar mark: an accretion disk seen edge-on, a bright core, and the two
 * jets firing out of it.
 *
 * Drawn to stay readable when it's 22px tall in the header — the disk is two
 * broken arcs rather than a closed ring, which is what gives it the swirl at
 * small sizes, and the jets are solid tapered wedges so they don't disappear.
 *
 * `id` scopes the gradient definitions. Two of these on one page with the same
 * id would make the second one reuse the first's gradients, so each instance
 * needs its own.
 */
export function Logo({ size = 28, id = "quasar" }: { size?: number; id?: string }) {
  const core = `${id}-core`;
  const jet = `${id}-jet`;

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={core} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFC24A" />
          <stop offset="45%" stopColor="#F5901F" />
          <stop offset="100%" stopColor="#E4335C" />
        </radialGradient>
        <linearGradient id={jet} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#F0325A" />
          <stop offset="100%" stopColor="#F5701F" />
        </linearGradient>
      </defs>

      <g transform="rotate(-20 32 33)">
        {/* The disk is a dashed ellipse rather than hand-plotted arcs: the gaps
            fall where the logo's spiral breaks, and the shape stays predictable
            at any size. Dash lengths are tuned to the ellipse's ~114 perimeter. */}
        <ellipse
          cx="32"
          cy="33"
          rx="24"
          ry="11"
          stroke="#3D4250"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="45 12"
          strokeDashoffset="22"
        />
        {/* Second, tighter band — the white space between the two is the swirl.
            Below ~32px the two bands blur into one blob, so the mark drops to
            a single band and stays legible. */}
        {size >= 32 && (
          <ellipse
            cx="32"
            cy="33"
            rx="14"
            ry="6.5"
            stroke="#3D4250"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeDasharray="26 10"
            strokeDashoffset="6"
          />
        )}
        <ellipse cx="32" cy="33" rx="8.5" ry="4.1" fill={`url(#${core})`} />
      </g>

      {/* Jets: the long crimson one entering top-left, the amber one exiting low-right. */}
      <path d="M11 3 L37 32 L31.5 35.5 Z" fill={`url(#${jet})`} />
      <path d="M57.5 62 L39 41 L43.5 38 Z" fill="#F5A623" />
    </svg>
  );
}

/** Mark plus wordmark, for the header and the login screen. */
export function Wordmark({
  size = 26,
  text = "text-base",
  id = "quasar",
}: {
  size?: number;
  text?: string;
  id?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Logo size={size} id={id} />
      <span className={`wordmark text-ink ${text}`}>Quasar</span>
    </span>
  );
}
