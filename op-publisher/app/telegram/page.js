"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

/**
 * TelegramPage with 3 tabs:
 * 1. Fresh Trade (extracted into FreshTradeSection)
 * 2. Square Off (3 sub-sections)
 * 3. Loss Booking
 */

export default function TelegramPage() {
    // ---- Common Hooks ----
    const { data: session, status } = useSession()
    const [authorized, setAuthorized] = useState(false)
    const [activeTab, setActiveTab] = useState("trade")

    const strikes = Array.from({ length: (50000 - 24000) / 50 + 1 }, (_, i) => 24000 + i * 50)

    useEffect(() => {
        if (!session?.user?.email) return setAuthorized(false)
        const whitelist = (process.env.NEXT_PUBLIC_AUTHORIZED_USERS || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        setAuthorized(whitelist.includes(session.user.email))
    }, [session])

    // ---- Reset listener for all sub-forms ----
    useEffect(() => {
        const resetHandler = () => {
            document.dispatchEvent(new CustomEvent("reset-forms"))
        }
        document.addEventListener("global-reset", resetHandler)
        return () => document.removeEventListener("global-reset", resetHandler)
    }, [])

    // ---- sendToTelegram shared utility ----
    const sendToTelegram = async (message) => {
        if (!message) return toast.error("No message to send")
        const loading = toast.loading("Sending...")
        try {
            const res = await fetch("/api/sendMessage", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message }),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success("Message sent!", { id: loading })
                // Notify children to reset
                document.dispatchEvent(new CustomEvent("reset-forms"))
            } else {
                toast.error(`Failed: ${data?.error ?? "unknown"}`, { id: loading })
            }
        } catch (err) {
            toast.error("Unexpected error", { id: loading })
        }
    }

    // ---- Guard ----
    if (status === "loading") return <p className="p-4">Loading...</p>
    if (!session) return <p className="p-4">Please sign in first.</p>
    if (!authorized) return <p className="p-4">Access denied.</p>

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-2xl space-y-6">

                {/* Tabs */}
                <div className="flex gap-3 border-b mb-4">
                    {[
                        { id: "trade", label: "Fresh Trade" },
                        { id: "squareoff", label: "Square Off" },
                        { id: "expiry", label: "Expiry Trade" },
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

                {/* Sections */}
                {activeTab === "trade" && <FreshTradeSection strikes={strikes} onSend={sendToTelegram} />}
                {activeTab === "squareoff" && <SquareOffSection strikes={strikes} onSend={sendToTelegram} />}
                {activeTab === "expiry" && <ExpiryTradesSection strikes={strikes} onSend={sendToTelegram} />}
                {activeTab === "ignore" && <IgnoreAlertSection onSend={sendToTelegram} />}
            </div>
        </div>
    )
}

/* ----------------------
   Reusable Input Component
   ---------------------- */
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

/* ----------------------
   Reusable Preview Component
   ---------------------- */
