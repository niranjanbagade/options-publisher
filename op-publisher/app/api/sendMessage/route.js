import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"

// 1. INCREASE TIMEOUT FOR COLD STARTS
export const maxDuration = 60; 

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const authorized = process.env.AUTHORIZED_USERS?.split(",").map((e) => e.trim()) || []
    if (!authorized.includes(session.user.email)) {
      return Response.json({ error: "Access denied" }, { status: 403 })
    }

    const { message } = await req.json()
    if (!message) {
      return Response.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    try {
      var sendToNgrok = false;
      const username = process.env.NGROK_USER_ID
      const password = process.env.NGROK_USER_SECRET
      const ngrokUrl = process.env.NGROK_URL
      const auth = Buffer.from(`${username}:${password}`).toString('base64')
      var externalRes = null;
      if(sendToNgrok){
        externalRes = await fetch(ngrokUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vercel-Token': process.env.X_VERCEL_TOKEN,
            'Authorization': `Basic ${auth}`, // Standard Basic Auth header
            'ngrok-skip-browser-warning': 'true' // Recommended to avoid ngrok landing page
          },
          body: JSON.stringify({ message: message, sentAt: Date.now() })
        })
        console.log("External API response status:", externalRes.status)
      }

      if (!sendToNgrok || externalRes.ok) {
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
        if (!res.ok) {
          return Response.json({ 
            error: "Automation worked, but Telegram failed: " + (data.description || "Unknown Error")
          }, { status: 500 })
        }

        return Response.json({ success: true })
      } else {
        return Response.json({ 
          error: `Automation failed (Status ${externalRes.status}). Telegram message skipped to avoid confusion.` 
        }, { status: 500 })
      }
    } catch (externalErr) {
      return Response.json({ error: "Could not reach automation server via proxy: " + externalErr.message }, { status: 500 })
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}