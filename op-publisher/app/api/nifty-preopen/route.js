export async function GET() {
    try {
        const res = await fetch("https://www.nseindia.com/api/market-data-pre-open?key=NIFTY", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "application/json",
                "Referer": "https://www.nseindia.com/",
            },
            cache: "no-store",
        });

        if (!res.ok) {
            return new Response(JSON.stringify({ error: "Failed to fetch from NSE" }), { status: res.status });
        }

        const data = await res.json();
        return Response.json(data);
    } catch (err) {
        console.error("Error fetching NIFTY pre-open data:", err);
        return Response.json({ error: "Server error fetching data" }, { status: 500 });
    }
}
