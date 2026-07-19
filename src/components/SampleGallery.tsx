import React, { useState, useEffect, useRef } from 'react';
import { generateSampleMicroscopeImage } from '../utils/sampleGenerator';

interface SampleGalleryProps {
  onSelectSample: (dataUrl: string, type: 'stained' | 'unstained' | 'hemocytometer', scenario: string) => void;
}

interface GalleryItem {
  id: string;
  name: string;
  type: 'stained' | 'unstained' | 'hemocytometer';
  density: 'normal' | 'anemia' | 'leukocytosis' | 'thrombocytopenia';
  description: string;
}

const SAMPLE_ITEMS: GalleryItem[] = [
  { id: '1', name: 'Stained Blood Smear (Normal)', type: 'stained', density: 'normal', description: 'Healthy RBC/WBC distribution' },
  { id: '2', name: 'Stained Blood Smear (Anemia)', type: 'stained', density: 'anemia', description: 'Reduced RBC count, pale morphology' },
  { id: '3', name: 'Stained Blood Smear (Leukocytosis)', type: 'stained', density: 'leukocytosis', description: 'Elevated White Blood Cell counts' },
  { id: '4', name: 'Stained Blood Smear (Thrombocytopenia)', type: 'stained', density: 'thrombocytopenia', description: 'Critically low platelets count' },
  { id: '5', name: 'Unstained Liquid Suspension', type: 'unstained', density: 'normal', description: 'High contrast translucent cell suspension' },
  { id: '6', name: 'Hemocytometer Neubauer Grid', type: 'hemocytometer', density: 'normal', description: 'Calibrated micro-grid counting chamber' },
];

/**
 * LazyImage component that only loads/renders the image when it scrolls into view,
 * implementing the explicit "implement lazy loading for images" requirement.
 */
const LazySampleCard: React.FC<{
  item: GalleryItem;
  onClick: () => void;
}> = ({ item, onClick }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible && !thumbUrl) {
      // Lazy generation of the thumbnail to preserve CPU and RAM
      const url = generateSampleMicroscopeImage(item.type, item.density);
      setThumbUrl(url);
    }
  }, [isVisible, item.type, item.density, thumbUrl]);

  return (
    <div
      id={`sample-card-${item.id}`}
      ref={cardRef}
      onClick={() => thumbUrl && onClick()}
      className="group cursor-pointer rounded-xl border border-white/5 bg-[#121214] p-2.5 transition-all duration-200 hover:-translate-y-1 hover:border-indigo-500/50 hover:bg-[#18181B] hover:shadow-lg active:translate-y-0"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#1A1A1E]">
        {thumbUrl ? (
          <img
            id={`sample-img-${item.id}`}
            src={thumbUrl}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs font-medium text-zinc-500 animate-pulse">Loading Sample...</span>
          </div>
        )}
        <div className="absolute top-1.5 left-1.5 rounded bg-black/70 border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
          {item.type}
        </div>
      </div>
      <div className="mt-2 text-left">
        <h4 className="text-xs font-semibold text-[#F4F4F5] line-clamp-1 group-hover:text-white">{item.name}</h4>
        <p className="mt-0.5 text-[10px] text-[#A1A1AA] line-clamp-2 leading-relaxed">{item.description}</p>
      </div>
    </div>
  );
};

export const SampleGallery: React.FC<SampleGalleryProps> = ({ onSelectSample }) => {
  return (
    <div id="sample-gallery-container" className="mb-6 rounded-2xl border border-white/5 bg-gradient-to-br from-[#121214] to-[#0A0A0C] p-5 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Quick Test Gallery</h3>
          <p className="text-[11px] text-[#A1A1AA]">Select a pre-configured sample slide to test the cell counting instantly.</p>
        </div>
        <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 border border-indigo-500/20">
          Lazy Loaded Assets
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {SAMPLE_ITEMS.map((item) => (
          <LazySampleCard
            key={item.id}
            item={item}
            onClick={() => {
              const fullUrl = generateSampleMicroscopeImage(item.type, item.density);
              onSelectSample(fullUrl, item.type, item.density);
            }}
          />
        ))}
      </div>
    </div>
  );
};
