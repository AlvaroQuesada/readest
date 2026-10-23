export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    const { provider, apiKey, model, messages, baseUrl: customBaseUrl } = await req.json();

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let endpointUrl = 'https://api.openai.com/v1/chat/completions';
    if (provider === 'deepseek') {
      endpointUrl = 'https://api.deepseek.com/v1/chat/completions';
    } else if (provider === 'custom' && customBaseUrl) {
      const cleanBase = customBaseUrl.replace(/\/+$/, '');
      endpointUrl = cleanBase.endsWith('/chat/completions')
        ? cleanBase
        : `${cleanBase}/chat/completions`;
    }

    const targetModel = model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-6-luna');

    const upstreamResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages,
        stream: true,
      }),
    });

    if (!upstreamResponse.ok) {
      let errorDetails = '';
      try {
        const errorJson = await upstreamResponse.json();
        errorDetails = errorJson.error?.message || JSON.stringify(errorJson);
      } catch {
        errorDetails = await upstreamResponse.text();
      }
      return new Response(
        JSON.stringify({
          error: `AI Provider error (${upstreamResponse.status}): ${errorDetails}`,
        }),
        {
          status: upstreamResponse.status,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Stream the SSE body directly back to the client
    return new Response(upstreamResponse.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: `Server error: ${message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
