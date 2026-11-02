'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export const CHART_SELECTOR =
  '.bento-card, .ca-panel, .ca-metric-item, .bd-kpi-card-rich, .bd-channel-structure, .bd-funnel, .bv-cost-chart, .bv-audience, .bv-ranks, .chart-inner-panel, .ops-section-card, .dashboard-section, .platform-panel, .kri-card, .mri-card, .wri-card, .ht-card, .qicui-trend-card, .qicui-structure-card';

export function ScrollChartAnimator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    let observer: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let rafId: number | null = null;

    const initObserver = () => {
      if (observer) {
        observer.disconnect();
      }

      observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const el = entry.target as HTMLElement;
              obs.unobserve(el);
              setTimeout(() => {
                el.setAttribute('data-chart-lazy', 'active');
              }, 60);
            }
          });
        },
        {
          threshold: 0.12,
          rootMargin: '0px 0px -24px 0px',
        }
      );

      const elements = document.querySelectorAll<HTMLElement>(CHART_SELECTOR);
      elements.forEach((el) => {
        if (!el.hasAttribute('data-chart-lazy')) {
          el.setAttribute('data-chart-lazy', 'pending');
        }
        if (el.getAttribute('data-chart-lazy') === 'pending') {
          observer?.observe(el);
        }
      });
    };

    // Run initial scan
    initObserver();

    // Replay on collapsible <details> toggling open
    const handleToggle = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'DETAILS' && (target as HTMLDetailsElement).open) {
        const nestedCharts = target.querySelectorAll<HTMLElement>(CHART_SELECTOR);
        nestedCharts.forEach((chart) => {
          chart.setAttribute('data-chart-lazy', 'pending');
          setTimeout(() => {
            chart.setAttribute('data-chart-lazy', 'active');
          }, 50);
        });
      }
    };
    document.addEventListener('toggle', handleToggle, true);

    // MutationObserver debounced via requestAnimationFrame to observe dynamically rendered chart blocks
    mutationObserver = new MutationObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const unobserved = document.querySelectorAll<HTMLElement>(CHART_SELECTOR);
        unobserved.forEach((el) => {
          if (!el.hasAttribute('data-chart-lazy')) {
            el.setAttribute('data-chart-lazy', 'pending');
            observer?.observe(el);
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer?.disconnect();
      mutationObserver?.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('toggle', handleToggle, true);
    };
  }, [pathname, searchParams]);

  return null;
}
