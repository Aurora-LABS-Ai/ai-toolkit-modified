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

type JoyCaptionWorkerState = {
  process: ChildProcessWithoutNullStreams | null;
  status: WorkerStatus;
  pid: number | null;
  modelPath: string;
  lastError: string;
  stderrLines: string[];
  requestId: number;
  pending: Map<number, PendingRequest>;
  readyPromise: Promise<void> | null;
  readyResolve: (() => void) | null;
  readyReject: ((reason?: any) => void) | null;
};

const globalForJoyCaption = globalThis as typeof globalThis & {
  __aitkJoyCaptionWorker?: JoyCaptionWorkerState;
};

const state =
  globalForJoyCaption.__aitkJoyCaptionWorker ??
  (globalForJoyCaption.__aitkJoyCaptionWorker = {
    process: null,
    status: 'unloaded',
    pid: null,
    modelPath: '',
    lastError: '',
    stderrLines: [],
    requestId: 0,
    pending: new Map<number, PendingRequest>(),
    readyPromise: null,
    readyResolve: null,
    readyReject: null,
  });

const toolkitRoot = () => path.resolve(process.cwd(), '..');

export const isJoyCaptionBackend = (endpointType: string) =>
  endpointType === 'joycaption_local' || endpointType === 'joycaption_hf' || endpointType === 'joycaption';

export const getJoyCaptionStatus = () => ({
  status: state.status,
  pid: state.pid,
  modelPath: state.modelPath,
  lastError: state.lastError,
  stderr: state.stderrLines.slice(-20),
});

const rejectAllPending = (error: Error) => {
  for (const item of state.pending.values()) {
    clearTimeout(item.timer);
    item.reject(error);
  }
  state.pending.clear();
};

const startWorker = async () => {
  if (state.process) return;

  const root = toolkitRoot();
  const scriptPath = path.join(root, 'scripts', 'joycaption_worker.py');
  const venvPython = path.join(root, 'venv', 'bin', 'python');
  const pythonBin = fs.existsSync(venvPython) ? venvPython : 'python3';
  const hfToken = await getHFToken();

  state.status = 'starting';
  state.lastError = '';
  state.stderrLines = [];
  state.readyPromise = new Promise((resolve, reject) => {
    state.readyResolve = resolve;
    state.readyReject = reject;
  });

  state.process = spawn(pythonBin, [scriptPath], {
    cwd: root,
    env: {
      ...process.env,
      HF_TOKEN: hfToken || process.env.HF_TOKEN || '',
      HUGGING_FACE_HUB_TOKEN: hfToken || process.env.HUGGING_FACE_HUB_TOKEN || '',
      NO_ALBUMENTATIONS_UPDATE: '1',
    },
  });
  state.pid = state.process.pid || null;

  const stdout = readline.createInterface({ input: state.process.stdout });
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
      state.readyResolve?.();
      state.readyResolve = null;
      state.readyReject = null;
      return;
    }
    const id = Number(message.id);
    const item = state.pending.get(id);
    if (!item) return;
    state.pending.delete(id);
    clearTimeout(item.timer);
    if (message.ok) {
      item.resolve(message);
    } else {
      state.lastError = message.traceback || message.error || 'JoyCaption worker failed';
      state.status = 'error';
      item.reject(new Error(state.lastError));
    }
  });

  state.process.stderr.on('data', chunk => {
    const text = chunk.toString();
    state.stderrLines.push(...text.split('\n').map(line => line.trim()).filter(Boolean));
    state.stderrLines = state.stderrLines.slice(-50);
  });

  state.process.on('error', error => {
    state.lastError = error.message;
    state.status = 'error';
    state.readyReject?.(error);
    state.readyResolve = null;
    state.readyReject = null;
    rejectAllPending(error);
  });

  state.process.on('exit', (code, signal) => {
    const error = new Error(`JoyCaption worker exited${code !== null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}`);
    if (state.status !== 'unloaded') {
      state.lastError = error.message;
      state.status = code === 0 ? 'unloaded' : 'error';
    }
    state.process = null;
    state.pid = null;
    state.modelPath = '';
    state.readyReject?.(error);
    state.readyResolve = null;
    state.readyReject = null;
    rejectAllPending(error);
  });

  await state.readyPromise;
};

const sendCommand = async (command: string, payload: any = {}, timeoutMs = 1000 * 60 * 20) => {
  await startWorker();
  const proc = state.process;
  if (!proc) throw new Error('JoyCaption worker is not running');
  const id = ++state.requestId;
  const promise = new Promise<any>((resolve, reject) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      reject(new Error(`JoyCaption worker timed out during ${command}`));
    }, timeoutMs);
    state.pending.set(id, { resolve, reject, timer });
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
  state.status = 'loaded';
  state.modelPath = payload.model_name_or_path;
  return result;
};

export const captionWithJoyCaptionWorker = async (imagePath: string) => {
  const payload = await buildJoyCaptionPayload(imagePath);
  if (!payload.model_name_or_path) throw new Error('Set a JoyCaption model path first');
  if (!isJoyCaptionBackend(payload.endpoint_type)) throw new Error('JoyCaption backend is not selected');
  const result = await sendCommand('caption', payload);
  state.status = 'loaded';
  state.modelPath = payload.model_name_or_path;
  return result;
};

export const unloadJoyCaptionWorker = async () => {
  if (!state.process) {
    state.status = 'unloaded';
    state.pid = null;
    state.modelPath = '';
    return { ok: true, status: 'unloaded' };
  }
  try {
    await sendCommand('shutdown', {}, 1000 * 30);
  } catch {
    state.process?.kill('SIGKILL');
  }
  state.process = null;
  state.status = 'unloaded';
  state.pid = null;
  state.modelPath = '';
  return { ok: true, status: 'unloaded' };
};
