'use client';
import { useState, useEffect, useSyncExternalStore } from 'react';
const subscribeHydration = () => () => {};
import type { Project } from '../../lib/types/project';
import { useProject } from '../../components/project-shell/ProjectContext';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProjectFormDialog } from '../project-center/ProjectFormDialog';

type PaletteKey = 'botanical' | 'terracotta' | 'nordic';

const THEME_PALETTES: {
  id: PaletteKey;
  title: string;
  subtitle: string;
  badge?: string;
  swatches: [string, string, string, string];
}[] = [
  {
    id: 'botanical',
    title: '🌿 旷野松石 (松石绿 + 赤陶橘)',
    subtitle: '温润纸感与自然松石绿主调，兼顾高可读性与全链路层次对比',
    badge: '默认推荐',
    swatches: ['#0F5E52', '#D95D39', '#2E6F8E', '#C87D20'],
  },
  {
    id: 'terracotta',
    title: '📰 财经社论 (丹砂红 + 矿石蓝)',
    subtitle: '社论报刊级暖调丹砂与深矿蓝对比，适合经营复盘与投流归因审阅',
    swatches: ['#C84B31', '#26547C', '#4A6B53', '#B87333'],
  },
  {
    id: 'nordic',
    title: '🏔️ 北欧矿石 (深海青 + 鼠尾草)',
    subtitle: '冷静克制的深海矿石青与鼠尾草绿，适合密集表格与多维指标对账',
    swatches: ['#1B4965', '#C85A32', '#4A7C59', '#C98A2C'],
  },
];

