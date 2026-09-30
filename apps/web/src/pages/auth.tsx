import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { z } from "zod";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/lib/auth-client";

function AuthCard({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  return (
    <div className="container flex justify-center py-12 sm:py-20">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-serif text-3xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
          <CardDescription>{footer}</CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

export function LoginPage() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error } = await signIn.email(values);
    if (error) return setError(error.message ?? t("auth.genericError"));
    navigate("/app");
  });

  return (
    <AuthCard
      title={t("auth.loginTitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            {t("nav.register")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="email" label={t("auth.email")} error={form.formState.errors.email && t("auth.genericError")}>
          <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        </Field>
        <Field id="password" label={t("auth.password")}>
          <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {t("auth.loginSubmit")}
        </Button>
      </form>
    </AuthCard>
  );
}

const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(8),
});

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const { error } = await signUp.email({
      ...values,
      locale: i18n.resolvedLanguage ?? "pl",
      callbackURL: "/app",
    });
    if (error) return setError(error.message ?? t("auth.genericError"));
    setSentTo(values.email);
  });

  return (
    <AuthCard
      title={t("auth.registerTitle")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            {t("nav.login")}
          </Link>
        </>
      }
    >
      {sentTo ? (
        <p role="status">{t("auth.checkEmail", { email: sentTo })}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field id="name" label={t("auth.name")}>
            <Input id="name" autoComplete="given-name" aria-invalid={!!errors.name} {...form.register("name")} />
          </Field>
          <Field id="email" label={t("auth.email")}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register("email")} />
          </Field>
          <Field id="password" label={t("auth.password")} error={errors.password && t("auth.passwordMin")}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...form.register("password")}
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {t("auth.registerSubmit")}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
