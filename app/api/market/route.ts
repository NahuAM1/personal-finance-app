import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  try {
    let url = "";

    switch (type) {
      case "dolar":
        url = "https://dolarapi.com/v1/dolares";
        break;
      case "cedears":
        url = "https://data912.com/live/arg_cedears";
        break;
      case "lecaps":
        url = "https://data912.com/live/arg_notes";
        break;
      case "bonos":
        url = "https://data912.com/live/arg_bonds";
        break;
      case "acciones":
        url = "https://data912.com/live/arg_stocks";
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    console.log(`Fetching ${type} from ${url}`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es-US,es;q=0.9,en;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "sec-ch-ua":
          '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
      },
      cache: "no-store",
    });

    console.log(`Response status for ${type}:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch ${type} data:`, errorText);
      throw new Error(`Failed to fetch ${type} data: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `Data received for ${type}:`,
      Array.isArray(data) ? `${data.length} items` : "object"
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching market data:", error);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
