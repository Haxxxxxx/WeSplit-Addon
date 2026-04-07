import type { ReactNode } from 'react';
import AppLayout from '@/components/layout/AppLayout';

// ---------------------------------------------------------------------------
// App group layout — wraps all authenticated screens in the shell
// ---------------------------------------------------------------------------

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
