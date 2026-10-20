// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from '../../src/App.tsx';

test('header matches the shop mockup: wordmark, subtitle, search, My crates', () => {
  render(<App />);
  const banner = screen.getByRole('banner');
  expect(within(banner).getByText('RHYTHM LAB')).toBeInTheDocument();
  expect(within(banner).getByText("Tarik's record collection")).toBeInTheDocument();
  expect(within(banner).getByRole('searchbox', { name: /search records/i })).toBeInTheDocument();
  expect(within(banner).getByRole('button', { name: /my crates/i })).toBeInTheDocument();
});
