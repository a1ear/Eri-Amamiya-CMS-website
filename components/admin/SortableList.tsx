"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, useState, type ReactNode } from "react";
import { iconButton } from "./styles";

type Item = { _id: string };

/** Moves `id` to directly after `afterId` (or first), for optimistic updates. */
export function reorderLocal<T extends Item>(list: T[], id: string, afterId: string | null): T[] {
  const moving = list.find((x) => x._id === id);
  if (!moving) return list;
  const rest = list.filter((x) => x._id !== id);
  const at = afterId === null ? 0 : rest.findIndex((x) => x._id === afterId) + 1;
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}

/**
 * Vertical list reorderable by drag handle (mouse, touch, keyboard via
 * dnd-kit) and by explicit up/down buttons, which are easier on phones.
 * Calls `onMove(id, afterId)` with `afterId === null` meaning "first".
 */
export function SortableList<T extends Item>({
  items,
  itemLabel,
  onMove,
  children,
}: {
  items: T[];
  itemLabel: (item: T, index: number) => string;
  onMove: (id: T["_id"], afterId: T["_id"] | null) => Promise<unknown>;
  children: (item: T, index: number) => ReactNode;
}) {
  const helpId = useId();
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function moveTo(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = arrayMove(items, from, to);
    setError(null);
    try {
      await onMove(items[from]._id, to === 0 ? null : next[to - 1]._id);
    } catch {
      setError("Could not save the new order. Try again.");
    }
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    void moveTo(
      items.findIndex((x) => x._id === active.id),
      items.findIndex((x) => x._id === over.id),
    );
  }

  return (
    <>
      <p id={helpId} className="mt-8 text-xs text-muted-foreground">
        Drag the handle, or use the arrow buttons, to change the order. The top item shows first on your site.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold">
          {error}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((x) => x._id)} strategy={verticalListSortingStrategy}>
          <ol className="mt-3 space-y-3">
            {items.map((item, i) => (
              <SortableRow
                key={item._id}
                id={item._id}
                label={itemLabel(item, i)}
                helpId={helpId}
                isFirst={i === 0}
                isLast={i === items.length - 1}
                onUp={() => moveTo(i, i - 1)}
                onDown={() => moveTo(i, i + 1)}
              >
                {children(item, i)}
              </SortableRow>
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

function SortableRow({
  id,
  label,
  helpId,
  isFirst,
  isLast,
  onUp,
  onDown,
  children,
}: {
  id: string;
  label: string;
  helpId: string;
  isFirst: boolean;
  isLast: boolean;
  onUp: () => void;
  onDown: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex gap-3 border border-[var(--line-strong)] bg-[var(--background)] p-3 ${
        isDragging ? "relative z-10 shadow-lg" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${label}`}
          aria-describedby={helpId}
          className={`${iconButton} cursor-grab touch-none active:cursor-grabbing`}
        >
          ⠿
        </button>
        <button type="button" onClick={onUp} disabled={isFirst} aria-label={`Move ${label} up`} className={iconButton}>
          ↑
        </button>
        <button type="button" onClick={onDown} disabled={isLast} aria-label={`Move ${label} down`} className={iconButton}>
          ↓
        </button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
