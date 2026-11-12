import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

export default function MarketLayout({ children }: { children: ReactNode }) {
  return <AppShell allow={['farmer', 'company']}>{children}</AppShell>;
}