export function ProjectProfile({ project, projectId, onDone, toast }: {
  project: Project | null; projectId: string; onDone: () => Promise<void>;
  toast: (value: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const { workspace, error, refreshWorkspace } = useProject();
  const [editing, setEditing] = useState(false);
  const [activePalette, setActivePalette] = useState<PaletteKey>('botanical');
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const syncFromDomOrStorage = (raw?: string | null) => {
      const candidate =
        raw ||
        window.localStorage.getItem('feihe_ui_palette') ||
        document.documentElement.getAttribute('data-palette') ||
        'botanical';
      const valid: PaletteKey =
        candidate === 'botanical' || candidate === 'terracotta' || candidate === 'nordic'
          ? candidate
          : 'botanical';
      document.documentElement.setAttribute('data-palette', valid);
      setActivePalette(valid);
    };
    syncFromDomOrStorage();

    const onPaletteChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const next = typeof detail === 'string' ? detail : detail?.palette;
      if (next) syncFromDomOrStorage(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'feihe_ui_palette') {
        syncFromDomOrStorage(e.newValue || 'botanical');
      }
    };
    window.addEventListener('palettechange', onPaletteChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('palettechange', onPaletteChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleSelectPalette = (val: PaletteKey) => {
    setActivePalette(val);
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.localStorage.setItem('feihe_ui_palette', val);
      document.documentElement.setAttribute('data-palette', val);
      window.dispatchEvent(new CustomEvent('palettechange', { detail: val }));
    }
    toast?.('已切换全站浅色色板主题', 'success');
  };

  if (!project || !workspace?.metadata) return error ? <ErrorState error={error} onRetry={refreshWorkspace} /> : <LoadingState text="正在读取项目资料…" />;
  const archived = Boolean(project.isArchived) || project.status === '已归档';
  const brandProductText = [project.brand, project.spu, project.category].filter(Boolean).join(' / ') || '未配置';
  const isOngoing = project.status === '进行中';

  const fieldBoxStyle: React.CSSProperties = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '14px 18px',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
  };

  return (
    <>
    <article
      className="panel integration-project-profile"
      aria-label="已保存的项目资料"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '22px 24px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        className="integration-page-heading"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '16px',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>项目资料</h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>团队共享的项目基本信息与基础配置</p>
        </div>
        {project.canManage && !archived && (
          <button
            type="button"
            className="primary"
            disabled={!hydrated}
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              background: '#0d6e52',
              borderColor: '#0d6e52',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            编辑项目资料
          </button>
        )}
      </div>

      {project.logoUrl && (
        <div
          className="project-profile-logo-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '18px',
            padding: '12px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <img
            src={project.logoUrl}
            alt="项目 Logo"
            style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
          />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>{project.name}</div>
            <span style={{ fontSize: '12px', color: '#64748b' }}>项目标识 Logo</span>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. 项目名称 */}
        <div style={fieldBoxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>项目名称</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: '4px',
                background: '#dff6f0',
                color: '#006858',
                border: '1px solid #b8eae0',
              }}
            >
              当前项目
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.name}
          </div>
        </div>

        {/* 2. 所属客户 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>所属客户</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.clientName || '内部项目'}
          </div>
        </div>

        {/* 3. 负责部门 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>负责部门</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.departmentName || '待设置'}
          </div>
        </div>

        {/* 4. 项目负责人 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>项目负责人</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {project.ownerName || '待设置'}
          </div>
        </div>

        {/* 5. 业务状态 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>业务状态</div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              background: isOngoing ? '#dff6f0' : '#f1f5f9',
              color: isOngoing ? '#006858' : '#475569',
              border: isOngoing ? '1px solid #b8eae0' : '1px solid #cbd5e1',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isOngoing ? '#0d6e52' : '#64748b',
              }}
            />
            {project.status}
          </span>
        </div>

        {/* 6. 业务模板 */}
        <div style={fieldBoxStyle}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>业务模板</div>
          <span
            style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
            }}
          >
            {project.templateName || '轻量营销看板'}
          </span>
        </div>

        {/* 7. 品牌 / SPU / 品类 */}
        <div style={{ ...fieldBoxStyle, gridColumn: 'span 1' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>品牌 / SPU / 品类</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>
            {brandProductText}
          </div>
        </div>

        {/* 8. 项目说明 */}
        <div style={{ ...fieldBoxStyle, gridColumn: 'span 2' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '6px' }}>项目说明</div>
          <div style={{ fontSize: '14px', color: '#0f172a', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {project.description || '未填写'}
          </div>
        </div>
      </div>

      {!project.canManage && (
        <p className="integration-form-help" style={{ margin: '16px 0 0', fontSize: '12px', color: '#64748b' }}>
          项目资料由负责人维护，需要调整时请联系{project.ownerName || '项目负责人'}。
        </p>
      )}
      {archived && (
        <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#e5484d' }}>
          项目已归档，恢复后可以继续编辑。
        </p>
      )}
      {editing && (
        <ProjectFormDialog
          key={projectId}
          project={project}
          metadata={workspace.metadata}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            toast('项目资料已更新', 'success');
            await refreshWorkspace();
            await onDone();
          }}
        />
      )}
    </article>

    <section
      className="panel settings-appearance-bento-card"
      aria-label="界面外观与浅色色板 (Appearance & Theme Palette)"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '22px 24px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '16px',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
              界面外观与浅色色板 (Appearance & Theme Palette)
            </h2>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'var(--brand-primary-soft, #dff6f0)',
                color: 'var(--brand-primary, #0F5E52)',
                border: '1px solid rgba(15, 94, 82, 0.18)',
              }}
            >
              全局实时生效
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
            自定义全站数据总览、分日看板、图表序列与语义卡片的浅色视觉色板
          </p>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <label
            htmlFor="settings-palette-select"
            style={{ fontSize: '12px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}
          >
            快速切换色板：
          </label>
          <select
            id="settings-palette-select"
            aria-label="选择浅色色板"
            value={activePalette}
            onChange={(e) => handleSelectPalette(e.target.value as PaletteKey)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              cursor: 'pointer',
            }}
          >
            {THEME_PALETTES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className="settings-palette-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '14px',
        }}
      >
        {THEME_PALETTES.map((item) => {
          const isSelected = activePalette === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectPalette(item.id)}
              aria-pressed={isSelected}
              className={`settings-palette-theme-card${isSelected ? ' is-selected' : ''}`}
              style={{
                textAlign: 'left',
                background: isSelected ? '#f4fbf9' : '#f8fafc',
                border: isSelected ? `2px solid ${item.swatches[0]}` : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: isSelected
                  ? '0 4px 12px rgba(15, 94, 82, 0.1)'
                  : '0 1px 2px rgba(15, 23, 42, 0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                    {item.title}
                  </span>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '1px 7px',
                          borderRadius: '4px',
                          background: item.swatches[0],
                          color: '#ffffff',
                        }}
                      >
                        当前使用
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.5 }}>
                  {item.subtitle}
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(148, 163, 184, 0.2)',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {item.swatches.map((hex) => (
                    <span
                      key={hex}
                      title={hex}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '6px',
                        background: hex,
                        border: '1px solid rgba(15, 23, 42, 0.12)',
                        display: 'inline-block',
                      }}
                    />
                  ))}
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: '#64748b',
                  }}
                >
                  {item.swatches.join(' · ')}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
    </>
  );
}
