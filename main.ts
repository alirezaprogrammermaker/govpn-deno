// GoVPN Deno Deploy Proxy with WebSocket Tunnel
// Supports both HTTP proxy and HTTPS tunneling

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // WebSocket Tunnel endpoint (for HTTPS)
  if (url.pathname === "/tunnel") {
    const upgrade = req.headers.get("upgrade");
    if (upgrade !== "websocket") {
      return jsonResponse({
        name: "GoVPN Deno WebSocket Tunnel",
        usage: 'Connect via WebSocket, send: {"host":"example.com","port":443}',
        status: "ready",
      });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    handleTunnelConnection(socket);
    return response;
  }

  // HTTP Proxy endpoint
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl || url.searchParams.has("health")) {
    return jsonResponse({
      project: "GoVPN Deno Deploy Proxy",
      message: "Deno Deploy Proxy with WebSocket Tunnel 🚀",
      endpoints: {
        http: "?url=https://example.com (HTTP proxy)",
        tunnel: "/tunnel (WebSocket tunnel for HTTPS)",
        health: "?health=true",
      },
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

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // HTTP Proxy
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

async function handleTunnelConnection(ws: WebSocket) {
  let socket: Deno.TcpConn | null = null;
  let writer: WritableStreamDefaultWriter | null = null;
  let reader: ReadableStreamDefaultReader | null = null;

  ws.onmessage = async (event) => {
    try {
      if (!socket) {
        // First message is the connection config
        const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
        const config = JSON.parse(raw);
        const host = config.host;
        const port = config.port || 443;

        // Connect to target via TCP
        socket = await Deno.connect({ hostname: host, port: port });
        writer = socket.writable.getWriter();
        reader = socket.readable.getReader();

        ws.send(JSON.stringify({ status: "connected", host, port }));

        // TCP → WebSocket
        (async () => {
          try {
            while (true) {
              const { done, value } = await reader!.read();
              if (done) break;
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(value);
              }
            }
          } catch (err) {
            // TCP closed
          } finally {
            if (ws.readyState === WebSocket.OPEN) ws.close();
          }
        })();

      } else {
        // WebSocket → TCP
        let bytes: Uint8Array;
        if (event.data instanceof ArrayBuffer) {
          bytes = new Uint8Array(event.data);
        } else if (event.data instanceof Uint8Array) {
          bytes = event.data;
        } else if (typeof event.data === "string") {
          bytes = new TextEncoder().encode(event.data);
        } else {
          return;
        }
        if (bytes && writer) {
          await writer.write(bytes);
        }
      }
    } catch (err) {
      ws.send(JSON.stringify({ error: err.message }));
      ws.close();
    }
  };

  ws.onclose = async () => {
    try { if (writer) await writer.close(); } catch {}
    try { if (socket) socket.close(); } catch {}
  };

  ws.onerror = async () => {
    try { if (writer) await writer.close(); } catch {}
    try { if (socket) socket.close(); } catch {}
  };
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
