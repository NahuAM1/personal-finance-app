import type { ProductStat } from "./shopping-stats";
import { normalizeProductName } from "./shopping-stats";

export type Urgency = "overdue" | "due_soon" | "scheduled" | "experimental";

export type PredictionConfidence = "high" | "medium" | "low";

export interface NeedPrediction {
  product: ProductStat;
  urgency: Urgency;
  confidence: PredictionConfidence;
  expected_quantity: number;
  expected_unit_price: number;
  estimated_total: number;
  days_until_expected: number | null;
  rationale_key: string;
}

export interface PredictionOptions {
  monthlyHorizonDays?: number;
  minDaysSinceLast?: number;
  oneOffGraceDays?: number;
}

const PERISHABLE_CATEGORIES: ReadonlySet<string> = new Set([
  "Carnes",
  "Panadería",
  "Frutas y Verduras",
  "Lácteos",
  "Congelados",
]);

const STAPLE_CATEGORIES: ReadonlySet<string> = new Set([
  "Almacén",
  "Limpieza",
  "Higiene",
  "Condimentos",
]);

const STAPLE_BEVERAGE_CATEGORIES: ReadonlySet<string> = new Set(["Bebidas"]);

const REJECTED_CATEGORIES: ReadonlySet<string> = new Set([
  "Snacks",
  "Otros",
]);

const ALCOHOL_NAME_PATTERNS: readonly string[] = [
  "cerveza",
  "vino",
  "whisky",
  "vodka",
  "ron",
  "gin",
  "fernet",
  "champagne",
  "espumante",
  "sidra",
  "malbec",
  "cabernet",
  "merlot",
  "syrah",
  "torrontes",
];

const CAPRICHO_NAME_PATTERNS: readonly string[] = [
  "nutella",
  "brownie",
  "torta",
  "alfajor",
  "bon o bon",
  "ferrero",
  "kinder",
  "lindor",
  "milka",
  "cadbury",
  "toblerone",
  "takis",
  "doritos",
  "cheetos",
  "lays",
  "pringles",
  "cachafaz",
  "rumba",
  "quento",
  "lindolin",
  "rocklets",
  "favo",
  "felfort",
  "arcor",
  "georgalos",
  "mogul",
  "beldent",
  "chicle",
  "caramelo",
  "chupetin",
  "galletita",
  "papas",
  "mani",
];

const URGENCY_ORDER: Record<Urgency, number> = {
  overdue: 0,
  due_soon: 1,
  scheduled: 2,
  experimental: 3,
};

function isAlcoholic(name: string): boolean {
  const normalized: string = normalizeProductName(name);
  return ALCOHOL_NAME_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isCapricho(name: string): boolean {
  const normalized: string = normalizeProductName(name);
  return CAPRICHO_NAME_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isStapleProduct(product: ProductStat): boolean {
  if (PERISHABLE_CATEGORIES.has(product.category)) return false;
  if (REJECTED_CATEGORIES.has(product.category)) return false;
  if (isAlcoholic(product.display_name)) return false;
  if (isCapricho(product.display_name)) return false;

  if (STAPLE_CATEGORIES.has(product.category)) return true;

  if (STAPLE_BEVERAGE_CATEGORIES.has(product.category)) {
    return product.purchases_90d >= 2;
  }

  return false;
}

function classifyConfidence(
  product: ProductStat,
  oneOffGraceDays: number,
): PredictionConfidence | null {
  if (product.purchases_90d >= 3) return "high";
  if (product.purchases_90d === 2) return "medium";
  if (product.purchases_90d === 1) {
    if (product.days_since_last < oneOffGraceDays) return null;
    return "low";
  }
  return null;
}

function classifyUrgency(
  product: ProductStat,
  monthlyHorizon: number,
): { urgency: Urgency; daysUntilExpected: number | null; rationaleKey: string } {
  if (product.avg_gap_days === null) {
    return {
      urgency: "experimental",
      daysUntilExpected: null,
      rationaleKey: `one_off_${product.days_since_last}d`,
    };
  }

  const daysUntilExpected: number =
    product.avg_gap_days - product.days_since_last;

  if (daysUntilExpected <= 0) {
    return {
      urgency: "overdue",
      daysUntilExpected,
      rationaleKey: `overdue_${Math.abs(daysUntilExpected)}d`,
    };
  }

  if (daysUntilExpected <= monthlyHorizon) {
    return {
      urgency: "due_soon",
      daysUntilExpected,
      rationaleKey: `due_in_${daysUntilExpected}d`,
    };
  }

  return {
    urgency: "scheduled",
    daysUntilExpected,
    rationaleKey: `next_in_${daysUntilExpected}d`,
  };
}

export function predictNeeds(
  stats: ProductStat[],
  options: PredictionOptions = {},
): NeedPrediction[] {
  const monthlyHorizon: number = options.monthlyHorizonDays ?? 30;
  const minDaysSinceLast: number = options.minDaysSinceLast ?? 14;
  const oneOffGraceDays: number = options.oneOffGraceDays ?? 45;

  const predictions: NeedPrediction[] = [];

  for (const product of stats) {
    if (product.days_since_last < minDaysSinceLast) continue;

    if (!isStapleProduct(product)) continue;

    const confidence: PredictionConfidence | null = classifyConfidence(
      product,
      oneOffGraceDays,
    );
    if (confidence === null) continue;

    const urgencyInfo = classifyUrgency(product, monthlyHorizon);

    if (
      urgencyInfo.urgency === "scheduled" &&
      urgencyInfo.daysUntilExpected !== null &&
      urgencyInfo.daysUntilExpected > monthlyHorizon
    ) {
      continue;
    }

    const expectedQuantity: number = Math.max(
      1,
      Math.round(product.typical_quantity),
    );
    const expectedUnitPrice: number = product.typical_price_ars;

    predictions.push({
      product,
      urgency: urgencyInfo.urgency,
      confidence,
      expected_quantity: expectedQuantity,
      expected_unit_price: expectedUnitPrice,
      estimated_total: expectedUnitPrice * expectedQuantity,
      days_until_expected: urgencyInfo.daysUntilExpected,
      rationale_key: urgencyInfo.rationaleKey,
    });
  }

  predictions.sort((a, b) => {
    const urgencyDiff: number = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;

    const aDays: number = a.days_until_expected ?? Number.MAX_SAFE_INTEGER;
    const bDays: number = b.days_until_expected ?? Number.MAX_SAFE_INTEGER;
    return aDays - bDays;
  });

  return predictions;
}
