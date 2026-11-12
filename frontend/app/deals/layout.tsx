import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

export default function DealsLayout({ children }: { children: ReactNode }) {
  return <AppShell allow={['farmer', 'company', 'admin']}>{children}</AppShell>;
}
