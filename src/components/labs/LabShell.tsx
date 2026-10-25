import type { CSSProperties, ReactNode } from "react";

interface LabShellProps {
  title: string;
  description: string;
  children: ReactNode;
  foot?: string;
  accent?: string;
}

export default function LabShell({ title, description, children, foot, accent }: LabShellProps) {
  return (
    <figure
      className="lab"
      style={{ "--lab-accent": accent ?? "var(--indigo)" } as CSSProperties}
    >
      <div className="lab-head">
        <span className="lab-kicker">
          <i aria-hidden="true" />
          Interactive lab
        </span>
        <h4 className="lab-title">{title}</h4>
        <p className="lab-desc">{description}</p>
      </div>
      <div className="lab-stage">{children}</div>
      {foot ? <figcaption className="lab-foot">{foot}</figcaption> : null}
    </figure>
  );
}
