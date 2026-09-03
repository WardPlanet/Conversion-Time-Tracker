import type { ReactNode } from "react";

/**
 * The header-bar/body/footer card shell shared by every Dashboard section
 * below the "Next upcoming booking" banner — one place for the border,
 * shadow, and title-bar treatment so each section only supplies its own
 * content.
 */
export function DashboardCard({
  title,
  children,
  footer,
  bodyClassName = "p-5",
  className = "",
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col rounded-md border border-brand-darkBlue/10 bg-white shadow-sm ${className}`}
    >
      <div className="border-b border-brand-darkBlue/10 px-5 py-4">
        <h2 className="text-base font-semibold text-brand-darkBlue">{title}</h2>
      </div>
      <div className={`flex-1 ${bodyClassName}`}>{children}</div>
      {footer && (
        <div className="border-t border-brand-darkBlue/10 px-5 py-4">
          {footer}
        </div>
      )}
    </div>
  );
}
