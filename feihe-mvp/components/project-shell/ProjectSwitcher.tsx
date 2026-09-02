'use client';

import { useRouter, usePathname } from 'next/navigation';
import type { Project } from '../../lib/types/project';

export function ProjectSwitcher({
  projects,
  currentProjectId,
}: {
  projects: Project[];
  currentProjectId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const current = projects.find((p) => p.id === currentProjectId) || projects[0];

  function handleChange(nextId: string) {
    if (!nextId || nextId === currentProjectId) return;
    const match = pathname.match(/^\/projects\/[^/]+(\/?.*)$/);
    const subpath = match ? match[1] : '';
    router.push('/projects/' + encodeURIComponent(nextId) + subpath);
  }

  return (
    <div className="project-switcher">
      <small>当前项目</small>
      <div className="switcher-control">
        <i
          className="project-dot"
          style={{ background: current?.color || '#2563eb' }}
        />
        <select
          value={currentProjectId}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="切换项目"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {current && (
        <p className="project-subtext">
          {current.brand || '飞鹤'} · {current.spu || current.id} · {current.status || '进行中'}
        </p>
      )}
    </div>
  );
}
