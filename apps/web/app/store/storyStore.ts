/**
 * TCC Stories Store — API-backed. 24h-ephemeral updates.
 */
import { create } from "zustand";
import { api }    from "@/lib/api/client";
import type { CommunityAuthor } from "@/store/communityStore";

export interface Story {
  id:        string;
  authorId:  string;
  author:    CommunityAuthor;
  content:   string;
  imageUrl:  string | null;
  createdAt: string;
  expiresAt: string;
  viewed?:   boolean;
  _count:    { views: number };
}

export interface StoryGroup {
  author:    CommunityAuthor;
  allViewed: boolean;
  stories:   Story[];
}

export interface StoryViewer extends CommunityAuthor {
  viewedAt: string;
}

interface StoryStore {
  groups:    StoryGroup[];
  isLoading: boolean;
  error:     string | null;

  loadFeed:      () => Promise<void>;
  getMyStories:  () => Promise<Story[]>;
  createStory:   (content: string, imageUrl?: string | null) => Promise<Story | null>;
  deleteStory:   (storyId: string) => Promise<boolean>;
  viewStory:     (storyId: string) => Promise<void>;
  getViewers:    (storyId: string) => Promise<StoryViewer[]>;
}

export const useStoryStore = create<StoryStore>()((set, get) => ({
  groups:    [],
  isLoading: false,
  error:     null,

  loadFeed: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{ groups: StoryGroup[] }>("/community/stories/feed");
      if (!res.success) { set({ isLoading: false, error: res.error }); return; }
      set({ groups: res.data.groups, isLoading: false });
    } catch (err) {
      console.error("[storyStore.loadFeed]", err);
      set({ isLoading: false, error: "Failed to load stories" });
    }
  },

  getMyStories: async () => {
    try {
      const res = await api.get<{ items: Story[] }>("/community/stories/mine");
      return res.success ? res.data.items : [];
    } catch (err) {
      console.error("[storyStore.getMyStories]", err);
      return [];
    }
  },

  createStory: async (content, imageUrl) => {
    try {
      const res = await api.post<Story>("/community/stories", { content, imageUrl });
      if (res.success) await get().loadFeed();
      return res.success ? res.data : null;
    } catch (err) {
      console.error("[storyStore.createStory]", err);
      return null;
    }
  },

  deleteStory: async (storyId) => {
    try {
      const res = await api.delete<{ deleted: boolean }>(`/community/stories/${storyId}`);
      if (res.success) await get().loadFeed();
      return res.success;
    } catch (err) {
      console.error("[storyStore.deleteStory]", err);
      return false;
    }
  },

  viewStory: async (storyId) => {
    try {
      await api.post(`/community/stories/${storyId}/view`);
      set((s) => ({
        groups: s.groups.map((g) => ({
          ...g,
          stories: g.stories.map((story) => (story.id === storyId ? { ...story, viewed: true } : story)),
          allViewed: g.stories.every((story) => story.id === storyId || story.viewed),
        })),
      }));
    } catch (err) {
      console.error("[storyStore.viewStory]", err);
    }
  },

  getViewers: async (storyId) => {
    try {
      const res = await api.get<{ items: StoryViewer[] }>(`/community/stories/${storyId}/viewers`);
      return res.success ? res.data.items : [];
    } catch (err) {
      console.error("[storyStore.getViewers]", err);
      return [];
    }
  },
}));
