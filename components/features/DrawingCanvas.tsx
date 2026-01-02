import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Eraser, RotateCcw, Download, Save, ZoomIn, ZoomOut, Move, X, HelpCircle } from 'lucide-react';

interface DrawingCanvasProps {
    prompt: string;
    backgroundImageUrl?: string;
    onComplete?: () => void;
    // If true, use layered mode (lines on top, coloring underneath)
    layeredMode?: boolean;
    // Unique key for saving/loading progress (e.g., "book-123-page-5")
    saveKey?: string;
    // If true, show the tutorial overlay for first-time users (default: true)
    enableTutorial?: boolean;
}

// Exposed methods via ref
export interface DrawingCanvasRef {
    captureScreenshot: () => Promise<string | null>;
}

// Crayon colors - arranged like a real crayon box
const CRAYON_COLORS = [
    { name: 'Red', color: '#E74C3C' },
    { name: 'Orange', color: '#F39C12' },
    { name: 'Yellow', color: '#F1C40F' },
    { name: 'Green', color: '#27AE60' },
    { name: 'Blue', color: '#3498DB' },
    { name: 'Purple', color: '#9B59B6' },
    { name: 'Pink', color: '#E91E63' },
    { name: 'Brown', color: '#795548' },
    { name: 'Teal', color: '#00BCD4' },
    { name: 'Lime', color: '#8BC34A' },
    { name: 'Sky Blue', color: '#87CEEB' },
    { name: 'Peach', color: '#FFAB91' },
    { name: 'Black', color: '#2C3E50' },
    { name: 'Gray', color: '#95A5A6' },
    { name: 'White', color: '#ECF0F1' },
];

