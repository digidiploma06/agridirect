'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'block w-full min-h-touch rounded-xl border border-leaf-300 bg-white px-3.5 text-base text-gray-900 focus:border-haldi-500 focus:outline-none focus:ring-2 focus:ring-haldi-100 aria-[invalid=true]:border-red-500';

interface WrapProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  id: string;
  children: ReactNode;
}

function Wrap({ label, hint, error, id, children }: WrapProps) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-sm text-gray-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: ReactNode; hint?: ReactNode; error?: string | null };

function describedBy(id: string, hint: unknown, error: unknown) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({ label, hint, error, className = '', ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} id={id}>
      <input id={id} className={`${CONTROL} ${className}`} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...rest} />
    </Wrap>
  );
}

export function SelectField({ label, hint, error, children, className = '', ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} id={id}>
      <select id={id} className={`${CONTROL} ${className}`} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...rest}>
        {children}
      </select>
    </Wrap>
  );
}

export function TextAreaField({ label, hint, error, className = '', ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap label={label} hint={hint} error={error} id={id}>
      <textarea id={id} rows={3} maxLength={500} className={`${CONTROL} py-2 ${className}`} aria-invalid={!!error} aria-describedby={describedBy(id, hint, error)} {...rest} />
    </Wrap>
  );
}

export function Checkbox({ label, checked, onChange, required }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <label className="flex min-h-touch cursor-pointer items-start gap-3 py-2 text-gray-800">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-haldi-600" checked={checked} required={required} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
