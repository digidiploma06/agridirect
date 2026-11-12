'use client';

import {
  BarChart3,
  ClipboardList,
  Handshake,
  Home,
  LogOut,
  PlusCircle,
  Search,
  ServerCog,
  ShieldCheck,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { HOME_BY_ROLE, useSession } from '@/lib/session';
import type { Role } from '@/lib/types';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { Loading } from './ui/States';

interface NavItem {
  href: string;
  label: string; // key under nav.*
  icon: LucideIcon;
}

const NAV: Record<Role, NavItem[]> = {
  farmer: [
    { href: '/farmer', label: 'home', icon: Home },
    { href: '/farmer/advice', label: 'advice', icon: Sprout },
    { href: '/farmer/listings', label: 'listings', icon: ClipboardList },
    { href: '/farmer/deals', label: 'deals', icon: Handshake },
    { href: '/market', label: 'market', icon: BarChart3 },
  ],
  company: [
    { href: '/company', label: 'home', icon: Home },
    { href: '/company/browse', label: 'browse', icon: Search },
    { href: '/company/requirements/new', label: 'post', icon: PlusCircle },
    { href: '/market', label: 'market', icon: BarChart3 },
  ],
  admin: [
    { href: '/admin', label: 'overview', icon: Home },
    { href: '/admin/verifications', label: 'verifications', icon: ShieldCheck },
    { href: '/admin/system', label: 'system', icon: ServerCog },
  ],
};

function isActive(pathname: string, href: string) {
  return href === pathname || (href.split('/').length > 2 && pathname.startsWith(`${href}/`));
}

/** Cream top bar used on every page, signed in or not. */
export function TopBar({ home = '/', children }: { home?: string; children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-leaf-200 bg-soil-50/95 text-leaf-800 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-1 px-3 sm:gap-3 sm:px-6 lg:px-10">
        <Logo href={home} />
        {children}
      </div>
    </header>
  );
}

/** Role-gated layout: redirects to /login when the session's role is not allowed. */
export function AppShell({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { session, ready, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const role = session?.user.role;
  const allowed = role !== undefined && allow.includes(role);

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/login');
    else if (!allowed) router.replace(HOME_BY_ROLE[session.user.role]);
  }, [ready, session, allowed, router]);

  if (!ready || !allowed || !role) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <Loading />
      </div>
    );
  }

  const items = NAV[role];
  async function onLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <TopBar home={HOME_BY_ROLE[role]}>
        <nav className="hidden h-full items-stretch md:flex" aria-label={tc('mainNav')}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className="flex items-center border-b-[3px] border-transparent px-3 pt-[3px] text-[15px] font-medium text-leaf-500 hover:text-leaf-800 aria-[current=page]:border-haldi-500 aria-[current=page]:text-leaf-800"
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center">
          <span className="mr-2 hidden text-sm text-leaf-500 lg:inline">{session.user.name}</span>
          <NotificationBell />
          <LanguageSwitcher />
          <button type="button" onClick={onLogout} className="flex min-h-touch min-w-touch items-center justify-center rounded-full text-leaf-600 hover:bg-leaf-100 hover:text-leaf-800" title={tc('logout')}>
            <LogOut aria-hidden className="h-5 w-5" />
            <span className="sr-only">{tc('logout')}</span>
          </button>
        </div>
      </TopBar>
      <main className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10 py-6">{children}</main>
      <nav aria-label={tc('mainNav')} className="fixed inset-x-0 bottom-0 z-20 border-t border-leaf-200 bg-white md:hidden">
        <ul className="mx-auto flex max-w-lg justify-around">
          {items.map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 border-t-[3px] border-transparent text-xs font-medium text-gray-500 aria-[current=page]:border-haldi-500 aria-[current=page]:text-leaf-800"
              >
                <item.icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                {t(item.label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
