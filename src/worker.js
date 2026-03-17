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
          requestType 
        } = await request.json();

        // Build detailed prompt with rich context
        let systemPrompt = `You are an expert ethics instructor for financial insurance exams (LLQP, HLLQP, WFG). 
Your goal is to provide clear, structured, and educational explanations that help students understand not just the answer, but the underlying concepts.

Key instructions:
1. Be supportive and non-judgmental
2. Explain concepts clearly and concisely
3. Connect answers to real-world ethics scenarios
4. Provide memory aids or mnemonics when helpful
5. Suggest related concepts for deeper learning

When generating explanations, structure your response with clear sections.`;

        let userPrompt;
        
        if (isFollowUp) {
          // Generate a follow-up insight request
          userPrompt = `The student needs a DEEPER UNDERSTANDING of this ethics concept:

Question: ${question}
Correct Answer: ${correctAnswer}
User's Answer: ${userAnswer}
Difficulty: ${difficulty}
Topics: ${tags}

Provide a deeper insight that connects this concept to:
1. Related ethical principles
2. Common misconceptions
3. Real-world application scenarios

Make it thought-provoking and help them see the bigger picture.`;
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

Please structure your response in this format (use these exact headers):

MAIN_EXPLANATION: [2-3 sentences explaining the core concept]

WHY_CORRECT: [2-3 sentences on why the correct answer is right]

${!isCorrect ? 'WHY_INCORRECT: [2-3 sentences on why the student\'s answer was incorrect and common misconceptions]' : ''}

KEY_CONCEPT: [1-2 sentences on the fundamental principle being tested]

STUDY_TIP: [A mnemonic, memory aid, or learning strategy]

RELATED_CONCEPT: [Another related concept they should study next]`;
        }

        // Call Workers AI LLM with streaming response
        const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.7,
        });

        // Parse the structured response
        const responseText = response.response;
        let result = { success: true };

        if (isFollowUp) {
          // For follow-up requests, extract the insight
          result.followUpInsight = responseText.trim();
        } else {
          // Parse the structured sections from response
          const sections = {
            mainExplanation: 'MAIN_EXPLANATION',
            whyCorrect: 'WHY_CORRECT',
            whyIncorrect: 'WHY_INCORRECT',
            keyConcept: 'KEY_CONCEPT',
            studyTip: 'STUDY_TIP',
            relatedConcept: 'RELATED_CONCEPT',
          };

          for (const [key, headerText] of Object.entries(sections)) {
            const regex = new RegExp(`${headerText}:\\s*(.+?)(?=\\n(?:[A-Z_]+:|$))`, 's');
            const match = responseText.match(regex);
            if (match) {
              result[key] = match[1].trim();
            }
          }

          // If parsing failed, use full response as main explanation
          if (!result.mainExplanation && responseText) {
            result.mainExplanation = responseText.trim().substring(0, 500);
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
