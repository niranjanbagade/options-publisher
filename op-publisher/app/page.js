"use client"

import { signIn, signOut, useSession } from "next-auth/react"

export default function HomePage() {
  const { data: session } = useSession()

  if (session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1>Welcome, {session.user.name}</h1>
        <img src={session.user.image} alt="profile" className="w-16 h-16 rounded-full" />
        <button
          onClick={() => signOut()}
          className="mt-4 bg-gray-800 text-white px-4 py-2 rounded"
        >
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1>Welcome to My App</h1>
      <button
        onClick={() => signIn("google")}
        className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
      >
        Sign in with Google
      </button>
    </div>
  )
}
