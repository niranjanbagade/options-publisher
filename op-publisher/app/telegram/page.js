"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

export default function TelegramPage() {
  const { data: session, status } = useSession()
  const [authorized, setAuthorized] = useState(false)

  // Form states
  const [action, setAction] = useState("BUY") // BUY | SELL | BOTH
  const [strike, setStrike] = useState(24000)
  const [optionType, setOptionType] = useState("CE") // for single buy/sell
  const [buyOptionType, setBuyOptionType] = useState("PE") // for BOTH: buy
  const [sellOptionType, setSellOptionType] = useState("CE") // for BOTH: sell
  const [expiry, setExpiry] = useState("")
  const [buyPrice, setBuyPrice] = useState("")
  const [sellPrice, setSellPrice] = useState("")
  const [preview, setPreview] = useState("")
  const [confirmMode, setConfirmMode] = useState(false)

  // Compute next Tuesday (weekly expiry)
  useEffect(() => {
    const today = new Date()
    const nextTuesday = new Date(today)
    const day = today.getDay() // 0=Sun ... 2=Tue
    const daysUntilTue = (2 - day + 7) % 7 || 7
    nextTuesday.setDate(today.getDate() + daysUntilTue)
    const formatted = nextTuesday.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    })
    setExpiry(formatted.replace(".", "")) // e.g. "11 Nov"
  }, [])

  // Whitelist check (frontend convenience — backend still enforces)
  useEffect(() => {
    if (session?.user?.email) {
      const whitelist = (process.env.NEXT_PUBLIC_AUTHORIZED_USERS || "")
        .split(",")
        .map((e) => e.trim())
      setAuthorized(whitelist.includes(session.user.email))
    }
  }, [session])

  if (status === "loading") return <p>Loading...</p>
  if (!session) return <p>Please sign in first.</p>
  if (!authorized) return <p>Access denied.</p>

  // Generate strike options (24000 -> 50000 step 50)
  const strikes = Array.from(
    { length: (50000 - 24000) / 50 + 1 },
    (_, i) => 24000 + i * 50
  )

  // Utility: compute range text and validate numeric input
  const getRangeText = (val) => {
    const low = Number(val)
    if (Number.isNaN(low)) return null
    const high = +((low + 5).toFixed(2)).replace(/\.00$/, "") // keep integer if integer
    return `${low} - ${high}`
  }

  // Build preview message based on action and chosen option types
  const buildPreviewMessage = () => {
    if (action === "BUY") {
      const range = getRangeText(buyPrice)
      if (!range) {
        toast.error("Enter a valid buy base price")
        return null
      }
      const opt = optionType
      return `FRESH TRADE\n\n"BUY" ${expiry} "Nifty ${strike} ${opt}" between ${range}`
    }

    if (action === "SELL") {
      const range = getRangeText(sellPrice)
      if (!range) {
        toast.error("Enter a valid sell base price")
        return null
      }
      const opt = optionType
      return `FRESH TRADE\n\n"SELL" ${expiry} "Nifty ${strike} ${opt}" between ${range}`
    }

    // BOTH
    const buyRange = getRangeText(buyPrice)
    const sellRange = getRangeText(sellPrice)
    if (!buyRange || !sellRange) {
      toast.error("Enter both buy and sell base prices")
      return null
    }

    // Use buyOptionType & sellOptionType
    return (
      `FRESH TRADE\n\n` +
      `"BUY" ${expiry} "Nifty ${strike} ${buyOptionType}" between ${buyRange}\n` +
      `AND\n` +
      `"SELL" ${expiry} "Nifty ${strike} ${sellOptionType}" between ${sellRange}`
    )
  }

  // Handle preview (form submit)
  const handlePreview = (e) => {
    e.preventDefault()

    var message = buildPreviewMessage()
    if (!message) return
    if (action == "BOTH" && buyOptionType == sellOptionType)
        message = "ERROR: NOT A DIRECTIONAL TRADE"
    if (action == "BOTH" && (buyPrice == 0 || sellPrice == 0))
        message = "ERROR: PLEASE ENTER THE RANGE"
    setPreview(message)
    setConfirmMode(true)
  }

  // Send message to Telegram
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
        // Reset entire form to defaults
        setAction("BUY")
        setStrike(24000)
        setOptionType("CE")
        setBuyOptionType("PE")
        setSellOptionType("CE")
        setBuyPrice("")
        setSellPrice("")
        setPreview("")
        setConfirmMode(false)
      } else {
        toast.error(`Failed: ${data.error}`, { id: loading })
      }
    } catch (err) {
      toast.error("Unexpected error!", { id: loading })
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4 py-8">
      <form
        onSubmit={handlePreview}
        className="bg-white shadow-xl rounded-2xl px-8 pt-8 pb-10 w-full max-w-md"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          NIFTY Option Signal
        </h1>

        {/* Trade Type */}
        <label className="block mb-2 font-semibold text-gray-700">Trade Type</label>
        <div className="flex justify-between mb-6">
          {["BUY", "SELL", "BOTH"].map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-gray-700">
              <input
                type="radio"
                name="action"
                value={opt}
                checked={action === opt}
                onChange={() => setAction(opt)}
                className="accent-blue-600"
              />
              {opt === "BOTH" ? "Both (Buy & Sell)" : `Only ${opt.charAt(0)}${opt.slice(1).toLowerCase()}`}
            </label>
          ))}
        </div>

        {/* Expiry */}
        <div className="mb-6 text-sm">
          <span className="font-semibold text-gray-700">Next Weekly Expiry: </span>
          <span className="text-blue-700 font-semibold">{expiry}</span>
        </div>

        {/* Strike */}
        <label className="block mb-2 font-semibold text-gray-700">Strike Price</label>
        <select
          className="border rounded-lg w-full py-2 px-3 mb-6 focus:ring-2 focus:ring-blue-500"
          value={strike}
          onChange={(e) => setStrike(Number(e.target.value))}
        >
          {strikes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        {/* For single BUY or SELL: single option type selector */}
        {action !== "BOTH" && (
          <>
            <label className="block mb-2 font-semibold text-gray-700">Option Type</label>
            <div className="flex gap-8 mb-6">
              {["CE", "PE"].map((t) => (
                <label key={t} className="flex items-center gap-2 text-gray-700">
                  <input
                    type="radio"
                    name="optionType"
                    value={t}
                    checked={optionType === t}
                    onChange={() => setOptionType(t)}
                    className="accent-blue-600"
                  />
                  {t}
                </label>
              ))}
            </div>
          </>
        )}


        {/* For BOTH: independent option type selectors for buy & sell */}
        {action === "BOTH" && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">Buy Option Type</label>
              <div className="flex gap-6">
                {["CE", "PE"].map((t) => (
                  <label key={`buy-${t}`} className="flex items-center gap-2 text-gray-700">
                    <input
                      type="radio"
                      name="buyOptionType"
                      value={t}
                      checked={buyOptionType === t}
                      onChange={() => setBuyOptionType(t)}
                      className="accent-blue-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700">Sell Option Type</label>
              <div className="flex gap-6">
                {["CE", "PE"].map((t) => (
                  <label key={`sell-${t}`} className="flex items-center gap-2 text-gray-700">
                    <input
                      type="radio"
                      name="sellOptionType"
                      value={t}
                      checked={sellOptionType === t}
                      onChange={() => setSellOptionType(t)}
                      className="accent-blue-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Price inputs based on action */}
        {action === "BUY" && (
          <div className="mb-6">
            <label className="block mb-2 font-semibold text-gray-700">Buy Range (Base Price)</label>
            <input
              type="number"
              className="border rounded-lg w-full py-2 px-3 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter buy base price (e.g. 160)"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
            />
            <p className="mt-2 text-sm text-gray-500">
              Range preview: {getRangeText(buyPrice) ?? "—"}
            </p>
          </div>
        )}

        {action === "SELL" && (
          <div className="mb-6">
            <label className="block mb-2 font-semibold text-gray-700">Sell Range (Base Price)</label>
            <input
              type="number"
              className="border rounded-lg w-full py-2 px-3 focus:ring-2 focus:ring-blue-500"
              placeholder="Enter sell base price (e.g. 160)"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
            />
            <p className="mt-2 text-sm text-gray-500">
              Range preview: {getRangeText(sellPrice) ?? "—"}
            </p>
          </div>
        )}

        {action === "BOTH" && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">Buy Base Price {buyOptionType}</label>
              <input
                type="number"
                className="border rounded-lg w-full py-2 px-3 focus:ring-2 focus:ring-blue-500"
                placeholder="Enter buy base price"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700">Sell Base Price {sellOptionType}</label>
              <input
                type="number"
                className="border rounded-lg w-full py-2 px-3 focus:ring-2 focus:ring-blue-500"
                placeholder="Enter sell base price"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg w-full"
        >
          Preview Message
        </button>
      </form>

      {/* Preview & Confirm */}
      {confirmMode && (
        <div className="bg-white shadow-xl rounded-2xl p-6 mt-6 w-full max-w-md text-center">
          <p className="mb-4 font-semibold text-gray-700">Preview:</p>
          <pre className="whitespace-pre-wrap text-lg text-gray-800 bg-gray-50 p-3 rounded-lg border">
            {preview}
          </pre>
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={sendToTelegram}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
            >
              Confirm & Send
            </button>
            <button
              onClick={() => setConfirmMode(false)}
              className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
