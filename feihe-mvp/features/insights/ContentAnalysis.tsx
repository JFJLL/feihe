'use client';

import type { Dashboard } from '../../lib/types/project';
import { ContentPerformance } from '../content/ContentPerformance';

export function ContentAnalysis({
  data,
  openNote,
}: {
  data: Dashboard;
  openNote?: (id: string) => void;
}) {
  return (
    <div className="stack">
      <ContentPerformance data={data} openNote={openNote || (() => undefined)} />
    </div>
  );
}
