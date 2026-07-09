import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component read-only */ }
        },
      },
    }
  )

  // Monkey-patch getUser to avoid unhandled rejections on Invalid Refresh Token
  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  supabase.auth.getUser = async (jwt?: string) => {
    try {
      return await originalGetUser(jwt);
    } catch (error: any) {
      console.error('Supabase getUser caught error:', error);
      return { data: { user: null }, error };
    }
  };

  return supabase;
}
