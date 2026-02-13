import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RotateCcw, Check, X, Sparkles, FlipHorizontal } from 'lucide-react';
import WoodButton from '../ui/WoodButton';

interface SelfieCaptureProps {
  isOpen: boolean;
  onCapture: (imageBase64: string) => void;
  onClose: () => void;
  childName?: string;
  /** When set, overlays this image (e.g. porthole frame) so the user frames their face in the circular window */
  frameOverlayImageUrl?: string;
}

type CaptureState = 'preview' | 'countdown' | 'captured' | 'error';

const SelfieCapture: React.FC<SelfieCaptureProps> = ({
  isOpen,
  onCapture,
  onClose,
  childName = 'there',
  frameOverlayImageUrl
}) => {
  const [state, setState] = useState<CaptureState>('preview');
  const [countdown, setCountdown] = useState(3);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for multiple cameras
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (e) {
        console.log('Could not enumerate devices');
      }
    };
    checkCameras();
  }, []);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 720 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setError(null);
      setState('preview');
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Could not access camera. Please allow camera permissions and try again.');
      setState('error');
    }
  }, [facingMode]);

  // Hide bottom nav wheel while selfie modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.setAttribute('data-modal-open', 'true');
    }
    return () => {
      document.body.removeAttribute('data-modal-open');
    };
  }, [isOpen]);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      // Cleanup when closed
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setState('preview');
      setCapturedImage(null);
      setCountdown(3);
    }
  }, [isOpen, startCamera]);

  // Handle countdown
  useEffect(() => {
    if (state === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (state === 'countdown' && countdown === 0) {
      capturePhoto();
    }
  }, [state, countdown]);

  const startCountdown = () => {
    setCountdown(3);
    setState('countdown');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Set canvas size to match video
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;

    // Calculate crop to center square
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;

    // Mirror the image for front camera
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    // Draw cropped, centered square
    ctx.drawImage(
      video,
      offsetX, offsetY, size, size,  // Source crop
      0, 0, size, size                // Destination
    );

    // Get base64 image
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageData);
    setState('captured');

    // Stop video stream to save resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const retake = async () => {
    setCapturedImage(null);
    setState('preview');
    await startCamera();
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative w-full max-w-md mx-4 bg-gradient-to-b from-[#2A1810] to-[#1A0F0A] rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="relative px-6 py-4 bg-gradient-to-r from-[#8B4513] to-[#A0522D]">
          <button
            onClick={onClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {state === 'captured' ? 'Perfect!' : `Hey ${childName}!`}
              </h2>
              <p className="text-white/80 text-sm">
                {state === 'captured' 
                  ? 'Is this photo good?' 
                  : "Let's take your picture!"}
              </p>
            </div>
          </div>
        </div>

        {/* Camera View / Captured Image */}
        <div className="relative aspect-square bg-black">
          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />

          {state === 'error' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <Camera className="w-16 h-16 text-gray-500 mb-4" />
              <p className="text-white/80 mb-4">{error}</p>
              <WoodButton onClick={startCamera}>
                Try Again
              </WoodButton>
            </div>
          ) : state === 'captured' && capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured selfie"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              
              {/* Camera overlay guide: porthole frame or default circle + corners */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {frameOverlayImageUrl ? (
                  <img
                    src={frameOverlayImageUrl}
                    alt=""
                    className="w-full h-full object-contain opacity-50"
                    aria-hidden
                  />
                ) : (
                  <>
                    <div className="absolute inset-[15%] border-4 border-white/30 rounded-full" />
                    <div className="absolute top-[10%] left-[10%] w-8 h-8 border-l-4 border-t-4 border-[#FFD700] rounded-tl-lg" />
                    <div className="absolute top-[10%] right-[10%] w-8 h-8 border-r-4 border-t-4 border-[#FFD700] rounded-tr-lg" />
                    <div className="absolute bottom-[10%] left-[10%] w-8 h-8 border-l-4 border-b-4 border-[#FFD700] rounded-bl-lg" />
                    <div className="absolute bottom-[10%] right-[10%] w-8 h-8 border-r-4 border-b-4 border-[#FFD700] rounded-br-lg" />
                  </>
                )}
              </div>

              {/* Countdown overlay */}
              {state === 'countdown' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-9xl font-bold text-[#FFD700] animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4">
          {state === 'captured' ? (
            <div className="flex gap-4">
              <button
                onClick={retake}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-bold transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Retake
              </button>
              <button
                onClick={confirmCapture}
                className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-gradient-to-r from-[#4CAF50] to-[#66BB6A] hover:from-[#43A047] hover:to-[#5CB85C] rounded-xl text-white font-bold transition-colors shadow-lg"
              >
                <Sparkles className="w-5 h-5" />
                Use This!
              </button>
            </div>
          ) : state === 'preview' || state === 'error' ? (
            <div className="flex gap-4">
              {hasMultipleCameras && (
                <button
                  onClick={switchCamera}
                  className="p-4 bg-gray-700 hover:bg-gray-600 rounded-xl text-white transition-colors"
                  title="Switch camera"
                >
                  <FlipHorizontal className="w-6 h-6" />
                </button>
              )}
              <button
                onClick={startCountdown}
                disabled={state === 'error'}
                className="flex-1 flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-[#8B4513] to-[#A0522D] hover:from-[#9B5523] hover:to-[#B0623D] disabled:opacity-50 rounded-xl text-white font-bold text-lg transition-colors shadow-lg"
              >
                <Camera className="w-6 h-6" />
                Take Photo
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[#FFD700] font-bold text-lg animate-pulse">
                Get ready... Smile! 📸
              </p>
            </div>
          )}

          {/* Tip */}
          {state !== 'captured' && (
            <p className="text-center text-white/60 text-sm">
              {frameOverlayImageUrl ? "Position your face in the porthole and smile!" : "Position your face in the circle and smile!"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelfieCapture;
