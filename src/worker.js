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
        const {
          question, 
          correctAnswer, 
          userAnswer, 
          options, 
          isCorrect, 
          difficulty,
          tags,
          optionFeedback,
          correctFeedback,
          explanation,
          examTips,
          isFollowUp,
          followUpQuestion
        } = await request.json();

        // Build detailed prompt with rich context
        const systemPrompt = `You are an expert LLQP/HLLQP ethics tutor.
Teach the student, do not just state the answer.
Use plain language, short sentences, and exam-focused coaching.
If the student is wrong, explain the misconception respectfully.
Never output markdown headings or bold markers.
Return ONLY valid JSON. No prose outside JSON.`;

        let userPrompt;
        
        if (isFollowUp) {
          const specificQuestion = (followUpQuestion || '').trim();
          // Generate a follow-up insight request
          userPrompt = `The student needs a DEEPER UNDERSTANDING of this ethics concept:

Question: ${question}
Correct Answer: ${correctAnswer}
User's Answer: ${userAnswer}
Difficulty: ${difficulty}
Topics: ${tags}

Student's specific follow-up question:
${specificQuestion || 'Provide one additional exam-focused insight and practical application.'}

Provide a deeper insight that connects this concept to:
1. Related ethical principles
2. Common misconceptions
3. Real-world application scenarios

Make it thought-provoking and help them see the bigger picture.

Return JSON exactly in this shape:
{"followUpInsight":"..."}`;
        } else {
          // Generate comprehensive explanation
          userPrompt = `Generate a comprehensive breakdown of this ethics question:

QUESTION: ${question}

OPTIONS: ${options.join(' | ')}

STUDENT ANSWERED: ${userAnswer}
CORRECT ANSWER: ${correctAnswer}
IS CORRECT: ${isCorrect}
DIFFICULTY: ${difficulty}
TOPICS: ${tags}

AVAILABLE CONTEXT:
- Option Feedback for student's choice: ${optionFeedback || 'N/A'}
- Why the correct answer is right: ${correctFeedback || 'N/A'}
- Official Explanation: ${explanation || 'N/A'}
- Exam Tips: ${examTips || 'N/A'}

Return JSON exactly in this shape:
{
  "mainExplanation": "2-4 sentences teaching the topic",
  "whyCorrect": "2-3 sentences",
  "whyIncorrect": "2-3 sentences, required only if student is incorrect",
  "keyConcept": "1-2 sentences",
  "studyTip": "practical memory aid",
  "relatedConcept": "what to study next"
}

No markdown. No extra keys. No text before/after JSON.`;
        }

        const messages = [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ];

        const responseSchema = isFollowUp
          ? {
              type: 'object',
              properties: {
                followUpInsight: { type: 'string' },
              },
              required: ['followUpInsight'],
            }
          : {
              type: 'object',
              properties: {
                mainExplanation: { type: 'string' },
                whyCorrect: { type: 'string' },
                whyIncorrect: { type: 'string' },
                keyConcept: { type: 'string' },
                studyTip: { type: 'string' },
                relatedConcept: { type: 'string' },
              },
              required: ['mainExplanation', 'whyCorrect', 'keyConcept', 'studyTip', 'relatedConcept'],
            };

        // Primary model: supports JSON mode and is more reliable for structured output.
        let response;
        try {
          response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
            messages,
            response_format: {
              type: 'json_schema',
              json_schema: responseSchema,
            },
            max_tokens: isFollowUp ? 300 : 700,
            temperature: 0.2,
          });
        } catch (primaryErr) {
          // Fallback model for compatibility.
          response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
            messages,
            max_tokens: isFollowUp ? 300 : 700,
            temperature: 0.2,
          });
        }

        // Parse model output (prefer strict JSON, fallback to text extraction)
        const responsePayload = response.response;
        const responseText = typeof responsePayload === 'string' ? responsePayload : JSON.stringify(responsePayload);
        let result = { success: true };

        const safeJsonParse = (raw) => {
          if (!raw || typeof raw !== 'string') return null;
          const trimmed = raw.trim();
          try {
            return JSON.parse(trimmed);
          } catch {
            // Try extracting JSON object from surrounding text/fences
            const start = trimmed.indexOf('{');
            const end = trimmed.lastIndexOf('}');
            if (start >= 0 && end > start) {
              const sliced = trimmed.slice(start, end + 1);
              try {
                return JSON.parse(sliced);
              } catch {
                return null;
              }
            }
            return null;
          }
        };

        if (isFollowUp) {
          const parsed = typeof responsePayload === 'object' && responsePayload !== null
            ? responsePayload
            : safeJsonParse(responseText);
          result.followUpInsight = parsed?.followUpInsight || responseText.trim();
        } else {
          const parsed = typeof responsePayload === 'object' && responsePayload !== null
            ? responsePayload
            : safeJsonParse(responseText);
          if (parsed && typeof parsed === 'object') {
            result.mainExplanation = parsed.mainExplanation;
            result.whyCorrect = parsed.whyCorrect;
            result.whyIncorrect = parsed.whyIncorrect;
            result.keyConcept = parsed.keyConcept;
            result.studyTip = parsed.studyTip;
            result.relatedConcept = parsed.relatedConcept;
          }

          // Fallback for non-JSON responses
          if (!result.mainExplanation && responseText) {
            result.mainExplanation = responseText.trim().substring(0, 700);
          }
        }

        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
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
