import React, { useEffect, useRef, useState } from 'react';

// Define props interface
interface LottieWrapperProps {
  animationData: any;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function LottieWrapper({
  animationData,
  loop = true,
  autoplay = true,
  className,
  style
}: LottieWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lottieInstance, setLottieInstance] = useState<any>(null);
  
  useEffect(() => {
    // Only import and run Lottie in the browser
    let animObj: any = null;

    // Dynamic import to avoid SSR issues
    import('lottie-web').then((lottie) => {
      if (containerRef.current) {
        animObj = lottie.default.loadAnimation({
          container: containerRef.current,
          renderer: 'svg',
          loop,
          autoplay,
          animationData,
        });
        
        setLottieInstance(animObj);
      }
    }).catch(err => {
      console.error('Failed to load Lottie animation:', err);
    });

    // Cleanup function
    return () => {
      if (animObj) {
        animObj.destroy();
      }
    };
  }, [animationData, loop, autoplay]);

  return <div ref={containerRef} className={className} style={style} />;
}