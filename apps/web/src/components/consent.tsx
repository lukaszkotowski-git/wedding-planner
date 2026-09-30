import { forwardRef } from "react";
import { Trans } from "react-i18next";
import { CheckboxField } from "@/components/ui/checkbox";

/** Checkbox zgody RODO z linkiem do polityki prywatności (otwiera się w nowej karcie, żeby nie zgubić formularza). */
export const ConsentCheckbox = forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof CheckboxField>, "label"> & { kind: "rsvp" | "gift" | "join" }
>(({ kind, ...props }, ref) => (
  <CheckboxField
    ref={ref}
    required
    {...props}
    label={
      <Trans
        i18nKey={`consent.${kind}`}
        components={{
          privacy: <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2" />,
        }}
      />
    }
  />
));
ConsentCheckbox.displayName = "ConsentCheckbox";
