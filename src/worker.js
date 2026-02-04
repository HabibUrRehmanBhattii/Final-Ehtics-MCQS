/**
 * Cloudflare Workers - AI Integration for Ethics MCQs
 * Generates explanations for answers using Workers AI
 */

export default {
  async fetch(request, env) {
    // Enable CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // API endpoint for generating explanation
    if (url.pathname === '/api/explain' && request.method === 'POST') {
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
        const messages = [
          {
            role: 'user',
            content: prompt,
          },
        ];

        const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
          messages,
        });

        return new Response(
          JSON.stringify({
            success: true,
            explanation: response.response,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: error.message,
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
