import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';

export default function FarmerLayout({ children }: { children: ReactNode }) {
  return <AppShell allow={['farmer']}>{children}</AppShell>;
}
