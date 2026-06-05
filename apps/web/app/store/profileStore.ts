/**
 * TCC Profile Store
 *
 * Manages each user's own profile settings and follow relationships.
 * Persisted per-user (user-scoped localStorage).
 * All stats are derived from real data stores — never hardcoded.
 *
 * Phase Alpha: replace with PostgreSQL + JWT auth session.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getUserScopedStorage } from "@/lib/persistence/storage";

// ── Types ─────────────────────────────────────────────────────────────────

export type TCCUserRole =
  | "normal_user"
  | "follower_trader"
  | "verified_trader"
  | "master_trader"
  | "mentor"
  | "admin"
  | "owner";

export type ProfileVisibility  = "public" | "private" | "followers_only";
export type PortfolioVisibility = "public" | "private" | "followers_only";
export type ExperienceLevel     = "beginner" | "intermediate" | "advanced" | "professional";

export interface TCCSocialLinks {
  website?:   string;
  x?:         string;
  linkedin?:  string;
  youtube?:   string;
  instagram?: string;
}

export interface TCCTradingIdentity {
  marketsTraded:     string[];   // e.g. ["Crypto", "Forex"]
  symbolsTraded:     string[];   // e.g. ["BTCUSDT", "XAUUSD"]
  strategiesUsed:    string[];   // e.g. ["SMC", "Price Action"]
  preferredSessions: string[];   // e.g. ["london", "newyork"]
  experienceLevel:   ExperienceLevel | "";
}

export interface TCCUserProfile {
  userId:              string;
  tccId:               string;
  username:            string;
  displayName:         string;
  bio:                 string;
  location:            string;
  avatarUrl:           string;
  roles:               TCCUserRole[];
  profileVisibility:   ProfileVisibility;
  portfolioVisibility: PortfolioVisibility;
  createdAt:           string;
  updatedAt:           string;
  socialLinks:         TCCSocialLinks;
  tradingIdentity:     TCCTradingIdentity;
}

export interface FollowRelationship {
  id:          string;
  followerId:  string;
  followingId: string;
  status:      "active" | "pending" | "blocked";
  createdAt:   string;
}

// ── Default values ────────────────────────────────────────────────────────

const DEFAULT_TRADING_IDENTITY: TCCTradingIdentity = {
  marketsTraded:     [],
  symbolsTraded:     [],
  strategiesUsed:    [],
  preferredSessions: [],
  experienceLevel:   "",
};

// ── Store ─────────────────────────────────────────────────────────────────

interface ProfileStore {
  myProfile: TCCUserProfile | null;
  follows:   FollowRelationship[];

  // Profile actions
  initProfile: (userId: string, tccId: string, username: string) => void;
  updateProfile: (updates: Partial<Omit<TCCUserProfile, "userId" | "tccId" | "createdAt">>) => void;
  setProfileVisibility:  (visibility: ProfileVisibility)  => void;
  setPortfolioVisibility: (visibility: PortfolioVisibility) => void;

  // Follow system
  followUser:   (followingId: string) => void;
  unfollowUser: (followingId: string) => void;
  blockUser:    (userId: string)      => void;

  // Selectors
  getFollowers: (userId: string) => FollowRelationship[];
  getFollowing: (userId: string) => FollowRelationship[];
  isFollowing:  (followerId: string, followingId: string) => boolean;
  canViewProfile:   (targetUserId: string, viewerId: string, targetProfile: TCCUserProfile | null) => boolean;
  canViewPortfolio: (targetUserId: string, viewerId: string, targetProfile: TCCUserProfile | null) => boolean;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set, get) => ({
      myProfile: null,
      follows:   [],

      initProfile: (userId, tccId, username) => {
        const existing = get().myProfile;
        // Don't overwrite if same user already initialized
        if (existing && existing.userId === userId) return;
        const now = new Date().toISOString();
        set({
          myProfile: {
            userId,
            tccId,
            username,
            displayName:         username,
            bio:                 "",
            location:            "",
            avatarUrl:           "",
            roles:               ["normal_user"],
            profileVisibility:   "public",
            portfolioVisibility: "private",
            createdAt:           now,
            updatedAt:           now,
            socialLinks:         {},
            tradingIdentity:     DEFAULT_TRADING_IDENTITY,
          },
        });
      },

      updateProfile: (updates) => {
        set((state) => {
          if (!state.myProfile) return state;
          return {
            myProfile: {
              ...state.myProfile,
              ...updates,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      setProfileVisibility: (visibility) => {
        set((state) => {
          if (!state.myProfile) return state;
          return {
            myProfile: {
              ...state.myProfile,
              profileVisibility: visibility,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      setPortfolioVisibility: (visibility) => {
        set((state) => {
          if (!state.myProfile) return state;
          return {
            myProfile: {
              ...state.myProfile,
              portfolioVisibility: visibility,
              updatedAt: new Date().toISOString(),
            },
          };
        });
      },

      followUser: (followingId) => {
        const { myProfile, follows } = get();
        if (!myProfile) return;
        if (myProfile.userId === followingId) return; // cannot follow self
        const already = follows.find(
          (f) => f.followerId === myProfile.userId && f.followingId === followingId
        );
        if (already) return;
        const newFollow: FollowRelationship = {
          id:          `follow_${Date.now()}`,
          followerId:  myProfile.userId,
          followingId,
          status:      "active",
          createdAt:   new Date().toISOString(),
        };
        set({ follows: [...follows, newFollow] });
      },

      unfollowUser: (followingId) => {
        const { myProfile } = get();
        if (!myProfile) return;
        set((state) => ({
          follows: state.follows.filter(
            (f) => !(f.followerId === myProfile.userId && f.followingId === followingId)
          ),
        }));
      },

      blockUser: (userId) => {
        const { myProfile } = get();
        if (!myProfile) return;
        set((state) => ({
          follows: state.follows.map((f) =>
            f.followerId === myProfile.userId && f.followingId === userId
              ? { ...f, status: "blocked" as const }
              : f
          ),
        }));
      },

      getFollowers: (userId) =>
        get().follows.filter(
          (f) => f.followingId === userId && f.status === "active"
        ),

      getFollowing: (userId) =>
        get().follows.filter(
          (f) => f.followerId === userId && f.status === "active"
        ),

      isFollowing: (followerId, followingId) =>
        get().follows.some(
          (f) =>
            f.followerId === followerId &&
            f.followingId === followingId &&
            f.status === "active"
        ),

      canViewProfile: (targetUserId, viewerId, targetProfile) => {
        if (!targetProfile) return false;
        if (targetUserId === viewerId) return true;
        if (targetProfile.profileVisibility === "public") return true;
        if (targetProfile.profileVisibility === "followers_only") {
          return get().isFollowing(viewerId, targetUserId);
        }
        return false; // private
      },

      canViewPortfolio: (targetUserId, viewerId, targetProfile) => {
        if (!targetProfile) return false;
        if (targetUserId === viewerId) return true;
        if (targetProfile.portfolioVisibility === "public") return true;
        if (targetProfile.portfolioVisibility === "followers_only") {
          return get().isFollowing(viewerId, targetUserId);
        }
        return false; // private
      },
    }),
    {
      name:    "profile",
      storage: createJSONStorage(() => getUserScopedStorage("profile")),
    }
  )
);