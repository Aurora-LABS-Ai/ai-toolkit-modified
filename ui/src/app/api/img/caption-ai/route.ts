import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getDatasetsRoot, getCaptionSettings, getHFToken } from '@/server/settings';
import { captionWithJoyCaptionWorker } from '@/server/joycaptionWorker';

const execFileAsync = promisify(execFile);

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp',
};

const defaultUserPrompt =
  'Describe this image in detail for use as a training caption for an AI image generation model. Be specific about the subject, style, lighting, and composition. Return only the caption text.';

const buildExtraInstructions = (settings: Record<string, string>, triggerWord: string) =>
  [
    settings.optReferByName === 'true' && triggerWord.trim()
      ? `Refer to the person/character as ${triggerWord.trim()}.`
      : '',
    settings.optExcludeUnchangeable === 'true'
      ? 'Do not include fixed attributes that cannot be changed, but do include changeable attributes such as hair style.'
      : '',
    settings.optIncludeLighting === 'true' ? 'Include lighting details.' : '',
    settings.optIncludeCameraAngle === 'true' ? 'Include camera angle.' : '',
    settings.optIncludeWatermark === 'true' ? 'Note whether there is a watermark.' : '',
    settings.optIncludeJpeg === 'true' ? 'Note whether there are JPEG artifacts.' : '',
    settings.optIncludeCameraDetails === 'true'
      ? 'If it is a photo, include likely camera or lens details when visible.'
      : '',
    settings.optNoSexual === 'true' ? 'Do not include sexual details; keep the caption PG.' : '',
    settings.optNoRealPeople === 'true' ? 'Do not include anything that could identify real people.' : '',
    settings.optArtisticPerspective === 'true' ? "Maintain the image's artistic perspective." : '',
  ]
    .filter(Boolean)
    .join('\n');

