'use client';

import type { AnchorHTMLAttributes, ReactNode, MouseEvent } from 'react';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  children: ReactNode;
};

export function AppLink({ href, children, onClick, ...rest }: Props) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;

    // 拦截同项目内的超链接，转为 0ms 纯客户端平滑无感切页
    if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey &&
      !e.altKey &&
      typeof window !== 'undefined'
    ) {
      if (href.startsWith('/projects/')) {
        const currentMatch = window.location.pathname.match(/^\/projects\/([^/]+)/);
        const targetMatch = href.match(/^\/projects\/([^/]+)/);
        if (currentMatch && targetMatch && currentMatch[1] === targetMatch[1]) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('app:navigate', { detail: { href } }));
          return;
        }
      }
    }
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export default AppLink;

