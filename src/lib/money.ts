/**
 * All monetary values are integer minor units (paise/cents).
 * Floating point is never used for money: 0.1 + 0.2 !== 0.3.
 */

export const roundHalfUp = (value: number): number => Math.round(value);

/** Parse a user-entered decimal string ("12.50") into minor units (1250). */
export function parseMoney(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Invalid amount");
    return roundHalfUp(input * 100);
  }
  const cleaned = input.trim().replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d{1,3})?$/.test(cleaned)) throw new Error(`Invalid amount: ${input}`);
  return roundHalfUp(Number.parseFloat(cleaned) * 100);
}

export const fromMinor = (minor: number): number => minor / 100;

export function formatMoney(minor: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export interface LineInput {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
  tax: number;
  total: number;
}

/** Single source of truth for a line's arithmetic, used by POS, purchases and quotations. */
export function computeLine(line: LineInput): LineTotals {
  const gross = roundHalfUp(line.quantity * line.unitPrice);
  const discount = Math.min(line.discount ?? 0, gross);
  const net = gross - discount;
  const tax = roundHalfUp(net * ((line.taxRate ?? 0) / 100));
  return { gross, discount, net, tax, total: net + tax };
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  lines: LineTotals[];
}

/** Sums line totals; `orderDiscount` is applied before tax proportionally. */
export function computeCart(lines: LineInput[], orderDiscount = 0): CartTotals {
  const computed = lines.map(computeLine);
  const subtotal = computed.reduce((s, l) => s + l.net, 0);
  const lineDiscount = computed.reduce((s, l) => s + l.discount, 0);

  if (orderDiscount <= 0) {
    const tax = computed.reduce((s, l) => s + l.tax, 0);
    return { subtotal, discount: lineDiscount, tax, total: subtotal + tax, lines: computed };
  }

  // Distribute the order-level discount proportionally across lines, then re-tax.
  const capped = Math.min(orderDiscount, subtotal);
  let remaining = capped;
  const discounted = computed.map((l, i) => {
    const share =
      i === computed.length - 1
        ? remaining
        : roundHalfUp((l.net / Math.max(subtotal, 1)) * capped);
    const take = Math.min(share, l.net);
    remaining -= take;
    return { ...l, net: l.net - take };
  });

  const tax = discounted.reduce(
    (s, l, i) => s + roundHalfUp(l.net * ((lines[i].taxRate ?? 0) / 100)),
    0,
  );
  const net = discounted.reduce((s, l) => s + l.net, 0);
  return {
    subtotal: net,
    discount: lineDiscount + capped,
    tax,
    total: net + tax,
    lines: computed,
  };
}
