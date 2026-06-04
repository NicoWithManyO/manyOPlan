import { create } from "zustand";
import * as assignmentsApi from "../api/assignments";
import type { Assignment } from "../types/models";

interface AssignmentState {
  assignments: Assignment[];
  myAssignments: Assignment[];
  isLoading: boolean;

  fetchAssignments: (eventId: number) => Promise<void>;
  fetchMyAssignments: (eventId: number) => Promise<void>;
  register: (eventId: number, slotId: number, startDate: string, endDate: string) => Promise<Assignment>;
  unregister: (eventId: number, assignmentId: number) => Promise<void>;
  adminAssign: (
    eventId: number,
    slotId: number,
    userId: number,
    force?: boolean,
  ) => Promise<Assignment>;
  updateTimes: (
    eventId: number,
    assignmentId: number,
    startDate: string,
    endDate: string,
  ) => Promise<void>;
  moveAssignment: (
    eventId: number,
    assignmentId: number,
    newSlotId: number,
  ) => Promise<void>;
  clear: () => void;
}

export const useAssignmentStore = create<AssignmentState>((set, get) => ({
  assignments: [],
  myAssignments: [],
  isLoading: false,

  fetchAssignments: async (eventId) => {
    set({ isLoading: true });
    try {
      const data = await assignmentsApi.getAssignments(eventId);
      set({ assignments: data });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMyAssignments: async (eventId) => {
    const data = await assignmentsApi.getMyAssignments(eventId);
    set({ myAssignments: data });
  },

  register: async (eventId, slotId, startDate, endDate) => {
    const assignment = await assignmentsApi.createAssignment(eventId, slotId, startDate, endDate);
    // Refetch both lists
    await Promise.all([
      get().fetchAssignments(eventId),
      get().fetchMyAssignments(eventId),
    ]);
    return assignment;
  },

  unregister: async (eventId, assignmentId) => {
    await assignmentsApi.deleteAssignment(eventId, assignmentId);
    set((s) => ({
      assignments: s.assignments.filter((a) => a.id !== assignmentId),
      myAssignments: s.myAssignments.filter((a) => a.id !== assignmentId),
    }));
  },

  adminAssign: async (eventId, slotId, userId, force) => {
    // Admin assign uses full slot time by default — would need start/end params for custom
    const assignment = await assignmentsApi.createAssignment(
      eventId,
      slotId,
      "", // placeholder — admin assign needs rework if custom times needed
      "",
      userId,
      force,
    );
    await get().fetchAssignments(eventId);
    return assignment;
  },

  updateTimes: async (eventId, assignmentId, startDate, endDate) => {
    await assignmentsApi.updateAssignmentTimes(eventId, assignmentId, startDate, endDate);
    await Promise.all([
      get().fetchAssignments(eventId),
      get().fetchMyAssignments(eventId),
    ]);
  },

  moveAssignment: async (eventId, assignmentId, newSlotId) => {
    await assignmentsApi.moveAssignment(eventId, assignmentId, newSlotId);
    await get().fetchAssignments(eventId);
  },

  clear: () => set({ assignments: [], myAssignments: [], isLoading: false }),
}));
