import { create } from "zustand";
import * as eventsApi from "../api/events";
import type { Event, EventCreateData, EventMembership } from "../types/models";

interface EventState {
  events: Event[];
  currentEvent: Event | null;
  members: EventMembership[];
  isLoading: boolean;

  fetchEvents: (orgId?: number) => Promise<void>;
  fetchEvent: (id: number) => Promise<void>;
  createEvent: (data: EventCreateData) => Promise<Event>;
  updateEvent: (id: number, data: Partial<EventCreateData>) => Promise<void>;
  deleteEvent: (id: number) => Promise<void>;
  joinEvent: (id: number) => Promise<void>;
  leaveEvent: (id: number) => Promise<void>;
  fetchMembers: (eventId: number) => Promise<void>;
  clearCurrent: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  currentEvent: null,
  members: [],
  isLoading: false,

  fetchEvents: async (orgId) => {
    set({ isLoading: true });
    try {
      const data = await eventsApi.getEvents(orgId);
      set({ events: data.results });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEvent: async (id) => {
    set({ isLoading: true });
    try {
      const event = await eventsApi.getEvent(id);
      set({ currentEvent: event });
    } finally {
      set({ isLoading: false });
    }
  },

  createEvent: async (data) => {
    const event = await eventsApi.createEvent(data);
    set((state) => ({ events: [event, ...state.events] }));
    return event;
  },

  updateEvent: async (id, data) => {
    const updated = await eventsApi.updateEvent(id, data);
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updated } : e)),
      currentEvent: state.currentEvent?.id === id ? { ...state.currentEvent, ...updated } : state.currentEvent,
    }));
  },

  deleteEvent: async (id) => {
    await eventsApi.deleteEvent(id);
    set((state) => ({
      events: state.events.filter((e) => e.id !== id),
      currentEvent: state.currentEvent?.id === id ? null : state.currentEvent,
    }));
  },

  joinEvent: async (id) => {
    await eventsApi.joinEvent(id);
    await get().fetchEvent(id);
    await get().fetchEvents();
  },

  leaveEvent: async (id) => {
    await eventsApi.leaveEvent(id);
    await get().fetchEvents();
  },

  fetchMembers: async (eventId) => {
    const data = await eventsApi.getMembers(eventId);
    set({ members: data.results });
  },

  clearCurrent: () => set({ currentEvent: null, members: [] }),
}));
