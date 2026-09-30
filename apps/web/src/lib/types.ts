import type { CeremonyType, GuestSide, GuestType, PlanId, RsvpMode, WeddingRole } from "@wedding/shared";

export interface Wedding {
  id: string;
  slug: string;
  partnerOneName: string;
  partnerTwoName: string;
  date: string;
  ceremonyType: CeremonyType;
  locale: "pl" | "en";
  plan: PlanId;
  rsvpMode: RsvpMode;
  rsvpDeadline: string | null;
  welcomeMessage: string | null;
  giftsIntro: string | null;
  cashGiftInfo: string | null;
  role: WeddingRole;
}

export interface EventPart {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  address: string | null;
  mapUrl: string | null;
  notes: string | null;
  order: number;
}

export interface MealOption {
  id: string;
  name: string;
  description: string | null;
  forChildren: boolean;
  active: boolean;
  order: number;
}

export interface ChildTier {
  id?: string;
  fromAge: number;
  toAge: number;
  pricePercent: number;
}

export interface GuestRow {
  id: string;
  firstName: string;
  lastName: string;
  type: GuestType;
  age: number | null;
  plusOneAllowed: boolean;
  mealOptionId: string | null;
  dietNotes: string | null;
  needsHighChair: boolean;
  needsSeparateSeat: boolean;
  attendance: Record<string, boolean>;
}

export type HouseholdStatus = "PENDING" | "ATTENDING" | "DECLINED";

export interface Household {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  side: GuestSide;
  tags: string[];
  notes: string | null;
  source: "MANUAL" | "OPEN_FORM";
  invitedPartIds: string[];
  needsAccommodation: boolean | null;
  needsTransport: boolean | null;
  messageToCouple: string | null;
  respondedAt: string | null;
  locked: boolean;
  status: HouseholdStatus;
  rsvpUrl: string;
  guests: (GuestRow & { plusOne: GuestRow | null })[];
}

export interface JoinRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface Gift {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  isGroupGift: boolean;
  targetCents: number | null;
  available: boolean;
  pledgedCents: number | null;
  remainingCents: number | null;
}

export interface AdminGift extends Gift {
  hidden: boolean;
  order: number;
  reservations: {
    id: string;
    status: "PENDING" | "CONFIRMED";
    amountCents: number | null;
    confirmedAt: string | null;
    name?: string;
    email?: string;
  }[];
}

export interface Stats {
  households: { total: number; responded: number; pending: number };
  guests: {
    invited: number;
    plusOnes: number;
    attending: number;
    declined: number;
    pending: number;
    attendingAdults: number;
    attendingChildren: number;
  };
  parts: { id: string; name: string; invited: number; attending: number }[];
  meals: { id: string | null; name: string | null; count: number }[];
  dietNotes: number;
  children: {
    highChairs: number;
    withoutSeat: number;
    tiers: { fromAge: number | null; toAge: number | null; pricePercent: number; count: number }[];
  };
  logistics: { accommodation: number; transport: number };
  gifts: { total: number; reserved: number };
  pendingJoinRequests: number;
}

export interface Team {
  members: { id: string; role: WeddingRole; isMe: boolean; user: { id: string; name: string; email: string } }[];
  invitations: { id: string; email: string; role: WeddingRole; expiresAt: string }[];
}
