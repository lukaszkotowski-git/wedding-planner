import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";

/** Moduł niedostępny w pakiecie lub dla roli. Płatności dojdą w fazie 5; na razie informacja. */
export function Upsell({ reason = "plan" }: { reason?: "plan" | "role" }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Sparkles className="size-8 text-primary" />
        {reason === "plan" ? (
          <>
            <p className="font-serif text-2xl font-semibold">{t("upsell.title")}</p>
            <p className="max-w-md text-muted-foreground">{t("upsell.body")}</p>
          </>
        ) : (
          <p className="max-w-md text-muted-foreground">{t("upsell.partnerOnly")}</p>
        )}
      </CardContent>
    </Card>
  );
}
