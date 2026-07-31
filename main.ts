// GoVPN Deno Deploy Proxy
// Deploy at: https://dash.deno.com

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  // Health check
  if (!targetUrl || url.searchParams.has("health")) {
    return jsonResponse({
      project: "GoVPN Deno Deploy Proxy",
      message: "Deno Deploy Proxy 🚀",
      usage: "?url=https://example.com",
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  }

  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Proxy the request
  try {
    const response = await fetch(targetUrl, {
      method: req.method === "POST" ? "POST" : "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
      },
      redirect: "follow",
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        ...corsHeaders,
        "Content-Type": response.headers.get("Content-Type") || "text/plain",
        "X-Proxy": "GoVPN-Deno",
        "X-Target": targetUrl,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err.message,
        target: targetUrl,
        timestamp: new Date().toISOString(),
      },
      502
    );
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
