import React, { useRef, useEffect, useState } from 'react';
import { Eraser, RotateCcw, Download } from 'lucide-react';

interface DrawingCanvasProps {
    prompt: string;
    backgroundImageUrl?: string;
    onComplete?: () => void;
}

const CRAYON_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Orange
    '#52BE80', // Green
    '#E74C3C', // Dark Red
    '#8E44AD', // Dark Purple
    '#000000', // Black
    '#FFFFFF', // White
];

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ prompt, backgroundImageUrl, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [selectedColor, setSelectedColor] = useState(CRAYON_COLORS[0]);
    const [brushSize, setBrushSize] = useState(8);
    const [isEraser, setIsEraser] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    // Track if canvas has been initialized
    const [canvasReady, setCanvasReady] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);

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

        // Set line properties
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

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

    // Add non-passive event listeners for touch to prevent scrolling while drawing
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleTouchStart = (e: TouchEvent) => startDrawing(e as any);
        const handleTouchMove = (e: TouchEvent) => draw(e as any);
        const handleTouchEnd = (e: TouchEvent) => stopDrawing();

        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd);

        return () => {
            canvas.removeEventListener('touchstart', handleTouchStart);
            canvas.removeEventListener('touchmove', handleTouchMove);
            canvas.removeEventListener('touchend', handleTouchEnd);
        };
    }); // Re-bind on every render to capture latest state/closures

    const getCoordinates = (e: any) => {
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
    };

    const startDrawing = (e: any) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e);

        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);

        if (isEraser) {
            ctx.globalCompositeOperation = 'destination-out';
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = selectedColor;
        }
        ctx.lineWidth = brushSize;
    };

    const draw = (e: any) => {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { x, y } = getCoordinates(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
            setIsDrawing(false);
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Redraw background image if provided
        if (backgroundImageUrl) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = backgroundImageUrl;
            img.onload = () => {
                const dpr = window.devicePixelRatio || 1;
                const canvasWidth = canvas.width / dpr;
                const canvasHeight = canvas.height / dpr;
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
            <div className="mb-3 p-3 bg-white/10 backdrop-blur-sm rounded-lg">
                <p className="text-white text-base md:text-lg font-semibold">{prompt}</p>
            </div>

            {/* Canvas */}
            <div className="flex-1 bg-white rounded-lg overflow-hidden shadow-lg mb-3 relative min-h-0">
                <canvas
                    ref={canvasRef}
                    className="w-full h-full touch-none cursor-crosshair"
                    style={{ minHeight: '300px' }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
            </div>

            {/* Crayon Palette */}
            <div className="mb-3">
                <div className="flex flex-wrap gap-2 justify-center">
                    {CRAYON_COLORS.map((color) => (
                        <button
                            key={color}
                            onClick={() => {
                                setSelectedColor(color);
                                setIsEraser(false);
                            }}
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all ${selectedColor === color && !isEraser
                                ? 'border-[#FFD700] scale-110 shadow-lg ring-2 ring-[#FFD700]'
                                : 'border-white/30 hover:scale-105'
                                }`}
                            style={{ backgroundColor: color }}
                            title={color}
                        />
                    ))}
                </div>
            </div>

            {/* Tools */}
            <div className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
                {/* Brush Size */}
                <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                    <span className="text-white/70 text-xs md:text-sm">Size:</span>
                    <input
                        type="range"
                        min="4"
                        max="20"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        className="flex-1"
                    />
                    <span className="text-white text-xs md:text-sm w-6 md:w-8">{brushSize}</span>
                </div>

                {/* Tool Buttons */}
                <div className="flex items-center gap-2">
                    {/* Eraser */}
                    <button
                        onClick={() => setIsEraser(!isEraser)}
                        className={`p-2 rounded-lg transition-all ${isEraser
                            ? 'bg-[#FFD700] text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                        title="Eraser"
                    >
                        <Eraser className="w-4 h-4 md:w-5 md:h-5" />
                    </button>

                    {/* Clear */}
                    <button
                        onClick={clearCanvas}
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                        title="Clear Canvas"
                    >
                        <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                    </button>

                    {/* Download */}
                    <button
                        onClick={downloadDrawing}
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
                        title="Save Drawing"
                    >
                        <Download className="w-4 h-4 md:w-5 md:h-5" />
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
                    className="mt-4 bg-[#FFD700] text-black px-6 py-3 rounded-lg font-semibold w-full hover:bg-[#FFC700] transition-colors shadow-lg"
                >
                    ✏️ I'm Done Drawing!
                </button>
            )}

            {/* Completion Message */}
            {isCompleted && (
                <div className="mt-4 bg-green-500/20 backdrop-blur-sm border-2 border-green-400 rounded-lg p-4 text-center">
                    <p className="text-white font-semibold text-lg mb-2">🎨 Great job!</p>
                    <p className="text-white/80 text-sm">Your drawing has been saved!</p>
                </div>
            )}
        </div>
    );
};

export default DrawingCanvas;

