import { useQuery } from "@tanstack/react-query";
import { hasRole, type WeddingRole } from "@wedding/shared";
import { createContext, useContext } from "react";
import { api } from "@/lib/api";
import type { Wedding } from "@/lib/types";

export const WeddingContext = createContext<Wedding | null>(null);

export function useWedding(): Wedding {
  const w = useContext(WeddingContext);
  if (!w) throw new Error("useWedding outside WeddingContext");
  return w;
}

export function useCan(role: WeddingRole) {
  return hasRole(useWedding().role, role);
}

export const weddingKeys = {
  wedding: (id: string) => ["wedding", id] as const,
  households: (id: string) => ["wedding", id, "households"] as const,
  joinRequests: (id: string) => ["wedding", id, "join-requests"] as const,
  parts: (id: string) => ["wedding", id, "event-parts"] as const,
  meals: (id: string) => ["wedding", id, "meal-options"] as const,
  tiers: (id: string) => ["wedding", id, "child-tiers"] as const,
  gifts: (id: string) => ["wedding", id, "gifts"] as const,
  stats: (id: string) => ["wedding", id, "stats"] as const,
  team: (id: string) => ["wedding", id, "team"] as const,
};

/** Wspólne słowniki używane na wielu ekranach. */
export function useWeddingData<T>(key: keyof typeof weddingKeys, path: string) {
  const { id } = useWedding();
  return useQuery({ queryKey: weddingKeys[key](id), queryFn: () => api<T>(`/weddings/${id}${path}`) });
}
