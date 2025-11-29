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
 * Only ONE card changes at a time with smooth transitions
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
  // Use two image layers for seamless crossfade
  const [bottomIndex, setBottomIndex] = useState(0);
  const [topIndex, setTopIndex] = useState(1);
  const [showTop, setShowTop] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const hasInitializedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cycleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize with a random starting image (only once)
  useEffect(() => {
    if (!hasInitializedRef.current && images.length > 1) {
      const startIndex = Math.floor(Math.random() * images.length);
      setBottomIndex(startIndex);
      setTopIndex((startIndex + 1) % images.length);
      hasInitializedRef.current = true;
    }
  }, [images.length]);
  
  // Transition function with proper sequencing
  const doTransition = useCallback(() => {
    if (isTransitioning || images.length <= 1) return;
    
    setIsTransitioning(true);
    
    // Step 1: Fade in the top layer
    setShowTop(true);
    
    // Step 2: After fade completes, swap layers and prepare next image
    setTimeout(() => {
      // Use requestAnimationFrame for smoother visual update
      requestAnimationFrame(() => {
        setBottomIndex(topIndex);
        setShowTop(false);
        
        // Prepare next image in the queue
        requestAnimationFrame(() => {
          setTopIndex((topIndex + 1) % images.length);
          setIsTransitioning(false);
        });
      });
    }, 2200); // Slightly longer than CSS transition to ensure completion
  }, [images.length, topIndex, isTransitioning]);
  
  // Sequential rotation: each card waits for its turn
  useEffect(() => {
    if (images.length <= 1) return;
    
    // Total cycle time = interval per card × number of cards
    // Add extra buffer between cards to prevent overlap
    const bufferTime = 500; // 500ms buffer between cards
    const cycleTime = (interval + bufferTime) * totalSlots;
    
    // This card's turn starts at: slotIndex × (interval + buffer)
    const myTurnDelay = slotIndex * (interval + bufferTime);
    
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
  
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Bottom Layer (current display) */}
      <img
        src={images[bottomIndex]}
        alt={alt}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      
      {/* Top Layer (fades in during transition) */}
      {images.length > 1 && (
        <img
          src={images[topIndex]}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: showTop ? 1 : 0,
            transition: 'opacity 2000ms ease-out',
            willChange: 'opacity',
          }}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      )}
      
      {/* Overlay content (children) */}
      {children}
    </div>
  );
}

export default RotatingImageCard;
