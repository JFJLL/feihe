'use client';

import React from 'react';
import type { CampaignDashboard } from '../../lib/campaign-types';
import { KailasDeepDive } from './KailasDeepDive';
import { MeilingDeepDive } from './MeilingDeepDive';
import { WipesDeepDive } from './WipesDeepDive';

export interface CampaignEnrichmentPanelsProps {
  dashboard: CampaignDashboard;
  section: 'ads' | 'content';
}

/**
 * CampaignEnrichmentPanels
 *
 * Project-isolated entry point for campaign deep-dive enrichment panels.
 * Renders the matching project component based on dashboard.projectId.
 */
export function CampaignEnrichmentPanels({
  dashboard,
  section,
}: CampaignEnrichmentPanelsProps) {
  const { projectId } = dashboard;

  if (projectId === 'kailas') {
    return <KailasDeepDive dashboard={dashboard} section={section} />;
  }

  if (projectId === 'meiling') {
    return <MeilingDeepDive dashboard={dashboard} section={section} />;
  }

  if (projectId === 'winner-wipes') {
    return <WipesDeepDive dashboard={dashboard} section={section} />;
  }

  return null;
}
