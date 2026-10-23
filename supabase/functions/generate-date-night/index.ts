const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return Response.json({ error: 'AI generation is not configured' }, { status: 503, headers: corsHeaders });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'Create one warm, practical date idea for a couple. Keep it inclusive and safe. Return only JSON with title, plan, budget, and mood string fields. Keep plan under 80 words.' },
          { role: 'user', content: 'Suggest a date that works for a couple in the Philippines, with a low-cost or at-home option.' },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 220,
      }),
    });
    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
    const payload = await response.json();
    const idea = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}');
    if (typeof idea.title !== 'string' || typeof idea.plan !== 'string') throw new Error('Invalid AI response');
    return Response.json({ idea }, { headers: corsHeaders });
  } catch (error) {
    console.error('Date night generation failed:', error);
    return Response.json({ error: 'Could not generate an idea' }, { status: 502, headers: corsHeaders });
  }
});
