p = 'feihe-mvp/features/campaign/CampaignEnrichmentPanels.tsx'
content = open(p, encoding='utf-8').read()
if 'KailasRichInsights' not in content:
    content = content.replace(
        "import { KailasDeepDive } from './KailasDeepDive';",
        "import { KailasDeepDive } from './KailasDeepDive';\nimport { KailasRichInsights } from './KailasRichInsights';"
    )
    old_block = """  if (section === 'overview') {
    return null;
  }

  if (projectId === 'kailas') {
    return <KailasDeepDive dashboard={dashboard} section={section} />;
  }"""
    new_block = """  if (projectId === 'kailas') {
    if (section === 'overview') {
      return <KailasRichInsights dashboard={dashboard} section={section} snapshot={snapshot} />;
    }
    return (
      <div className="campaign-enrichment-stack">
        <KailasRichInsights dashboard={dashboard} section={section} snapshot={snapshot} />
        <KailasDeepDive dashboard={dashboard} section={section} />
      </div>
    );
  }

  if (section === 'overview') {
    return null;
  }"""
    content = content.replace(old_block, new_block)
    open(p, 'w', encoding='utf-8').write(content)
    print('CampaignEnrichmentPanels updated successfully.')
else:
    print('Already updated.')