const extractCaption = (content: any): string => {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        if (typeof part?.content === 'string') return part.content;
        return '';
      })
      .join(' ')
      .trim();
  }
  return '';
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imgPath } = body;

    if (!imgPath) {
      return NextResponse.json({ error: 'imgPath is required' }, { status: 400 });
    }

    const datasetsRoot = path.resolve(await getDatasetsRoot());
    const resolvedImagePath = path.resolve(imgPath);
    if (
      (!resolvedImagePath.startsWith(`${datasetsRoot}${path.sep}`) && resolvedImagePath !== datasetsRoot) ||
      resolvedImagePath.includes(`..${path.sep}`)
    ) {
      return NextResponse.json({ error: 'Invalid image path' }, { status: 400 });
    }

    if (!fs.existsSync(resolvedImagePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const {
      baseUrl,
      apiKey,
      model,
      systemPrompt,
      userPrompt,
      triggerWord,
      maxTokens,
      endpointType,
      joyCaptionType,
      joyCaptionLength,
      joyLowVram,
      keepJoyCaptionLoaded,
      optReferByName,
      optExcludeUnchangeable,
      optIncludeLighting,
      optIncludeCameraAngle,
      optIncludeWatermark,
      optIncludeJpeg,
      optIncludeCameraDetails,
      optNoSexual,
      optNoRealPeople,
      optArtisticPerspective,
    } =
      await getCaptionSettings();

    if (!model) {
      return NextResponse.json(
        { error: 'AI caption settings not configured. Set a model/model path first.' },
        { status: 400 },
      );
    }

    if (endpointType === 'joycaption_local' || endpointType === 'joycaption_hf' || endpointType === 'joycaption') {
      if (keepJoyCaptionLoaded === 'true') {
        const result = await captionWithJoyCaptionWorker(resolvedImagePath);
        return NextResponse.json({
          caption: result.caption,
          captionPath: result.captionPath,
          keptLoaded: true,
        });
      }

      const toolkitRoot = path.resolve(process.cwd(), '..');
      const scriptPath = path.join(toolkitRoot, 'scripts', 'joycaption_single.py');
      const venvPython = path.join(toolkitRoot, 'venv', 'bin', 'python');
      const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
      const payload = {
        image_path: resolvedImagePath,
        model_name_or_path: model,
        trigger_word: triggerWord,
        custom_instructions: userPrompt,
        max_new_tokens: maxTokens,
        caption_type: joyCaptionType,
        caption_length: joyCaptionLength,
        low_vram: joyLowVram === 'true',
        opt_refer_by_name: optReferByName === 'true',
        opt_exclude_unchangeable: optExcludeUnchangeable === 'true',
        opt_include_lighting: optIncludeLighting === 'true',
        opt_include_camera_angle: optIncludeCameraAngle === 'true',
        opt_include_watermark: optIncludeWatermark === 'true',
        opt_include_jpeg: optIncludeJpeg === 'true',
        opt_include_camera_details: optIncludeCameraDetails === 'true',
        opt_no_sexual: optNoSexual === 'true',
        opt_no_real_people: optNoRealPeople === 'true',
        opt_artistic_perspective: optArtisticPerspective === 'true',
        device: 'cuda',
      };
      try {
        const hfToken = await getHFToken();
        const { stdout, stderr } = await execFileAsync(pythonBin, [scriptPath, '--config-json', JSON.stringify(payload)], {
          cwd: toolkitRoot,
          env: {
            ...process.env,
            HF_TOKEN: hfToken || process.env.HF_TOKEN || '',
            HUGGING_FACE_HUB_TOKEN: hfToken || process.env.HUGGING_FACE_HUB_TOKEN || '',
          },
          maxBuffer: 1024 * 1024 * 20,
          timeout: 1000 * 60 * 20,
        });
        const jsonLine = stdout
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .reverse()
          .find(line => line.startsWith('{') && line.endsWith('}'));
        if (!jsonLine) {
          return NextResponse.json({ error: stderr || stdout || 'JoyCaption did not return a caption' }, { status: 500 });
        }
        const result = JSON.parse(jsonLine);
        return NextResponse.json(result);
      } catch (error: any) {
        return NextResponse.json(
          { error: error?.stderr || error?.stdout || error?.message || 'JoyCaption failed' },
          { status: 500 },
        );
      }
    }

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'OpenAI-compatible caption settings not configured. Set Base URL first.' },
        { status: 400 },
      );
    }
    if (endpointType !== 'openai') {
      return NextResponse.json({ error: `Unsupported caption backend: ${endpointType}` }, { status: 400 });
    }

    const ext = path.extname(resolvedImagePath).toLowerCase();
    const mimeType = MIME_MAP[ext] || 'image/jpeg';
    const imageBuffer = fs.readFileSync(resolvedImagePath);
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
    const textPrompt = [
      userPrompt.trim() || defaultUserPrompt,
      triggerWord.trim() ? `Use this exact trigger word/name when referring to the subject if appropriate: ${triggerWord.trim()}` : '',
      buildExtraInstructions(
        {
          optReferByName,
          optExcludeUnchangeable,
          optIncludeLighting,
          optIncludeCameraAngle,
          optIncludeWatermark,
          optIncludeJpeg,
          optIncludeCameraDetails,
          optNoSexual,
          optNoRealPeople,
          optArtisticPerspective,
        },
        triggerWord,
      ),
    ]
      .filter(Boolean)
      .join('\n\n');
    messages.push({
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        { type: 'text', text: textPrompt },
      ],
    });

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return NextResponse.json({ error: `API error ${apiResponse.status}: ${errText}` }, { status: 500 });
    }

    const data = await apiResponse.json();
    const caption = extractCaption(
      data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.message?.content ?? data.response,
    );

    if (!caption) {
      return NextResponse.json({ error: 'Empty caption returned from API' }, { status: 500 });
    }

    const captionPath = resolvedImagePath.replace(/\.[^/.]+$/, '') + '.txt';
    fs.writeFileSync(captionPath, caption, 'utf-8');

    return NextResponse.json({ caption, captionPath });
  } catch (error: any) {
    console.error('AI caption error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate caption' }, { status: 500 });
  }
}
