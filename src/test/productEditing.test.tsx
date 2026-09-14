import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/i18n/LanguageContext';
import { DataProvider } from '@/store/DataStore';
import ProductStrategyPage from '@/pages/ProductStrategyPage';
import type { ProductRecord } from '@/store/DataStore';

const companyId = 'local_editco';
const productsKey = `acs_products_${companyId}`;

const seedProducts = (products: Partial<ProductRecord>[]) => {
  localStorage.setItem('acs_companies', JSON.stringify([{ id: companyId, company_name: 'EditCo', enrichment_status: 'pending' }]));
  localStorage.setItem('acs_active_company', companyId);
  localStorage.setItem(productsKey, JSON.stringify(products));
};

const readStoredProducts = (): ProductRecord[] => JSON.parse(localStorage.getItem(productsKey) || '[]');

const renderPage = () => {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DataProvider>
          <TooltipProvider>
            <MemoryRouter initialEntries={['/product-strategy']}>
              <ProductStrategyPage />
            </MemoryRouter>
          </TooltipProvider>
        </DataProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
};

const fieldInput = (labelText: string) => {
  const label = screen.getByText(labelText);
  const input = label.parentElement?.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
  if (!input) throw new Error(`No input found for label ${labelText}`);
  return input;
};

describe('Product ficha editing flow', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    localStorage.clear();
  });

  it('opens any product from the list in edit mode, saves changes and keeps the selection', async () => {
    seedProducts([
      { name: 'Retal', type: 'equipment', averageValue: 12000, comments: 'scrap handling' },
      { name: 'SR1400', type: 'equipment line', averageValue: 95000, comments: 'scrap conveyor' },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Edit SR1400')).toBeTruthy());
    // Stored products are the source of truth: canonical profiles are not re-injected.
    expect(screen.queryByLabelText('Edit EASY PACK')).toBeNull();

    fireEvent.click(screen.getByLabelText('Edit SR1400'));

    const nameInput = fieldInput('Name') as HTMLInputElement;
    expect(nameInput.value).toBe('SR1400');
    expect(nameInput.disabled).toBe(false);

    const costInput = fieldInput('Reference estimated cost') as HTMLInputElement;
    fireEvent.change(costInput, { target: { value: '61000' } });

    // Dossier list textareas must accept new lines while typing.
    const applications = fieldInput('Applications (one per line)') as HTMLTextAreaElement;
    fireEvent.change(applications, { target: { value: 'Steel scrap\nAluminium scrap\n' } });
    expect(applications.value).toBe('Steel scrap\nAluminium scrap\n');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      const stored = readStoredProducts();
      const sr1400 = stored.find((product) => product.name === 'SR1400');
      expect(sr1400?.estimatedCost).toBe(61000);
      expect(sr1400?.technicalDossier?.applications).toEqual(['Steel scrap', 'Aluminium scrap']);
      expect(stored.map((product) => product.name).sort()).toEqual(['Retal', 'SR1400']);
    });

    // After saving, the same product remains selected in the ficha.
    await waitFor(() => {
      const heading = screen.getAllByText('SR1400').find((node) => node.tagName === 'DIV' || node.tagName === 'H3');
      expect(heading).toBeTruthy();
      expect((fieldInput('Name') as HTMLInputElement).value).toBe('SR1400');
    });
  }, 20000);

  it('persists product removal instead of re-injecting canonical profiles', async () => {
    seedProducts([
      { name: 'Retal', type: 'equipment', averageValue: 12000, comments: 'scrap handling' },
      { name: 'SR1400', type: 'equipment line', averageValue: 95000, comments: 'scrap conveyor' },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Edit Retal')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Edit Retal'));
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    fireEvent.click(screen.getByRole('button', { name: /save catalog/i }));

    await waitFor(() => {
      expect(readStoredProducts().map((product) => product.name)).toEqual(['SR1400']);
    });
    expect(screen.queryByLabelText('Edit Retal')).toBeNull();
  }, 20000);

  it('seeds canonical Ingecart profiles when the company has no catalog yet', async () => {
    seedProducts([]);
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Edit EASY PACK')).toBeTruthy());
    expect(screen.getByLabelText('Edit SR1400')).toBeTruthy();
  }, 20000);
});