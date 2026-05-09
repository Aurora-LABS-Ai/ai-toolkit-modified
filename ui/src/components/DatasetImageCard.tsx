import React, { useRef, useEffect, useState, ReactNode, KeyboardEvent } from 'react';
import { FaTrashAlt, FaEye, FaEyeSlash } from 'react-icons/fa';
import { Loader2, Sparkles } from 'lucide-react';
import { openConfirm } from './ConfirmModal';
import classNames from 'classnames';
import { apiClient } from '@/utils/api';
import AudioPlayer from './AudioPlayer';
import { isVideo, isAudio } from '@/utils/basic';

interface DatasetImageCardProps {
  imageUrl: string;
  alt: string;
  isAutoCaptioning: boolean;
  children?: ReactNode;
  className?: string;
  onDelete?: () => void;
  // selection & AI caption
  isSelected?: boolean;
  onToggleSelect?: () => void;
  shouldAICaption?: boolean;
  onAICaptionComplete?: (imgPath: string) => void;
  captionConfigured?: boolean;
  onConfigureCaption?: () => void;
}

const DatasetImageCard: React.FC<DatasetImageCardProps> = ({
  imageUrl,
  alt,
  isAutoCaptioning,
  children,
  className = '',
  onDelete = () => {},
  isSelected = false,
  onToggleSelect,
  shouldAICaption = false,
  onAICaptionComplete,
  captionConfigured = false,
  onConfigureCaption,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [inViewport, setInViewport] = useState<boolean>(false);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [isCaptionLoaded, setIsCaptionLoaded] = useState<boolean>(false);
  const [caption, setCaption] = useState<string>('');
  const [savedCaption, setSavedCaption] = useState<string>('');
  const [isAICaptioning, setIsAICaptioning] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const aiCaptioningRef = useRef<boolean>(false);

  const fetchCaption = async () => {
    if (isCaptionLoaded) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    apiClient
      .post(`/api/caption/get`, { imgPath: imageUrl }, { signal: controller.signal })
      .then(res => res.data)
      .then(data => {
        if (data) data = `${data}`;
        setCaption(data || '');
        setSavedCaption(data || '');
        setIsCaptionLoaded(true);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        console.error('Error fetching caption:', error);
      })
      .finally(() => {
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
      });
  };

  const saveCaption = () => {
    const trimmedCaption = caption.trim();
    if (trimmedCaption === savedCaption) return;
    apiClient
      .post('/api/img/caption', { imgPath: imageUrl, caption: trimmedCaption })
      .then(res => res.data)
      .then(() => setSavedCaption(trimmedCaption))
      .catch(error => console.error('Error saving caption:', error));
  };

  const runAICaption = async () => {
    if (aiCaptioningRef.current) return;
    if (!captionConfigured) {
      onConfigureCaption?.();
      return;
    }
    aiCaptioningRef.current = true;
    setIsAICaptioning(true);
    setAiError(null);
    try {
      const res = await apiClient.post('/api/img/caption-ai', { imgPath: imageUrl });
      const newCaption = res.data.caption || '';
      setCaption(newCaption);
      setSavedCaption(newCaption);
      setIsCaptionLoaded(true);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Caption failed';
      setAiError(msg);
    } finally {
      aiCaptioningRef.current = false;
      setIsAICaptioning(false);
      onAICaptionComplete?.(imageUrl);
    }
  };

  // Triggered by parent "Caption Selected"
  useEffect(() => {
    if (shouldAICaption && !aiCaptioningRef.current) {
      runAICaption();
    }
  }, [shouldAICaption]);

  useEffect(() => {
    if (inViewport && isVisible) fetchCaption();
  }, [inViewport, isVisible, isCaptionLoaded]);

  useEffect(() => {
    if (!isAutoCaptioning || !inViewport || !isVisible) return;
    const interval = setInterval(() => setIsCaptionLoaded(false), 5000);
    return () => clearInterval(interval);
  }, [isAutoCaptioning, inViewport, isVisible]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setInViewport(true);
          if (!isVisible) setIsVisible(true);
        } else {
          setInViewport(false);
          abortControllerRef.current?.abort();
        }
      },
      { threshold: 0.1 },
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLoad = (): void => setLoaded(true);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveCaption();
    }
  };

  const isCaptionCurrent = caption.trim() === savedCaption;
  const [showAudioPlayer, setShowAudioPlayer] = useState(true);
  const isItAVideo = isVideo(imageUrl);
  const isItAudio = isAudio(imageUrl);
  const isItImage = !isItAVideo && !isItAudio;
  const isBusy = isAutoCaptioning || isAICaptioning;

  return (
    <div className={`flex flex-col ${className}`}>
      <div ref={cardRef} className="relative w-full" style={{ paddingBottom: '100%' }}>
        <div className="absolute inset-0 rounded-t-lg shadow-md">
          {inViewport && isVisible && (
            <>
              {isItAVideo && (
                <video
                  src={`/api/img/${encodeURIComponent(imageUrl)}`}
                  className="w-full h-full object-contain"
                  autoPlay={false}
                  loop
                  muted
                  controls
                />
              )}
              {isItAudio && !showAudioPlayer && (
                <div
                  className="w-full h-full cursor-pointer flex items-center justify-center bg-gray-900"
                  onClick={() => setShowAudioPlayer(true)}
                >
                  <img
                    src={`/api/audio/art/${encodeURIComponent(imageUrl)}`}
                    alt={alt}
                    className="w-full h-full object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              {isItAudio && showAudioPlayer && (
                <AudioPlayer
                  src={`/api/img/${encodeURIComponent(imageUrl)}`}
                  title={imageUrl.replace(/^.*[\\/]/, '')}
                />
              )}
              {isItImage && (
                <img
                  src={`/api/img/${encodeURIComponent(imageUrl)}`}
                  alt={alt}
                  onLoad={handleLoad}
                  className={`w-full h-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                />
              )}
            </>
          )}
          {!isVisible && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75 rounded-t-lg">
              <span className="text-white text-lg"></span>
            </div>
          )}
          {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}

          {/* Selection checkbox — top left */}
          {onToggleSelect && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggleSelect(); }}
              className={classNames(
                'absolute top-1 left-1 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
                isSelected
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-gray-900/60 border-gray-400 hover:border-blue-400',
              )}
            >
              {isSelected && (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )}

          {/* Action buttons — top right */}
          <div className="absolute top-1 right-1 flex space-x-1 z-10">
            {/* AI caption button — images only */}
            {isItImage && (
              <button
                type="button"
                title={captionConfigured ? 'Generate AI caption' : 'Configure AI caption'}
                onClick={() => runAICaption()}
                disabled={isAICaptioning}
                className={classNames(
                  'rounded-full p-2 transition-colors disabled:opacity-50',
                  captionConfigured ? 'bg-gray-800 hover:bg-purple-700' : 'bg-orange-700 hover:bg-orange-600',
                )}
              >
                {isAICaptioning
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              className="bg-gray-800 rounded-full p-2"
              onClick={() => {
                openConfirm({
                  title: `Delete ${isItAVideo ? 'video' : 'image'}`,
                  message: `Are you sure you want to delete this ${isItAVideo ? 'video' : 'image'}? This action cannot be undone.`,
                  type: 'warning',
                  confirmText: 'Delete',
                  onConfirm: () => {
                    apiClient
                      .post('/api/img/delete', { imgPath: imageUrl })
                      .then(() => onDelete())
                      .catch(error => console.error('Error deleting image:', error));
                  },
                });
              }}
            >
              <FaTrashAlt />
            </button>
          </div>

          {/* AI captioning overlay */}
          {isAICaptioning && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center rounded-t-lg">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <span className="text-white text-xs mt-2">Captioning...</span>
            </div>
          )}
        </div>
      </div>

      {/* Caption textarea */}
      <div
        className={classNames('w-full p-2 bg-gray-800 text-white text-sm rounded-b-lg', {
          'border-blue-500 border-2': !isCaptionCurrent,
          'border-red-500 border-2': !!aiError,
          'border-transparent border-2': isCaptionCurrent && !aiError,
          'min-h-[75px]': true,
        })}
      >
        {aiError && (
          <div className="text-red-400 text-xs mb-1 truncate" title={aiError}>{aiError}</div>
        )}
        {inViewport && isVisible && (isCaptionLoaded || caption) && (
          <form onSubmit={e => { e.preventDefault(); saveCaption(); }} onBlur={saveCaption}>
            <textarea
              className={classNames('w-full bg-transparent resize-none outline-none focus:ring-0 focus:outline-none', {
                'opacity-50 cursor-not-allowed': isBusy,
              })}
              value={caption}
              rows={3}
              readOnly={isBusy}
              onChange={e => setCaption(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </form>
        )}
        {(!inViewport || !isVisible) && isCaptionLoaded && (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            {isVisible ? 'Scroll into view to edit caption' : 'Show content to edit caption'}
          </div>
        )}
        {!isCaptionLoaded && !caption && !aiError && (
          <div className="w-full h-full flex items-center justify-center text-gray-400">Loading caption...</div>
        )}
      </div>
    </div>
  );
};

export default DatasetImageCard;
