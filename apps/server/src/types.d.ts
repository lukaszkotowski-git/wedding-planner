import type { Wedding } from "@prisma/client";
import type { WeddingRole } from "@wedding/shared";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; name: string; locale: string };
      /** Ustawiane przez requireWeddingRole: wesele w kontekście żądania. */
      wedding?: Wedding;
      weddingRole?: WeddingRole;
    }
  }
}
