'use client';
import { useEffect } from 'react';
import { activateCacheIdentity, clearIdentityCache } from '../../lib/browser-cache';
import { useCacheIdentity } from '../project-shell/IdentityBoundary';
import Link from './AppLink';
export function AccessState({ status, message }: { status: number; message?: string }) {
  const identity = useCacheIdentity();
  useEffect(() => { if (identity) clearIdentityCache(identity); activateCacheIdentity(null); }, [identity]);
  return <main className="main"><section className="ui-state-box error" role="alert"><h1>{status === 401 ? '需要公司身份验证' : '无权访问此项目'}</h1><p>{message || '请通过已验证的公司身份入口登录，或联系项目负责人申请访问。'}</p><Link className="primary" href="/">返回项目中心</Link><p>如已重新登录或获得授权，请重新打开项目页面。</p></section></main>;
}
