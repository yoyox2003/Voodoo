import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { ApiError } from "../lib/api";

type PageFrameProps = {
  backTo?: string;
  backLabel?: string;
  children: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  wide?: boolean;
};

export function PageFrame({
  backTo,
  backLabel = "Back",
  children,
  eyebrow,
  title,
  wide = false,
}: PageFrameProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isGoingBack, setIsGoingBack] = useState(false);
  const backTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (backTimer.current !== null) clearTimeout(backTimer.current);
    },
    [],
  );

  function goBack() {
    if (!backTo || backTimer.current !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(backTo);
      return;
    }
    setIsGoingBack(true);
    backTimer.current = setTimeout(() => {
      backTimer.current = null;
      setIsGoingBack(false);
      navigate(backTo, { state: { backTransition: true } });
    }, 180);
  }

  return (
    <main
      className={`mx-auto px-6 py-10 sm:px-10 lg:px-12 lg:py-14 ${location.state?.backTransition ? "back-page-enter" : ""} ${isGoingBack ? "back-page-exit" : ""} ${wide ? "max-w-[1200px]" : "max-w-[900px]"}`}
    >
      {backTo && (
        <button
          className="mb-6 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[#716a64] transition hover:bg-[#f3f1ef] hover:text-[#c84b37] focus:outline-none focus:ring-2 focus:ring-[#d95d47] focus:ring-offset-2 dark:text-[#b9b1aa] dark:hover:bg-[#302d29] dark:hover:text-[#ffad9b] dark:focus:ring-offset-[#1e1c1a]"
          onClick={goBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={18} />
          {backLabel}
        </button>
      )}
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#c84b37] dark:text-[#ff9d87]">
          {eyebrow}
        </p>
      )}
      <h1 className="text-3xl font-bold tracking-[-0.025em] sm:text-[32px]">{title}</h1>
      {children}
    </main>
  );
}

export function WorkspacePageStatus({
  error,
  isError,
  isLoading,
}: {
  error: unknown;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <p className="mt-10 text-sm text-[#77716b] dark:text-[#aaa29b]">Loading your workspace…</p>
    );
  if (!isError) return null;
  const message =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : "Unable to load your workspace.";
  return (
    <p
      className="mt-10 border-l-2 border-[#c84b37] bg-[#fff5f1] px-4 py-3 text-sm text-[#9f3d2c] dark:bg-[#3d2722] dark:text-[#ffad9b]"
      role="alert"
    >
      {message}
    </p>
  );
}
