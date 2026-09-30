import type { CeremonyType, GuestSide, GuestType, PlanId, RsvpMode, TaskCategory, WeddingRole } from "@wedding/shared";

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
  platePriceCents: number | null;
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
  tasks: {
    total: number;
    done: number;
    overdue: number;
    next: { id: string; title: string; dueDate: string | null; assignee: string | null }[];
  };
}

export interface Team {
  members: { id: string; role: WeddingRole; isMe: boolean; user: { id: string; name: string; email: string } }[];
  invitations: { id: string; email: string; role: WeddingRole; expiresAt: string }[];
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  templateKey: string | null;
  title: string;
  description: string | null;
  category: TaskCategory;
  dueDate: string | null;
  dueMode: "RELATIVE" | "FIXED";
  status: TaskStatus;
  doneAt: string | null;
  assignee: { id: string; name: string } | null;
}

export interface Assignee {
  id: string;
  name: string;
}

export type CalendarKind = "PART" | "TASK" | "PAYMENT" | "ENTRY";

export interface CalendarItem {
  id: string;
  kind: CalendarKind;
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  done: boolean;
  location: string | null;
  notes: string | null;
  refId: string;
}

export interface CalendarEntry {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  vendorId: string | null;
}

export type VendorStatus = "CONSIDERING" | "BOOKED" | "REJECTED";

export interface Vendor {
  id: string;
  category: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  status: VendorStatus;
  hasContract: boolean;
  contractName: string | null;
}

export interface BudgetPayment {
  id: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  note: string | null;
  overdue: boolean;
}

export interface BudgetExpense {
  id: string;
  title: string;
  amountCents: number;
  notes: string | null;
  vendor: { id: string; name: string } | null;
  paidCents: number;
  payments: BudgetPayment[];
}

export interface BudgetCategory {
  id: string;
  name: string;
  order: number;
  plannedCents: number;
  committedCents: number;
  paidCents: number;
  expenses: BudgetExpense[];
}

export interface Budget {
  totals: { plannedCents: number; committedCents: number; paidCents: number };
  catering: { platePriceCents: number | null; confirmedCents: number | null; maxCents: number | null };
  categories: BudgetCategory[];
  upcomingPayments: (BudgetPayment & { expenseTitle: string; categoryName: string })[];
}