function PreviewCard({ preview, onConfirm, onCancel }) {
    return (
        <div className="bg-white rounded-2xl shadow p-6 fixed bottom-6 right-6 w-96 z-50">
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

/* ----------------------
   FreshTradeSection (extracted)
   ---------------------- */
function FreshTradeSection({ strikes, onSend }) {
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

    return (
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
                    />
                </div>
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

            {confirmMode && (
                <PreviewCard
                    preview={preview}
                    onConfirm={() => {
                        onSend(preview)
                        setConfirmMode(false)
                        setPreview("")
                    }}
                    onCancel={() => setConfirmMode(false)}
                />
            )}
        </form>
    )
}

/* ----------------------
   SquareOffSection (with flipped input order)
   ---------------------- */
function SquareOffSection({ strikes, onSend }) {
    const [exitMode, setExitMode] = useState("") // BUY | SELL | BOTH
    const [marketView, setMarketView] = useState("BULLISH") // BULLISH | BEARISH
    const [strike, setStrike] = useState(strikes?.[0] ?? 25900)
    const [ceExit, setCeExit] = useState("")
    const [peExit, setPeExit] = useState("")
    const [singleExit, setSingleExit] = useState("")
    const [selectedOption, setSelectedOption] = useState("") // CE or PE for single exit
    const [action, setAction] = useState("book100")
    const [preview, setPreview] = useState("")

    const squareOffTemplates = {
        book100: "Modify stop loss and book 100% profit.",
        book50: "Modify stop loss and book 50% profit and now keep trailing stop loss at cost for remaining 50% qty.",
        trailprofit: "Trailing stop loss triggered. Modify stop loss and book profit for remaining 50% quantity.",
        trailclose: "Trailing stop loss triggered. Square off position.",
        stoploss: "Stop loss triggered. Modify your stop loss and square off position.",
    }

    useEffect(() => {
        const resetHandler = () => {
            setExitMode("")
            setMarketView("BULLISH")
            setStrike(strikes?.[0] ?? 25900)
            setCeExit("")
            setPeExit("")
            setSingleExit("")
            setSelectedOption("")
            setAction("book100")
            setPreview("")
        }
        document.addEventListener("reset-forms", resetHandler)
        return () => document.removeEventListener("reset-forms", resetHandler)
    }, [strikes])

    const buildMessage = () => {
        const actionText = squareOffTemplates[action]
        if (!actionText) {
            toast.error("Select valid action type.")
            return null
        }

        let msg = ""

        // Exit from Buy (Sell to close)
        if (exitMode === "BUY") {
            if (!selectedOption) {
                toast.error("Select CE or PE to exit from Buy position.")
                return null
            }
            if (!singleExit) {
                toast.error("Enter exit price.")
                return null
            }
            msg = `SQUARE OFF\n${actionText} Sell ${strike} ${selectedOption} @ ${singleExit}`
        }

        // Exit from Sell (Buy to close)
        if (exitMode === "SELL") {
            if (!selectedOption) {
                toast.error("Select CE or PE to exit from Sell position.")
                return null
            }
            if (!singleExit) {
                toast.error("Enter exit price.")
                return null
            }
            msg = `SQUARE OFF\n${actionText} Buy ${strike} ${selectedOption} @ ${singleExit}`
        }

        // Exit from Both
        if (exitMode === "BOTH") {
            if (!ceExit || !peExit) {
                toast.error("Enter both CE and PE exit prices.")
                return null
            }

            if (marketView === "BULLISH") {
                // Bullish = originally Buy CE, Sell PE → to close: Sell CE, Buy PE
                msg = `SQUARE OFF\n${actionText} Sell ${strike} CE @ ${ceExit} and Buy ${strike} PE @ ${peExit}`
            } else {
                // Bearish = originally Buy PE, Sell CE → to close: Sell PE, Buy CE
                msg = `SQUARE OFF\n${actionText} Sell ${strike} PE @ ${peExit} and Buy ${strike} CE @ ${ceExit}`
            }
        }

        return msg
    }

    const handlePreview = (e) => {
        e.preventDefault()
        const message = buildMessage()
        if (message) setPreview(message)
    }

    return (
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow p-8">
            <h1 className="text-2xl font-bold mb-6">Square Off</h1>

            {/* Step 1: Exit Mode */}
            <div className="mb-6">
                <label className="block font-semibold mb-2">Select Exit Mode</label>
                <div className="flex gap-6">
                    <label>
                        <input
                            type="radio"
                            name="exitMode"
                            value="BUY"
                            checked={exitMode === "BUY"}
                            onChange={() => setExitMode("BUY")}
                            className="accent-blue-600"
                        />{" "}
                        Exit from Buy
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="exitMode"
                            value="SELL"
                            checked={exitMode === "SELL"}
                            onChange={() => setExitMode("SELL")}
                            className="accent-blue-600"
                        />{" "}
                        Exit from Sell
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="exitMode"
                            value="BOTH"
                            checked={exitMode === "BOTH"}
                            onChange={() => setExitMode("BOTH")}
                            className="accent-blue-600"
                        />{" "}
                        Exit from Both
                    </label>
                </div>
            </div>

            {/* Step 2: Strike Selection (always visible) */}
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

            {/* Step 3: If Single Exit */}
            {(exitMode === "BUY" || exitMode === "SELL") && (
                <>
                    <div className="mb-4">
                        <label className="block font-semibold mb-2">Select Option Type</label>
                        <div className="flex gap-6">
                            <label>
                                <input
                                    type="radio"
                                    name="optionType"
                                    value="CE"
                                    checked={selectedOption === "CE"}
                                    onChange={() => setSelectedOption("CE")}
                                    className="accent-blue-600"
                                />{" "}
                                CE
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="optionType"
                                    value="PE"
                                    checked={selectedOption === "PE"}
                                    onChange={() => setSelectedOption("PE")}
                                    className="accent-blue-600"
                                />{" "}
                                PE
                            </label>
                        </div>
                    </div>

                    <Input
                        label={`Exit Price for ${exitMode === "BUY" ? "Buy" : "Sell"} ${selectedOption || "Option"}`}
                        value={singleExit}
                        setValue={setSingleExit}
                        placeholder="e.g. 120"
                    />
                </>
            )}

            {/* Step 4: If Both */}
            {exitMode === "BOTH" && (
                <>
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
                                Bullish (Buy CE & Sell PE)
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
                                Bearish (Buy PE & Sell CE)
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {marketView === "BULLISH" ? (
                            <>
                                <Input
                                    label="CE Exit Price (Sell to Close)"
                                    value={ceExit}
                                    setValue={setCeExit}
                                    placeholder="e.g. 120"
                                />
                                <Input
                                    label="PE Exit Price (Buy to Close)"
                                    value={peExit}
                                    setValue={setPeExit}
                                    placeholder="e.g. 125"
                                />
                            </>
                        ) : (
                            <>
                                <Input
                                    label="PE Exit Price (Sell to Close)"
                                    value={peExit}
                                    setValue={setPeExit}
                                    placeholder="e.g. 125"
                                />
                                <Input
                                    label="CE Exit Price (Buy to Close)"
                                    value={ceExit}
                                    setValue={setCeExit}
                                    placeholder="e.g. 120"
                                />
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Step 5: Action Type */}
            {exitMode && (
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
            )}

            {/* Step 6: Preview */}
            {exitMode && (
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded"
                >
                    Preview Message
                </button>
            )}

            {preview && (
                <div className="mt-4">
                    <PreviewCard
                        preview={preview}
                        onConfirm={() => {
                            onSend(preview)
                            setPreview("")
                            setCeExit("")
                            setPeExit("")
                            setSingleExit("")
                        }}
                        onCancel={() => setPreview("")}
                    />
                </div>
            )}
        </form>
    )
}

/* ----------------------
   IgnoreAlertSection
   ---------------------- */
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

/* ----------------------
   ExpiryTradesSection (unchanged)
   ---------------------- */
function ExpiryTradesSection({ strikes, onSend }) {
    const [marketView, setMarketView] = useState("BULLISH") // BULLISH or BEARISH
    const [strike, setStrike] = useState(25900)
    const [exitPrice, setExitPrice] = useState("")
    const [template, setTemplate] = useState("book100")
    const [preview, setPreview] = useState("")

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

    useEffect(() => {
        const resetHandler = () => {
            setMarketView("BULLISH")
            setStrike(25900)
            setExitPrice("")
            setTemplate("book100")
            setPreview("")
        }
        document.addEventListener("reset-forms", resetHandler)
        return () => document.removeEventListener("reset-forms", resetHandler)
    }, [])

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