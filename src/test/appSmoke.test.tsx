import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '@/App';

describe('App smoke test', () => {
  it('renders the main shell', () => {
    render(<App />);
    expect(screen.getByText(/add company/i)).toBeInTheDocument();
  });
});
