import { Place } from './app.models';

// ── API Response Envelope ─────────────────────────────
export interface DecisionApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

// ── Room ──────────────────────────────────────────────
export interface DecisionRoom {
  id: number;
  code: string;
  status: 'open' | 'closed';
  created_by: number;
  members_count: number;
  created_at: string;
  member_avatars?: string[];
  members?: Array<{
    avatar?: string | null;
    avatar_url?: string | null;
  }>;
}

export type DecisionRoomOrigin = 'created' | 'joined';

export interface RecentDecisionRoom {
  code: string;
  status: DecisionRoom['status'];
  created_at: string;
  members_count: number;
  origin: DecisionRoomOrigin;
  last_used_at: string;
  member_avatars?: string[];
}

// ── Room User ─────────────────────────────────────────
export interface DecisionRoomUser {
  id: number;
  room_id: number;
  user_id: number | null;
  session_id: string | null;
}

// ── Swipe ─────────────────────────────────────────────
export type SwipeType = 'like' | 'dislike';

export interface SwipePayload {
  room_code: string;
  place_id: string;
  type: SwipeType;
}

export interface SwipeResult {
  swipe: {
    id: number;
    room_id: number;
    place_id: string;
    type: SwipeType;
  };
  matched: boolean;
  match: {
    id: number;
    room_id: number;
    place_id: string;
    created_at: string;
    place?: {
      id: string;
      name: string;
      category: string;
      rating: number;
      address: string;
      image_url: string;
    }
  } | null;
}

// ── Match Event (from Broadcast) ──────────────────────
export interface MatchEventPayload {
  room_id: number;
  room_code: string;
  place: {
    id: string;
    name: string;
    category: string;
    rating: number;
    address: string;
    image_url: string;
  };
  matched_at: string;
}

// ── Swipe Card (UI) ──────────────────────────────────
export interface SwipeCard {
  place: Place;
  vibeTags: string[];
}
