import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// ---------------------------------------------------------------------------
// Root page — redirect based on auth cookie presence.
// The AuthProvider sets a `wesplit-session` cookie after successful login.
// Middleware also guards /dashboard, but this gives a cleaner UX on root /.
// ---------------------------------------------------------------------------

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get('wesplit-session');

  if (session?.value) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
