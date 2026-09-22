export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 22V10h2.4l9.2 8.4V10H23v12h-2.4l-9.2-8.4V22H9Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}
