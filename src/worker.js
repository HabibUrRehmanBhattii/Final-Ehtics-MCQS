/**
 * Cloudflare Workers - AI Integration for Ethics MCQs
 * Generates explanations for answers using Workers AI
 */

export default {
  async fetch(request, env, ctx) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Health check
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // API endpoint for generating explanation
    if (path === '/api/explain' && request.method === 'POST') {
      try {
        const { question, correctAnswer, userAnswer, options } = await request.json();

        const prompt = `You are an expert ethics instructor. A student answered this ethics question:

Question: ${question}

Student's Answer: ${userAnswer}
Correct Answer: ${correctAnswer}

Available options were: ${options.join(', ')}

Provide a brief, clear explanation (2-3 sentences) of:
1. Why the correct answer is right
2. Why the student's answer was incorrect (if applicable)

Keep the explanation educational and supportive.`;

        // Call Workers AI LLM
        const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        return new Response(
          JSON.stringify({
            success: true,
            explanation: response.response,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      } catch (error) {
        console.error('AI Error:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
    }

    // Serve static assets for all other routes
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    // Fallback if ASSETS binding is missing
    return new Response('Not Found', { status: 404 });
  },
};
