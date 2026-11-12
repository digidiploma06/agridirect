import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A plain panel: optional title bar, then content. */
export function Card({ title, action, className = '', children }: CardProps) {
  return (
    <section className={`rounded-2xl border border-leaf-200 bg-white shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex min-h-12 items-center justify-between gap-2 border-b border-leaf-100 px-5 py-2.5">
          {title && <h2 className="text-base font-semibold text-gray-900">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-leaf-200 pb-4">
      <div>
        <h1 className="text-[1.75rem] font-semibold leading-tight text-leaf-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-gray-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
