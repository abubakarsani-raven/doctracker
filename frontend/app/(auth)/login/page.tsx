"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText } from "lucide-react";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Authenticate with backend or mock API
      await api.login(email, password, rememberMe);
      
      // Token is already stored by api-client
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      router.push(safeNext);
    } catch (err) {
      console.error("Login error:", err);
      const raw = err instanceof Error ? err.message : "";
      const message = /deactivated/i.test(raw)
        ? raw
        : /failed to fetch|network|cors|load failed/i.test(raw)
          ? "Cannot reach the API. Is the backend running on the configured URL?"
          : /invalid|credentials|unauthorized|401/i.test(raw)
            ? "That email and password do not match an account."
            : raw || "That email and password do not match an account.";
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              DocTracker
            </h1>
          </div>
          {/* The three scope colours, widest reach to narrowest. The same band
              runs down the edge of every record in the app, so the system's
              organising idea is present from the first screen. */}
          <div className="flex h-0.5 w-24 overflow-hidden rounded-full" aria-hidden>
            <span className="flex-1 bg-scope-company" />
            <span className="flex-1 bg-scope-department" />
            <span className="flex-1 bg-scope-division" />
          </div>
          <p className="register-label">Document Registry</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl">Sign in</CardTitle>
            <CardDescription className="text-center">
              You will see the documents your role and department reach.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  disabled={loading}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="remember"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Remember me
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Stay signed in on this device for 30 days. Leave unchecked
                    to sign out when you close the browser.
                  </p>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Accounts are invite-only. Ask an administrator if you need
                access.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
