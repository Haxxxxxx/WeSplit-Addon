/**
 * useAuth Hook
 *
 * Re-exports the canonical useAuth hook from AuthProvider.
 * Use `import { useAuth } from '@/providers'` directly in most cases.
 * This re-export exists for backwards compatibility with any code that
 * imports from `@/hooks/web/useAuth`.
 */

export { useAuth } from '@/providers/AuthProvider';
