import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Wraps a horizontally-scrolling row and adds a soft blur/fade over each edge,
 * shown only on the side there's still more to scroll toward (mirrors the
 * scrollbar-thin-brand convention: a subtle affordance, not a heavy overlay).
 */
export function HorizontalScroller({
  children,
  className = "",
  scrollClassName = "",
  edgeFromClassName,
  edgeWidthClassName = "w-6",
}: {
  children: ReactNode;
  /** Applied to the outer wrapper — use for e.g. flex-1 when nested in a flex row. */
  className?: string;
  scrollClassName?: string;
  /** e.g. "from-background" or "from-brand" — must match the row's own background. */
  edgeFromClassName: string;
  edgeWidthClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setAtStart(el.scrollLeft <= 4);
      setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [children]);

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} className={`scrollbar-thin-brand overflow-x-auto ${scrollClassName}`}>
        {children}
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 ${edgeWidthClassName} bg-gradient-to-r ${edgeFromClassName} to-transparent backdrop-blur-[0.5px] transition-opacity duration-300 ${
          atStart ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 ${edgeWidthClassName} bg-gradient-to-l ${edgeFromClassName} to-transparent backdrop-blur-[0.5px] transition-opacity duration-300 ${
          atEnd ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
}
