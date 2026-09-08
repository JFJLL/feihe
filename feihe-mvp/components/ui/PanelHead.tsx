import React from 'react';

import { sectionLabels } from './section-labels';

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
        {eyebrow && <small>{sectionLabels[eyebrow]?.[0] || eyebrow}</small>}
        <h2>{title}</h2>
      </div>
      {extra}
    </div>
  );
}
