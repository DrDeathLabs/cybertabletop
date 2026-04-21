import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  className?: string;
}

const variantClasses = {
  default: 'bg-slate-700 text-slate-200 border-slate-600',
  success: 'bg-green-950/50 text-green-400 border-green-700/50',
  warning: 'bg-yellow-950/50 text-yellow-400 border-yellow-700/50',
  danger: 'bg-red-950/50 text-red-400 border-red-700/50',
  info: 'bg-blue-950/50 text-blue-400 border-blue-700/50',
  outline: 'bg-transparent text-slate-300 border-slate-600',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
