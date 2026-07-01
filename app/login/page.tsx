"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/admin";
  const supabase = createClient();

  function handleLogin() {
    setError(null);
    startTransition(async () => {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      router.push(redirect);
      router.refresh();
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <PawPrint className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Petra Paws Admin</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to manage your grooming business.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
        {error && (
          <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@petrapaws.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoComplete="current-password"
          />
        </div>

        <Button
          className="w-full"
          onClick={handleLogin}
          disabled={isPending || !email || !password}
        >
          {isPending ? "Signing in…" : "Sign In"}
        </Button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
