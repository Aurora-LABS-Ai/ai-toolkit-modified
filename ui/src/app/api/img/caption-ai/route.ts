import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot, getCaptionSettings } from '@/server/settings';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imgPath } = body;

    if (!imgPath) {
      return NextResponse.json({ error: 'imgPath is required' }, { status: 400 });
    }

    const datasetsRoot = await getDatasetsRoot();
    if (!imgPath.startsWith(datasetsRoot) || imgPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 });
    }

    if (!fs.existsSync(imgPath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const { baseUrl, apiKey, model, systemPrompt } = await getCaptionSettings();

    if (!baseUrl || !model) {
      return NextResponse.json(
        { error: 'AI caption settings not configured. Set Base URL and Model in Settings.' },
        { status: 400 },
      );
    }

    const ext = path.extname(imgPath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'image/jpeg';
    const imageBuffer = fs.readFileSync(imgPath);
    const base64Image = imageBuffer.toString('base64');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const cleanBase = baseUrl.replace(/\/$/, '');
    const apiUrl = `${cleanBase}/chat/completions`;

    const messages: any[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        { type: 'text', text: 'Describe this image.' },
      ],
    });

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens: 512 }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return NextResponse.json({ error: `API error ${apiResponse.status}: ${errText}` }, { status: 500 });
    }

    const data = await apiResponse.json();
    const caption = (data.choices?.[0]?.message?.content || '').trim();

    if (!caption) {
      return NextResponse.json({ error: 'Empty caption returned from API' }, { status: 500 });
    }

    const captionPath = imgPath.replace(/\.[^/.]+$/, '') + '.txt';
    fs.writeFileSync(captionPath, caption, 'utf-8');

    return NextResponse.json({ caption });
  } catch (error: any) {
    console.error('AI caption error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate caption' }, { status: 500 });
  }
}
