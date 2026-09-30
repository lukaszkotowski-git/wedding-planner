import { Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * Transakcja SERIALIZABLE z ponowieniem przy konflikcie zapisu (P2034).
 * Używana tam, gdzie dwie osoby mogą jednocześnie rezerwować ten sam prezent.
 */
export async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      const conflict = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
      if (!conflict || attempt >= retries) throw e;
      await new Promise((r) => setTimeout(r, 10 + Math.random() * 40 * (attempt + 1)));
    }
  }
}
