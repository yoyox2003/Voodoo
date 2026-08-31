import { Link } from "react-router";
import { PageFrame } from "./PageState";

export function NotFoundPage() {
  return (
    <PageFrame title="Page not found">
      <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">That page does not exist or is no longer available.</p>
      <Link className="mt-6 inline-flex rounded-lg bg-[#d95d47] px-3 py-2 text-sm font-semibold text-white hover:bg-[#bf4d3a]" to="/">Go home</Link>
    </PageFrame>
  );
}
