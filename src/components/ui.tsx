import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

export function Page({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className={cx("mx-auto w-full max-w-xl px-5 pt-safe", className)}>
      {children}
    </main>
  );
}

/** Large title with an optional back link above and an action on the right. */
export function Header({
  title,
  back,
  action,
  sub,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <header className="pt-4 pb-5">
      <div className="flex h-8 items-center justify-between">
        {back ? (
          <Link href={back.href} className="press -ml-1 px-1 text-[17px]">
            ‹ {back.label}
          </Link>
        ) : (
          <span />
        )}
        {action}
      </div>
      <h1 className="mt-1 text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] break-words">
        {title}
      </h1>
      {sub ? <p className="mt-1.5 text-[15px] text-secondary">{sub}</p> : null}
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mb-9", className)}>
      {title ? (
        <div className="flex items-baseline justify-between pb-1">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.04em] text-secondary">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Row({
  href,
  onClick,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const cls = cx(
    "flex min-h-[52px] w-full items-center justify-between gap-4 border-b-[0.5px] border-separator py-3 text-left",
    (href || onClick) && "press",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

export function Button({
  className,
  variant = "solid",
  ...props
}: ComponentProps<"button"> & { variant?: "solid" | "secondary" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "flex h-[52px] w-full items-center justify-center rounded-[14px] px-5 text-[17px] font-semibold transition-[opacity,transform] duration-100 active:scale-[0.98] disabled:opacity-30",
        variant === "solid" ? "bg-black text-white" : "bg-fill text-black",
        className,
      )}
    />
  );
}

export function ButtonLink({
  className,
  variant = "solid",
  ...props
}: ComponentProps<typeof Link> & { variant?: "solid" | "secondary" }) {
  return (
    <Link
      {...props}
      className={cx(
        "flex h-[52px] w-full items-center justify-center rounded-[14px] px-5 text-[17px] font-semibold transition-[opacity,transform] duration-100 active:scale-[0.98]",
        variant === "solid" ? "bg-black text-white" : "bg-fill text-black",
        className,
      )}
    />
  );
}

export function TextButton({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "press py-1 text-[15px] font-medium disabled:opacity-30",
        className,
      )}
    />
  );
}

export function Muted({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("text-secondary", className)}>{children}</span>;
}

/** A labelled number. `big` is for the one figure a screen leads with. */
export function Stat({
  label,
  value,
  sub,
  big,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  big?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-secondary">{label}</div>
      <div
        className={cx(
          "mt-0.5 font-semibold tracking-[-0.02em]",
          big ? "text-[40px] leading-none" : "text-[22px] leading-tight",
        )}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[13px] text-secondary">{sub}</div>
      ) : null}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-5 py-4 sm:grid-cols-3">
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-[15px] text-secondary">{children}</p>;
}

export const field =
  "h-11 w-full border-b-[0.5px] border-separator bg-transparent text-[17px] focus:border-secondary";

export { cx };
