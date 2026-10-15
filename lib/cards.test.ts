import { describe, expect, it } from 'vitest';
import { CARD_NETWORKS, CARD_NETWORK_LABELS, formatCardLabel, parseCardForm } from '@/lib/cards';

describe('parseCardForm', () => {
  it('accepts a card with a trimmed name, a network and the last four digits', () => {
    expect(parseCardForm({ name: '  Galicia  ', network: 'visa', lastFour: '1234' })).toEqual({
      ok: true,
      card: { name: 'Galicia', network: 'visa', last_four: '1234' },
    });
  });

  it('stores no last four digits when the field is left empty', () => {
    expect(parseCardForm({ name: 'Santander', network: 'mastercard', lastFour: '  ' })).toEqual({
      ok: true,
      card: { name: 'Santander', network: 'mastercard', last_four: null },
    });
  });

  it('rejects a blank name', () => {
    expect(parseCardForm({ name: '   ', network: 'visa', lastFour: '' })).toEqual({
      ok: false,
      error: 'El nombre de la tarjeta es obligatorio',
    });
  });

  it('rejects a name longer than 100 characters', () => {
    expect(parseCardForm({ name: 'a'.repeat(101), network: 'visa', lastFour: '' })).toEqual({
      ok: false,
      error: 'El nombre no puede superar los 100 caracteres',
    });
  });

  it('rejects a network outside the supported list', () => {
    expect(parseCardForm({ name: 'Galicia', network: 'discover', lastFour: '' })).toEqual({
      ok: false,
      error: 'Elegí la red de la tarjeta',
    });
  });

  it.each(['123', '12345', '12a4'])('rejects "%s" as the last four digits', (lastFour: string) => {
    expect(parseCardForm({ name: 'Galicia', network: 'visa', lastFour })).toEqual({
      ok: false,
      error: 'Los últimos 4 dígitos tienen que ser 4 números',
    });
  });
});

describe('formatCardLabel', () => {
  it('shows the name, the network and the last four digits', () => {
    expect(formatCardLabel({ name: 'Galicia', network: 'visa', last_four: '1234' })).toBe(
      'Galicia · Visa •••• 1234',
    );
  });

  it('omits the digits when the card has none', () => {
    expect(formatCardLabel({ name: 'Naranja X', network: 'naranja', last_four: null })).toBe(
      'Naranja X · Naranja',
    );
  });
});

describe('CARD_NETWORKS', () => {
  it('offers Visa, Mastercard, American Express, Cabal, Naranja and Otra', () => {
    expect(CARD_NETWORKS.map((network) => CARD_NETWORK_LABELS[network])).toEqual([
      'Visa',
      'Mastercard',
      'American Express',
      'Cabal',
      'Naranja',
      'Otra',
    ]);
  });
});
