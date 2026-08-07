import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;
    const role = token?.role;

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL(role === "STAFF" ? "/staff" : "/portal", req.url));
    }

    if (path.startsWith("/staff") && role !== "STAFF") {
      return NextResponse.redirect(new URL(role === "ADMIN" ? "/admin" : "/portal", req.url));
    }

    if (path.startsWith("/portal")) {
      if (role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      if (role === "STAFF") {
        return NextResponse.redirect(new URL("/staff", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/portal/:path*", "/staff/:path*"],
};
