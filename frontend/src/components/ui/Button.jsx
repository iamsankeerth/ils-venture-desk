const VARIANTS = {
  primary: "bg-brand text-white hover:brightness-110 disabled:bg-slate-300 disabled:text-slate-500",
  secondary: "bg-white text-nav ring-1 ring-inset ring-border-ui hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-danger-ui text-white hover:brightness-110 disabled:bg-slate-300 disabled:text-slate-500",
  ghost: "bg-transparent text-muted hover:bg-slate-100 disabled:text-slate-300",
};

export default function Button({ variant = "secondary", className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-[background-color,filter] duration-150 disabled:cursor-not-allowed ${VARIANTS[variant] ?? VARIANTS.secondary} ${className}`}
      {...props}
    />
  );
}
