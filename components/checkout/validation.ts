import type { PaymentData } from "./types"

function cardDigits(data: PaymentData): string {
  return data.cardNumber.replace(/\s/g, "")
}

function expiryParts(data: PaymentData): { month: number; year: number } | null {
  const match = /^(\d{2})\/(\d{2})$/.exec(data.expiry)
  if (!match) return null
  const month = Number(match[1])
  if (month < 1 || month > 12) return null
  return { month, year: 2000 + Number(match[2]) }
}

function isExpiryPast(parts: { month: number; year: number }, now = new Date()): boolean {
  return (
    parts.year < now.getFullYear() ||
    (parts.year === now.getFullYear() && parts.month < now.getMonth() + 1)
  )
}

export interface PaymentFieldErrors {
  cardName?: string
  cardNumber?: string
  expiry?: string
  cvv?: string
}

/** Alan bazında mesajlar: boş alan kızmaz, dolu ama hatalı alan söyler. */
export function paymentFieldErrors(data: PaymentData): PaymentFieldErrors {
  const errors: PaymentFieldErrors = {}
  if (data.method !== "card") return errors
  if (data.cardName.trim() && data.cardName.trim().length < 2) {
    errors.cardName = "Kart üzerindeki ismi tam yazın."
  }
  const digits = cardDigits(data)
  if (digits && !/^(\d{16}|\d{19})$/.test(digits)) {
    errors.cardNumber = "Kart numarası 16 haneli olmalı."
  }
  if (data.expiry) {
    const parts = expiryParts(data)
    if (!parts) errors.expiry = "AA/YY biçiminde yazın."
    else if (isExpiryPast(parts)) errors.expiry = "Bu kartın süresi geçmiş."
  }
  if (data.cvv && !/^(\d{3}|\d{4})$/.test(data.cvv)) {
    errors.cvv = "CVV 3 haneli olmalı."
  }
  return errors
}

export function isPaymentValid(data: PaymentData): boolean {
  if (data.method === "cod") return true
  const digits = cardDigits(data)
  const cardNameValid = data.cardName.trim().length > 1
  const cardNumberValid = /^(\d{16}|\d{19})$/.test(digits)
  const parts = expiryParts(data)
  const expiryValid = !!parts && !isExpiryPast(parts)
  const cvvValid = /^(\d{3}|\d{4})$/.test(data.cvv)
  return cardNameValid && cardNumberValid && expiryValid && cvvValid
}

export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
}

export function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function formatCVV(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4)
}

export function maskedCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\s/g, "")
  const last4 = digits.slice(-4)
  return `•••• •••• •••• ${last4 || "••••"}`
}
