"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

/**
 * Stable TelegramPage component:
 * - All Hooks are declared up top (no conditional hooks)
 * - BOTH mode offers Market Direction (Bullish / Bearish) which maps to option types
 * - Preview, confirm, send, and full reset after send
 */

export default function TelegramPage() {
  // ------ Hooks: ALWAYS declared (top-level) ------
  const { data: session, status } = useSession()

  // auth / UI
  const [authorized, setAuthorized] = useState(false)
  const [confirmMode, setConfirmMode] = useState(false)
  const [preview, setPreview] = useState("")

  // form state
  const [action, setAction] = useState("BUY") // BUY | SELL | BOTH
  const [strike, setStrike] = useState(24000)
  const [optionType, setOptionType] = useState("CE") // used for single BUY or SELL
  const [marketDirection, setMarketDirection] = useState("BULLISH") // used only when BOTH
  const [buyOptionType, setBuyOptionType] = useState("CE") // auto-set for BOTH (buy leg)
  const [sellOptionType, setSellOptionType] = useState("PE") // auto-set for BOTH (sell leg)
  const [buyPrice, setBuyPrice] = useState("") // base price user enters for buy
  const [sellPrice, setSellPrice] = useState("") // base price user enters for sell

  const [expiry, setExpiry] = useState("") // next weekly expiry string

  // ------ Derived data (no hooks) ------
  const strikes = Array.from({ length: (50000 - 24000) / 50 + 1 }, (_, i) => 24000 + i * 50)

  // ------ Effects (always declared, but internal logic conditional) ------
  // compute next Tuesday expiry (runs once)
  useEffect(() => {
    const today = new Date()
    const nextTuesday = new Date(today)
    const day = today.getDay() // 0=Sun ... 2=Tue
    const daysUntilTue = (2 - day + 7) % 7 || 7
    nextTuesday.setDate(today.getDate() + daysUntilTue)
    const formatted = nextTuesday.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    setExpiry(formatted.replace(".", "")) // e.g. "11 Nov"
  }, [])

  // whitelist check for frontend convenience (backend still must enforce)
  useEffect(() => {
    if (!session?.user?.email) {
      setAuthorized(false)
      return
    }
    const whitelist = (process.env.NEXT_PUBLIC_AUTHORIZED_USERS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    setAuthorized(whitelist.includes(session.user.email))
  }, [session])

  // map marketDirection -> option types whenever action === "BOTH" OR marketDirection changes
  useEffect(() => {
    if (action === "BOTH") {
      if (marketDirection === "BULLISH") {
        // Sell PE & Buy CE
        setBuyOptionType("CE")
        setSellOptionType("PE")
      } else {
        // BEARISH -> Buy PE & Sell CE
        setBuyOptionType("PE")
        setSellOptionType("CE")
      }
    }
    // Note: we intentionally do not change buy/sell prices here (preserve user input)
  }, [action, marketDirection])

  // ------ Utilities ------
  const getRangeText = (val) => {
    const low = Number(val)
    if (!isFinite(low)) return null
    const high = low + 5
    // format to avoid trailing .0
    const format = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
    return `${format(low)} - ${format(high)}`
  }

  const buildPreviewMessage = () => {
    // single BUY
    if (action === "BUY") {
      const range = getRangeText(buyPrice)
      if (!range) {
        toast.error("Enter a valid buy base price")
        return null
      }
      return `FRESH TRADE\n\n"BUY" ${expiry} "Nifty ${strike} ${optionType}" between ${range}`
    }

    // single SELL
    if (action === "SELL") {
      const range = getRangeText(sellPrice)
      if (!range) {
        toast.error("Enter a valid sell base price")
        return null
      }
      return `FRESH TRADE\n\n"SELL" ${expiry} "Nifty ${strike} ${optionType}" between ${range}`
    }

    // BOTH (directional)
    const buyRange = getRangeText(buyPrice)
    const sellRange = getRangeText(sellPrice)
    if (!buyRange || !sellRange) {
      toast.error("Enter both buy and sell base prices")
      return null
    }

    // Compose using the mapped buyOptionType / sellOptionType
    return (
      `FRESH TRADE\n\n` +
      `"BUY" ${expiry} "Nifty ${strike} ${buyOptionType}" between ${buyRange}\n` +
      `AND\n` +
      `"SELL" ${expiry} "Nifty ${strike} ${sellOptionType}" between ${sellRange}`
    )
  }

  // ------ Handlers ------
  const handlePreview = (e) => {
    e.preventDefault()
    const message = buildPreviewMessage()
    if (!message) return
    setPreview(message)
    setConfirmMode(true)
  }

  const sendToTelegram = async () => {
    const loading = toast.loading("Sending message...")
    try {
      const res = await fetch("/api/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: preview }),
      })
      const data = await res.json()

      if (res.ok) {
        toast.success("Message sent successfully!", { id: loading })
        // reset all form state to defaults
        setAction("BUY")
        setStrike(24000)
        setOptionType("CE")
        setMarketDirection("BULLISH")
        setBuyOptionType("CE")
        setSellOptionType("PE")
        setBuyPrice("")
        setSellPrice("")
        setPreview("")
        setConfirmMode(false)
      } else {
        toast.error(`Failed: ${data?.error ?? "unknown"}`, { id: loading })
      }
    } catch (err) {
      toast.error("Unexpected error!", { id: loading })
    }
  }

  // ------ Render: hooks called above, conditional UI only below ------
  if (status === "loading") return <p className="p-4">Loading...</p>
  if (!session) return <p className="p-4">Please sign in first.</p>
  if (!authorized) return <p className="p-4">Access denied.</p>

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl space-y-6">
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow p-8">
          <h1 className="text-2xl font-bold mb-6">NIFTY Option Signal</h1>

          {/* Trade Type */}
          <div className="mb-4">
            <label className="block font-semibold mb-2">Trade Type</label>
            <div className="flex gap-6">
              {["BUY", "SELL", "BOTH"].map((opt) => (
                <label key={opt} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="action"
                    value={opt}
                    checked={action === opt}
                    onChange={() => setAction(opt)}
                    className="accent-blue-600"
                  />
                  <span>{opt === "BOTH" ? "Directional (Both)" : `Only ${opt}`}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="mb-4 flex items-center justify-between bg-blue-50 p-3 rounded">
            <div className="text-sm font-medium">Next Weekly Expiry</div>
            <div className="text-lg font-bold text-blue-700">{expiry}</div>
          </div>

          {/* Strike */}
          <div className="mb-4">
            <label className="block font-semibold mb-2">Strike Price</label>
            <select
              value={strike}
              onChange={(e) => setStrike(Number(e.target.value))}
              className="w-full border rounded p-2"
            >
              {strikes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Option type for single BUY/SELL */}
          {action !== "BOTH" && (
            <div className="mb-4">
              <label className="block font-semibold mb-2">Option Type</label>
              <div className="flex gap-6">
                {["CE", "PE"].map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="optionType"
                      value={t}
                      checked={optionType === t}
                      onChange={() => setOptionType(t)}
                      className="accent-blue-600"
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Direction selector when BOTH */}
          {action === "BOTH" && (
            <div className="mb-4">
              <label className="block font-semibold mb-2">Market Direction</label>
              <div className="flex gap-6 items-center">
                {["BULLISH", "BEARISH"].map((d) => (
                  <label key={d} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="direction"
                      value={d}
                      checked={marketDirection === d}
                      onChange={() => setMarketDirection(d)}
                      className="accent-blue-600"
                    />
                    <span>{d[0] + d.slice(1).toLowerCase()}</span>
                  </label>
                ))}
                <div className="text-sm text-gray-500 ml-4">
                  Bullish → Sell PE & Buy CE
                </div>
                <div className="text-sm text-gray-500 ml-4">
                  Bearish → Buy PE & Sell CE
                </div>
              </div>
            </div>
          )}

          {/* Price inputs */}
          {action === "BUY" && (
            <div className="mb-4">
              <label className="block font-semibold mb-2">Buy Base Price</label>
              <input
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-full border rounded p-2"
                placeholder="e.g. 160"
              />
            </div>
          )}

          {action === "SELL" && (
            <div className="mb-4">
              <label className="block font-semibold mb-2">Sell Base Price</label>
              <input
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="w-full border rounded p-2"
                placeholder="e.g. 160"
              />
            </div>
          )}

          {action === "BOTH" && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-semibold mb-2">Buy Base Price ({buyOptionType})</label>
                <input
                  type="number"
                  value={buyPrice}
                  onChange={(e) => setBuyPrice(e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="e.g. 160"
                />
              </div>

              <div>
                <label className="block font-semibold mb-2">Sell Base Price ({sellOptionType})</label>
                <input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-full border rounded p-2"
                  placeholder="e.g. 160"
                />
              </div>
            </div>
          )}

          <div className="mt-6">
            <button className="w-full bg-blue-600 text-white py-2 rounded" type="submit">
              Preview Message
            </button>
          </div>
        </form>

        {/* Preview / Confirm area */}
        {confirmMode && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="font-semibold mb-3">Preview</h2>
            <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded">{preview}</pre>

            <div className="flex gap-4 justify-center mt-4">
              <button onClick={sendToTelegram} className="bg-green-600 text-white px-4 py-2 rounded">
                Confirm & Send
              </button>
              <button onClick={() => setConfirmMode(false)} className="bg-gray-200 px-4 py-2 rounded">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}