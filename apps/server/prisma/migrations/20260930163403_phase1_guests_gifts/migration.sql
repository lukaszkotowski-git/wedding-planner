-- CreateEnum
CREATE TYPE "RsvpMode" AS ENUM ('DEDICATED', 'OPEN', 'BOTH');

-- CreateEnum
CREATE TYPE "GuestSide" AS ENUM ('PARTNER_ONE', 'PARTNER_TWO', 'BOTH');

-- CreateEnum
CREATE TYPE "HouseholdSource" AS ENUM ('MANUAL', 'OPEN_FORM');

-- CreateEnum
CREATE TYPE "GuestType" AS ENUM ('ADULT', 'CHILD');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('RSVP', 'GIFT_RESERVATION', 'JOIN_REQUEST');

-- AlterTable
ALTER TABLE "wedding" ADD COLUMN     "cashGiftInfo" TEXT,
ADD COLUMN     "giftsIntro" TEXT,
ADD COLUMN     "rsvpDeadline" DATE,
ADD COLUMN     "rsvpMode" "RsvpMode" NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "welcomeMessage" TEXT;

-- CreateTable
CREATE TABLE "team_invitation" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WeddingRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_part" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "locationName" TEXT,
    "address" TEXT,
    "mapUrl" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_option" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "forChildren" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "meal_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_price_tier" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "fromAge" INTEGER NOT NULL,
    "toAge" INTEGER NOT NULL,
    "pricePercent" INTEGER NOT NULL,

    CONSTRAINT "child_price_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "side" "GuestSide" NOT NULL DEFAULT 'BOTH',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "source" "HouseholdSource" NOT NULL DEFAULT 'MANUAL',
    "needsAccommodation" BOOLEAN,
    "needsTransport" BOOLEAN,
    "messageToCouple" TEXT,
    "respondedAt" TIMESTAMP(3),
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "type" "GuestType" NOT NULL DEFAULT 'ADULT',
    "age" INTEGER,
    "plusOneAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isPlusOne" BOOLEAN NOT NULL DEFAULT false,
    "plusOneOfId" TEXT,
    "mealOptionId" TEXT,
    "dietNotes" TEXT,
    "needsHighChair" BOOLEAN NOT NULL DEFAULT false,
    "needsSeparateSeat" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_event_rsvp" (
    "guestId" TEXT NOT NULL,
    "eventPartId" TEXT NOT NULL,
    "attending" BOOLEAN NOT NULL,

    CONSTRAINT "guest_event_rsvp_pkey" PRIMARY KEY ("guestId","eventPartId")
);

-- CreateTable
CREATE TABLE "join_request" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pl',
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "householdId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "join_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "imageKey" TEXT,
    "priceCents" INTEGER,
    "isGroupGift" BOOLEAN NOT NULL DEFAULT false,
    "targetCents" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_reservation" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "amountCents" INTEGER,
    "locale" TEXT NOT NULL DEFAULT 'pl',
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmToken" TEXT NOT NULL,
    "cancelToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_log" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "householdId" TEXT,
    "kind" "ConsentKind" NOT NULL,
    "email" TEXT,
    "textVersion" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventPartToHousehold" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventPartToHousehold_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_invitation_token_key" ON "team_invitation"("token");

-- CreateIndex
CREATE INDEX "team_invitation_weddingId_idx" ON "team_invitation"("weddingId");

-- CreateIndex
CREATE INDEX "event_part_weddingId_idx" ON "event_part"("weddingId");

-- CreateIndex
CREATE INDEX "meal_option_weddingId_idx" ON "meal_option"("weddingId");

-- CreateIndex
CREATE INDEX "child_price_tier_weddingId_idx" ON "child_price_tier"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "household_token_key" ON "household"("token");

-- CreateIndex
CREATE INDEX "household_weddingId_idx" ON "household"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_plusOneOfId_key" ON "guest"("plusOneOfId");

-- CreateIndex
CREATE INDEX "guest_weddingId_idx" ON "guest"("weddingId");

-- CreateIndex
CREATE INDEX "guest_householdId_idx" ON "guest"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "join_request_householdId_key" ON "join_request"("householdId");

-- CreateIndex
CREATE INDEX "join_request_weddingId_status_idx" ON "join_request"("weddingId", "status");

-- CreateIndex
CREATE INDEX "gift_weddingId_idx" ON "gift"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "gift_reservation_confirmToken_key" ON "gift_reservation"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "gift_reservation_cancelToken_key" ON "gift_reservation"("cancelToken");

-- CreateIndex
CREATE INDEX "gift_reservation_giftId_status_idx" ON "gift_reservation"("giftId", "status");

-- CreateIndex
CREATE INDEX "consent_log_weddingId_idx" ON "consent_log"("weddingId");

-- CreateIndex
CREATE INDEX "_EventPartToHousehold_B_index" ON "_EventPartToHousehold"("B");

-- AddForeignKey
ALTER TABLE "team_invitation" ADD CONSTRAINT "team_invitation_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_invitation" ADD CONSTRAINT "team_invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_part" ADD CONSTRAINT "event_part_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_option" ADD CONSTRAINT "meal_option_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_price_tier" ADD CONSTRAINT "child_price_tier_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household" ADD CONSTRAINT "household_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest" ADD CONSTRAINT "guest_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest" ADD CONSTRAINT "guest_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest" ADD CONSTRAINT "guest_plusOneOfId_fkey" FOREIGN KEY ("plusOneOfId") REFERENCES "guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest" ADD CONSTRAINT "guest_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "meal_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_event_rsvp" ADD CONSTRAINT "guest_event_rsvp_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_event_rsvp" ADD CONSTRAINT "guest_event_rsvp_eventPartId_fkey" FOREIGN KEY ("eventPartId") REFERENCES "event_part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "join_request" ADD CONSTRAINT "join_request_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift" ADD CONSTRAINT "gift_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_reservation" ADD CONSTRAINT "gift_reservation_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_reservation" ADD CONSTRAINT "gift_reservation_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventPartToHousehold" ADD CONSTRAINT "_EventPartToHousehold_A_fkey" FOREIGN KEY ("A") REFERENCES "event_part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventPartToHousehold" ADD CONSTRAINT "_EventPartToHousehold_B_fkey" FOREIGN KEY ("B") REFERENCES "household"("id") ON DELETE CASCADE ON UPDATE CASCADE;
