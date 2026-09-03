import React from 'react';

export function PanelHead({
  eyebrow,
  title,
  extra,
}: {
  eyebrow?: string;
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        {eyebrow && <small>{eyebrow}</small>}
        <h2>{title}</h2>
      </div>
      {extra}
    </div>
  );
}
