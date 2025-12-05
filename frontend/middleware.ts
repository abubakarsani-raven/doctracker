import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Admin routes that require Master or Company Admin role
const adminRoutes = [
  "/admin/dashboard",
  "/admin/companies",
  "/admin/reports",
  "/admin/storage",
  "/approvals",
];

// Master-only routes
const masterOnlyRoutes = ["/admin/companies"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is an admin route
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  const isMasterOnlyRoute = masterOnlyRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isAdminRoute || isMasterOnlyRoute) {
    // Get user from cookie or header (adjust based on your auth implementation)
    // For now, we'll let the page component handle the check
    // This middleware can be enhanced to check JWT tokens or session
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
