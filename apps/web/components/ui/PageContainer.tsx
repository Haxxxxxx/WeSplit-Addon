// Re-export from layout version — single source of truth.
// Named export `PageContainer` maps to the layout default export.
import LayoutPageContainer, { type PageContainerProps as LayoutProps } from '@/components/layout/PageContainer';

export { LayoutPageContainer as PageContainer };
export type { LayoutProps as PageContainerProps };
