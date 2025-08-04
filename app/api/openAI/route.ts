import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { OpenAIModels } from '@/public/enums';
import { getMessage } from '@/public/utils/openAI';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE_URL,
});

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  const messages = new Array(getMessage(message));
  try {
    const response = await openai.chat.completions.create({
      model: OpenAIModels.DEEPSEEK_R1_FREE,
      messages,
      temperature: 0.7,
    });

    return new NextResponse(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error generating response:', error);
    return new Response('Error generating response', { status: 500 });
  }
}