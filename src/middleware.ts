import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Menyegarkan sesi Supabase di setiap request dan mengarahkan tamu ke /login.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Middleware hanya mengusir tamu. Pengalihan user yang sudah login dari /login ke / dilakukan
  // halaman login sendiri, dan hanya kalau profilnya ada. Kalau middleware juga ikut mengalihkan,
  // akun tanpa profil memicu loop /login <-> / (ERR_TOO_MANY_REDIRECTS).
  const { data } = await supabase.auth.getClaims();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!data?.claims && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Lewati file statis, ikon, manifest, dan service worker
  matcher: ["/((?!_next/static|_next/image|icons/|sw.js|manifest.webmanifest|favicon.ico).*)"],
};
