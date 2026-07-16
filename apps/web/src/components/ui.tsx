import { cloneElement, isValidElement, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { useWebContext } from "../context.js";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  className?: string;
};

export function ButtonLink({ href, children, variant = "primary", className = "" }: ButtonLinkProps) {
  return (
    <a className={`button button--${variant} ${className}`.trim()} href={href}>
      {children}
    </a>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}

type NoticeProps = {
  tone: "info" | "success" | "warning" | "error";
  title: string;
  children: ReactNode;
};

const noticeIcons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

export function StatusNotice({ tone, title, children }: NoticeProps) {
  const Icon = noticeIcons[tone];
  return (
    <section className={`notice notice--${tone}`} aria-live={tone === "error" ? "assertive" : "polite"}>
      <Icon aria-hidden="true" size={22} strokeWidth={2} />
      <div>
        <h2>{title}</h2>
        <div>{children}</div>
      </div>
    </section>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
  const hintId = useId();
  const control = isValidElement<{ "aria-describedby"?: string }>(children) && hint !== undefined
    ? cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], hintId].filter(Boolean).join(" ") })
    : children;
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {control}
      {hint ? <span className="field__hint" id={hintId}>{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="text-input" {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="select-input" {...props} />;
}

export function HiddenFormFields({ idempotencyKey }: { idempotencyKey?: string }) {
  const { security } = useWebContext();
  return (
    <>
      <input type="hidden" name="csrf" value={security.csrfToken} />
      {idempotencyKey ? <input type="hidden" name="idempotencyKey" value={`${security.idempotencyPrefix}-${idempotencyKey}`} /> : null}
    </>
  );
}

export function PageHeader({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {children ? <div className="page-header__intro">{children}</div> : null}
      </div>
      {action ? <div className="page-header__action">{action}</div> : null}
    </header>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}
