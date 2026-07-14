"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  MessageSquare,
  Trophy,
  User as UserIcon,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signin" | "signup";

export default function AuthPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [mode, setMode] = useState<AuthMode>("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.replace("/");
    }
  }, [user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const cleanUsername = username
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "");

        if (cleanUsername.length < 3) {
          throw new Error(
            "Username must be at least 3 characters and may only contain letters, numbers, and underscores.",
          );
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              username: cleanUsername,
              display_name: cleanUsername,
            },
          },
        });

        if (error) {
          throw error;
        }

        toast.success(
          "Account created. Check your inbox if email confirmation is required.",
        );

        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      toast.success("Welcome back");

      router.replace("/");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (forgotLoading) {
      return;
    }

    setForgotLoading(true);

    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(
          forgotEmail.trim(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        );

      if (error) {
        throw error;
      }

      toast.success(
        "Password reset email sent. Check your inbox.",
      );

      setForgotOpen(false);
      setForgotEmail("");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Something went wrong.",
      );
    } finally {
      setForgotLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setForgotOpen(false);
    setPassword("");
    setConfirmPassword("");
  }

  function toggleForgotPassword() {
    setForgotEmail(email);
    setForgotOpen((current) => !current);
  }

  return (
    <AppShell>
      <main className="relative mx-auto max-w-sm px-6 py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-2xl"
        />

        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
          <span className="inline-block size-1.5 rounded-full bg-primary" />

          {mode === "signin"
            ? "Welcome back"
            : "Join the crowd"}
        </div>

        <h1 className="text-3xl font-black leading-tight tracking-tight">
          {mode === "signin" ? (
            <>
              Sign in to{" "}
              <span className="text-primary">FanTwit</span>
            </>
          ) : (
            <>
              Create your{" "}
              <span className="text-primary">FanTwit</span>{" "}
              profile
            </>
          )}
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          Post takes, tag team threads with{" "}
          <span className="font-semibold text-foreground">
            $ARS
          </span>
          ,{" "}
          <span className="font-semibold text-foreground">
            $LAL
          </span>
          ,{" "}
          <span className="font-semibold text-foreground">
            $KC
          </span>{" "}
          — chat with fans across every league.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-medium text-muted-foreground">
          <FeatureCard
            icon={<Trophy className="size-4 text-primary" />}
            label="Every league"
          />

          <FeatureCard
            icon={
              <MessageSquare className="size-4 text-primary" />
            }
            label="Live takes"
          />

          <FeatureCard
            icon={<Users className="size-4 text-primary" />}
            label="Real fans"
          />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-muted p-1">
          {(["signin", "signup"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeMode(item)}
              className={`rounded-full py-1.5 text-xs font-semibold transition-colors ${
                mode === item
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item === "signin"
                ? "Sign in"
                : "Create account"}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-3"
        >
          {mode === "signup" && (
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="username"
                className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
              required
              autoComplete="email"
            />
          </div>

          <PasswordInput
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() =>
              setShowPassword((current) => !current)
            }
            placeholder="password"
            autoComplete={
              mode === "signin"
                ? "current-password"
                : "new-password"
            }
          />

          {mode === "signup" && (
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showConfirmPassword}
              onToggle={() =>
                setShowConfirmPassword((current) => !current)
              }
              placeholder="confirm password"
              autoComplete="new-password"
            />
          )}

          {mode === "signin" && (
            <div className="text-right">
              <button
                type="button"
                onClick={toggleForgotPassword}
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 hover:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        {forgotOpen && mode === "signin" && (
          <form
            onSubmit={handlePasswordReset}
            className="mt-4 space-y-2 rounded-lg border border-border bg-accent/30 p-3"
          >
            <p className="text-xs text-muted-foreground">
              Enter your email and we&apos;ll send you a reset
              link.
            </p>

            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="email"
                value={forgotEmail}
                onChange={(event) =>
                  setForgotEmail(event.target.value)
                }
                placeholder="email"
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {forgotLoading
                ? "Sending…"
                : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-xs text-muted-foreground">
          By continuing, you agree to keep it civil in the
          threads.
        </p>

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to feed
          </Link>
        </div>
      </main>
    </AppShell>
  );
}

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
};

function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
  autoComplete,
}: PasswordInputProps) {
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-10 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring"
        required
        minLength={6}
        autoComplete={autoComplete}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {visible ? (
          <EyeOff className="size-4" />
        ) : (
          <Eye className="size-4" />
        )}
      </button>
    </div>
  );
}

function FeatureCard({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card/50 px-2 py-2">
      {icon}
      <span>{label}</span>
    </div>
  );
}