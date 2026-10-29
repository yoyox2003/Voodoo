import { useNavigate } from "react-router";
import { Button } from "../UI/Button";
import { PageFrame } from "./PageState";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <PageFrame title="Home">
      <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">Start with a task, then organise it into your workspace.</p>
      <Button className="mt-6" onClick={() => navigate("/tasks/new", { state: { returnTo: "/" }, viewTransition: true })}>
        Create task
      </Button>
    </PageFrame>
  );
}
