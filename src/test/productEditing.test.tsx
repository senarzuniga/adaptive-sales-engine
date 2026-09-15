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

  it('saves an edited product as a new one and keeps the original untouched', async () => {
    seedProducts([
      { name: 'SR1400', type: 'equipment line', averageValue: 95000, estimatedCost: 55000, comments: 'scrap conveyor' },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Edit SR1400')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Edit SR1400'));

    fireEvent.change(fieldInput('Name'), { target: { value: 'SR1400 HEAVY' } });
    fireEvent.change(fieldInput('Reference estimated cost'), { target: { value: '72000' } });
    fireEvent.click(screen.getByRole('button', { name: /save as new/i }));

    await waitFor(() => {
      const stored = readStoredProducts();
      expect(stored.map((product) => product.name).sort()).toEqual(['SR1400', 'SR1400 HEAVY']);
      expect(stored.find((product) => product.name === 'SR1400')?.estimatedCost).toBe(55000);
      expect(stored.find((product) => product.name === 'SR1400 HEAVY')?.estimatedCost).toBe(72000);
    });
    await waitFor(() => expect(screen.getByLabelText('Edit SR1400 HEAVY')).toBeTruthy());
  }, 20000);

  it('duplicates a product with a unique name when the name is not changed', async () => {
    seedProducts([{ name: 'Retal', type: 'equipment', averageValue: 12000, comments: 'scrap handling' }]);
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Edit Retal')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^duplicate$/i }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(readStoredProducts().map((product) => product.name).sort()).toEqual(['Retal', 'Retal (copy)']);
    });
  }, 20000);

  it('enables a detailed installation plan on a preset line and persists labour + travel parameters', async () => {
    seedProducts([
      { name: 'SR1400', type: 'equipment line', averageValue: 95000, comments: 'scrap conveyor', costPreset: [{ category: 'installation', lineItem: 'SR1400 installation', mode: 'installation', days: 8, resources: 2, unitCost: 550 }] },
    ]);
    renderPage();

    await waitFor(() => expect(screen.getByLabelText('Edit SR1400')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Edit SR1400'));

    fireEvent.click(screen.getByLabelText('Detailed installation plan SR1400 installation'));
    await waitFor(() => expect(screen.getByTestId('preset-0-planner')).toBeTruthy());
    // 8 d x 2 tech x (10 h x 65 + 80 + 20) = 12,000 labour; car with 0 km + 8 nights x 2 x 120 = 1,920 travel
    expect(screen.getByTestId('preset-0-labor').textContent).toContain('12,000');
    expect(screen.getByTestId('preset-0-travel').textContent).toContain('1,920');

    fireEvent.change(fieldInput('Km per round trip'), { target: { value: '400' } });
    await waitFor(() => expect(screen.getByTestId('preset-0-travel').textContent).toContain('2,200'));

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => {
      const stored = readStoredProducts().find((product) => product.name === 'SR1400');
      expect(stored?.costPreset?.[0]?.installation?.distanceKm).toBe(400);
      expect(stored?.costPreset?.[0]?.installation?.days).toBe(8);
    });
  }, 20000);

  it('seeds canonical Ingecart profiles when the company has no catalog yet', async () => {
    seedProducts([]);
    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Edit EASY PACK')).toBeTruthy());
    expect(screen.getByLabelText('Edit SR1400')).toBeTruthy();
  }, 20000);
});