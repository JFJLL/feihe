import type { AnchorHTMLAttributes, ReactNode } from 'react';
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string; children: ReactNode };
export function AppLink({ href, children, ...rest }: Props) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
export default AppLink;
