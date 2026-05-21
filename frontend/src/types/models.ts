export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  nickname: string;
  display_name: string;
  is_staff: boolean;
  is_placeholder: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export type OrgRole = "admin" | "member";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  invite_code: string | null;
  logo: string | null;
  created_by: number;
  created_at: string;
  my_role: OrgRole | null;
  member_count: number;
}

export interface OrganizationMembership {
  id: number;
  user: number;
  username: string;
  full_name: string;
  email: string;
  role: OrgRole;
  created_at: string;
}

export interface RegisterData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  action?: "create_org" | "join_org";
  org?: { name: string; slug?: string; invite_code: string };
  invite_code?: string;
}

export interface RegisterResponse {
  user: User;
  tokens: AuthTokens;
  organization: Organization | null;
}

export interface LoginData {
  username: string;
  password: string;
}

// Events
export type EventType = "festival" | "conference" | "sport" | "charity" | "other";
export type MembershipRole = "admin" | "volunteer";

export interface Event {
  id: number;
  name: string;
  event_type: EventType;
  description: string;
  start_date: string;
  end_date: string;
  organization: number;
  organization_name: string;
  member_count: number;
  my_role: MembershipRole | null;
  created_at: string;
  updated_at: string;
}

export interface EventCreateData {
  name: string;
  event_type: EventType;
  description: string;
  start_date: string;
  end_date: string;
  organization: number;
}

export interface EventMembership {
  id: number;
  user: number;
  username: string;
  full_name: string;
  role: MembershipRole;
  created_at: string;
}

export interface EventInvitation {
  id: number;
  token: string;
  label: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  is_valid: boolean;
  invalid_reason: string | null;
  is_promoted: boolean;
}

export interface EventInvitationCreateData {
  label?: string;
  token?: string;
  expires_at?: string | null;
  max_uses?: number | null;
}

export interface InvitationPreview {
  event_name: string;
  organization_name: string;
  event_start_date: string;
  event_end_date: string;
  is_valid: boolean;
  invalid_reason: string | null;
}

export interface InvitationAcceptSignup {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  nickname?: string;
}

export interface InvitationAcceptResponse {
  user: User;
  tokens?: AuthTokens;
  event_id: number;
  organization_id: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Tasks & Slots
export interface Slot {
  id: number;
  task: number;
  start_date: string;
  end_date: string;
  capacity: number | null;
  order: number;
  confirmed_count?: number;
  is_full?: boolean;
  created_at: string;
}

export interface Task {
  id: number;
  event: number;
  name: string;
  description: string;
  min_volunteers: number | null;
  max_volunteers: number | null;
  order: number;
  slots: Slot[];
  slot_count: number;
  created_at: string;
}

export interface TaskCreateData {
  name: string;
  description: string;
  min_volunteers: number | null;
  max_volunteers: number | null;
  order?: number;
}

export interface SlotCreateData {
  start_date: string;
  end_date: string;
  capacity: number | null;
  order?: number;
}

// Assignments
export type AssignmentStatus = "confirmed" | "backup";

export interface Assignment {
  id: number;
  user: number;
  username: string;
  full_name: string;
  is_placeholder: boolean;
  slot: number;
  slot_start: string;
  slot_end: string;
  start_date: string;
  end_date: string;
  task_name: string;
  status: AssignmentStatus;
  assigned_at: string;
}

export interface MyEngagement extends Assignment {
  event_id: number;
  event_name: string;
  organization_id: number;
  organization_name: string;
}

// News
export interface News {
  id: number;
  event: number | null;
  author: number;
  author_name: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// Messaging
export interface Message {
  id: number;
  sender: number;
  sender_name: string;
  receiver: number;
  receiver_name: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface Conversation {
  user_id: number;
  username: string;
  full_name: string;
  last_message: string;
  last_date: string;
  unread_count: number;
}
