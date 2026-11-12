import type { ReactNode } from 'react';

export type Tone = 'green' | 'amber' | 'red' | 'gray' | 'blue';

const TONES: Record<Tone, string> = {
  green: 'border-leaf-800 bg-leaf-800 text-white',
  amber: 'border-haldi-400 bg-haldi-50 text-haldi-700',
  red: 'border-red-200 bg-red-50 text-red-800',
  gray: 'border-gray-300 bg-gray-50 text-gray-700',
  blue: 'border-sky-200 bg-sky-50 text-sky-900',
};

export function Badge({ tone = 'gray', icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-medium leading-5 ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}
