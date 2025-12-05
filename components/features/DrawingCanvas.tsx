import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Eraser, RotateCcw, Download } from 'lucide-react';

interface DrawingCanvasProps {
    prompt: string;
    backgroundImageUrl?: string;
    onComplete?: () => void;
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

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ prompt, backgroundImageUrl, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [selectedColor, setSelectedColor] = useState(CRAYON_COLORS[0].color);
    const [brushSize, setBrushSize] = useState(18); // Crayon default size
    const [isEraser, setIsEraser] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    // Track if canvas has been initialized
    const [canvasReady, setCanvasReady] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

    // Store last position for smooth drawing
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);

    // Crayon brush settings
    const CRAYON_MIN_SIZE = 10;
    const CRAYON_MAX_SIZE = 35;
    const CRAYON_OPACITY = 0.85;

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

        console.log('🎨 DrawingCanvas: Loading background image:', backgroundImageUrl);

        const img = new Image();
        // Don't use crossOrigin for GCS images - it triggers CORS requirements
        // The canvas will be "tainted" but that's fine for coloring (no export needed)

        img.onload = () => {
            console.log('🎨 DrawingCanvas: Image loaded successfully!', { width: img.width, height: img.height });
            const dpr = window.devicePixelRatio || 1;
            const canvasWidth = canvas.width / dpr;
            const canvasHeight = canvas.height / dpr;

            // Clear canvas and redraw white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Calculate aspect ratio to fit image within canvas
            const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
            const x = (canvasWidth / 2) - (img.width / 2) * scale;
            const y = (canvasHeight / 2) - (img.height / 2) * scale;

            try {
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                setImageLoaded(true);
            } catch (e) {
                console.error('🎨 DrawingCanvas: Error drawing image to canvas (likely CORS):', e);
            }
        };

        img.onerror = (err) => {
            console.error('🎨 DrawingCanvas: Failed to load image:', backgroundImageUrl, err);
        };

        img.src = backgroundImageUrl;
    }, [canvasReady, backgroundImageUrl]);

    // Apply crayon stroke style
    const applyCrayonStyle = useCallback((ctx: CanvasRenderingContext2D) => {
        ctx.globalAlpha = CRAYON_OPACITY;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [CRAYON_OPACITY]);

    // Draw with crayon texture effect
    const drawWithCrayonTexture = useCallback((
        ctx: CanvasRenderingContext2D,
        fromX: number,
        fromY: number,
        toX: number,
        toY: number,
        size: number,
        color: string
    ) => {
        // Crayon effect - draw multiple offset dots for waxy texture
        const distance = Math.sqrt((toX - fromX) ** 2 + (toY - fromY) ** 2);
        const steps = Math.max(Math.floor(distance / 2), 1);

        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const x = fromX + (toX - fromX) * t;
            const y = fromY + (toY - fromY) * t;

            // Add slight random offset for waxy texture
            const jitter = size * 0.15;
            const offsetX = (Math.random() - 0.5) * jitter;
            const offsetY = (Math.random() - 0.5) * jitter;

            ctx.beginPath();
            ctx.arc(x + offsetX, y + offsetY, size / 2 * (0.8 + Math.random() * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
    }, []);

    const getCoordinates = useCallback((e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        // Handle both React synthetic events and native DOM events
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Since we scaled the context by devicePixelRatio, coordinates should be in CSS pixels
        // which is what we get from getBoundingClientRect
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    }, []);

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
        }
    }, [isDrawing]);

    const handleMouseLeave = useCallback(() => {
        stopDrawing();
    }, [stopDrawing]);

    // Add non-passive event listeners for touch to prevent scrolling while drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (e: TouchEvent) => startDrawing(e as any);
        const handleTouchMove = (e: TouchEvent) => draw(e as any);
        const handleTouchEnd = () => stopDrawing();

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }, [startDrawing, draw, stopDrawing]);


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

        // Redraw background image if provided
        if (backgroundImageUrl) {
            const img = new Image();
            img.src = backgroundImageUrl;
            img.onload = () => {
                const scale = Math.min(canvasWidth / img.width, canvasHeight / img.height);
                const x = (canvasWidth / 2) - (img.width / 2) * scale;
                const y = (canvasHeight / 2) - (img.height / 2) * scale;

                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
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
        <div className="flex flex-col h-full min-h-0">
            {/* Prompt */}
            <div className="mb-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg">
                <p className="text-white text-sm md:text-base font-semibold">{prompt}</p>
            </div>

            {/* Canvas Container */}
            <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-lg mb-2 relative min-h-0">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full touch-none cursor-crosshair"
                    style={{ minHeight: '250px' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={handleMouseLeave}
                />
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
        </div>
    );
};

export default DrawingCanvas;
