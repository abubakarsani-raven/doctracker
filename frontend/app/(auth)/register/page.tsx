"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

/**
 * Public self-registration is disabled — DocTracker is invite-only.
 * Admins add people from company settings (invite by email or create account).
 */
export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">
              DocTracker
            </h1>
          </div>
          <div className="flex h-0.5 w-24 overflow-hidden rounded-full" aria-hidden>
            <span className="flex-1 bg-scope-company" />
            <span className="flex-1 bg-scope-department" />
            <span className="flex-1 bg-scope-division" />
          </div>
          <p className="register-label">Document Registry</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-2xl">Invite only</CardTitle>
            <CardDescription className="text-center">
              DocTracker is a closed system. New accounts are created by an
              administrator — you cannot sign up yourself.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              If you already have an account, sign in. If you were invited, use
              the link in your email to set a password. You can also reset a
              forgotten password from the sign-in page.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              <Link
                href="/forgot-password"
                className="text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
