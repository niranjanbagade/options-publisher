"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

/**
 * TelegramPage with 3 tabs:
 * 1. Fresh Trade (existing)
 * 2. Square Off (3 sub-sections)
 * 3. Loss Booking
 */

export default function TelegramPage() {
    // ---- Common Hooks ----
    const { data: session, status } = useSession()
    const [authorized, setAuthorized] = useState(false)
    const [activeTab, setActiveTab] = useState("trade")

    // ---- Fresh Trade State ----
    const [confirmMode, setConfirmMode] = useState(false)
    const [preview, setPreview] = useState("")
    const [action, setAction] = useState("BUY") // BUY | SELL | BOTH
    const [strike, setStrike] = useState(24000)
    const [optionType, setOptionType] = useState("CE")
    const [marketDirection, setMarketDirection] = useState("BULLISH")
    const [buyOptionType, setBuyOptionType] = useState("CE")
    const [sellOptionType, setSellOptionType] = useState("PE")
    const [buyPrice, setBuyPrice] = useState("")
    const [sellPrice, setSellPrice] = useState("")
    const [expiry, setExpiry] = useState("")
    const [buyStopLoss, setBuyStopLoss] = useState("")
    const [sellStopLoss, setSellStopLoss] = useState("")


    const strikes = Array.from({ length: (50000 - 24000) / 50 + 1 }, (_, i) => 24000 + i * 50)

    // ---- Effects ----
    useEffect(() => {
        const today = new Date()
        const nextTuesday = new Date(today)
        const day = today.getDay()
        const daysUntilTue = (2 - day + 7) % 7 || 7
        nextTuesday.setDate(today.getDate() + daysUntilTue)
        const formatted = nextTuesday.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        setExpiry(formatted.replace(".", ""))
    }, [])

    useEffect(() => {
        if (!session?.user?.email) return setAuthorized(false)
        const whitelist = (process.env.NEXT_PUBLIC_AUTHORIZED_USERS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        setAuthorized(whitelist.includes(session.user.email))
    }, [session])

    useEffect(() => {
        if (action === "BOTH") {
            if (marketDirection === "BULLISH") {
                setBuyOptionType("CE")
                setSellOptionType("PE")
            } else {
                setBuyOptionType("PE")
                setSellOptionType("CE")
            }
        }
    }, [action, marketDirection])

    useEffect(() => {
        // Clear previews when tab changes
        setConfirmMode(false)
        setPreview("")
    }, [activeTab])

    useEffect(() => {
        const resetHandler = () => {
            setAction("BUY")
            setStrike(24000)
            setOptionType("CE")
            setMarketDirection("BULLISH")
            setBuyOptionType("CE")
            setSellOptionType("PE")
            setBuyPrice("")
            setSellPrice("")
            setBuyStopLoss("")
            setSellStopLoss("")
            setPreview("")
            setConfirmMode(false)
        }

        document.addEventListener("reset-forms", resetHandler)
        return () => document.removeEventListener("reset-forms", resetHandler)
    }, [])


    // ---- Utilities ----
    const getRangeText = (val) => {
        const low = Number(val)
        if (!isFinite(low)) return null
        const high = low + 5
        const format = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
        return `${format(low)} - ${format(high)}`
    }

    const buildPreviewMessage = () => {
        let mainMsg = ""
        let stopLossMsg = ""

        // --- main trade message ---
        if (action === "BUY") {
            const range = getRangeText(buyPrice)
            if (!range) return toast.error("Enter valid buy price"), null
            mainMsg = `FRESH TRADE\n\n"BUY" ${expiry} "Nifty ${strike} ${optionType}" between ${range}`
            if (buyStopLoss) {
                stopLossMsg = `\n\nStop loss for ${strike} ${optionType} is ${buyStopLoss}`
            }
        }

        if (action === "SELL") {
            const range = getRangeText(sellPrice)
            if (!range) return toast.error("Enter valid sell price"), null
            mainMsg = `FRESH TRADE\n\n"SELL" ${expiry} "Nifty ${strike} ${optionType}" between ${range}`
            if (sellStopLoss) {
                stopLossMsg = `\n\nStop loss for ${strike} ${optionType} is ${sellStopLoss}`
            }
        }

        if (action === "BOTH") {
            const buyRange = getRangeText(buyPrice)
            const sellRange = getRangeText(sellPrice)
            if (!buyRange || !sellRange)
                return toast.error("Enter both buy and sell prices"), null

            mainMsg =
                `FRESH TRADE\n\n` +
                `"BUY" ${expiry} "Nifty ${strike} ${buyOptionType}" between ${buyRange}\n` +
                `AND\n` +
                `"SELL" ${expiry} "Nifty ${strike} ${sellOptionType}" between ${sellRange}`

            if (buyStopLoss && sellStopLoss) {
                stopLossMsg = `\n\nStop loss for ${strike} ${buyOptionType} is ${buyStopLoss} and ${strike} ${sellOptionType} is ${sellStopLoss}`
            } else if (buyStopLoss || sellStopLoss) {
                stopLossMsg = `\n\nStop loss for ${strike} ${buyStopLoss ? buyOptionType + " is " + buyStopLoss : sellOptionType + " is " + sellStopLoss
                    }`
            }
        }

        return mainMsg + stopLossMsg
    }

    const handlePreview = (e) => {
        e.preventDefault()
        const msg = buildPreviewMessage()
        if (!msg) return
        setPreview(msg)
        setConfirmMode(true)
    }

    const sendToTelegram = async (message) => {
        const msg = message || preview
        if (!msg) return toast.error("No message to send")
        const loading = toast.loading("Sending...")
        try {
            const res = await fetch("/api/sendMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Message sent!", { id: loading })
                setConfirmMode(false)
                setPreview("")

                // Notify child forms to reset if needed
                document.dispatchEvent(new CustomEvent("reset-forms"))
            } else {
                toast.error(`Failed: ${data?.error ?? "unknown"}`, { id: loading })
            }
        } catch {
            toast.error("Unexpected error", { id: loading })
        }
    }

    // ---- Guard ----
    if (status === "loading") return <p className="p-4">Loading...</p>
    if (!session) return <p className="p-4">Please sign in first.</p>
    if (!authorized) return <p className="p-4">Access denied.</p>

    // ---- Render ----
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-2xl space-y-6">

                {/* Tabs */}
                <div className="flex gap-3 border-b mb-4">
                    {[
                        { id: "trade", label: "Fresh Trade" },
                        { id: "squareoff", label: "Square Off - Both" },
                        { id: "expiry", label: "Square Off - Single" },
                        // { id: "loss", label: "Loss Booking" },
                        { id: "ignore", label: "Ignore Alert" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 font-medium border-b-2 ${activeTab === tab.id
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Fresh Trade */}
                {activeTab === "trade" && (
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
                                </div>
                            </div>
                        )}

                        {/* Price inputs */}
                        {action === "BUY" && (
                            <div>
                                <Input label="Buy Base Price" value={buyPrice} setValue={setBuyPrice} />
                                <Input
                                    label={`Stop Loss (${optionType})`}
                                    value={buyStopLoss}
                                    setValue={setBuyStopLoss}
                                    placeholder="e.g. 120"
                                /></div>

                        )}
                        {action === "SELL" && (
                            <div>
                                <Input label="Sell Base Price" value={sellPrice} setValue={setSellPrice} />
                                <Input
                                    label={`Stop Loss (${optionType})`}
                                    value={sellStopLoss}
                                    setValue={setSellStopLoss}
                                    placeholder="e.g. 120"
                                />
                            </div>

                        )}
                        {action === "BOTH" && (
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <Input
                                    label={`Buy Base Price (${buyOptionType})`}
                                    value={buyPrice}
                                    setValue={setBuyPrice}
                                />
                                <Input
                                    label={`Stop Loss (${buyOptionType})`}
                                    value={buyStopLoss}
                                    setValue={setBuyStopLoss}
                                    placeholder="e.g. 120"
                                />
                                <Input
                                    label={`Sell Base Price (${sellOptionType})`}
                                    value={sellPrice}
                                    setValue={setSellPrice}
                                />
                                <Input
                                    label={`Stop Loss (${sellOptionType})`}
                                    value={sellStopLoss}
                                    setValue={setSellStopLoss}
                                    placeholder="e.g. 125"
                                />
                            </div>
                        )}

                        <button className="w-full bg-blue-600 text-white py-2 rounded" type="submit">
                            Preview Message
                        </button>
                    </form>
                )}

                {/* Square Off */}
                {activeTab === "squareoff" && <SquareOffSection strikes={strikes} onSend={sendToTelegram} />}

                {activeTab === "expiry" && (
                    <ExpiryTradesSection strikes={strikes} onSend={sendToTelegram} />
                )}

                {/* Loss Booking */}
                {/* {activeTab === "loss" && <LossBookingSection strikes={strikes} onSend={sendToTelegram} />} */}

                {activeTab === "ignore" && <IgnoreAlertSection onSend={sendToTelegram} />}
            </div>

            {/* Global preview (used by Fresh Trade only) */}
            {confirmMode && (
                <PreviewCard
                    preview={preview}
                    onConfirm={() => sendToTelegram(preview)}
                    onCancel={() => setConfirmMode(false)}
                />
            )}
        </div>
    )
}

