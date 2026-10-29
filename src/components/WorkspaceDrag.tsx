import { useAuth } from "@clerk/react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useAuthenticatedApi } from "../hooks/useAuthenticatedApi";
import { apiQueryKey, type WorkspaceData } from "../hooks/useWorkspaceData";
import { useToast } from "../toast/useToast";
import type { Task } from "../types/entities";

// When a row and its bucket both contain the pointer, prefer the row so the
// task can be inserted precisely. Empty buckets and sidebar targets still win
// when there is no row under the pointer.
const taskCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const sidebar = hits.filter((hit) => String(hit.id).startsWith("sidebar:"));
  const rows = hits.filter((hit) => hit.data?.droppableContainer.data.current?.kind === "task");
  return sidebar.length ? sidebar : rows.length ? rows : hits.length ? hits : args.pointerCoordinates ? [] : closestCenter(args);
};

// Bucket drop areas surround their rows, so the default keyboard sorter can
// select a bucket instead of the next row. Prefer rows for vertical movement
// and sidebar buckets for horizontal movement.
const taskKeyboardCoordinates: KeyboardCoordinateGetter = (event, { currentCoordinates, context }) => {
  const direction = event.code;
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(direction) || !context.collisionRect || !context.active) return undefined;
  event.preventDefault();
  const activeRect = context.collisionRect;
  const center = { x: activeRect.left + activeRect.width / 2, y: activeRect.top + activeRect.height / 2 };
  const candidates = context.droppableContainers.getEnabled().flatMap((container) => {
    const rect = context.droppableRects.get(container.id);
    if (!rect || container.id === context.active?.id) return [];
    const dx = rect.left + rect.width / 2 - center.x;
    const dy = rect.top + rect.height / 2 - center.y;
    if ((direction === "ArrowUp" && dy >= -1) || (direction === "ArrowDown" && dy <= 1) || (direction === "ArrowLeft" && dx >= -1) || (direction === "ArrowRight" && dx <= 1)) return [];
    return [{ container, dx, dy }];
  });
  const vertical = direction === "ArrowUp" || direction === "ArrowDown";
  const preferred = candidates.filter(({ container }) => vertical ? container.data.current?.kind === "task" : String(container.id).startsWith("sidebar:"));
  const choices = preferred.length ? preferred : candidates.filter(({ container }) => container.data.current?.bucketId !== context.active?.data.current?.bucketId);
  choices.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
  const target = choices[0];
  return target ? { x: currentCoordinates.x + target.dx, y: currentCoordinates.y + target.dy } : undefined;
};

export function WorkspaceDrag({ children, workspace, onTaskDragStart, onTaskDragFinish }: { children: ReactNode; workspace: WorkspaceData; onTaskDragStart?: () => void; onTaskDragFinish?: () => void }) {
  const request = useAuthenticatedApi();
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const toast = useToast();
  const key = apiQueryKey(userId, "/api/tasks");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: taskKeyboardCoordinates }));
  const move = useMutation({
    mutationFn: ({ id, bucketId, beforeTaskId }: { id: string; bucketId: string; beforeTaskId: string | null; order: string[] }) =>
      request<Task[]>(`/api/tasks/${id}/move`, { method: "PATCH", body: JSON.stringify({ bucketId, beforeTaskId }) }),
    onMutate: async ({ id, bucketId, order }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key)?.filter((item) => order.includes(item.id));
      queryClient.setQueryData<Task[]>(key, (current = []) => current.map((item) => {
        const index = order.indexOf(item.id);
        return index < 0 ? item : { ...item, bucketId: item.id === id ? bucketId : item.bucketId, position: index };
      }));
      return { previous };
    },
    onSuccess: (saved) => {
      const byId = new Map(saved.map((task) => [task.id, task]));
      queryClient.setQueryData<Task[]>(key, (current = []) => current.map((task) => byId.get(task.id) ?? task));
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        const previous = new Map(context.previous.map((task) => [task.id, task]));
        queryClient.setQueryData<Task[]>(key, (current = []) => current.map((task) => {
          const original = previous.get(task.id);
          return original ? { ...task, bucketId: original.bucketId, position: original.position } : task;
        }));
      }
      toast.error(error instanceof Error ? error.message : "Unable to move task.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  function onDragEnd({ active, over }: DragEndEvent) {
    onTaskDragFinish?.();
    if (!over || active.data.current?.kind !== "task" || move.isPending) return;
    const source = workspace.tasks.find((task) => task.id === active.data.current?.taskId);
    const targetBucket = over.data.current?.bucketId as string | undefined;
    if (!source || !targetBucket) return;
    const targetTask = over.data.current?.kind === "task" ? over.data.current.taskId as string : null;
    if (targetTask === source.id) return;
    const destination = workspace.tasks.filter((task) => task.bucketId === targetBucket).sort((a, b) => a.position - b.position);
    let ordered: Task[];
    if (source.bucketId === targetBucket && targetTask) {
      const from = destination.findIndex((task) => task.id === source.id);
      const to = destination.findIndex((task) => task.id === targetTask);
      if (from < 0 || to < 0) return;
      ordered = arrayMove(destination, from, to);
    } else {
      ordered = destination.filter((task) => task.id !== source.id);
      const index = targetTask ? ordered.findIndex((task) => task.id === targetTask) : ordered.length;
      if (index < 0) return;
      ordered.splice(index, 0, source);
    }
    const index = ordered.findIndex((task) => task.id === source.id);
    move.mutate({ id: source.id, bucketId: targetBucket, beforeTaskId: ordered[index + 1]?.id ?? null, order: ordered.map((task) => task.id) });
  }

  return <DndContext sensors={sensors} collisionDetection={taskCollision} onDragStart={onTaskDragStart} onDragCancel={onTaskDragFinish} onDragEnd={onDragEnd}>{children}</DndContext>;
}

export function TaskListOrder({ tasks, children }: { tasks: Task[]; children: ReactNode }) {
  return <SortableContext items={tasks.map((task) => `task:${task.id}`)} strategy={verticalListSortingStrategy}>{children}</SortableContext>;
}

export function SortableTask({ task, children }: { task: Task; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: `task:${task.id}`, data: { kind: "task", taskId: task.id, bucketId: task.bucketId } });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : undefined }} className="flex min-w-0 items-start gap-1">
    <button {...attributes} {...listeners} ref={setActivatorNodeRef} aria-label={`Reorder task ${task.title}`} className="mt-2 grid h-8 w-7 shrink-0 touch-none cursor-grab place-items-center text-[#aaa29b] active:cursor-grabbing" type="button"><Menu aria-hidden="true" size={16} /></button>
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
}

export function BucketDrop({ bucketId, sidebar = false, children }: { bucketId: string; sidebar?: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${sidebar ? "sidebar" : "bucket"}:${bucketId}`, data: { kind: "bucket", bucketId } });
  return <div ref={setNodeRef} className={isOver ? "rounded bg-[#f3f1ef] dark:bg-[#302d29]" : ""}>{children}</div>;
}
