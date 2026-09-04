/**
 * TCC Groups Store — API-backed.
 * A group post is a normal CommunityPost with a groupId attached, so group
 * feeds reuse CommunityPost's shape directly rather than inventing a
 * parallel type.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";
import type { CommunityPost, CommunityAuthor } from "@/store/communityStore";

export type GroupVisibility = "PUBLIC" | "PRIVATE";
export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";

export interface CommunityGroup {
  id:            string;
  name:          string;
  slug:          string;
  description:   string;
  coverImageUrl: string | null;
  visibility:    GroupVisibility;
  ownerId:       string;
  owner:         CommunityAuthor;
  myRole:        GroupRole | null;
  _count:        { members: number; posts: number };
  createdAt:     string;
  updatedAt:     string;
}

export interface GroupMemberSummary extends CommunityAuthor {
  role:     GroupRole;
  joinedAt: string;
}

interface PaginatedResult<T> {
  items: T[]; total: number; page: number; pageSize: number; totalPages: number; hasNext: boolean; hasPrev: boolean;
}

export interface CreateGroupInput {
  name:          string;
  description?:  string;
  visibility?:   GroupVisibility;
  coverImageUrl?: string | null;
}

interface GroupStore {
  isLoading: boolean;
  error:     string | null;

  discoverGroups: (page?: number, search?: string) => Promise<PaginatedResult<CommunityGroup> | null>;
  getMyGroups:    (page?: number) => Promise<PaginatedResult<CommunityGroup> | null>;
  createGroup:    (input: CreateGroupInput) => Promise<CommunityGroup | null>;
  getGroup:       (idOrSlug: string) => Promise<CommunityGroup | null>;
  updateGroup:    (groupId: string, input: Partial<CreateGroupInput>) => Promise<CommunityGroup | null>;
  deleteGroup:    (groupId: string) => Promise<boolean>;
  joinGroup:      (groupId: string) => Promise<boolean>;
  leaveGroup:     (groupId: string) => Promise<boolean>;
  getMembers:     (groupId: string, page?: number) => Promise<PaginatedResult<GroupMemberSummary> | null>;
  kickMember:     (groupId: string, userId: string) => Promise<boolean>;
  setMemberRole:  (groupId: string, userId: string, role: "ADMIN" | "MEMBER") => Promise<boolean>;
  getGroupFeed:   (groupId: string, page?: number, sort?: "latest" | "trending") => Promise<PaginatedResult<CommunityPost> | null>;
  createGroupPost: (groupId: string, content: string, tags?: string[]) => Promise<CommunityPost | null>;
}

export const useGroupStore = create<GroupStore>()((set) => ({
  isLoading: false,
  error:     null,

  discoverGroups: async (page = 1, search) => {
    set({ isLoading: true, error: null });
    try {
      const qs  = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) qs.set("search", search);
      const res = await api.get<PaginatedResult<CommunityGroup>>(`/community/groups?${qs.toString()}`);
      set({ isLoading: false });
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.discoverGroups]", err);
      set({ isLoading: false, error: "Failed to load groups" });
      return null;
    }
  },

  getMyGroups: async (page = 1) => {
    try {
      const res = await api.get<PaginatedResult<CommunityGroup>>(`/community/groups/mine?page=${page}&pageSize=20`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.getMyGroups]", err);
      return null;
    }
  },

  createGroup: async (input) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<CommunityGroup>("/community/groups", input);
      set({ isLoading: false });
      if (!res.success) { set({ error: res.error }); return null; }
      return res.data;
    } catch (err) {
      console.error("[groupStore.createGroup]", err);
      set({ isLoading: false, error: "Failed to create group" });
      return null;
    }
  },

  getGroup: async (idOrSlug) => {
    try {
      const res = await api.get<CommunityGroup>(`/community/groups/${idOrSlug}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.getGroup]", err);
      return null;
    }
  },

  updateGroup: async (groupId, input) => {
    try {
      const res = await api.patch<CommunityGroup>(`/community/groups/${groupId}`, input);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.updateGroup]", err);
      return null;
    }
  },

  deleteGroup: async (groupId) => {
    try {
      const res = await api.delete<{ deleted: boolean }>(`/community/groups/${groupId}`);
      return res.success;
    } catch (err) {
      console.error("[groupStore.deleteGroup]", err);
      return false;
    }
  },

  joinGroup: async (groupId) => {
    try {
      const res = await api.post<{ joined: boolean }>(`/community/groups/${groupId}/join`);
      return res.success;
    } catch (err) {
      console.error("[groupStore.joinGroup]", err);
      return false;
    }
  },

  leaveGroup: async (groupId) => {
    try {
      const res = await api.post<{ joined: boolean }>(`/community/groups/${groupId}/leave`);
      return res.success;
    } catch (err) {
      console.error("[groupStore.leaveGroup]", err);
      return false;
    }
  },

  getMembers: async (groupId, page = 1) => {
    try {
      const res = await api.get<PaginatedResult<GroupMemberSummary>>(`/community/groups/${groupId}/members?page=${page}&pageSize=30`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.getMembers]", err);
      return null;
    }
  },

  kickMember: async (groupId, userId) => {
    try {
      const res = await api.delete<{ removed: boolean }>(`/community/groups/${groupId}/members/${userId}`);
      return res.success;
    } catch (err) {
      console.error("[groupStore.kickMember]", err);
      return false;
    }
  },

  setMemberRole: async (groupId, userId, role) => {
    try {
      const res = await api.patch<{ role: GroupRole }>(`/community/groups/${groupId}/members/${userId}/role`, { role });
      return res.success;
    } catch (err) {
      console.error("[groupStore.setMemberRole]", err);
      return false;
    }
  },

  getGroupFeed: async (groupId, page = 1, sort = "latest") => {
    try {
      const res = await api.get<PaginatedResult<CommunityPost>>(`/community/groups/${groupId}/posts?page=${page}&pageSize=20&sort=${sort}`);
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.getGroupFeed]", err);
      return null;
    }
  },

  createGroupPost: async (groupId, content, tags = []) => {
    try {
      const res = await api.post<CommunityPost>(`/community/groups/${groupId}/posts`, { type: "TEXT", content, tags });
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[groupStore.createGroupPost]", err);
      return null;
    }
  },
}));
