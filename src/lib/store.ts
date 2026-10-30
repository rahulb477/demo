import { client } from "@/db";
import { formatMoney as fmt } from "@/lib/money";

export interface StoreConfig {
  name: string;
  address: string;
  phone: string;
  currency: string;
  locale: string;
  taxInclusive: boolean;
  receiptFooter: string;
  allowNegativeStock: boolean;
}

export async function getStore(): Promise<StoreConfig> {
  const res = await client.execute("SELECT key, value FROM settings");
  const map = new Map(res.rows.map((r) => [String(r.key), String(r.value)]));
  return {
    name: map.get("store.name") ?? "Orbit POS",
    address: map.get("store.address") ?? "",
    phone: map.get("store.phone") ?? "",
    currency: map.get("store.currency") ?? "INR",
    locale: map.get("store.locale") ?? "en-IN",
    taxInclusive: map.get("store.tax_inclusive") === "true",
    receiptFooter: map.get("receipt.footer") ?? "Thank you",
    allowNegativeStock: map.get("pos.allow_negative_stock") === "true",
  };
}

export const money = (minor: number, store?: { currency?: string; locale?: string }) =>
  fmt(minor, store?.currency ?? "INR", store?.locale ?? "en-IN");
