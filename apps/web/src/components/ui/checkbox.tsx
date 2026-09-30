import * as React from "react";
import { cn } from "@/lib/utils";

/** Natywny checkbox z etykietą (dostępny, działa z react-hook-form przez register). */
const CheckboxField = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type"> & { label: React.ReactNode }
>(({ className, label, id, ...props }, ref) => {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-2.5 text-sm leading-snug", className)}>
      <input
        id={inputId}
        type="checkbox"
        ref={ref}
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-[hsl(var(--primary))]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
});
CheckboxField.displayName = "CheckboxField";

export { CheckboxField };
