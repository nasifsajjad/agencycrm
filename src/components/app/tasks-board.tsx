"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, useDraggable, useDroppable, type DropResult } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { updateTaskStatusAction } from "@/lib/crm-actions";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate, initials, humanStatus } from "@/lib/format";

interface Task {
  id: string;
  name: string;
  priority: string;
  statusId: string;
  statusName: string;
  statusColor: string | null;
  statusCategory: string;
  assigneeName: string | null;
  dueAt: string | null;
  estimateMinutes: number;
}

export function TasksBoard({
  workspaceSlug,
  statuses,
  tasks,
  canEdit,
}: {
  workspaceSlug: string;
  statuses: { id: string; name: string; color?: string | null; category?: string }[];
  tasks: Task[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function onDragEnd(result: DropResult) {
    if (!result.destination || result.destination.droppableId === result.source.droppableId) return;
    const taskId = String(result.draggableId);
    const newStatusId = result.destination.droppableId;
    setPendingId(taskId);
    try {
      const res = await updateTaskStatusAction(workspaceSlug, taskId, newStatusId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Task moved");
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {statuses.map((status) => {
          const statusTasks = tasks.filter((t) => t.statusId === status.id);
          const totalEstimate = statusTasks.reduce((s, t) => s + t.estimateMinutes, 0);
          return (
            <div key={status.id} className="flex w-72 shrink-0 flex-col rounded-lg border border-border/60 bg-muted/20">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color ?? "var(--muted-foreground)" }} />
                  <span className="text-sm font-medium">{status.name}</span>
                  <span className="text-xs text-muted-foreground">{statusTasks.length}</span>
                </div>
                {totalEstimate > 0 && (
                  <span className="text-xs text-muted-foreground">{Math.floor(totalEstimate / 60)}h</span>
                )}
              </div>
              <DroppableContainer id={status.id}>
                <div className="flex-1 space-y-2 p-2 min-h-[200px]">
                  {statusTasks.map((t) => (
                    <DraggableTaskCard
                      key={t.id}
                      task={t}
                      pending={pendingId === t.id}
                      disabled={!canEdit || t.statusCategory === "done"}
                    />
                  ))}
                  {statusTasks.length === 0 && (
                    <div className="rounded-md border border-dashed py-6 text-center text-xs text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </div>
              </DroppableContainer>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}

function DroppableContainer({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={isOver ? "bg-muted/40" : ""}>
      {children}
    </div>
  );
}

function DraggableTaskCard({ task, pending, disabled }: { task: Task; pending: boolean; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled,
  });
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: pending ? 0.5 : isDragging ? 0.7 : 1,
  };
  const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-md border border-border/60 bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="text-sm font-medium">{task.name}</div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {task.priority !== "normal" && (
            <Badge variant="outline" className={
              task.priority === "urgent" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 text-[10px]"
              : task.priority === "high" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px]"
              : "text-[10px]"
            }>
              {humanStatus(task.priority)}
            </Badge>
          )}
          {task.estimateMinutes > 0 && (
            <span className="text-[10px] text-muted-foreground">{Math.floor(task.estimateMinutes / 60)}h</span>
          )}
        </div>
        {task.assigneeName && (
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px]">{initials(task.assigneeName)}</AvatarFallback>
          </Avatar>
        )}
      </div>
      {task.dueAt && (
        <div className={`mt-1.5 text-[10px] ${isOverdue ? "text-danger" : "text-muted-foreground"}`}>
          Due {formatDate(task.dueAt)}
        </div>
      )}
    </div>
  );
}
