import { describe, expect, it } from 'vitest';
import { formatCo2Estimate, formatDecimal, formatTonnes } from './format';

describe('estimate formatting', () => {
  it('keeps at most the requested decimals', () => {
    expect(formatDecimal(7.84)).toBe('7.8');
    expect(formatDecimal(12)).toBe('12');
    expect(formatDecimal(6.849, 2)).toBe('6.85');
    expect(formatDecimal(1234.5, 0)).toBe('1,235');
  });

  it('shows tonnes to one decimal', () => {
    expect(formatTonnes(7.83)).toBe('7.8 t');
    expect(formatTonnes(15.66)).toBe('15.7 t');
    expect(formatTonnes(1.2)).toBe('1.2 t');
  });

  it('never claims more than two significant figures', () => {
    expect(formatCo2Estimate(0.1234)).toBe('120 g');
    expect(formatCo2Estimate(0.0519)).toBe('52 g');
    expect(formatCo2Estimate(1.52)).toBe('1.5 kg');
    expect(formatCo2Estimate(48.7)).toBe('49 kg');
    expect(formatCo2Estimate(554.8)).toBe('550 kg');
    expect(formatCo2Estimate(2290.1)).toBe('2.3 t');
    expect(formatCo2Estimate(0)).toBe('0 kg');
    expect(formatCo2Estimate(Number.NaN)).toBe('0 kg');
  });
});