// Crayon SVG component
const CrayonIcon: React.FC<{ color: string; isSelected: boolean; onClick: () => void }> = ({ color, isSelected, onClick }) => (
    <button
        onClick={onClick}
        className={`relative transition-all duration-200 ${isSelected ? 'scale-125 -translate-y-2 z-10' : 'hover:scale-110 hover:-translate-y-1'}`}
        style={{ filter: isSelected ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' : 'none' }}
    >
        <svg width="28" height="60" viewBox="0 0 28 60" className="drop-shadow-md">
            {/* Crayon tip */}
            <polygon 
                points="14,0 6,12 22,12" 
                fill={color}
                style={{ filter: 'brightness(0.85)' }}
            />
            {/* Crayon body */}
            <rect x="6" y="12" width="16" height="40" fill={color} rx="1" />
            {/* Wrapper/Label */}
            <rect x="6" y="30" width="16" height="18" fill="#1a1a1a" opacity="0.9" rx="1" />
            {/* Paper texture lines */}
            <line x1="6" y1="35" x2="22" y2="35" stroke="#333" strokeWidth="0.5" />
            <line x1="6" y1="40" x2="22" y2="40" stroke="#333" strokeWidth="0.5" />
            {/* Highlight on crayon */}
            <rect x="8" y="14" width="3" height="14" fill="white" opacity="0.3" rx="1" />
            {/* Bottom */}
            <rect x="6" y="52" width="16" height="8" fill={color} rx="2" />
        </svg>
        {isSelected && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
        )}
    </button>
);

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({ prompt, backgroundImageUrl, onComplete, layeredMode = true, saveKey, enableTutorial = true }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Expose captureScreenshot method via ref
    useImperativeHandle(ref, () => ({
        captureScreenshot: async (): Promise<string | null> => {
            const zoomContainer = zoomContainerRef.current;
            if (!zoomContainer) return null;
            
            try {
                // Dynamically import html2canvas
                const html2canvas = (await import('html2canvas')).default;
                
                // Temporarily reset zoom/pan for the screenshot so we capture the full artwork
                const originalTransform = zoomContainer.style.transform;
                const originalTransition = zoomContainer.style.transition;
                zoomContainer.style.transition = 'none';
                zoomContainer.style.transform = 'scale(1) translate(0px, 0px)';
                
                // Wait a frame for the style to apply
                await new Promise(resolve => requestAnimationFrame(resolve));
                
                // Take literal screenshot of what's on screen
                const screenshot = await html2canvas(zoomContainer, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#FFFFFF',
                    scale: 2, // Higher quality
                    logging: false,
                });
                
                // Restore original zoom/pan
                zoomContainer.style.transform = originalTransform;
                zoomContainer.style.transition = originalTransition;
                
                console.log('📸 Screenshot captured!');
                return screenshot.toDataURL('image/jpeg', 0.92);
            } catch (err) {
                console.error('📸 Screenshot capture failed:', err);
                return null;
            }
        }
    }), []);
    const [isDrawing, setIsDrawing] = useState(false);
    const [selectedColor, setSelectedColor] = useState(CRAYON_COLORS[0].color);
    const [brushSize, setBrushSize] = useState(18); // Crayon default size
    const [isEraser, setIsEraser] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    
    // Zoom/Pan state
    const [zoomMode, setZoomMode] = useState(false);
    const [scale, setScale] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const lastPinchDistanceRef = useRef<number | null>(null);
    const lastPanPosRef = useRef<{ x: number; y: number } | null>(null);
    const zoomContainerRef = useRef<HTMLDivElement>(null);
    
    // Tutorial overlay state
    const [showTutorial, setShowTutorial] = useState(false);
    
    // Show tutorial for first-time users (only if enableTutorial is true)
    useEffect(() => {
        if (!enableTutorial) return; // Skip tutorial in lessons
        
        const hasSeenTutorial = localStorage.getItem('godlykids_coloring_tutorial_seen');
        if (!hasSeenTutorial) {
            // Small delay so the canvas loads first
            const timer = setTimeout(() => {
                setShowTutorial(true);
                localStorage.setItem('godlykids_coloring_tutorial_seen', 'true');
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [enableTutorial]);

    // Track if canvas has been initialized
    const [canvasReady, setCanvasReady] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    
    // Store processed line art for layered mode
    const [processedLineArt, setProcessedLineArt] = useState<string | null>(null);
    const [isProcessingImage, setIsProcessingImage] = useState(false);
    
    // Auto-save state
    const [hasSavedProgress, setHasSavedProgress] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Store last position for smooth drawing
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    // Crayon brush settings
    const CRAYON_MIN_SIZE = 10;
    const CRAYON_MAX_SIZE = 35;
    // Higher opacity in layered mode since lines stay on top
    const CRAYON_OPACITY = layeredMode ? 0.7 : 0.3;
    
    // Storage key for this coloring page
    const STORAGE_PREFIX = 'godlykids_coloring_';
    const storageKey = saveKey ? `${STORAGE_PREFIX}${saveKey}` : null;

    // Process image to extract line art (remove white background, keep dark lines)
    // Falls back to original image if CORS blocks pixel access
    const processImageForLayeredMode = useCallback((imageUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    // Create temporary canvas for processing
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = img.width;
                    tempCanvas.height = img.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    if (!tempCtx) {
                        console.log('🎨 Could not get canvas context, using original image');
                        resolve(imageUrl);
                        return;
                    }
                    
                    // Draw image
                    tempCtx.drawImage(img, 0, 0);
                    
                    // Try to get image data - this will fail if CORS blocks it
                    let imageData;
                    try {
                        imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    } catch (corsError) {
                        // CORS blocked pixel access - use original with CSS blend mode instead
                        console.log('🎨 CORS blocked pixel access, using CSS multiply blend mode instead');
                        resolve(imageUrl);
                        return;
                    }
                    
                    const data = imageData.data;
                    
                    // Process each pixel: make white/light pixels transparent, keep dark pixels
                    for (let i = 0; i < data.length; i += 4) {
                        const r = data[i];
                        const g = data[i + 1];
                        const b = data[i + 2];
                        
                        // Calculate brightness (0-255)
                        const brightness = (r + g + b) / 3;
                        
                        // If pixel is light (brightness > 200), make it transparent
                        // Keep dark pixels (lines) visible
                        if (brightness > 200) {
                            data[i + 3] = 0; // Set alpha to 0 (transparent)
                        } else {
                            // For darker pixels, set to black with some transparency based on darkness
                            data[i] = 0;     // R
                            data[i + 1] = 0; // G
                            data[i + 2] = 0; // B
                            // Alpha based on how dark the pixel is (darker = more opaque)
                            data[i + 3] = Math.min(255, (255 - brightness) * 2);
                        }
                    }
                    
                    // Put processed data back
                    tempCtx.putImageData(imageData, 0, 0);
                    
                    // Convert to data URL
                    console.log('🎨 Line art processed successfully');
                    resolve(tempCanvas.toDataURL('image/png'));
                } catch (err) {
                    console.log('🎨 Error processing line art, using original:', err);
                    resolve(imageUrl);
                }
            };
            
            img.onerror = () => {
                console.log('🎨 Could not load image for line art processing, using original');
                resolve(imageUrl); // Fall back to original image
            };
            
            img.src = imageUrl;
        });
    }, []);

    // Save canvas progress to localStorage
    const saveProgress = useCallback(() => {
        if (!storageKey || !canvasRef.current) return;
        
        try {
            const canvas = canvasRef.current;
            const dataUrl = canvas.toDataURL('image/png');
            localStorage.setItem(storageKey, dataUrl);
            setLastSaved(new Date());
            setHasSavedProgress(true);
            console.log('🎨 Coloring progress saved:', storageKey);
        } catch (e) {
            console.error('🎨 Error saving coloring progress:', e);
        }
    }, [storageKey]);

    // Load saved canvas progress from localStorage
    const loadProgress = useCallback(() => {
        if (!storageKey || !canvasRef.current) return false;
        
        const savedData = localStorage.getItem(storageKey);
        if (!savedData) return false;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const img = new Image();
        img.onload = () => {
            const dpr = window.devicePixelRatio || 1;
            const canvasWidth = canvas.width / dpr;
            const canvasHeight = canvas.height / dpr;
            
            // Draw saved progress
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            setHasSavedProgress(true);
            console.log('🎨 Coloring progress loaded:', storageKey);
        };
        img.src = savedData;
        return true;
    }, [storageKey]);

    // Auto-save after drawing stops (debounced)
    const scheduleAutoSave = useCallback(() => {
        if (!storageKey) return;
        
        // Clear any pending save
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        // Schedule save after 1 second of inactivity
        saveTimeoutRef.current = setTimeout(() => {
            saveProgress();
        }, 1000);
    }, [storageKey, saveProgress]);

    // Cleanup auto-save timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            // Set actual size in memory (scaled for device pixel ratio)
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            // Scale the drawing context to account for device pixel ratio
            ctx.scale(dpr, dpr);

            // Set display size (CSS pixels)
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';

            // Fill with white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, rect.width, rect.height);
        };

        resizeCanvas();
        setCanvasReady(true);

        // Handle window resize
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    // Load background image when URL changes or canvas is ready
    useEffect(() => {
        if (!canvasReady || !backgroundImageUrl) {
            console.log('🎨 DrawingCanvas: Waiting for canvas or no image URL', { canvasReady, backgroundImageUrl });
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        console.log('🎨 DrawingCanvas: Loading background image:', backgroundImageUrl, 'Layered mode:', layeredMode);

        if (layeredMode) {
            // In layered mode, process image to extract lines and use as overlay
            setIsProcessingImage(true);
            
            processImageForLayeredMode(backgroundImageUrl)
                .then((processedUrl) => {
                    console.log('🎨 DrawingCanvas: Line art processed for layered mode');
                    setProcessedLineArt(processedUrl);
                    setImageLoaded(true);
                    setIsProcessingImage(false);
                })
                .catch((err) => {
                    console.error('🎨 DrawingCanvas: Error processing image:', err);
                    // Fall back to using original image as overlay
                    setProcessedLineArt(backgroundImageUrl);
                    setImageLoaded(true);
                    setIsProcessingImage(false);
                });
        } else {
            // Original behavior: draw image directly on canvas
            const img = new Image();
            
            img.onload = () => {
                console.log('🎨 DrawingCanvas: Image loaded successfully!', { width: img.width, height: img.height });
                const dpr = window.devicePixelRatio || 1;
                const canvasWidth = canvas.width / dpr;
                const canvasHeight = canvas.height / dpr;

                // Clear canvas and redraw white background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                // Calculate scale to fit entire image within canvas (contain mode)
                const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                
                // Center both horizontally and vertically
                const x = (canvasWidth - scaledWidth) / 2;
                const y = (canvasHeight - scaledHeight) / 2;

                try {
                    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
                    setImageLoaded(true);
                } catch (e) {
                    console.error('🎨 DrawingCanvas: Error drawing image to canvas (likely CORS):', e);
                }
            };

            img.onerror = (err) => {
                console.error('🎨 DrawingCanvas: Failed to load image:', backgroundImageUrl, err);
            };

            img.src = backgroundImageUrl;
        }
    }, [canvasReady, backgroundImageUrl, layeredMode, processImageForLayeredMode]);

    // Load saved progress after canvas and image are ready
    useEffect(() => {
        if (!canvasReady || !storageKey) return;
        
        // In layered mode, wait for image processing to complete
        // In non-layered mode, wait for image to load
        if (layeredMode && !processedLineArt) return;
        if (!layeredMode && backgroundImageUrl && !imageLoaded) return;
        
        // Small delay to ensure canvas is fully rendered
        const loadTimeout = setTimeout(() => {
            loadProgress();
        }, 100);
        
        return () => clearTimeout(loadTimeout);
    }, [canvasReady, storageKey, layeredMode, processedLineArt, imageLoaded, backgroundImageUrl, loadProgress]);

    // Apply crayon stroke style
    const applyCrayonStyle = useCallback((ctx: CanvasRenderingContext2D) => {
        ctx.globalAlpha = CRAYON_OPACITY;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [CRAYON_OPACITY]);

    // Draw with crayon texture effect - 30% transparent so lines clearly show through
    const drawWithCrayonTexture = useCallback((
        ctx: CanvasRenderingContext2D,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        size: number,
        color: string
    ) => {
        // Convert color to rgba with 50% opacity
        const getRGBA = (hexOrName: string) => {
            // Create temp element to resolve color
            const temp = document.createElement('div');
            temp.style.color = hexOrName;
            document.body.appendChild(temp);
            const computed = getComputedStyle(temp).color;
            document.body.removeChild(temp);
            // Extract rgb values
            const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (match) {
                return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${CRAYON_OPACITY})`;
            }
            return `rgba(0, 0, 0, ${CRAYON_OPACITY})`;
        };
        
        const transparentColor = getRGBA(color);
        
        // Simpler crayon effect - single stroke with transparency
        ctx.globalAlpha = 1; // We bake alpha into the color instead
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = size;
        ctx.strokeStyle = transparentColor;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();
    }, [CRAYON_OPACITY]);

    const getCoordinates = useCallback((e: any) => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return { x: 0, y: 0 };

        // Handle both React synthetic events and native DOM events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // When NOT zoomed (scale === 1 and no pan), use simple direct coordinates
        // This ensures no shift when zoom mode is toggled
        if (scale === 1 && panOffset.x === 0 && panOffset.y === 0) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: clientX - rect.left,
                y: clientY - rect.top,
            };
        }

        // When zoomed, we need to convert screen coordinates to canvas coordinates
        const containerRect = container.getBoundingClientRect();
        
        // Get position relative to container center (since transformOrigin is center)
        const containerCenterX = containerRect.width / 2;
        const containerCenterY = containerRect.height / 2;
        
        // Position relative to container
        const relX = clientX - containerRect.left;
        const relY = clientY - containerRect.top;
        
        // Convert from screen space to canvas space
        // Account for scale and pan offset
        const canvasX = (relX - containerCenterX - panOffset.x) / scale + containerCenterX;
        const canvasY = (relY - containerCenterY - panOffset.y) / scale + containerCenterY;

        return {
            x: canvasX,
            y: canvasY,
        };
    }, [scale, panOffset]);

    const startDrawing = useCallback((e: any) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e);
        lastPosRef.current = { x, y };

        setIsDrawing(true);

        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = 1;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            applyCrayonStyle(ctx);
            ctx.strokeStyle = selectedColor;
        }
        ctx.lineWidth = brushSize;

        // Draw a dot at start position for crayon texture
        if (!isEraser) {
            ctx.beginPath();
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = selectedColor;
            ctx.fill();
        }
    }, [getCoordinates, isEraser, selectedColor, brushSize, applyCrayonStyle]);

    const draw = useCallback((e: any) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        if (!isDrawing) return;

        const { x, y } = getCoordinates(e);

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const lastPos = lastPosRef.current || { x, y };

        if (isEraser) {
            ctx.beginPath();
            ctx.moveTo(lastPos.x, lastPos.y);
            ctx.lineTo(x, y);
            ctx.stroke();
        } else {
            drawWithCrayonTexture(ctx, lastPos.x, lastPos.y, x, y, brushSize, selectedColor);
        }

        lastPosRef.current = { x, y };
    }, [getCoordinates, isDrawing, isEraser, brushSize, selectedColor, drawWithCrayonTexture]);

    const stopDrawing = useCallback(() => {
        if (isDrawing) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = 1;
                }
            }
            setIsDrawing(false);
            lastPosRef.current = null;
            
            // Schedule auto-save after drawing stops
            scheduleAutoSave();
        }
    }, [isDrawing, scheduleAutoSave]);

    const handleMouseLeave = useCallback(() => {
        stopDrawing();
    }, [stopDrawing]);

    // Calculate distance between two touch points (for pinch zoom)
    const getTouchDistance = useCallback((touches: TouchList) => {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }, []);

    // Get center point between two touches
    const getTouchCenter = useCallback((touches: TouchList) => {
        if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }, []);

    // Add non-passive event listeners for touch to prevent scrolling while drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (e: TouchEvent) => {
            // In zoom mode: disable drawing, use touches for panning/zooming only
            if (zoomMode) {
                e.preventDefault();
                
                if (e.touches.length === 2) {
                    // Two fingers: pinch to zoom
                    lastPinchDistanceRef.current = getTouchDistance(e.touches);
                    const center = getTouchCenter(e.touches);
                    lastPanPosRef.current = center;
                } else if (e.touches.length === 1) {
                    // Single finger: pan (NO drawing in zoom mode)
                    lastPanPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                setIsPanning(true);
                return;
            }
            
            // Normal mode: Single finger draws
            if (e.touches.length === 1) {
                startDrawing(e as any);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            // In zoom mode: handle pan/zoom only (no drawing)
            if (zoomMode) {
                e.preventDefault();
                
                if (e.touches.length === 2) {
                    // Two fingers: pinch zoom AND pan simultaneously
                    const newDistance = getTouchDistance(e.touches);
                    if (lastPinchDistanceRef.current) {
                        const scaleDelta = newDistance / lastPinchDistanceRef.current;
                        setScale(prev => Math.min(4, Math.max(1, prev * scaleDelta)));
                    }
                    lastPinchDistanceRef.current = newDistance;

                    // Pan while pinching
                    const center = getTouchCenter(e.touches);
                    if (lastPanPosRef.current) {
                        const dx = center.x - lastPanPosRef.current.x;
                        const dy = center.y - lastPanPosRef.current.y;
                        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                    }
                    lastPanPosRef.current = center;
                } else if (e.touches.length === 1 && lastPanPosRef.current) {
                    // Single finger: pan only (NO drawing in zoom mode)
                    const dx = e.touches[0].clientX - lastPanPosRef.current.x;
                    const dy = e.touches[0].clientY - lastPanPosRef.current.y;
                    setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                    lastPanPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                return;
            }

            // Normal mode: Single finger draws
            if (e.touches.length === 1 && !isPanning) {
                draw(e as any);
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (e.touches.length === 0) {
                lastPinchDistanceRef.current = null;
                lastPanPosRef.current = null;
                setIsPanning(false);
                if (!zoomMode) {
                    stopDrawing();
                }
            } else if (e.touches.length === 1) {
                // Went from 2 fingers to 1
                lastPinchDistanceRef.current = null;
                lastPanPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        };

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }, [startDrawing, draw, stopDrawing, zoomMode, scale, isPanning, getTouchDistance, getTouchCenter]);

    // Reset zoom when zoom mode is turned off
    const resetZoom = useCallback(() => {
        setScale(1);
        setPanOffset({ x: 0, y: 0 });
    }, []);

    // Toggle zoom mode - canvas stays at current zoom/pan position when exiting
    const toggleZoomMode = useCallback(() => {
        // Don't reset zoom when toggling off - keep the view as is
        // User can draw at the zoomed position
        setZoomMode(!zoomMode);
    }, [zoomMode]);


    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const canvasWidth = canvas.width / dpr;
        const canvasHeight = canvas.height / dpr;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Clear saved progress
        if (storageKey) {
            localStorage.removeItem(storageKey);
            setHasSavedProgress(false);
            setLastSaved(null);
            console.log('🎨 Coloring progress cleared:', storageKey);
        }

        // In layered mode, don't redraw background (lines are in overlay)
        // In non-layered mode, redraw background image if provided
        if (!layeredMode && backgroundImageUrl) {
            const img = new Image();
            img.src = backgroundImageUrl;
            img.onload = () => {
                // Use contain mode scaling (fit entire image)
                const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
                const scaledWidth = img.width * scale;
                const scaledHeight = img.height * scale;
                const x = (canvasWidth - scaledWidth) / 2;
                const y = (canvasHeight - scaledHeight) / 2;

                ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            };
        }
    };

    const downloadDrawing = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const link = document.createElement('a');
        link.download = 'my-drawing.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    return (
        <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-[#3E1F07] to-[#5c2e0b] p-3 rounded-xl">
            {/* Canvas Container - Layered structure with zoom support */}
            <div 
                ref={containerRef}
                className="flex-1 bg-white rounded-lg overflow-hidden shadow-lg mb-2 relative min-h-0"
                style={{ maxHeight: 'calc(100% - 200px)' }} /* Leave room for crayons & tools */
            >
                {/* Zoom indicator */}
                {zoomMode && (
                    <div className="absolute top-2 left-2 z-30 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <ZoomIn size={12} />
                        <span>{Math.round(scale * 100)}%</span>
                        {scale > 1 && (
                            <button 
                                onClick={resetZoom}
                                className="ml-1 bg-white/20 rounded-full p-0.5 hover:bg-white/40"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>
                )}

                {/* Zoomable/Pannable Container */}
                <div
                    ref={zoomContainerRef}
                    className="absolute inset-0"
                    style={{
                        transform: `scale(${scale}) translate(${panOffset.x / scale}px, ${panOffset.y / scale}px)`,
                        transformOrigin: 'center center',
                        transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                    }}
                >
                    {/* Bottom Layer: Drawing Canvas (user colors here) */}
                    <canvas
                        ref={canvasRef}
                        className={`absolute inset-0 w-full h-full touch-none ${zoomMode ? 'cursor-move' : 'cursor-crosshair'}`}
                        onMouseDown={zoomMode ? undefined : startDrawing}
                        onMouseMove={zoomMode ? undefined : draw}
                        onMouseUp={zoomMode ? undefined : stopDrawing}
                        onMouseLeave={zoomMode ? undefined : handleMouseLeave}
                    />
                    
                    {/* Top Layer: Line art overlay (in layered mode) */}
                    {layeredMode && processedLineArt && (
                        <img
                            ref={overlayRef}
                            src={processedLineArt}
                            alt="Coloring lines"
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{ 
                                zIndex: 10,
                                mixBlendMode: 'multiply', // Makes white transparent, keeps black lines
                                // No objectFit - stretch to fill same as canvas for perfect alignment
                            }}
                        />
                    )}
                </div>
                
                {/* Loading indicator */}
                {isProcessingImage && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[#5c2e0b] font-bold text-sm">Preparing coloring page...</span>
                        </div>
                    </div>
                )}
                
                {/* Zoom Mode Hint - inside container so it doesn't affect layout */}
                {zoomMode && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 text-xs text-white bg-black/70 rounded-full py-1.5 px-3 z-30 pointer-events-none whitespace-nowrap">
                        <Move size={14} />
                        <span>
                            Move with finger • Pinch to zoom • Tap 🔍 to draw
                        </span>
                    </div>
                )}
                
                {/* Auto-save Status - inside container so it doesn't affect layout */}
                {storageKey && !zoomMode && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 text-xs z-30 pointer-events-none">
                        {lastSaved ? (
                            <span className="text-green-600 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1 shadow">
                                <Save size={12} />
                                Saved
                            </span>
                        ) : hasSavedProgress ? (
                            <span className="text-blue-600 bg-white/90 rounded-full px-3 py-1 flex items-center gap-1 shadow">
                                <Save size={12} />
                                Restored
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Crayon Box - Looks like a real crayon set */}
            <div className="mb-3 bg-gradient-to-b from-[#5D4037] to-[#3E2723] rounded-xl p-3 shadow-lg border-2 border-[#8D6E63]">
                {/* Crayon box lid effect */}
                <div className="absolute -top-1 left-4 right-4 h-2 bg-gradient-to-b from-[#8D6E63] to-[#5D4037] rounded-t-lg" />
                
                {/* Crayons arranged in rows like a real box */}
                <div className="flex flex-wrap justify-center gap-1 pb-2" style={{ perspective: '500px' }}>
                    {CRAYON_COLORS.map((crayon) => (
                        <CrayonIcon
                            key={crayon.color}
                            color={crayon.color}
                            isSelected={selectedColor === crayon.color && !isEraser}
                            onClick={() => {
                                setSelectedColor(crayon.color);
                                setIsEraser(false);
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Tools Row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Brush Size */}
                <div className="flex items-center gap-2 flex-1 min-w-[100px]">
                    <span className="text-white/70 text-xs">Size:</span>
                    <input
                        type="range"
                        min={CRAYON_MIN_SIZE}
                        max={CRAYON_MAX_SIZE}
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="flex-1 accent-[#FFD700]"
                    />
                    <div
                        className="rounded-full"
                        style={{
                            width: Math.max(10, brushSize / 2),
                            height: Math.max(10, brushSize / 2),
                            backgroundColor: selectedColor,
                            border: selectedColor === '#ECF0F1' ? '2px solid #ccc' : 'none',
                        }}
                    />
                </div>

                {/* Tool Buttons */}
                <div className="flex items-center gap-1.5">
                    {/* Help/Tutorial */}
                    <button
                        onClick={() => setShowTutorial(true)}
                        className="p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-all"
                        title="Help"
                    >
                        <HelpCircle className="w-5 h-5" />
                    </button>
                    
                    {/* Zoom Toggle */}
                    <button
                        onClick={toggleZoomMode}
                        className={`p-2 rounded-lg transition-all ${zoomMode
                            ? 'bg-[#4CAF50] text-white shadow-lg'
                            : 'bg-white/15 text-white hover:bg-white/25'
                            }`}
                        title={zoomMode ? "Exit Zoom Mode - Start Drawing" : "Enable Zoom Mode - Move Canvas"}
                    >
                        {zoomMode ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
                    </button>

                    {/* Eraser */}
                    <button
                        onClick={() => setIsEraser(!isEraser)}
                        className={`p-2 rounded-lg transition-all ${isEraser
                            ? 'bg-[#FFD700] text-black shadow-lg'
                            : 'bg-white/15 text-white hover:bg-white/25'
                            }`}
                        title="Eraser"
                    >
                        <Eraser className="w-5 h-5" />
                    </button>

                    {/* Clear */}
                    <button
                        onClick={clearCanvas}
                        className="p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-all"
                        title="Start Over"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>

                    {/* Download */}
                    <button
                        onClick={downloadDrawing}
                        className="p-2 rounded-lg bg-white/15 text-white hover:bg-white/25 transition-all"
                        title="Save Drawing"
                    >
                        <Download className="w-5 h-5" />
                    </button>
                </div>
            </div>



            {/* Complete Button */}
            {!isCompleted && onComplete && (
                <button
                    onClick={() => {
                        setIsCompleted(true);
                        onComplete();
                    }}
                    className="mt-3 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black px-6 py-3 rounded-xl font-bold w-full hover:shadow-lg hover:scale-[1.02] transition-all active:scale-95"
                >
                    🖍️ I'm Done Coloring!
                </button>
            )}

            {/* Completion Message */}
            {isCompleted && (
                <div className="mt-3 bg-green-500/20 backdrop-blur-sm border-2 border-green-400 rounded-xl p-3 text-center animate-in fade-in zoom-in duration-300">
                    <p className="text-white font-bold text-lg mb-1">🌟 Amazing Artwork!</p>
                    <p className="text-white/80 text-sm">You did a wonderful job!</p>
                </div>
            )}
            
            {/* Tutorial Overlay Modal */}
            {showTutorial && (
                <div 
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowTutorial(false)}
                >
                    <div 
                        className="bg-gradient-to-b from-[#3E1F07] to-[#5c2e0b] rounded-2xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl border-2 border-[#8D6E63]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-white font-bold text-xl flex items-center gap-2">
                                🎨 How to Color
                            </h2>
                            <button 
                                onClick={() => setShowTutorial(false)}
                                className="p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        
                        {/* Tutorial Items */}
                        <div className="space-y-4">
                            {/* Crayons */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="text-3xl">🖍️</div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Pick a Crayon</h3>
                                    <p className="text-white/80 text-xs">Tap any crayon to choose a color. The selected crayon pops up!</p>
                                </div>
                            </div>
                            
                            {/* Zoom */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <ZoomIn className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Zoom Mode</h3>
                                    <p className="text-white/80 text-xs">
                                        <span className="text-green-400 font-semibold">ON:</span> Use 1 finger to move around, 2 fingers to pinch-zoom. <span className="italic">Drawing is paused!</span>
                                    </p>
                                    <p className="text-white/80 text-xs mt-1">
                                        <span className="text-yellow-400 font-semibold">OFF:</span> Draw at your zoomed position. Canvas stays where you placed it.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Eraser */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <Eraser className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Eraser</h3>
                                    <p className="text-white/80 text-xs">Remove colors you don't want. Turns yellow when active.</p>
                                </div>
                            </div>
                            
                            {/* Start Over */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <RotateCcw className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Start Over</h3>
                                    <p className="text-white/80 text-xs">Clear everything and begin fresh with a blank page.</p>
                                </div>
                            </div>
                            
                            {/* Download */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <Download className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Save Your Art</h3>
                                    <p className="text-white/80 text-xs">Download your masterpiece to your device!</p>
                                </div>
                            </div>
                            
                            {/* Size Slider */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="text-3xl">📏</div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Brush Size</h3>
                                    <p className="text-white/80 text-xs">Slide left for thin lines, right for thick strokes.</p>
                                </div>
                            </div>
                            
                            {/* Auto-save */}
                            <div className="bg-white/10 rounded-xl p-3 flex items-start gap-3">
                                <div className="bg-white/20 p-2 rounded-lg">
                                    <Save className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[#FFD700] font-bold text-sm">Auto-Save</h3>
                                    <p className="text-white/80 text-xs">Your progress saves automatically! Come back anytime to continue.</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Got it button */}
                        <button
                            onClick={() => setShowTutorial(false)}
                            className="mt-5 w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black py-3 rounded-xl font-bold hover:shadow-lg transition-all active:scale-95"
                        >
                            Got it! Let's Color! 🎨
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;
