'use client';

import React from 'react';
import type { CampaignDashboard } from '../../lib/campaign-types';
import { KailasDeepDive } from './KailasDeepDive';
import { KailasRichInsights } from './KailasRichInsights';
import { MeilingDeepDive } from './MeilingDeepDive';
import { WipesDeepDive } from './WipesDeepDive';
import { MeilingRichInsights } from './MeilingRichInsights';
import { WipesRichInsights } from './WipesRichInsights';

export interface CampaignEnrichmentPanelsProps {
  dashboard: CampaignDashboard;
  section: 'overview' | 'ads' | 'content';
  activeSnapshot?: string;
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
  activeSnapshot,
}: CampaignEnrichmentPanelsProps) {
  const { projectId } = dashboard;

  // Meiling: overview renders MeilingRichInsights; ads/content renders MeilingDeepDive + MeilingRichInsights
  if (projectId === 'meiling') {
    if (section === 'overview') {
      return (
        <MeilingRichInsights
          dashboard={dashboard}
          section="overview"
          snapshot={activeSnapshot}
        />
      );
    }
    return (
      <>
        <MeilingDeepDive dashboard={dashboard} section={section} />
        <MeilingRichInsights
          dashboard={dashboard}
          section={section}
          snapshot={activeSnapshot}
        />
      </>
    );
  }

  // Winner Wipes: overview renders WipesRichInsights; ads/content renders WipesDeepDive + WipesRichInsights
  if (projectId === 'winner-wipes') {
    if (section === 'overview') {
      return <WipesRichInsights dashboard={dashboard} section="overview" />;
    }
    return (
      <>
        <WipesDeepDive dashboard={dashboard} section={section} />
        <WipesRichInsights dashboard={dashboard} section={section} />
      </>
    );
  }

  if (projectId === 'kailas') {
    if (section === 'overview') {
      return <KailasRichInsights dashboard={dashboard} section={section} snapshot={activeSnapshot} />;
    }
    return (
      <div className="campaign-enrichment-stack">
        <KailasRichInsights dashboard={dashboard} section={section} snapshot={activeSnapshot} />
        <KailasDeepDive dashboard={dashboard} section={section} />
      </div>
    );
  }

  if (section === 'overview') {
    return null;
  }

  return null;
}
