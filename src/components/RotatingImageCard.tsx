import React, { useState, useEffect, useRef, useCallback } from 'react';

interface RotatingImageCardProps {
  images: string[];
  alt: string;
  interval?: number;
  className?: string;
  children?: React.ReactNode;
  /** Slot index (0-3) for sequential rotation - only this card changes during its turn */
  slotIndex?: number;
  /** Total number of cards in the rotation sequence */
  totalSlots?: number;
}

/**
 * Card component that rotates through multiple images with smooth crossfade
 * Cards rotate sequentially: Photo → Art → Anime → Text → repeat
 * Only ONE card changes at a time
 */
export function RotatingImageCard({
  images,
  alt,
  interval = 4000,
  className = '',
  children,
  slotIndex = 0,
  totalSlots = 4
}: RotatingImageCardProps) {
  const [displayIndex, setDisplayIndex] = useState(0);
  const [showNext, setShowNext] = useState(false);
  const nextIndexRef = useRef(1);
  const hasInitializedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize with a random starting image (only once)
  useEffect(() => {
    if (!hasInitializedRef.current && images.length > 1) {
      const startIndex = Math.floor(Math.random() * images.length);
      setDisplayIndex(startIndex);
      nextIndexRef.current = (startIndex + 1) % images.length;
      hasInitializedRef.current = true;
    }
  }, [images.length]);
  
  // Transition function
  const doTransition = useCallback(() => {
    // Step 1: Show next image (fade in on top)
    setShowNext(true);
    
    // Step 2: After fade completes, make next the current (instant swap)
    setTimeout(() => {
      const nextIdx = nextIndexRef.current;
      setDisplayIndex(nextIdx);
      setShowNext(false);
      
      // Step 3: Prepare the next image in queue
      nextIndexRef.current = (nextIdx + 1) % images.length;
    }, 2100);
  }, [images.length]);
  
  // Sequential rotation: each card waits for its turn
  useEffect(() => {
    if (images.length <= 1) return;
    
    // Total cycle time = interval per card × number of cards
    const cycleTime = interval * totalSlots;
    
    // This card's turn starts at: slotIndex × interval
    const myTurnDelay = slotIndex * interval;
    
    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    
    // Wait for initial turn, then repeat every cycle
    timerRef.current = setTimeout(() => {
      doTransition();
      cycleTimerRef.current = setInterval(doTransition, cycleTime);
    }, myTurnDelay);
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current);
    };
  }, [images.length, interval, slotIndex, totalSlots, doTransition]);
  
  if (images.length === 0) return null;
  
  // Get the next index for rendering
  const nextIndex = nextIndexRef.current;
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Base Image (current display) */}
      <img
        src={images[displayIndex]}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        draggable={false}
      />
      
      {/* Next Image (fades in on top, then disappears after becoming current) */}
      {images.length > 1 && (
        <img
          src={images[nextIndex]}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] ease-out"
          style={{
            opacity: showNext ? 1 : 0,
          }}
          loading="lazy"
          draggable={false}
        />
      )}
      
      {/* Overlay content (children) */}
      {children}
    </div>
  );
}

export default RotatingImageCard;
