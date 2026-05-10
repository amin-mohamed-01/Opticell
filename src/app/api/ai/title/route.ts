import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const formattedMessages = [
      { role: 'system', content: 'You are an AI that summarizes conversations. Given a conversation, generate a short, concise, and descriptive title (2-4 words). Do not use emojis. Respond ONLY with the title without quotes or extra text.' },
      ...messages
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: formattedMessages,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const title = data.choices[0]?.message?.content?.trim() || 'New Chat';

    return NextResponse.json({ title });

  } catch (error: any) {
    console.error('AI Title generator error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
