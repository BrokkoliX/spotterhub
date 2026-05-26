import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────
//
// We mock urql's `useQuery` so we can inspect the variables / pause it was
// called with as the user types. The previous broken implementation used
// `pause: true` and tried to manually re-trigger the query via the second
// tuple element with new variables — which urql v5 silently ignores. The
// fix drives `variables` reactively from a debounced state, so once the
// user types ≥ 2 chars, urql must be invoked with the typed query and
// `pause: false`.

const useQueryMock = vi.fn();

vi.mock('urql', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    Provider: ({ children }: { children: React.ReactNode }) => children,
    useQuery: (args: unknown) => useQueryMock(args),
  };
});

// Import after mocks so the component picks up the mocked module.
import AirportPicker from '../components/AirportPicker';

// ─── Helpers ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  useQueryMock.mockReset();
  // Default: no data, not fetching. Returns the urql tuple shape.
  useQueryMock.mockImplementation(() => [{ data: null, fetching: false }, vi.fn()]);
  vi.useFakeTimers();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AirportPicker', () => {
  it('starts paused with an empty query', () => {
    render(<AirportPicker value={null} onChange={vi.fn()} />);

    const lastCall = useQueryMock.mock.calls.at(-1)?.[0] as {
      variables: { query: string; first: number };
      pause: boolean;
    };
    expect(lastCall.variables.query).toBe('');
    expect(lastCall.pause).toBe(true);
  });

  it('runs the GraphQL query with the typed text after debounce (≥ 2 chars)', () => {
    render(<AirportPicker value={null} onChange={vi.fn()} />);

    const input = screen.getByRole('combobox') as HTMLInputElement;

    // Type "KL" — below threshold not yet, exactly 2 chars triggers fetch
    fireEvent.change(input, { target: { value: 'KL' } });

    // Before debounce elapses, query should still be empty and paused
    let lastCall = useQueryMock.mock.calls.at(-1)?.[0] as {
      variables: { query: string };
      pause: boolean;
    };
    expect(lastCall.variables.query).toBe('');
    expect(lastCall.pause).toBe(true);

    // Advance past the 300ms debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    lastCall = useQueryMock.mock.calls.at(-1)?.[0] as {
      variables: { query: string };
      pause: boolean;
    };
    expect(lastCall.variables.query).toBe('KL');
    expect(lastCall.pause).toBe(false);
  });

  it('keeps the query paused for input shorter than 2 characters', () => {
    render(<AirportPicker value={null} onChange={vi.fn()} />);

    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'K' } });

    act(() => {
      vi.advanceTimersByTime(350);
    });

    const lastCall = useQueryMock.mock.calls.at(-1)?.[0] as {
      variables: { query: string };
      pause: boolean;
    };
    expect(lastCall.variables.query).toBe('');
    expect(lastCall.pause).toBe(true);
  });

  it('updates query variables to match the most recent debounced input (name search)', () => {
    render(<AirportPicker value={null} onChange={vi.fn()} />);

    const input = screen.getByRole('combobox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Los' } });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    fireEvent.change(input, { target: { value: 'Los Angeles' } });
    act(() => {
      vi.advanceTimersByTime(350);
    });

    const lastCall = useQueryMock.mock.calls.at(-1)?.[0] as {
      variables: { query: string };
      pause: boolean;
    };
    expect(lastCall.variables.query).toBe('Los Angeles');
    expect(lastCall.pause).toBe(false);
  });
});