// ---- Reusable Input Component ----
function Input({ label, value, setValue, placeholder = "e.g. 160" }) {
    return (
        <div className="mb-4">
            <label className="block font-semibold mb-2">{label}</label>
            <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full border rounded p-2"
                placeholder={placeholder}
            />
        </div>
    )
}

// ---- Reusable Preview Component ----
function PreviewCard({ preview, onConfirm, onCancel }) {
    return (
        <div className="bg-white rounded-2xl shadow p-6 fixed bottom-6 right-6 w-96">
            <h2 className="font-semibold mb-3">Preview</h2>
            <pre className="whitespace-pre-wrap bg-gray-50 p-3 rounded text-sm">{preview}</pre>
            <div className="flex gap-3 justify-center mt-4">
                <button onClick={onConfirm} className="bg-green-600 text-white px-4 py-2 rounded">
                    Confirm & Send
                </button>
                <button onClick={onCancel} className="bg-gray-200 px-4 py-2 rounded">
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ---- Square Off Section (updated per new requirement) ----
function SquareOffSection({ strikes, onSend }) {
    const [marketView, setMarketView] = useState("BULLISH") // BULLISH | BEARISH
    const [strike, setStrike] = useState(strikes?.[0] ?? 25900)
    const [exitCE, setExitCE] = useState("")
    const [exitPE, setExitPE] = useState("")
    const [action, setAction] = useState("book100")
    const [preview, setPreview] = useState("")

    // Action templates mapped to text
    const squareOffTemplates = {
        book100:
            "Modify stop loss and book 100% profit.",
        book50:
            "Modify stop loss and book 50% profit and now keep trailing stop loss at cost for remaining 50% qty.",
        trailprofit:
            "Trailing stop loss triggered. Modify stop loss and book profit for remaining 50% quantity.",
        trailclose:
            "Trailing stop loss triggered. Square off position.",
        stoploss:
            "Stop loss triggered. Modify your stop loss and square off position.",
    }

    const buildMessage = () => {
        if (!exitCE || !exitPE) {
            toast.error("Enter both CE and PE exit prices.")
            return null
        }

        const actionText = squareOffTemplates[action]
        if (!actionText) {
            toast.error("Select valid action type.")
            return null
        }

        // Determine order based on market view
        let sellLeg, buyLeg
        if (marketView === "BULLISH") {
            sellLeg = `Sell ${strike} CE @ ${exitCE}`
            buyLeg = `Buy ${strike} PE @ ${exitPE}`
        } else {
            sellLeg = `Sell ${strike} PE @ ${exitPE}`
            buyLeg = `Buy ${strike} CE @ ${exitCE}`
        }

        // Construct message exactly per your format
        const message = `SQUARE OFF\n${actionText} ${sellLeg} and ${buyLeg}`

        return message
    }

    const handlePreview = (e) => {
        e.preventDefault()
        const msg = buildMessage()
        if (msg) setPreview(msg)
    }

    return (
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-2xl font-bold mb-6">Square Off</h1>

            {/* Market View */}
            <div className="mb-4">
                <label className="block font-semibold mb-2">Market View</label>
                <div className="flex gap-6">
                    <label>
                        <input
                            type="radio"
                            name="marketView"
                            value="BULLISH"
                            checked={marketView === "BULLISH"}
                            onChange={() => setMarketView("BULLISH")}
                            className="accent-blue-600"
                        />{" "}
                        Bullish (Sell CE & Buy PE)
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="marketView"
                            value="BEARISH"
                            checked={marketView === "BEARISH"}
                            onChange={() => setMarketView("BEARISH")}
                            className="accent-blue-600"
                        />{" "}
                        Bearish (Sell PE & Buy CE)
                    </label>
                </div>
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

            {/* Exit Prices */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block font-semibold mb-1">CE Exit Price</label>
                    <input
                        type="number"
                        value={exitCE}
                        onChange={(e) => setExitCE(e.target.value)}
                        placeholder="e.g. 120"
                        className="w-full border rounded p-2"
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-1">PE Exit Price</label>
                    <input
                        type="number"
                        value={exitPE}
                        onChange={(e) => setExitPE(e.target.value)}
                        placeholder="e.g. 125"
                        className="w-full border rounded p-2"
                    />
                </div>
            </div>

            {/* Action Dropdown */}
            <div className="mb-4">
                <label className="block font-semibold mb-2">Action Type</label>
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="w-full border rounded p-2"
                >
                    <option value="book100">Book 100% profit</option>
                    <option value="book50">Book 50% profit</option>
                    <option value="trailprofit">
                        Trailing SL triggered – book remaining 50% profit
                    </option>
                    <option value="trailclose">
                        Trailing SL triggered – square off position
                    </option>
                    <option value="stoploss">Stop loss triggered</option>
                </select>
            </div>

            <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded"
            >
                Preview Message
            </button>

            {preview && (
                <div className="mt-4">
                    <PreviewCard
                        preview={preview}
                        onConfirm={() => {
                            onSend(preview)
                            setPreview("")
                            setExitCE("")
                            setExitPE("")
                        }}
                        onCancel={() => setPreview("")}
                    />
                </div>
            )}
        </form>
    )
}


function LossBookingSection({ onSend, strikes }) {
    const [strike, setStrike] = useState(25600)
    const [side, setSide] = useState("BOTH") // NEW: CE | PE | BOTH
    const [cePrice, setCePrice] = useState("")
    const [pePrice, setPePrice] = useState("")
    const [preview, setPreview] = useState("")

    useEffect(() => {
        const resetHandler = () => {
            setStrike(25600)
            setSide("BOTH")
            setCePrice("")
            setPePrice("")
            setPreview("")
        }

        document.addEventListener("reset-forms", resetHandler)
        return () => document.removeEventListener("reset-forms", resetHandler)
    }, [])


    const buildMessage = () => {
        if (side === "CE" && !cePrice) return toast.error("Enter CE price")
        if (side === "PE" && !pePrice) return toast.error("Enter PE price")
        if (side === "BOTH" && (!cePrice || !pePrice))
            return toast.error("Enter both CE & PE prices")

        let msg = "SQUARE OFF\nStop loss triggered. Modify your stop loss and square off position. "

        if (side === "CE")
            msg += `Sell ${strike} CE @ ${cePrice}`
        else if (side === "PE")
            msg += `Buy ${strike} PE @ ${pePrice}`
        else
            msg += `Sell ${strike} CE @ ${cePrice} and Buy ${strike} PE @ ${pePrice}`

        return msg
    }

    const handlePreview = (e) => {
        e.preventDefault()
        const msg = buildMessage()
        if (msg) setPreview(msg)
    }

    return (
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-2xl font-bold mb-6">Loss Booking</h1>

            {/* CE/PE/Both selector */}
            <div className="mb-4">
                <label className="block font-semibold mb-2">Option Side</label>
                <div className="flex gap-6">
                    {["CE", "PE", "BOTH"].map((t) => (
                        <label key={t}>
                            <input
                                type="radio"
                                checked={side === t}
                                onChange={() => setSide(t)}
                                className="accent-blue-600"
                            />{" "}
                            {t === "BOTH" ? "Both CE & PE" : `Only ${t}`}
                        </label>
                    ))}
                </div>
            </div>

            {/* Strike dropdown */}
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

            {/* Dynamic inputs */}
            {(side === "CE" || side === "BOTH") && (
                <Input label="CE Price" value={cePrice} setValue={setCePrice} />
            )}
            {(side === "PE" || side === "BOTH") && (
                <Input label="PE Price" value={pePrice} setValue={setPePrice} />
            )}

            <button className="w-full bg-blue-600 text-white py-2 rounded" type="submit">
                Preview Message
            </button>

            {preview && (
                <PreviewCard
                    preview={preview}
                    onConfirm={() => onSend(preview)}
                    onCancel={() => setPreview("")}
                />
            )}
        </form>
    )
}

// ---- Ignore Alert Section ----
function IgnoreAlertSection({ onSend }) {
    const [loading, setLoading] = useState(false)

    const handleSend = async () => {
        if (loading) return
        setLoading(true)
        try {
            await onSend("Kindly ignore the alert")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-2xl font-bold mb-6">Ignore Alert</h1>
            <p className="text-gray-600 mb-6">
                Click the button below to send a message to the Telegram channel.
            </p>
            <button
                onClick={handleSend}
                disabled={loading}
                className={`w-full py-3 rounded text-white ${loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                    }`}
            >
                {loading ? "Sending..." : "Send 'Kindly ignore the alert'"}
            </button>
        </div>
    )
}

// ---- Expiry Trades Section (Final - simplified per new requirement) ----
function ExpiryTradesSection({ strikes, onSend }) {
    const [marketView, setMarketView] = useState("BULLISH") // BULLISH or BEARISH
    const [strike, setStrike] = useState(25900)
    const [exitPrice, setExitPrice] = useState("")
    const [template, setTemplate] = useState("book100")
    const [preview, setPreview] = useState("")

    // Templates as per your pattern
    const expiryTemplates = [
        {
            id: "book100",
            label: "Book 100% Profit",
            text: "Modify stop loss and book 100% profit.",
        },
        {
            id: "book50",
            label:
                "Book 50% Profit (Trailing stop loss for remaining 50%)",
            text:
                "Modify stop loss and book 50% profit and now keep trailing stop loss at cost for remaining 50% qty.",
        },
        {
            id: "trailprofit",
            label: "Trailing Stop Loss Triggered - Book Remaining Profit",
            text:
                "Trailing stop loss triggered. Modify stop loss and book profit for remaining 50% quantity.",
        },
        {
            id: "trailclose",
            label: "Trailing Stop Loss Triggered - Square Off",
            text:
                "Trailing stop loss triggered. Modify your stop loss and square off position.",
        },
        {
            id: "stoploss",
            label: "Stop Loss Triggered - Square Off",
            text:
                "Stop loss triggered. Modify your stop loss and square off position.",
        },
    ]

    // Build message text
    const buildMessage = () => {
        if (!exitPrice) {
            toast.error("Enter Exit Price")
            return null
        }

        const selectedTemplate = expiryTemplates.find((t) => t.id === template)
        if (!selectedTemplate) {
            toast.error("Select message type")
            return null
        }

        // Market View logic
        const optionType = marketView === "BULLISH" ? "PE" : "CE"

        // Construct final message
        const message = `SQUARE OFF\n${selectedTemplate.text} Buy ${strike} ${optionType} @ ${exitPrice}`

        return message
    }

    const handlePreview = (e) => {
        e.preventDefault()
        const msg = buildMessage()
        if (msg) setPreview(msg)
    }

    return (
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-2xl font-bold mb-6">Expiry Day Trades</h1>

            {/* Market View */}
            <div className="mb-4">
                <label className="block font-semibold mb-2">Market View</label>
                <div className="flex gap-6">
                    <label>
                        <input
                            type="radio"
                            name="marketView"
                            value="BULLISH"
                            checked={marketView === "BULLISH"}
                            onChange={() => setMarketView("BULLISH")}
                            className="accent-blue-600"
                        />{" "}
                        Bullish (Buy PE)
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="marketView"
                            value="BEARISH"
                            checked={marketView === "BEARISH"}
                            onChange={() => setMarketView("BEARISH")}
                            className="accent-blue-600"
                        />{" "}
                        Bearish (Buy CE)
                    </label>
                </div>
            </div>

            {/* Strike Price */}
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

            {/* Exit Price */}
            <div className="mb-4">
                <label className="block font-semibold mb-2">
                    Exit Price ({marketView === "BULLISH" ? "PE" : "CE"})
                </label>
                <input
                    type="number"
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full border rounded p-2"
                    placeholder="e.g. 120"
                />
            </div>

            {/* Message Type */}
            <div className="mb-4">
                <label className="block font-semibold mb-2">Message Type</label>
                <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="w-full border rounded p-2"
                >
                    {expiryTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Preview */}
            <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded"
            >
                Preview Message
            </button>

            {preview && (
                <div className="mt-4">
                    <PreviewCard
                        preview={preview}
                        onConfirm={() => {
                            onSend(preview)
                            setPreview("")
                            setExitPrice("")
                        }}
                        onCancel={() => setPreview("")}
                    />
                </div>
            )}
        </form>
    )
}  