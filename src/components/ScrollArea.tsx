import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type ScrollAreaProps = {
  children: ReactNode;
  enabled: boolean;
  expanded: boolean;
  label: string;
  maxHeightClass: string;
};

export function ScrollArea({ children, enabled, expanded, label, maxHeightClass }: ScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ height: number; top: number } | null>(null);

  const updateIndicator = useCallback(() => {
    const element = scrollRef.current;
    if (!element || element.scrollHeight <= element.clientHeight) {
      setIndicator(null);
      return;
    }
    const height = Math.max(16, element.clientHeight * element.clientHeight / element.scrollHeight);
    const top = (element.clientHeight - height) * element.scrollTop / (element.scrollHeight - element.clientHeight);
    setIndicator({ height, top });
  }, []);

  useEffect(() => {
    if (!enabled || !expanded || !scrollRef.current || !contentRef.current) return;
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(scrollRef.current);
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [enabled, expanded, updateIndicator]);

  return (
    <div className="relative">
      <div
        aria-label={enabled && expanded ? label : undefined}
        className={enabled ? `${maxHeightClass} overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden` : undefined}
        onScroll={updateIndicator}
        ref={scrollRef}
        role={enabled && expanded ? "region" : undefined}
        tabIndex={enabled && expanded ? 0 : undefined}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {enabled && expanded && indicator && (
        <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 w-[3px] rounded-full bg-[#aaa19a] dark:bg-[#77706a]" data-scroll-indicator style={{ height: indicator.height, transform: `translateY(${indicator.top}px)` }} />
      )}
    </div>
  );
}
