'use client';

import { useEffect, useState, use, useMemo, useCallback } from 'react';
import { LuImageOff, LuLoader, LuBan } from 'react-icons/lu';
import { Sparkles, Settings2 } from 'lucide-react';
import { FaChevronLeft } from 'react-icons/fa';
import DatasetImageCard from '@/components/DatasetImageCard';
import { Button } from '@headlessui/react';
import AddImagesModal, { openImagesModal, useOpenImagesModalOnDrag } from '@/components/AddImagesModal';
import { TopBar, MainContent } from '@/components/layout';
import { apiClient } from '@/utils/api';
import useSettings from '@/hooks/useSettings';
import { pathJoin } from '@/utils/basic';
import AutoCaptionButton from '@/components/AutoCaptionButton';
import Link from 'next/link';
import { isVideo, isAudio } from '@/utils/basic';

export default function DatasetPage({ params }: { params: { datasetName: string } }) {
  const [imgList, setImgList] = useState<{ img_path: string }[]>([]);
  const [isAutoCaptioning, setIsAutoCaptioning] = useState(false);
  const usableParams = use(params as any) as { datasetName: string };
  const datasetName = usableParams.datasetName;
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const { settings, isSettingsLoaded } = useSettings();

  // Selection state
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  // Set of image paths currently being AI-captioned (triggers card effect)
  const [captioningImages, setCaptioningImages] = useState<Set<string>>(new Set());

  const captionConfigured = !!(settings.CAPTION_BASE_URL && settings.CAPTION_MODEL);

  const imageOnlyList = useMemo(
    () => imgList.filter(img => !isVideo(img.img_path) && !isAudio(img.img_path)),
    [imgList],
  );

  const refreshImageList = (dbName: string) => {
    setStatus('loading');
    apiClient
      .post('/api/datasets/listImages', { datasetName: dbName })
      .then((res: any) => {
        const data = res.data;
        data.images.sort((a: { img_path: string }, b: { img_path: string }) =>
          a.img_path.localeCompare(b.img_path),
        );
        setImgList(data.images);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  };

  useOpenImagesModalOnDrag(datasetName, () => refreshImageList(datasetName));

  useEffect(() => {
    if (datasetName) refreshImageList(datasetName);
  }, [datasetName]);

  // Selection helpers
  const toggleSelect = useCallback((imgPath: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev);
      if (next.has(imgPath)) next.delete(imgPath);
      else next.add(imgPath);
      return next;
    });
  }, []);

  const selectAll = () => {
    setSelectedImages(new Set(imageOnlyList.map(img => img.img_path)));
  };

  const deselectAll = () => setSelectedImages(new Set());

  // Called by each card when AI captioning completes
  const handleCaptionComplete = useCallback((imgPath: string) => {
    setCaptioningImages(prev => {
      const next = new Set(prev);
      next.delete(imgPath);
      return next;
    });
  }, []);

  // Trigger AI captioning on all selected images
  const captionSelected = () => {
    if (!captionConfigured) return;
    const toCaption = [...selectedImages].filter(p => !isVideo(p) && !isAudio(p));
    if (toCaption.length === 0) return;
    setCaptioningImages(prev => {
      const next = new Set(prev);
      toCaption.forEach(p => next.add(p));
      return next;
    });
    setSelectedImages(new Set());
  };

  const PageInfoContent = useMemo(() => {
    if (status === 'loading')
      return (
        <div className="mt-10 flex flex-col items-center justify-center py-16 px-8 rounded-xl border-2 border-gray-700 border-dashed bg-gray-800/50 text-gray-100 mx-auto max-w-md text-center">
          <LuLoader className="animate-spin w-8 h-8 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Loading Images</h3>
          <p className="text-sm opacity-75">Please wait while we fetch your dataset images...</p>
        </div>
      );
    if (status === 'error')
      return (
        <div className="mt-10 flex flex-col items-center justify-center py-16 px-8 rounded-xl border-2 border-red-700 border-dashed bg-red-600/20 text-red-100 mx-auto max-w-md text-center">
          <LuBan className="w-8 h-8 text-red-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Images</h3>
          <p className="text-sm opacity-75">There was a problem fetching the images. Please try refreshing the page.</p>
        </div>
      );
    if (status === 'success' && imgList.length === 0)
      return (
        <div className="mt-10 flex flex-col items-center justify-center py-16 px-8 rounded-xl border-2 border-gray-700 border-dashed bg-gray-800/50 text-gray-100 mx-auto max-w-md text-center">
          <LuImageOff className="w-8 h-8 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Images Found</h3>
          <p className="text-sm opacity-75">This dataset is empty. Click &quot;Add Images&quot; to get started.</p>
        </div>
      );
    return null;
  }, [status, imgList.length]);

  const selectedCount = selectedImages.size;
  const captioningCount = captioningImages.size;

  return (
    <>
      <TopBar>
        <div>
          <Button className="text-gray-500 dark:text-gray-300 px-3 mt-1" onClick={() => history.back()}>
            <FaChevronLeft />
          </Button>
        </div>
        <div>
          <h1 className="text-lg">Dataset: {datasetName}</h1>
        </div>
        <div className="flex-1" />

        {/* Selection controls */}
        {imageOnlyList.length > 0 && (
          <div className="flex items-center gap-2 mr-3">
            {selectedCount === 0 ? (
              <button
                onClick={selectAll}
                className="text-sm text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
              >
                Select All
              </button>
            ) : (
              <>
                <button
                  onClick={deselectAll}
                  className="text-sm text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                >
                  Deselect All ({selectedCount})
                </button>
                {captionConfigured ? (
                  <button
                    onClick={captionSelected}
                    disabled={captioningCount > 0}
                    className="flex items-center gap-1.5 text-sm text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Caption Selected ({selectedCount})
                  </button>
                ) : (
                  <Link
                    href="/settings"
                    className="flex items-center gap-1.5 text-sm text-white bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded-md transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Setup AI Caption
                  </Link>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <AutoCaptionButton
            datasetPath={`${pathJoin(settings.DATASETS_FOLDER, datasetName)}`}
            setIsAutoCaptioning={setIsAutoCaptioning}
          />
          <Button
            className="text-white bg-slate-600 px-3 py-1 rounded-md"
            onClick={() => openImagesModal(datasetName, () => refreshImageList(datasetName))}
          >
            Add Images
          </Button>
        </div>
      </TopBar>

      <MainContent>
        {/* AI caption not configured banner */}
        {isSettingsLoaded && !captionConfigured && imageOnlyList.length > 0 && (
          <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-lg bg-gray-800 border border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
              <span>
                AI image captioning is available — configure an OpenAI-compatible endpoint to generate captions automatically.
              </span>
            </div>
            <Link
              href="/settings"
              className="ml-4 shrink-0 text-sm text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-md transition-colors"
            >
              Configure
            </Link>
          </div>
        )}

        {/* Active captioning status */}
        {captioningCount > 0 && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-purple-900/40 border border-purple-700 text-sm text-purple-200">
            <LuLoader className="w-4 h-4 animate-spin shrink-0" />
            Generating captions for {captioningCount} image{captioningCount > 1 ? 's' : ''}...
          </div>
        )}

        {PageInfoContent}

        {status === 'success' && imgList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {imgList.map(img => (
              <DatasetImageCard
                key={img.img_path}
                alt="image"
                isAutoCaptioning={isAutoCaptioning}
                imageUrl={img.img_path}
                onDelete={() => refreshImageList(datasetName)}
                isSelected={selectedImages.has(img.img_path)}
                onToggleSelect={() => toggleSelect(img.img_path)}
                shouldAICaption={captioningImages.has(img.img_path)}
                onAICaptionComplete={handleCaptionComplete}
                captionConfigured={captionConfigured}
              />
            ))}
          </div>
        )}
      </MainContent>
      <AddImagesModal />
    </>
  );
}
