import type { Card, CardNetwork } from "@/types/database"

export const CARD_NETWORKS: readonly CardNetwork[] = [
  "visa",
  "mastercard",
  "amex",
  "cabal",
  "naranja",
  "other",
]

export const CARD_NETWORK_LABELS: Readonly<Record<CardNetwork, string>> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  cabal: "Cabal",
  naranja: "Naranja",
  other: "Otra",
}

const MAX_NAME_LENGTH: number = 100
const LAST_FOUR_PATTERN: RegExp = /^\d{4}$/

export interface CardFormInput {
  name: string
  network: string
  lastFour: string
}

export interface CardDraft {
  name: string
  network: CardNetwork
  last_four: string | null
}

export type CardFormResult = { ok: true; card: CardDraft } | { ok: false; error: string }

export function isCardNetwork(value: string): value is CardNetwork {
  return CARD_NETWORKS.some((network) => network === value)
}

export function parseCardForm(input: CardFormInput): CardFormResult {
  const name: string = input.name.trim()
  if (name.length === 0) {
    return { ok: false, error: "El nombre de la tarjeta es obligatorio" }
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "El nombre no puede superar los 100 caracteres" }
  }
  if (!isCardNetwork(input.network)) {
    return { ok: false, error: "Elegí la red de la tarjeta" }
  }

  const lastFour: string = input.lastFour.trim()
  if (lastFour.length > 0 && !LAST_FOUR_PATTERN.test(lastFour)) {
    return { ok: false, error: "Los últimos 4 dígitos tienen que ser 4 números" }
  }

  return {
    ok: true,
    card: { name, network: input.network, last_four: lastFour.length > 0 ? lastFour : null },
  }
}

export function formatCardLabel(card: Pick<Card, "name" | "network" | "last_four">): string {
  const base: string = `${card.name} · ${CARD_NETWORK_LABELS[card.network]}`
  return card.last_four === null ? base : `${base} •••• ${card.last_four}`
}

const NO_CARD_LABEL: string = "Sin tarjeta"

export interface CardAmount {
  cardId: string | null
  amount: number
}

export interface CardSubtotal {
  cardId: string | null
  label: string
  amount: number
}

function sumAmounts(items: readonly CardAmount[]): number {
  return items.reduce((sum: number, item: CardAmount) => sum + item.amount, 0)
}

export function subtotalsByCard(items: readonly CardAmount[], cards: readonly Card[]): CardSubtotal[] {
  const knownIds: ReadonlySet<string> = new Set(cards.map((card: Card) => card.id))

  const cardSubtotals: CardSubtotal[] = cards
    .map((card: Card) => ({
      card,
      items: items.filter((item: CardAmount) => item.cardId === card.id),
    }))
    .filter((group) => group.items.length > 0)
    .map((group) => ({ cardId: group.card.id, label: formatCardLabel(group.card), amount: sumAmounts(group.items) }))
    .sort((a: CardSubtotal, b: CardSubtotal) => a.label.localeCompare(b.label))

  const withoutCard: CardAmount[] = items.filter(
    (item: CardAmount) => item.cardId === null || !knownIds.has(item.cardId),
  )

  return withoutCard.length > 0
    ? [...cardSubtotals, { cardId: null, label: NO_CARD_LABEL, amount: sumAmounts(withoutCard) }]
    : cardSubtotals
}
