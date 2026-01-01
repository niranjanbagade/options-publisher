import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

export async function POST(req) {
  try {
    // Get logged-in user session
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized - not logged in" }, { status: 401 })
    }

    // Read authorized emails from env
    const authorized = process.env.AUTHORIZED_USERS?.split(",").map((e) => e.trim()) || []

    // Check if user email is whitelisted
    if (!authorized.includes(session.user.email)) {
      return Response.json({ error: "Access denied" }, { status: 403 })
    }

    // Continue if authorized
    const { message } = await req.json()
    if (!message) {
      return Response.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    // Send to external API (fire and forget or await but don't block success)
    try {
      const username = process.env.NGROK_USER_ID
      const password = process.env.NGROK_USER_SECRET
      const ngrokUrl = process.env.NGROK_URL
      const auth = Buffer.from(`${username}:${password}`).toString('base64')

      const externalRes = await fetch(ngrokUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vercel-Token': process.env.X_VERCEL_TOKEN,
          'Authorization': `Basic ${auth}`, // Standard Basic Auth header
          'ngrok-skip-browser-warning': 'true' // Recommended to avoid ngrok landing page
        },
        body: JSON.stringify({ message })
      })

      console.log("External API response status:", externalRes.status)

      if (externalRes.ok) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN
        const chatId = process.env.TELEGRAM_CHAT_ID
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
        const res = await fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.description || "Failed to send message")
      }
    } catch (externalErr) {
      console.error("Failed to send to external API:", externalErr)
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("Error sending message:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}