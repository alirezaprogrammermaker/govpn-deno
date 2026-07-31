// Test TCP connection on Deno Deploy

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === "/test-tcp") {
    try {
      // Try to connect to httpbin.org on port 443
      const socket = await Deno.connect({ hostname: "httpbin.org", port: 443 });

      // If we get here, TCP connection works
      const localAddr = socket.localAddr as Deno.NetAddr;
      const remoteAddr = socket.remoteAddr as Deno.NetAddr;

      await socket.close();

      return new Response(JSON.stringify({
        status: "success",
        message: "TCP connection works!",
        local: localAddr,
        remote: remoteAddr,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({
        status: "error",
        message: err.message,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response(JSON.stringify({
    project: "GoVPN Deno TCP Test",
    usage: "/test-tcp",
    timestamp: new Date().toISOString()
  }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
});
