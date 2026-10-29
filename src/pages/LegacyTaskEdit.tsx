import { Navigate, useParams } from "react-router";

export function LegacyTaskEdit() {
  const { taskId } = useParams();
  return <Navigate to={`/tasks/${taskId}`} replace state={{ startEditing: true }} />;
}
