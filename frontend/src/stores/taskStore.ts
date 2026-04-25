import { create } from "zustand";
import * as tasksApi from "../api/tasks";
import type { SlotCreateData, Task, TaskCreateData } from "../types/models";

interface TaskState {
  tasks: Task[];
  isLoading: boolean;

  fetchTasks: (eventId: number) => Promise<void>;
  createTask: (eventId: number, data: TaskCreateData) => Promise<Task>;
  updateTask: (
    eventId: number,
    taskId: number,
    data: Partial<TaskCreateData>,
  ) => Promise<void>;
  deleteTask: (eventId: number, taskId: number) => Promise<void>;
  reorderTasks: (eventId: number, taskIds: number[]) => Promise<void>;
  createSlot: (
    eventId: number,
    taskId: number,
    data: SlotCreateData,
  ) => Promise<void>;
  bulkCreateSlots: (
    eventId: number,
    taskId: number,
    slots: SlotCreateData[],
  ) => Promise<void>;
  deleteSlot: (
    eventId: number,
    taskId: number,
    slotId: number,
  ) => Promise<void>;
  clear: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,

  fetchTasks: async (eventId) => {
    set({ isLoading: true });
    try {
      const data = await tasksApi.getTasks(eventId);
      set({ tasks: data.results });
    } finally {
      set({ isLoading: false });
    }
  },

  createTask: async (eventId, data) => {
    const task = await tasksApi.createTask(eventId, data);
    // Refetch to get slots included
    await get().fetchTasks(eventId);
    return task;
  },

  updateTask: async (eventId, taskId, data) => {
    await tasksApi.updateTask(eventId, taskId, data);
    await get().fetchTasks(eventId);
  },

  deleteTask: async (eventId, taskId) => {
    await tasksApi.deleteTask(eventId, taskId);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  reorderTasks: async (eventId, taskIds) => {
    // Optimistic reorder
    set((s) => {
      const taskMap = new Map(s.tasks.map((t) => [t.id, t]));
      const reordered = taskIds
        .map((id) => taskMap.get(id))
        .filter((t): t is Task => t !== undefined);
      return { tasks: reordered };
    });
    await tasksApi.reorderTasks(eventId, taskIds);
  },

  createSlot: async (eventId, taskId, data) => {
    await tasksApi.createSlot(eventId, taskId, data);
    await get().fetchTasks(eventId);
  },

  bulkCreateSlots: async (eventId, taskId, slots) => {
    await tasksApi.bulkCreateSlots(eventId, taskId, slots);
    await get().fetchTasks(eventId);
  },

  deleteSlot: async (eventId, taskId, slotId) => {
    await tasksApi.deleteSlot(eventId, taskId, slotId);
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, slots: t.slots.filter((sl) => sl.id !== slotId), slot_count: t.slot_count - 1 }
          : t,
      ),
    }));
  },

  clear: () => set({ tasks: [], isLoading: false }),
}));
