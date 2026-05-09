import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { getCaptionSettings, getHFToken } from '@/server/settings';

type WorkerStatus = 'unloaded' | 'starting' | 'loaded' | 'error';

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timer: NodeJS.Timeout;
};

let workerProcess: ChildProcessWithoutNullStreams | null = null;
let workerStatus: WorkerStatus = 'unloaded';
let workerPid: number | null = null;
let workerModelPath = '';
let lastError = '';
let stderrLines: string[] = [];
let requestId = 0;
let pending = new Map<number, PendingRequest>();
let readyPromise: Promise<void> | null = null;
let readyResolve: (() => void) | null = null;
let readyReject: ((reason?: any) => void) | null = null;

const toolkitRoot = () => path.resolve(process.cwd(), '..');

export const isJoyCaptionBackend = (endpointType: string) =>
  endpointType === 'joycaption_local' || endpointType === 'joycaption_hf' || endpointType === 'joycaption';

export const getJoyCaptionStatus = () => ({
  status: workerStatus,
  pid: workerPid,
  modelPath: workerModelPath,
  lastError,
  stderr: stderrLines.slice(-20),
});

const rejectAllPending = (error: Error) => {
  for (const item of pending.values()) {
    clearTimeout(item.timer);
    item.reject(error);
  }
  pending.clear();
};

const startWorker = async () => {
  if (workerProcess) return;

  const root = toolkitRoot();
  const scriptPath = path.join(root, 'scripts', 'joycaption_worker.py');
  const venvPython = path.join(root, 'venv', 'bin', 'python');
  const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
  const hfToken = await getHFToken();

  workerStatus = 'starting';
  lastError = '';
  stderrLines = [];
  readyPromise = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  workerProcess = spawn(pythonBin, [scriptPath], {
    cwd: root,
    env: {
      ...process.env,
      HF_TOKEN: hfToken || process.env.HF_TOKEN || '',
      HUGGING_FACE_HUB_TOKEN: hfToken || process.env.HUGGING_FACE_HUB_TOKEN || '',
      NO_ALBUMENTATIONS_UPDATE: '1',
    },
  });
  workerPid = workerProcess.pid || null;

  const stdout = readline.createInterface({ input: workerProcess.stdout });
  stdout.on('line', line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let message: any;
    try {
      message = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (message.ready) {
      readyResolve?.();
      readyResolve = null;
      readyReject = null;
      return;
    }
    const id = Number(message.id);
    const item = pending.get(id);
    if (!item) return;
    pending.delete(id);
    clearTimeout(item.timer);
    if (message.ok) {
      item.resolve(message);
    } else {
      lastError = message.traceback || message.error || 'JoyCaption worker failed';
      workerStatus = 'error';
      item.reject(new Error(lastError));
    }
  });

  workerProcess.stderr.on('data', chunk => {
    const text = chunk.toString();
    stderrLines.push(...text.split('\n').map(line => line.trim()).filter(Boolean));
    stderrLines = stderrLines.slice(-50);
  });

  workerProcess.on('error', error => {
    lastError = error.message;
    workerStatus = 'error';
    readyReject?.(error);
    readyResolve = null;
    readyReject = null;
    rejectAllPending(error);
  });

  workerProcess.on('exit', (code, signal) => {
    const error = new Error(`JoyCaption worker exited${code !== null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}`);
    if (workerStatus !== 'unloaded') {
      lastError = error.message;
      workerStatus = code === 0 ? 'unloaded' : 'error';
    }
    workerProcess = null;
    workerPid = null;
    workerModelPath = '';
    readyReject?.(error);
    readyResolve = null;
    readyReject = null;
    rejectAllPending(error);
  });

  await readyPromise;
};

const sendCommand = async (command: string, payload: any = {}, timeoutMs = 1000 * 60 * 20) => {
  await startWorker();
  const proc = workerProcess;
  if (!proc) throw new Error('JoyCaption worker is not running');
  const id = ++requestId;
  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`JoyCaption worker timed out during ${command}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
  });
  proc.stdin.write(`${JSON.stringify({ id, command, payload })}\n`);
  return promise;
};

export const buildJoyCaptionPayload = async (imagePath?: string) => {
  const settings = await getCaptionSettings();
  return {
    image_path: imagePath,
    model_name_or_path: settings.model,
    trigger_word: settings.triggerWord,
    custom_instructions: settings.userPrompt,
    max_new_tokens: settings.maxTokens,
    caption_type: settings.joyCaptionType,
    caption_length: settings.joyCaptionLength,
    low_vram: settings.joyLowVram === 'true',
    opt_refer_by_name: settings.optReferByName === 'true',
    opt_exclude_unchangeable: settings.optExcludeUnchangeable === 'true',
    opt_include_lighting: settings.optIncludeLighting === 'true',
    opt_include_camera_angle: settings.optIncludeCameraAngle === 'true',
    opt_include_watermark: settings.optIncludeWatermark === 'true',
    opt_include_jpeg: settings.optIncludeJpeg === 'true',
    opt_include_camera_details: settings.optIncludeCameraDetails === 'true',
    opt_no_sexual: settings.optNoSexual === 'true',
    opt_no_real_people: settings.optNoRealPeople === 'true',
    opt_artistic_perspective: settings.optArtisticPerspective === 'true',
    device: 'cuda',
    endpoint_type: settings.endpointType,
    keep_loaded: settings.keepJoyCaptionLoaded === 'true',
  };
};

export const loadJoyCaptionWorker = async () => {
  const payload = await buildJoyCaptionPayload();
  if (!payload.model_name_or_path) throw new Error('Set a JoyCaption model path first');
  if (!isJoyCaptionBackend(payload.endpoint_type)) throw new Error('JoyCaption backend is not selected');
  const result = await sendCommand('load', payload);
  workerStatus = 'loaded';
  workerModelPath = payload.model_name_or_path;
  return result;
};

export const captionWithJoyCaptionWorker = async (imagePath: string) => {
  const payload = await buildJoyCaptionPayload(imagePath);
  if (!payload.model_name_or_path) throw new Error('Set a JoyCaption model path first');
  if (!isJoyCaptionBackend(payload.endpoint_type)) throw new Error('JoyCaption backend is not selected');
  const result = await sendCommand('caption', payload);
  workerStatus = 'loaded';
  workerModelPath = payload.model_name_or_path;
  return result;
};

export const unloadJoyCaptionWorker = async () => {
  if (!workerProcess) {
    workerStatus = 'unloaded';
    workerPid = null;
    workerModelPath = '';
    return { ok: true, status: 'unloaded' };
  }
  try {
    await sendCommand('shutdown', {}, 1000 * 30);
  } catch {
    workerProcess?.kill('SIGKILL');
  }
  workerProcess = null;
  workerStatus = 'unloaded';
  workerPid = null;
  workerModelPath = '';
  return { ok: true, status: 'unloaded' };
};
