import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EmitNfeView } from '../../views/EmitNfeView';

describe('EmitNfeView NF‑e flow', () => {
  const mockBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock fetch for emission endpoint
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/fiscal/emit-nfe')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            caminhoDanfe: 'https://example.com/danfe.pdf',
            referencia: 'NF12345',
            chaveAcesso: 'CHAVE123',
          }),
        } as any);
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
    // Mock Electron API for printer handling
    (window as any).electronAPI = {
      getPrinters: jest.fn().mockResolvedValue(['Printer A', 'Printer B']),
      printPdf: jest.fn(),
    };
  });

  test('emits NF‑e and prints via selected printer', async () => {
    render(<EmitNfeView onBack={mockBack} />);

    // Click Emitir NF‑e button
    const emitBtn = screen.getByRole('button', { name: /Emitir NF‑e/i });
    fireEvent.click(emitBtn);

    // Wait for success message
    const successMsg = await screen.findByText(/NF‑e emitida! Referência:/i);
    expect(successMsg).toBeInTheDocument();
    expect(successMsg).toHaveTextContent('NF‑e emitida! Referência: NF12345');

    // Open printer selection modal
    const emitirNotaBtn = screen.getByRole('button', { name: /Emitir Nota/i });
    fireEvent.click(emitirNotaBtn);
    const modalTitle = await screen.findByText(/Selecionar Impressora/i);
    expect(modalTitle).toBeInTheDocument();

    // Choose a printer
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Printer A' } });
    expect(select).toHaveValue('Printer A');

    // Click Imprimir button
    const imprimirBtn = screen.getByRole('button', { name: /Imprimir/i });
    fireEvent.click(imprimirBtn);

    // Verify electron print call
    await waitFor(() => {
      expect((window as any).electronAPI.printPdf).toHaveBeenCalledWith(
        'https://example.com/danfe.pdf',
        'Printer A'
      );
    });
  });
});
