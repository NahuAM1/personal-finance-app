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
