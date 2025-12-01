import React, { useRef, useEffect, useState } from 'react';
import { Eraser, RotateCcw, Download } from 'lucide-react';

interface DrawingCanvasProps {
    prompt: string;
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

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ prompt, onComplete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [selectedColor, setSelectedColor] = useState(CRAYON_COLORS[0]);
    const [brushSize, setBrushSize] = useState(8);
    const [isEraser, setIsEraser] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

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
        };

        resizeCanvas();

        // Set default background (in CSS pixels since context is scaled)
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        // Set line properties
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Handle window resize
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        // Since we scaled the context by devicePixelRatio, coordinates should be in CSS pixels
        // which is what we get from getBoundingClientRect
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
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

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();
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
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
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
                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 transition-all ${
                                selectedColor === color && !isEraser
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
                        className={`p-2 rounded-lg transition-all ${
                            isEraser
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

