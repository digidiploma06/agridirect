import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

export default function CompanyLayout({ children }: { children: ReactNode }) {
  return <AppShell allow={['company']}>{children}</AppShell>;
}
