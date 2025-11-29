import React from 'react';

interface TextBox {
    id: string;
    text: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    alignment?: 'left' | 'center' | 'right' | 'justify';
    startTime?: number;
    endTime?: number;
}

interface PageData {
    id: string;
    pageNumber: number;
    backgroundUrl: string;
    backgroundType: 'image' | 'video';
    textBoxes: TextBox[];
    scrollUrl?: string;
    scrollHeight?: number;
}

interface BookPageRendererProps {
    page: PageData;
    activeTextBoxIndex: number | null;
    showScroll: boolean;
    onToggleScroll?: (e: React.MouseEvent) => void;
    onPlayText?: (text: string, index: number, e: React.MouseEvent) => void;
    highlightedWordIndex?: number;
    wordAlignment?: { words: Array<{ word: string; start: number; end: number }> } | null;
}

export const BookPageRenderer: React.FC<BookPageRendererProps> = ({
    page,
    activeTextBoxIndex,
    showScroll,
    onToggleScroll,
    onPlayText,
    highlightedWordIndex,
    wordAlignment
}) => {
    return (
        <div
            className="w-full h-full relative bg-white overflow-hidden shadow-2xl"
            onClick={onToggleScroll}
        >
            {/* Background Layer */}
            <div className="absolute inset-0 bg-black overflow-hidden">
                {page.backgroundType === 'video' ? (
                    <video
                        src={page.backgroundUrl}
                        className="absolute inset-0 w-full h-full object-cover min-w-full min-h-full"
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                            objectFit: 'cover',
                            width: '100%',
                            height: '100%',
                        }}
                    />
                ) : (
                    <img
                        src={page.backgroundUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-contain"
                    />
                )}
            </div>

            {/* Gradient Overlay for depth (spine shadow) */}
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/20 to-transparent pointer-events-none z-10" />

            {/* Scroll Image Layer */}
            {page.scrollUrl && (
                <div
                    className={`absolute bottom-0 left-0 right-0 transition-transform duration-500 ease-in-out z-15 ${showScroll ? 'translate-y-0' : 'translate-y-full'}`}
                    style={{ height: page.scrollHeight ? `${page.scrollHeight}px` : '30%' }}
                >
                    <img
                        src={page.scrollUrl}
                        alt="Scroll background"
                        className="w-full h-full object-fill"
                    />
                </div>
            )}

            {/* Text Boxes Layer */}
            <div
                className="absolute inset-0 pointer-events-none transition-transform duration-500 ease-in-out z-20"
                style={{
                    transform: page.scrollUrl && !showScroll
                        ? 'translateY(100%)'
                        : 'translateY(0)'
                }}
            >
                {page.textBoxes?.map((box, idx) => {
                    const scrollHeightVal = page.scrollHeight ? `${page.scrollHeight}px` : '30%';
                    const scrollTopVal = `calc(100% - ${scrollHeightVal})`;
                    const isActive = activeTextBoxIndex === idx;

                    return (
                        <div
                            key={idx}
                            className="absolute pointer-events-auto overflow-y-auto p-2 group"
                            style={{
                                left: `${box.x}%`,
                                top: page.scrollUrl ? `max(${box.y}%, ${scrollTopVal})` : `${box.y}%`,
                                width: `${box.width || 30}%`,
                                textAlign: box.alignment || 'left',
                                color: box.color || '#4a3b2a',
                                fontFamily: box.fontFamily || 'Comic Sans MS',
                                fontSize: `${box.fontSize || 24}px`,
                                maxHeight: page.scrollUrl
                                    ? `calc(100% - max(${box.y}%, ${scrollTopVal}) - 40px)`
                                    : `calc(100% - ${box.y}% - 40px)`,
                                overflowY: 'auto',
                                textShadow: '1px 1px 2px rgba(255,255,255,0.8)'
                            }}
                            onClick={(e) => onPlayText && onPlayText(box.text, idx, e)}
                        >
                            <div className={`
                                relative p-3 rounded-xl transition-all duration-300
                                ${isActive
                                    ? 'bg-white/90 shadow-[0_0_15px_rgba(255,215,0,0.6)] scale-105 ring-2 ring-[#FFD700]'
                                    : 'bg-white/70 hover:bg-white/85 hover:scale-105 hover:shadow-lg cursor-pointer'
                                }
                            `}>
                                <p className="leading-relaxed relative">
                                    {isActive && wordAlignment ? (
                                        // Highlighted text rendering
                                        wordAlignment.words.map((wordObj, wIdx) => {
                                            const isHighlighted = wIdx === highlightedWordIndex;
                                            return (
                                                <span
                                                    key={wIdx}
                                                    className={`
                                                        transition-all duration-200 rounded px-0.5
                                                        ${isHighlighted
                                                            ? 'bg-[#FFD700] text-black font-bold scale-110 inline-block shadow-sm'
                                                            : ''
                                                        }
                                                    `}
                                                >
                                                    {wordObj.word}{' '}
                                                </span>
                                            );
                                        })
                                    ) : (
                                        // Standard text rendering
                                        box.text
                                    )}
                                </p>

                                {/* Play Icon Indicator */}
                                {!isActive && (
                                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#FFD700] text-black rounded-full p-1 shadow-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
