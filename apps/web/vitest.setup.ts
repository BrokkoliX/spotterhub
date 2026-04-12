import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import NextRouter from 'next-router-mock';

// ─── Urql mock ────────────────────────────────────────────────────────────────

const mockClient = {
  query: vi.fn(),
  mutation: vi.fn(),
  subscription: vi.fn(),
  executeQuery: vi.fn(),
  executeMutation: vi.fn(),
  executeSubscription: vi.fn(),
  readQuery: vi.fn(),
  getRequestStatus: vi.fn().mockReturnValue('idle'),
  url: 'http://localhost:4000/graphql',
  cache: vi.fn(),
  exchanges: [],
};

// Mock @urql/core (core package — used by urql internally)
vi.mock('@urql/core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Cache: vi.fn(),
    CombinedError: class CombinedError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'CombinedError';
      }
    },
    fetchExchange: vi.fn(),
    cacheExchange: vi.fn(),
    dedupExchange: vi.fn(),
    errorExchange: vi.fn(),
    composeExchanges: vi.fn((exchanges: unknown[]) => exchanges),
    createClient: vi.fn(() => mockClient),
    Provider: ({ children }: { children: React.ReactNode }) => children,
    useQuery: vi.fn(() => [{ data: null }, { fetching: false }]),
    useMutation: vi.fn(() => [
      { data: null },
      vi.fn().mockResolvedValue({ data: null }),
    ]),
    useSubscription: vi.fn(() => [{ data: null }, { fetching: false }]),
    useClient: vi.fn(() => mockClient),
  };
});

// Mock urql (the React hook package — used directly by components)
vi.mock('urql', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Provider: ({ children }: { children: React.ReactNode }) => children,
    useQuery: vi.fn(() => [{ data: null }, { fetching: false }]),
    useMutation: vi.fn(() => [
      { data: null },
      vi.fn().mockResolvedValue({ data: null }),
    ]),
    useSubscription: vi.fn(() => [{ data: null }, { fetching: false }]),
    useClient: vi.fn(() => mockClient),
  };
});

vi.mock('@urql/exchange-auth', () => ({
  authExchange: vi.fn(),
  renewSession: vi.fn(),
}));

// ─── Next.js router mock ───────────────────────────────────────────────────────

NextRouter.reset();
vi.mock('next/navigation', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useRouter: () => NextRouter,
    usePathname: () => NextRouter.pathname,
    useSearchParams: () => (NextRouter as unknown as { searchParams: URLSearchParams }).searchParams,
  };
});

afterEach(() => {
  cleanup();
  NextRouter.reset();
});
