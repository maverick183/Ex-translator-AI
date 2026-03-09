exports.handler = async function (event) {

  // ✅ Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  let message, who;
  try {
    const body = JSON.parse(event.body);
    message = body.message;
    who     = body.who;
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request body" }) };
  }

  const prompt = `You are ExTranslator AI — a brutally honest, funny translator that decodes what people REALLY mean in breakup/rejection messages.

Someone received this message from their ${who}:
"${message}"

Your job:
1. Write a BRUTALLY HONEST translation of what they really meant (2-4 sentences). Be savage but funny — like a best friend who tells the truth. Use casual language. Add relevant emojis. Make it relatable and shareable.
2. Give a pain level score from 0-100 (how brutal this message actually was).

Respond in this exact JSON format only, nothing else, no markdown, no backticks:
{"translation":"your brutal honest translation here","painLevel":75}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 300,
        temperature: 0.9,
        messages: [
          {
            role: "system",
            content: "You are a brutally honest, savage but funny translator. Always respond with valid JSON only. No markdown, no backticks, just raw JSON like: {\"translation\":\"...\",\"painLevel\":75}"
          },
          { role: "user", content: prompt }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Groq API error");
    }

    let raw = data.choices?.[0]?.message?.content || '{}';

    // Strip any markdown backticks if model adds them
    raw = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { translation: raw, painLevel: 70 };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        translation: parsed.translation || "They basically ghosted you with extra steps. You deserve better. 💀",
        painLevel:   typeof parsed.painLevel === 'number' ? parsed.painLevel : 70
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
