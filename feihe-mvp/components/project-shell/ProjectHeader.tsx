'use client';

import Link from 'next/link';
import type { Project } from '../../lib/types/project';

export function ProjectHeader({
  project,
  title,
  subtitle,
  children,
}: {
  project: Project;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div className="topbar-identity">
        <p className="project-badge">
          {project.brand || '飞鹤'} · {project.spu || project.name}
        </p>
        {title && <h1>{title}</h1>}
        {subtitle && <p className="page-desc">{subtitle}</p>}
      </div>

      <div className="topbar-right">
        {children}
        <Link
          href={'/projects/' + encodeURIComponent(project.id) + '/insights?tab=ai'}
          className="primary ai-header-btn"
        >
          ✨ AI 生成报告
        </Link>
      </div>
    </header>
  );
}
