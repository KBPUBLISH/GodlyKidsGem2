import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient, getMediaUrl } from '../services/apiClient';
import {
    Save,
    Image as ImageIcon,
    Images,
    Type,
    Move,
    Trash2,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Upload,
    LayoutTemplate,
    Video,
    Sparkles,
    Loader2,
    Music,
    X,
    Plus,
    ChevronUp,
    ChevronDown,
    Film
} from 'lucide-react';

interface TextBox {
    id: string;
    text: string;
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    width: number; // percentage (0-100)
    height?: number; // percentage (0-100) - optional, auto if not set
    alignment: 'left' | 'center' | 'right';
    fontFamily: string;
    fontSize: number;
    color: string;
}

interface VideoSequenceItem {
    id: string; // Temporary ID for UI
    url?: string; // Uploaded URL
    filename: string;
    order: number;
    file?: File;
    preview?: string;
}

interface ImageSequenceItem {
    id: string; // Temporary ID for UI
    url?: string; // Uploaded URL
    file?: File; // File to upload
    filename: string;
    order: number;
    preview?: string; // Object URL for preview
}

const PageEditor: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();

    // Core State
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
    const [scrollFile, setScrollFile] = useState<File | null>(null);
    const [scrollHeight, setScrollHeight] = useState<number>(60); // 3 states: 0% (hidden), 30% (mid), 60% (max) - Default to 60% for text positioning
    const [scrollOffsetY, setScrollOffsetY] = useState<number>(0); // Vertical offset from bottom in percentage
    const [soundEffectFile, setSoundEffectFile] = useState<File | null>(null);
    const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
    const [loading, setLoading] = useState(false);
    const [enhancingText, setEnhancingText] = useState(false);
    
    // Coloring page settings
    const [isColoringPage, setIsColoringPage] = useState(false);
    const [coloringEndModalOnly, setColoringEndModalOnly] = useState(true); // Default: coloring pages show in end modal
    
    // Video sequence settings (multiple videos that play in order)
    const [useVideoSequence, setUseVideoSequence] = useState(false);
    const [videoSequence, setVideoSequence] = useState<VideoSequenceItem[]>([]);
    
    // Image sequence settings (multiple images that cycle with transitions)
    const [useImageSequence, setUseImageSequence] = useState(false);
    const [imageSequence, setImageSequence] = useState<ImageSequenceItem[]>([]);
    const [imageSequenceDuration, setImageSequenceDuration] = useState(3); // seconds per image
    const [imageSequenceAnimation, setImageSequenceAnimation] = useState<string>('kenBurns'); // animation effect

    // Previews
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const [scrollPreview, setScrollPreview] = useState<string | null>(null);
    const [soundEffectPreview, setSoundEffectPreview] = useState<string | null>(null);
    const [soundEffectFilename, setSoundEffectFilename] = useState<string | null>(null);

    // UI State
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);

    const [existingPages, setExistingPages] = useState<any[]>([]);
    const [loadingPages, setLoadingPages] = useState(true);
    const [editingPageId, setEditingPageId] = useState<string | null>(null);
    
    // Character voices for @ autocomplete
    const [characterVoices, setCharacterVoices] = useState<Array<{ characterName: string; voiceId: string; color?: string }>>([]);
    const [showCharacterSuggestions, setShowCharacterSuggestions] = useState(false);
    const [characterFilter, setCharacterFilter] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Template for reusing scroll and text boxes
    const [pageTemplate, setPageTemplate] = useState<{
        scrollUrl: string;
        scrollHeight: number;
        textBoxes: Omit<TextBox, 'id'>[];
    } | null>(null);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [applyLayoutToAllPages, setApplyLayoutToAllPages] = useState(false); // Copy layout to all other pages

    // Resizable panels
    const [leftPanelWidth, setLeftPanelWidth] = useState(320); // 320px = w-80
    const [rightPanelWidth, setRightPanelWidth] = useState(256); // 256px = w-64
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [isResizingCanvas, setIsResizingCanvas] = useState(false);

    // Fetch book data to get character voices
    useEffect(() => {
        const fetchBookData = async () => {
            if (!bookId) return;
            try {
                const res = await apiClient.get(`/api/books/${bookId}`);
                if (res.data.characterVoices && Array.isArray(res.data.characterVoices)) {
                    console.log('🎭 Loaded character voices:', res.data.characterVoices);
                    setCharacterVoices(res.data.characterVoices);
                }
            } catch (err) {
                console.error('Failed to fetch book data for character voices:', err);
            }
        };
        fetchBookData();
    }, [bookId]);

    // Fetch existing pages for this book
    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                console.log('📚 Fetched pages for book:', bookId, res.data);
                console.log('📚 First page textBoxes sample:', res.data[0]?.textBoxes, res.data[0]?.content?.textBoxes);
                setExistingPages(res.data);

                // Auto-set page number to next available
                if (res.data.length > 0) {
                    const maxPageNum = Math.max(...res.data.map((p: any) => p.pageNumber));
                    setPageNumber(maxPageNum + 1);

                    // Load template from localStorage if it exists for this book
                    const savedTemplate = localStorage.getItem(`pageTemplate_${bookId}`);
                    if (savedTemplate) {
                        const template = JSON.parse(savedTemplate);
                        setPageTemplate(template);

                        // Apply template to new page
                        if (template.scrollUrl) {
                            setScrollPreview(template.scrollUrl);
                        }
                        if (template.scrollHeight) {
                            setScrollHeight(template.scrollHeight);
                        }
                        if (template.textBoxes && template.textBoxes.length > 0) {
                            const boxesWithIds = template.textBoxes.map((box: any, idx: number) => ({
                                ...box,
                                id: `template-${Date.now()}-${idx}`
                            }));
                            setTextBoxes(boxesWithIds);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch existing pages:', err);
            } finally {
                setLoadingPages(false);
            }
        };
        fetchPages();
    }, [bookId]);

    // Cleanup object URLs
    useEffect(() => {
        return () => {
            if (backgroundPreview && !backgroundPreview.startsWith('http')) URL.revokeObjectURL(backgroundPreview);
            if (scrollPreview && !scrollPreview.startsWith('http')) URL.revokeObjectURL(scrollPreview);
        };
    }, [backgroundPreview, scrollPreview]);

    // Add new text box
    const addTextBox = () => {
        const newBox: TextBox = {
            id: Date.now().toString(),
            text: 'New Text',
            x: 50, // 50% of canvas width
            y: 50, // 50% of canvas height
            width: 30, // 30% of canvas width
            alignment: 'center',
            fontFamily: 'Comic Sans MS',
            fontSize: 24,
            color: '#4a3b2a'
        };
        setTextBoxes([...textBoxes, newBox]);
        setSelectedBoxId(newBox.id);
    };

    // Update text box
    const updateTextBox = (id: string, updates: Partial<TextBox>) => {
        setTextBoxes(boxes => boxes.map(box => box.id === id ? { ...box, ...updates } : box));
    };

    // Delete text box
    const deleteTextBox = (id: string) => {
        setTextBoxes(boxes => boxes.filter(box => box.id !== id));
        if (selectedBoxId === id) setSelectedBoxId(null);
    };

    // Enhance text with TTS emotion prompts
    const handleEnhanceText = async (boxId: string) => {
        const box = textBoxes.find(b => b.id === boxId);
        if (!box || !box.text.trim()) {
            alert('Please add text first before enhancing.');
            return;
        }

        setEnhancingText(true);
        try {
            const response = await apiClient.post('/api/tts/enhance', { 
                text: box.text 
            });
            
            if (response.data.enhancedText) {
                updateTextBox(boxId, { text: response.data.enhancedText });
                alert('Text enhanced with emotion prompts!');
            }
        } catch (error) {
            console.error('Failed to enhance text:', error);
            alert('Failed to enhance text. Please try again.');
        } finally {
            setEnhancingText(false);
        }
    };

    // Handle text change in textarea with @ detection
    const handleTextChange = (boxId: string, newText: string) => {
        updateTextBox(boxId, { text: newText });
        
        // Check for @ character to show suggestions
        const textarea = textareaRef.current;
        if (textarea) {
            const cursorPos = textarea.selectionStart;
            setCursorPosition(cursorPos);
            
            // Find if cursor is after an @ symbol
            const textBeforeCursor = newText.substring(0, cursorPos);
            const lastAtIndex = textBeforeCursor.lastIndexOf('@');
            
            if (lastAtIndex !== -1) {
                // Check if there's a space or newline between @ and cursor (if so, hide suggestions)
                const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                    setCharacterFilter(textAfterAt.toLowerCase());
                    setShowCharacterSuggestions(true);
                    return;
                }
            }
            setShowCharacterSuggestions(false);
            setCharacterFilter('');
        }
    };

    // Insert character name at cursor position
    const insertCharacterName = (boxId: string, characterName: string) => {
        const box = textBoxes.find(b => b.id === boxId);
        if (!box) return;
        
        const text = box.text;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const lastAtIndex = textBeforeCursor.lastIndexOf('@');
        
        if (lastAtIndex !== -1) {
            // Replace everything from @ to cursor with the character name
            const before = text.substring(0, lastAtIndex);
            const after = text.substring(cursorPosition);
            const newText = `${before}@${characterName} ${after}`;
            updateTextBox(boxId, { text: newText });
        }
        
        setShowCharacterSuggestions(false);
        setCharacterFilter('');
    };

    // Filter character voices based on input
    const filteredCharacters = characterVoices.filter(cv => 
        cv.characterName.toLowerCase().includes(characterFilter)
    );

    // Enhance text with sound effect prompts
    const [enhancingSfx, setEnhancingSfx] = useState(false);
    const handleEnhanceSfx = async (boxId: string) => {
        const box = textBoxes.find(b => b.id === boxId);
        if (!box || !box.text.trim()) {
            alert('Please add text first before enhancing.');
            return;
        }

        setEnhancingSfx(true);
        try {
            const response = await apiClient.post('/api/tts/enhance-sfx', { 
                text: box.text 
            });
            
            if (response.data.enhancedText) {
                updateTextBox(boxId, { text: response.data.enhancedText });
                alert('Text enhanced with sound effect prompts!');
            }
        } catch (error) {
            console.error('Failed to enhance text with sound effects:', error);
            alert('Failed to enhance text. Please try again.');
        } finally {
            setEnhancingSfx(false);
        }
    };

    // Helper to resolve image URLs
    const resolveUrl = (url?: string) => {
        if (!url) return '';
        return getMediaUrl(url);
    };

    // Load existing page for editing
    const loadPage = (page: any) => {
        console.log('📄 Loading page:', page._id, 'pageNumber:', page.pageNumber);
        console.log('📄 Page data:', JSON.stringify(page, null, 2));
        
        // Debug: Log all possible background locations
        console.log('🔍 Background debug:', {
            'page.backgroundUrl': page.backgroundUrl,
            'page.backgroundType': page.backgroundType,
            'page.files': page.files,
            'page.files?.background': page.files?.background,
            'page.files?.background?.url': page.files?.background?.url,
            'page.files?.background?.type': page.files?.background?.type,
            'page.content?.backgroundUrl': page.content?.backgroundUrl,
        });
        
        setEditingPageId(page._id);
        setPageNumber(page.pageNumber);
        
        // Determine background type - check all possible locations
        const bgType = page.backgroundType || page.files?.background?.type || page.content?.backgroundType || 'image';
        console.log('🎬 Background type determined:', bgType);
        setBackgroundType(bgType);

        // Set background preview if URL exists (check ALL possible locations)
        const bgUrl = page.backgroundUrl || page.files?.background?.url || page.content?.backgroundUrl || page.imageUrl;
        console.log('🖼️ Background URL determined:', bgUrl);
        if (bgUrl) {
            const resolvedUrl = resolveUrl(bgUrl);
            console.log('🖼️ Background URL resolved:', resolvedUrl);
            setBackgroundPreview(resolvedUrl);
            setBackgroundFile(null); // Clear file since we're using existing URL
        } else {
            console.log('⚠️ No background URL found for this page!');
            setBackgroundPreview(null);
        }

        // Set scroll preview if URL exists (check both legacy and new locations)
        const scrollUrl = page.scrollUrl || page.files?.scroll?.url || page.content?.scrollUrl;
        console.log('📜 Scroll URL:', scrollUrl);
        if (scrollUrl) {
            setScrollPreview(resolveUrl(scrollUrl));
            setScrollFile(null);
        } else {
            setScrollPreview(null);
        }

        // Load scroll height (default to 33%) - check multiple possible field names
        const savedScrollHeight = page.scrollHeight || page.scrollMidHeight || page.files?.scroll?.height;
        console.log('📏 Scroll height:', savedScrollHeight);
        setScrollHeight(savedScrollHeight || 33);
        
        // Load scroll offset (default to 0)
        const savedScrollOffsetY = page.scrollOffsetY || 0;
        console.log('📍 Scroll offset Y:', savedScrollOffsetY);
        setScrollOffsetY(savedScrollOffsetY);

        // Load sound effect if exists
        const soundEffectUrl = page.soundEffectUrl || page.files?.soundEffect?.url;
        const soundEffectName = page.files?.soundEffect?.filename;
        console.log('🔊 Sound effect URL:', soundEffectUrl);
        if (soundEffectUrl) {
            setSoundEffectPreview(resolveUrl(soundEffectUrl));
            setSoundEffectFilename(soundEffectName || 'Sound Effect');
            setSoundEffectFile(null);
        } else {
            setSoundEffectPreview(null);
            setSoundEffectFilename(null);
        }

        // Load text boxes with IDs for editing
        // IMPORTANT: Check content.textBoxes FIRST (where data actually lives), 
        // then fall back to root textBoxes only if content.textBoxes is empty/missing
        console.log('📝 page.textBoxes:', page.textBoxes);
        console.log('📝 page.content?.textBoxes:', page.content?.textBoxes);
        const contentTextBoxes = page.content?.textBoxes || [];
        const rootTextBoxes = page.textBoxes || [];
        // Prefer content.textBoxes if it has data, otherwise use root textBoxes
        const textBoxesData = contentTextBoxes.length > 0 ? contentTextBoxes : rootTextBoxes;
        console.log('📝 Final textBoxesData:', textBoxesData);
        
        if (Array.isArray(textBoxesData) && textBoxesData.length > 0) {
            const boxesWithIds = textBoxesData.map((box: any, idx: number) => ({
                ...box,
                id: `${page._id}-${idx}`,
                fontFamily: box.fontFamily || 'Comic Sans MS',
                fontSize: box.fontSize || 24,
                color: box.color || '#4a3b2a',
                width: box.width || 30
            }));
            console.log('📝 Loaded text boxes:', boxesWithIds);
            setTextBoxes(boxesWithIds);
        } else {
            console.log('📝 No text boxes found, setting empty array');
            setTextBoxes([]);
        }

        // Load coloring page settings
        setIsColoringPage(page.isColoringPage || false);
        setColoringEndModalOnly(page.coloringEndModalOnly !== false); // Default to true if not set
        
        // Load video sequence settings
        console.log('🎬 Video sequence settings:', {
            useVideoSequence: page.useVideoSequence,
            videoSequenceLength: page.videoSequence?.length || 0,
            videoSequence: page.videoSequence
        });
        setUseVideoSequence(page.useVideoSequence || false);
        if (page.videoSequence && page.videoSequence.length > 0) {
            const loadedVideos: VideoSequenceItem[] = page.videoSequence.map((v: any, idx: number) => ({
                id: `loaded-${page._id}-${idx}`,
                url: v.url,
                filename: v.filename || `Video ${v.order}`,
                order: v.order,
            }));
            setVideoSequence(loadedVideos);
        } else {
            setVideoSequence([]);
        }
        
        // Load image sequence settings
        console.log('🖼️ Image sequence settings:', {
            useImageSequence: page.useImageSequence,
            imageSequenceLength: page.imageSequence?.length || 0,
            imageSequence: page.imageSequence,
            imageSequenceAnimation: page.imageSequenceAnimation
        });
        setUseImageSequence(page.useImageSequence || false);
        setImageSequenceDuration(page.imageSequenceDuration || 3);
        setImageSequenceAnimation(page.imageSequenceAnimation || 'kenBurns');
        if (page.imageSequence && page.imageSequence.length > 0) {
            const loadedImages: ImageSequenceItem[] = page.imageSequence.map((img: any, idx: number) => ({
                id: `loaded-img-${page._id}-${idx}`,
                url: img.url,
                filename: img.filename || `Image ${img.order}`,
                order: img.order,
            }));
            setImageSequence(loadedImages);
        } else {
            setImageSequence([]);
        }

        setSelectedBoxId(null);
    };

    // Create new page (reset editor)
    const createNewPage = () => {
        setEditingPageId(null);
        const nextPageNum = existingPages.length > 0
            ? Math.max(...existingPages.map((p: any) => p.pageNumber)) + 1
            : 1;
        setPageNumber(nextPageNum);
        setBackgroundType('image');
        setBackgroundFile(null);
        setBackgroundPreview(null);
        setScrollFile(null);
        setScrollHeight(33); // Reset to default
        setScrollOffsetY(0); // Reset offset
        setSoundEffectFile(null);
        setSoundEffectPreview(null);
        setSoundEffectFilename(null);
        setSelectedBoxId(null);
        
        // Reset coloring page settings
        setIsColoringPage(false);
        setColoringEndModalOnly(true);
        
        // Reset video sequence settings
        setUseVideoSequence(false);
        // Cleanup object URLs
        videoSequence.forEach(v => {
            if (v.preview) URL.revokeObjectURL(v.preview);
        });
        setVideoSequence([]);
        
        // Reset image sequence settings
        setUseImageSequence(false);
        setImageSequenceDuration(3);
        setImageSequenceAnimation('kenBurns');
        imageSequence.forEach(img => {
            if (img.preview) URL.revokeObjectURL(img.preview);
        });
        setImageSequence([]);

        // Apply template if it exists
        if (pageTemplate) {
            if (pageTemplate.scrollUrl) {
                setScrollPreview(resolveUrl(pageTemplate.scrollUrl));
            }
            if (pageTemplate.textBoxes && pageTemplate.textBoxes.length > 0) {
                const boxesWithIds = pageTemplate.textBoxes.map((box: any, idx: number) => ({
                    ...box,
                    id: `new-${Date.now()}-${idx}`,
                    width: box.width || 30
                }));
                setTextBoxes(boxesWithIds);
            } else {
                setTextBoxes([]);
            }
        } else {
            setScrollPreview(null);
            setTextBoxes([]);
        }
    };

    // Drag Handlers
    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const box = textBoxes.find(b => b.id === id);
        if (!box || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const startX = e.clientX - canvasRect.left;
        const startY = e.clientY - canvasRect.top;

        // Convert percentage to pixels for drag offset
        const boxXPx = (box.x / 100) * canvasRect.width;
        const boxYPx = (box.y / 100) * canvasRect.height;

        setDraggingId(id);
        setSelectedBoxId(id);
        setDragOffset({
            x: startX - boxXPx,
            y: startY - boxYPx
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingId && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const currentX = e.clientX - canvasRect.left;
            const currentY = e.clientY - canvasRect.top;

            const newXPx = currentX - dragOffset.x;
            const newYPx = currentY - dragOffset.y;

            // Convert pixels to percentage
            const newXPercent = Math.max(0, Math.min(100, (newXPx / canvasRect.width) * 100));
            const newYPercent = Math.max(0, Math.min(100, (newYPx / canvasRect.height) * 100));

            updateTextBox(draggingId, { x: newXPercent, y: newYPercent });
        }
    };

    const handleBoxResize = (e: React.MouseEvent) => {
        if (resizingBoxId && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const box = textBoxes.find(b => b.id === resizingBoxId);
            if (!box) return;

            const currentX = e.clientX - canvasRect.left;
            // Calculate new width based on mouse position
            // width = (currentX - boxX) / canvasWidth * 100
            const boxLeftPx = (box.x / 100) * canvasRect.width;
            const newWidthPx = currentX - boxLeftPx;

            // Min width 10%, Max width 100% - box.x
            const newWidthPercent = Math.max(10, Math.min(100 - box.x, (newWidthPx / canvasRect.width) * 100));

            updateTextBox(resizingBoxId, { width: newWidthPercent });
        }
    };

    const handleMouseUp = () => {
        setDraggingId(null);
        setResizingBoxId(null);
        setIsResizingLeft(false);
        setIsResizingRight(false);
        setIsResizingCanvas(false);
    };

    // Panel resize handlers
    const handleLeftResize = (e: React.MouseEvent) => {
        if (isResizingLeft) {
            const newWidth = Math.max(200, Math.min(600, e.clientX));
            setLeftPanelWidth(newWidth);
        }
    };

    const handleRightResize = (e: React.MouseEvent) => {
        if (isResizingRight) {
            const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
            setRightPanelWidth(newWidth);
        }
    };

    const handleCanvasResize = (e: React.MouseEvent) => {
        if (isResizingCanvas && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();

            // Calculate new size based on mouse position relative to canvas top-left
            const mouseX = e.clientX - canvasRect.left;
            const mouseY = e.clientY - canvasRect.top;

            const newWidth = Math.max(400, Math.min(2000, mouseX));
            const newHeight = Math.max(300, Math.min(2000, mouseY));

            setCanvasWidth(newWidth);
            setCanvasHeight(newHeight);
        }
    };

    // Combined mouse move handler
    const handleGlobalMouseMove = (e: React.MouseEvent) => {
        handleMouseMove(e);
        handleBoxResize(e);
        handleLeftResize(e);
        handleRightResize(e);
        handleCanvasResize(e);
    };

    const handleSubmit = async () => {
        if (!bookId) return;
        setLoading(true);
        try {
            // Upload background
            let backgroundUrl = '';
            if (backgroundPreview && backgroundPreview.startsWith('http')) {
                backgroundUrl = backgroundPreview;
            }

            if (backgroundFile) {
                const formData = new FormData();
                formData.append('file', backgroundFile);
                // Include bookId, type=pages, and pageNumber for proper GCS path
                const endpoint = backgroundType === 'image' 
                    ? `/api/upload/image?bookId=${bookId}&type=pages&pageNumber=${pageNumber}` 
                    : `/api/upload/video?bookId=${bookId}&type=pages&pageNumber=${pageNumber}`;
                const res = await apiClient.post(endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                backgroundUrl = res.data.url;
            }

            // Upload scroll - include bookId and type=scroll for proper GCS path
            let scrollUrl = '';
            
            console.log('📜 Scroll save debug:', {
                scrollPreview: scrollPreview?.substring(0, 50) + '...',
                scrollFile: scrollFile ? scrollFile.name : null,
                startsWithHttp: scrollPreview?.startsWith('http'),
                startsWithBlob: scrollPreview?.startsWith('blob:'),
                startsWithHttps: scrollPreview?.startsWith('https://'),
            });
            
            // Only use existing URL if it's a real HTTPS URL (GCS, etc) - not blob:
            if (scrollPreview && scrollPreview.startsWith('https://') && !scrollPreview.includes('blob:')) {
                scrollUrl = scrollPreview;
                console.log('📜 Using existing scroll URL:', scrollUrl);
            }

            // If we have a new file to upload, upload it
            if (scrollFile) {
                console.log('📜 Uploading new scroll file:', scrollFile.name);
                const formData = new FormData();
                formData.append('file', scrollFile);
                const res = await apiClient.post(`/api/upload/image?bookId=${bookId}&type=scroll`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                scrollUrl = res.data.url;
                console.log('📜 Uploaded scroll image:', scrollUrl);
            } else if (scrollPreview && scrollPreview.startsWith('blob:')) {
                // CRITICAL: Blob URLs are temporary and expire - try to upload but don't block save
                console.log('⚠️ Blob URL detected without file - attempting to fetch and upload...');
                try {
                    const response = await fetch(scrollPreview);
                    if (response.ok) {
                        const blob = await response.blob();
                        const formData = new FormData();
                        formData.append('file', blob, 'scroll-image.png');
                        const res = await apiClient.post(`/api/upload/image?bookId=${bookId}&type=scroll`, formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        scrollUrl = res.data.url;
                        console.log('📜 Uploaded blob scroll image:', scrollUrl);
                    } else {
                        console.warn('⚠️ Blob URL expired - clearing scroll. Please re-upload.');
                        scrollUrl = ''; // Clear broken scroll
                    }
                } catch (err) {
                    // Blob URL expired or invalid - just clear it and continue saving
                    console.warn('⚠️ Blob URL fetch failed (likely expired) - clearing scroll:', err);
                    scrollUrl = ''; // Clear broken scroll, allow save to continue
                }
            }
            
            console.log('📜 Final scroll URL to save:', scrollUrl || '(empty)');

            // Upload sound effect - include bookId and pageNumber for proper GCS path
            let soundEffectUrl = '';
            if (soundEffectPreview && soundEffectPreview.startsWith('http')) {
                soundEffectUrl = soundEffectPreview;
            }

            if (soundEffectFile) {
                const formData = new FormData();
                formData.append('file', soundEffectFile);
                const res = await apiClient.post(`/api/upload/sound-effect?bookId=${bookId}&pageNumber=${pageNumber}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                soundEffectUrl = res.data.url;
            }

            // Upload video sequence files
            const uploadedVideoSequence: { url: string; filename: string; order: number }[] = [];
            if (useVideoSequence && videoSequence.length > 0) {
                for (const video of videoSequence.sort((a, b) => a.order - b.order)) {
                    if (video.file) {
                        // Upload new video file
                        const formData = new FormData();
                        formData.append('file', video.file);
                        try {
                            const res = await apiClient.post(
                                `/api/upload/video?bookId=${bookId}&type=sequence&pageNumber=${pageNumber}`,
                                formData,
                                { headers: { 'Content-Type': 'multipart/form-data' } }
                            );
                            uploadedVideoSequence.push({
                                url: res.data.url,
                                filename: video.filename,
                                order: video.order,
                            });
                        } catch (uploadErr) {
                            console.error('Failed to upload video sequence item:', uploadErr);
                            alert(`Failed to upload video: ${video.filename}`);
                        }
                    } else if (video.url) {
                        // Keep existing URL
                        uploadedVideoSequence.push({
                            url: video.url,
                            filename: video.filename,
                            order: video.order,
                        });
                    }
                }
            }
            
            // Upload image sequence files
            const uploadedImageSequence: { url: string; filename: string; order: number }[] = [];
            if (useImageSequence && imageSequence.length > 0) {
                for (const img of imageSequence.sort((a, b) => a.order - b.order)) {
                    if (img.file) {
                        // Upload new image file
                        const formData = new FormData();
                        formData.append('file', img.file);
                        try {
                            const res = await apiClient.post(
                                `/api/upload/image?bookId=${bookId}&type=image-sequence&pageNumber=${pageNumber}`,
                                formData,
                                { headers: { 'Content-Type': 'multipart/form-data' } }
                            );
                            uploadedImageSequence.push({
                                url: res.data.url,
                                filename: img.filename,
                                order: img.order,
                            });
                        } catch (uploadErr) {
                            console.error('Failed to upload image sequence item:', uploadErr);
                            alert(`Failed to upload image: ${img.filename}`);
                        }
                    } else if (img.url) {
                        // Keep existing URL
                        uploadedImageSequence.push({
                            url: img.url,
                            filename: img.filename,
                            order: img.order,
                        });
                    }
                }
            }

            const payload = {
                bookId,
                pageNumber,
                backgroundUrl,
                backgroundType,
                scrollUrl,
                scrollHeight,
                // scrollHeight is the main/default height shown in app (what was used when positioning text)
                // scrollMaxHeight = the selected height (default state in app)
                // scrollMidHeight = smaller height for when user swipes down
                scrollMidHeight: Math.max(30, scrollHeight - 30), // Mid is 30% less than max, minimum 30%
                scrollMaxHeight: scrollHeight, // Max is the selected height (default in app)
                scrollOffsetY, // Vertical offset for scroll position
                soundEffectUrl, // Sound effect bubble audio
                textBoxes: textBoxes.map(({ id, ...rest }) => rest), // Remove ID before sending
                isColoringPage,
                coloringEndModalOnly: isColoringPage ? coloringEndModalOnly : false, // Only relevant if it's a coloring page
                // Video sequence settings
                useVideoSequence: useVideoSequence && uploadedVideoSequence.length > 0,
                videoSequence: uploadedVideoSequence,
                // Image sequence settings
                useImageSequence: useImageSequence && uploadedImageSequence.length > 0,
                imageSequence: uploadedImageSequence,
                imageSequenceDuration,
                imageSequenceAnimation,
            };

            console.log('📤 Sending payload:', JSON.stringify(payload, null, 2));
            console.log('📝 TextBoxes being saved:', textBoxes.map(b => ({ id: b.id, x: b.x, y: b.y, text: b.text.substring(0, 20) })));

            // Use PUT to update existing page, POST to create new
            if (editingPageId) {
                await apiClient.put(`/api/pages/${editingPageId}`, payload);
                // Refresh pages list
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                setExistingPages(res.data);

                // Reload the updated page into the editor to keep state in sync
                const updatedPage = res.data.find((p: any) => p._id === editingPageId);
                console.log('📥 Page returned from server after save:', {
                    textBoxes: updatedPage?.textBoxes?.map((b: any) => ({ x: b.x, y: b.y, text: b.text?.substring(0, 20) })),
                    contentTextBoxes: updatedPage?.content?.textBoxes?.map((b: any) => ({ x: b.x, y: b.y, text: b.text?.substring(0, 20) })),
                });
                if (updatedPage) {
                    loadPage(updatedPage);
                }
                
                // If applyLayoutToAllPages is checked, update all other pages with the same layout
                if (applyLayoutToAllPages && pageNumber === 1) {
                    const otherPages = existingPages.filter(p => p.pageNumber !== 1);
                    let updatedCount = 0;
                    
                    for (const otherPage of otherPages) {
                        try {
                            // Create layout payload (only scroll and textbox layout, not background)
                            const layoutPayload = {
                                scrollUrl,
                                scrollHeight,
                                scrollMidHeight: Math.max(30, scrollHeight - 30),
                                scrollMaxHeight: scrollHeight,
                                scrollOffsetY,
                                // Copy text boxes but update the text content from existing page
                                textBoxes: textBoxes.map(({ id, ...rest }) => ({
                                    ...rest,
                                    text: '' // Empty text - user fills in for each page
                                })),
                            };
                            
                            await apiClient.put(`/api/pages/${otherPage._id}`, layoutPayload);
                            updatedCount++;
                        } catch (err) {
                            console.error(`Failed to update page ${otherPage.pageNumber}:`, err);
                        }
                    }
                    
                    alert(`Page updated and layout applied to ${updatedCount} other pages!`);
                    setApplyLayoutToAllPages(false); // Reset checkbox
                    
                    // Refresh pages list
                    const refreshRes = await apiClient.get(`/api/pages/book/${bookId}`);
                    setExistingPages(refreshRes.data);
                } else {
                    alert('Page updated successfully!');
                }
            } else {
                await apiClient.post('/api/pages', payload);

                // Refresh pages list
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                setExistingPages(res.data);

                // If this is page 1 and no template exists, ask if user wants to create one
                if (pageNumber === 1 && !pageTemplate && (scrollUrl || textBoxes.length > 0)) {
                    setShowTemplateDialog(true);
                } else {
                    // Reset for new page
                    createNewPage();
                }
            }
        } catch (err: any) {
            console.error('Error saving page:', err);
            if (err.response) {
                console.error('Response data:', err.response.data);
                console.error('Response status:', err.response.status);
                alert(`Failed to save page: ${err.response.data.message || 'Unknown error'}`);
            } else {
                alert('Failed to save page');
            }
        } finally {
            setLoading(false);
        }
    };

    // Delete a page
    const handleDeletePage = async (pageId: string, pageNum: number) => {
        if (!confirm(`Are you sure you want to delete page ${pageNum}? This cannot be undone.`)) {
            return;
        }
        
        try {
            await apiClient.delete(`/api/pages/${pageId}`);
            
            // Refresh pages list
            const res = await apiClient.get(`/api/pages/book/${bookId}`);
            setExistingPages(res.data);
            
            // If we were editing the deleted page, reset to new page
            if (editingPageId === pageId) {
                createNewPage();
            }
            
            alert('Page deleted successfully!');
        } catch (error) {
            console.error('Failed to delete page:', error);
            alert('Failed to delete page. Please try again.');
        }
    };

    const selectedBox = textBoxes.find(b => b.id === selectedBoxId);

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden" onMouseMove={handleGlobalMouseMove} onMouseUp={handleMouseUp}>
            {/* Left Sidebar - Controls */}
            <div className="bg-white border-r border-gray-200 flex flex-col shadow-xl z-10 relative" style={{ width: `${leftPanelWidth}px` }}>
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <LayoutTemplate className="w-5 h-5 text-indigo-600" />
                        Page Editor
                    </h2>
                </div>

                {/* Resize handle */}
                <div
                    className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-indigo-500 bg-indigo-300 transition-colors z-50"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizingLeft(true);
                    }}
                />

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Page Settings */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Page Settings</label>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Page #</span>
                            <input
                                type="number"
                                min={1}
                                value={pageNumber}
                                onChange={e => setPageNumber(parseInt(e.target.value) || 1)}
                                className="w-20 border rounded px-2 py-1 text-sm"
                            />
                        </div>
                        
                        {/* Copy layout to other pages - only show for page 1 */}
                        {pageNumber === 1 && existingPages.length > 1 && (scrollPreview || textBoxes.length > 0) && (
                            <label className="flex items-center gap-2 cursor-pointer bg-amber-50 p-2 rounded-lg border border-amber-200">
                                <input
                                    type="checkbox"
                                    checked={applyLayoutToAllPages}
                                    onChange={(e) => setApplyLayoutToAllPages(e.target.checked)}
                                    className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                                />
                                <div>
                                    <span className="text-sm text-gray-700 font-medium">Apply layout to all pages</span>
                                    <p className="text-xs text-amber-600">
                                        Copy scroll & text box positions to {existingPages.length - 1} other page{existingPages.length > 2 ? 's' : ''}
                                    </p>
                                </div>
                            </label>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Background */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Background</label>
                        <div className="flex gap-2 mb-2">
                            <button
                                onClick={() => setBackgroundType('image')}
                                className={`flex-1 py-1.5 text-sm rounded border ${backgroundType === 'image' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Image
                            </button>
                            <button
                                onClick={() => setBackgroundType('video')}
                                className={`flex-1 py-1.5 text-sm rounded border ${backgroundType === 'video' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-600'}`}
                            >
                                Video
                            </button>
                        </div>

                        <div className="relative group">
                            <input
                                type="file"
                                accept={backgroundType === 'image' ? 'image/*' : 'video/*'}
                                className="hidden"
                                id="bg-upload"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setBackgroundFile(file);
                                        setBackgroundPreview(URL.createObjectURL(file));
                                    }
                                }}
                            />
                            <label
                                htmlFor="bg-upload"
                                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition relative"
                            >
                                {backgroundPreview ? (
                                    <>
                                        {backgroundType === 'image' ?
                                            <img src={backgroundPreview} className="w-full h-full object-cover rounded-lg opacity-50 group-hover:opacity-40" /> :
                                            <video src={backgroundPreview} className="w-full h-full object-cover rounded-lg opacity-50 group-hover:opacity-40" autoPlay loop muted playsInline />
                                        }
                                    </>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        {backgroundType === 'image' ? <ImageIcon className="w-8 h-8 mx-auto mb-1" /> : <Video className="w-8 h-8 mx-auto mb-1" />}
                                        <span className="text-xs">Click to upload</span>
                                    </div>
                                )}
                            </label>
                            {/* Remove Background Button */}
                            {backgroundPreview && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setBackgroundFile(null);
                                        setBackgroundPreview(null);
                                    }}
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition shadow-md z-10"
                                    title="Remove background"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        
                        {/* Remove Background Text Button */}
                        {backgroundPreview && (
                            <button
                                type="button"
                                onClick={() => {
                                    setBackgroundFile(null);
                                    setBackgroundPreview(null);
                                }}
                                className="w-full py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                                Remove Background
                            </button>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Video Sequence - Multiple videos that play in order */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Film className="w-4 h-4" />
                            Video Sequence
                        </label>
                        <p className="text-xs text-gray-400">
                            Upload multiple videos to play in sequence. They will loop until the page audio finishes.
                        </p>
                        
                        {/* Toggle to enable video sequence */}
                        <label className="flex items-center gap-2 cursor-pointer bg-indigo-50 p-2 rounded-lg border border-indigo-200">
                            <input
                                type="checkbox"
                                checked={useVideoSequence}
                                onChange={(e) => setUseVideoSequence(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-sm text-gray-700 font-medium">Use video sequence instead of background</span>
                        </label>
                        
                        {!useVideoSequence && (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                ⚠️ Check the box above to enable video sequence mode
                            </p>
                        )}
                        
                        {useVideoSequence && (
                            <div className="space-y-3 bg-gray-50 p-3 rounded-lg border-2 border-indigo-300">
                                {/* Empty state message */}
                                {videoSequence.length === 0 && (
                                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded text-center">
                                        ⬇️ Add at least one video below to use video sequence
                                    </p>
                                )}
                                
                                {/* Video list */}
                                {videoSequence.length > 0 && (
                                    <div className="space-y-2">
                                        {videoSequence.sort((a, b) => a.order - b.order).map((video, index) => (
                                            <div 
                                                key={video.id}
                                                className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm"
                                            >
                                                {/* Order badge */}
                                                <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {video.order}
                                                </div>
                                                
                                                {/* Video preview thumbnail */}
                                                <div className="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                                    {(video.preview || video.url) && (
                                                        <video 
                                                            src={video.preview || resolveUrl(video.url)}
                                                            className="w-full h-full object-cover"
                                                            muted
                                                        />
                                                    )}
                                                </div>
                                                
                                                {/* Filename */}
                                                <span className="flex-1 text-xs text-gray-600 truncate">
                                                    {video.filename}
                                                </span>
                                                
                                                {/* Reorder buttons */}
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => {
                                                            // Move up
                                                            setVideoSequence(prev => {
                                                                const sorted = [...prev].sort((a, b) => a.order - b.order);
                                                                if (index === 0) return prev;
                                                                const current = sorted[index];
                                                                const above = sorted[index - 1];
                                                                return prev.map(v => {
                                                                    if (v.id === current.id) return { ...v, order: above.order };
                                                                    if (v.id === above.id) return { ...v, order: current.order };
                                                                    return v;
                                                                });
                                                            });
                                                        }}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <ChevronUp className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={index === videoSequence.length - 1}
                                                        onClick={() => {
                                                            // Move down
                                                            setVideoSequence(prev => {
                                                                const sorted = [...prev].sort((a, b) => a.order - b.order);
                                                                if (index === sorted.length - 1) return prev;
                                                                const current = sorted[index];
                                                                const below = sorted[index + 1];
                                                                return prev.map(v => {
                                                                    if (v.id === current.id) return { ...v, order: below.order };
                                                                    if (v.id === below.id) return { ...v, order: current.order };
                                                                    return v;
                                                                });
                                                            });
                                                        }}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                
                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Revoke object URL if exists
                                                        if (video.preview) URL.revokeObjectURL(video.preview);
                                                        setVideoSequence(prev => {
                                                            const filtered = prev.filter(v => v.id !== video.id);
                                                            // Re-order remaining items
                                                            return filtered.sort((a, b) => a.order - b.order).map((v, i) => ({ ...v, order: i + 1 }));
                                                        });
                                                    }}
                                                    className="p-1 text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Add video button */}
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        id="video-sequence-upload"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const newVideo: VideoSequenceItem = {
                                                    id: `video-${Date.now()}`,
                                                    file,
                                                    filename: file.name,
                                                    order: videoSequence.length + 1,
                                                    preview: URL.createObjectURL(file),
                                                };
                                                setVideoSequence(prev => [...prev, newVideo]);
                                                // Reset input
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="video-sequence-upload"
                                        className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition text-indigo-600 text-sm font-medium"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Video ({videoSequence.length}/10)
                                    </label>
                                </div>
                                
                                {videoSequence.length > 0 && (
                                    <p className="text-xs text-indigo-600 text-center">
                                        ✨ Videos will play in order: {videoSequence.sort((a, b) => a.order - b.order).map(v => v.order).join(' → ')} → loop
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Image Sequence */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Images className="w-4 h-4" />
                            Image Sequence
                        </label>
                        <p className="text-xs text-gray-400">
                            Upload multiple images that cycle with smooth transitions. Perfect for animated backgrounds.
                        </p>
                        
                        {/* Toggle to enable image sequence */}
                        <label className="flex items-center gap-2 cursor-pointer bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                            <input
                                type="checkbox"
                                checked={useImageSequence}
                                onChange={(e) => {
                                    setUseImageSequence(e.target.checked);
                                    // Disable video sequence if enabling image sequence
                                    if (e.target.checked) {
                                        setUseVideoSequence(false);
                                    }
                                }}
                                className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                            <span className="text-sm text-gray-700 font-medium">Use image sequence instead of static background</span>
                        </label>
                        
                        {!useImageSequence && (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                ⚠️ Check the box above to enable image sequence mode
                            </p>
                        )}
                        
                        {useImageSequence && (
                            <div className="space-y-3 bg-gray-50 p-3 rounded-lg border-2 border-emerald-300">
                                {/* Duration setting */}
                                <div className="flex items-center gap-3">
                                    <label className="text-xs text-gray-600 whitespace-nowrap">Duration per image:</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={imageSequenceDuration}
                                        onChange={(e) => setImageSequenceDuration(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                                        className="w-16 px-2 py-1 text-sm border rounded"
                                    />
                                    <span className="text-xs text-gray-500">seconds</span>
                                </div>
                                
                                {/* Animation effect */}
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-600">Camera Animation:</label>
                                    <select
                                        value={imageSequenceAnimation}
                                        onChange={(e) => setImageSequenceAnimation(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border rounded bg-white"
                                    >
                                        <option value="kenBurns">🎬 Ken Burns (Pan + Zoom)</option>
                                        <option value="zoomIn">🔍 Slow Zoom In</option>
                                        <option value="zoomOut">🔎 Slow Zoom Out</option>
                                        <option value="panLeft">⬅️ Pan Left</option>
                                        <option value="panRight">➡️ Pan Right</option>
                                        <option value="panUp">⬆️ Pan Up</option>
                                        <option value="panDown">⬇️ Pan Down</option>
                                        <option value="none">❌ No Animation (Static)</option>
                                    </select>
                                    <p className="text-xs text-gray-400">
                                        Ken Burns creates a cinematic documentary-style effect
                                    </p>
                                </div>
                                
                                {/* Empty state message */}
                                {imageSequence.length === 0 && (
                                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded text-center">
                                        ⬇️ Add at least one image below to use image sequence
                                    </p>
                                )}
                                
                                {/* Image list */}
                                {imageSequence.length > 0 && (
                                    <div className="space-y-2">
                                        {imageSequence.sort((a, b) => a.order - b.order).map((img, index) => (
                                            <div 
                                                key={img.id}
                                                className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm"
                                            >
                                                {/* Order badge */}
                                                <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                                    {img.order}
                                                </div>
                                                
                                                {/* Image preview thumbnail */}
                                                <div className="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                                                    {(img.preview || img.url) && (
                                                        <img 
                                                            src={img.preview || resolveUrl(img.url)}
                                                            className="w-full h-full object-cover"
                                                            alt={img.filename}
                                                        />
                                                    )}
                                                </div>
                                                
                                                {/* Filename */}
                                                <span className="flex-1 text-xs text-gray-600 truncate">
                                                    {img.filename}
                                                </span>
                                                
                                                {/* Reorder buttons */}
                                                <div className="flex flex-col gap-0.5">
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => {
                                                            // Move up
                                                            setImageSequence(prev => {
                                                                const sorted = [...prev].sort((a, b) => a.order - b.order);
                                                                if (index === 0) return prev;
                                                                const current = sorted[index];
                                                                const above = sorted[index - 1];
                                                                return prev.map(i => {
                                                                    if (i.id === current.id) return { ...i, order: above.order };
                                                                    if (i.id === above.id) return { ...i, order: current.order };
                                                                    return i;
                                                                });
                                                            });
                                                        }}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <ChevronUp className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={index === imageSequence.length - 1}
                                                        onClick={() => {
                                                            // Move down
                                                            setImageSequence(prev => {
                                                                const sorted = [...prev].sort((a, b) => a.order - b.order);
                                                                if (index === sorted.length - 1) return prev;
                                                                const current = sorted[index];
                                                                const below = sorted[index + 1];
                                                                return prev.map(i => {
                                                                    if (i.id === current.id) return { ...i, order: below.order };
                                                                    if (i.id === below.id) return { ...i, order: current.order };
                                                                    return i;
                                                                });
                                                            });
                                                        }}
                                                        className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                    >
                                                        <ChevronDown className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                
                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Revoke object URL if exists
                                                        if (img.preview) URL.revokeObjectURL(img.preview);
                                                        setImageSequence(prev => {
                                                            const filtered = prev.filter(i => i.id !== img.id);
                                                            // Re-order remaining items
                                                            return filtered.sort((a, b) => a.order - b.order).map((i, idx) => ({ ...i, order: idx + 1 }));
                                                        });
                                                    }}
                                                    className="p-1 text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Add image button */}
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        id="image-sequence-upload"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const newImage: ImageSequenceItem = {
                                                    id: `img-${Date.now()}`,
                                                    file,
                                                    filename: file.name,
                                                    order: imageSequence.length + 1,
                                                    preview: URL.createObjectURL(file),
                                                };
                                                setImageSequence(prev => [...prev, newImage]);
                                                // Reset input
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    <label
                                        htmlFor="image-sequence-upload"
                                        className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-emerald-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition text-emerald-600 text-sm font-medium"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Image ({imageSequence.length}/20)
                                    </label>
                                </div>
                                
                                {imageSequence.length > 0 && (
                                    <p className="text-xs text-emerald-600 text-center">
                                        🎨 Images will transition every {imageSequenceDuration}s: {imageSequence.sort((a, b) => a.order - b.order).map(i => i.order).join(' → ')} → loop
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Scroll Overlay */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Scroll Overlay</label>
                        
                        {/* Existing scrolls from this book */}
                        {(() => {
                            // Get unique scroll URLs from existing pages (excluding blob: URLs)
                            const existingScrolls = [...new Set(
                                existingPages
                                    .map(p => p.scrollUrl || p.files?.scroll?.url)
                                    .filter(url => url && url.startsWith('https://') && !url.includes('blob:'))
                            )];
                            
                            if (existingScrolls.length > 0) {
                                return (
                                    <div className="space-y-1">
                                        <label className="block text-xs text-gray-400">Use existing scroll:</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {existingScrolls.slice(0, 4).map((url, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        setScrollPreview(url);
                                                        setScrollFile(null); // Clear file since we're using existing URL
                                                    }}
                                                    className={`w-12 h-12 rounded border-2 overflow-hidden transition ${
                                                        scrollPreview === url 
                                                            ? 'border-indigo-600 ring-2 ring-indigo-300' 
                                                            : 'border-gray-200 hover:border-indigo-400'
                                                    }`}
                                                    title="Click to use this scroll"
                                                >
                                                    <img src={url} className="w-full h-full object-cover" alt={`Scroll ${idx + 1}`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                        
                        {/* Upload new scroll */}
                        <div className="relative group">
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                id="scroll-upload"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setScrollFile(file);
                                        setScrollPreview(URL.createObjectURL(file));
                                        console.log('📜 Selected new scroll file:', file.name);
                                    }
                                }}
                            />
                            <label
                                htmlFor="scroll-upload"
                                className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
                            >
                                {scrollPreview ? (
                                    <img src={scrollPreview} className="w-full h-full object-contain rounded-lg opacity-80" />
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Upload className="w-6 h-6 mx-auto mb-1" />
                                        <span className="text-xs">Upload Scroll Image</span>
                                    </div>
                                )}
                            </label>
                        </div>
                        
                        {/* Scroll Height Control - 3 states: hidden (0%), mid (30%), max (60%) */}
                        {scrollPreview && (
                            <div className="space-y-2">
                                <label className="block text-xs text-gray-500">Scroll Height (tap to toggle in app)</label>
                                <div className="flex gap-2">
                                    {[0, 30, 60].map(height => (
                                        <button
                                            key={height}
                                            type="button"
                                            onClick={() => setScrollHeight(height)}
                                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                                                scrollHeight === height
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {height === 0 ? 'Hidden' : height === 30 ? '30% (Mid)' : '60% (Max)'}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-400">
                                    Set to 60% to position text. App starts at 30% (mid).
                                </p>
                            </div>
                        )}
                        
                        {/* Scroll Position Control (Up/Down) */}
                        {scrollPreview && (
                            <div className="space-y-2">
                                <label className="block text-xs text-gray-500">Vertical Position (from bottom)</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setScrollOffsetY(prev => Math.max(0, prev - 5))}
                                        className="p-2 bg-gray-100 rounded hover:bg-gray-200 transition"
                                        title="Move scroll down"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                    <div className="flex-1 text-center">
                                        <span className="text-sm font-medium text-gray-700">{scrollOffsetY}%</span>
                                        <p className="text-xs text-gray-400">offset from bottom</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setScrollOffsetY(prev => Math.min(50, prev + 5))}
                                        className="p-2 bg-gray-100 rounded hover:bg-gray-200 transition"
                                        title="Move scroll up"
                                    >
                                        <ChevronUp className="w-4 h-4" />
                                    </button>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="50"
                                    value={scrollOffsetY}
                                    onChange={(e) => setScrollOffsetY(parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>
                        )}
                        
                        {/* Clear Scroll Button */}
                        {scrollPreview && (
                            <button
                                type="button"
                                onClick={() => {
                                    setScrollFile(null);
                                    setScrollPreview(null);
                                }}
                                className="w-full py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                                Remove Scroll Overlay
                            </button>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Sound Effect Bubble */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Sound Effect Bubble
                        </label>
                        <p className="text-xs text-gray-400">
                            Audio that plays when user taps the bubble
                        </p>
                        <div className="relative group">
                            <input
                                type="file"
                                accept="audio/*"
                                className="hidden"
                                id="soundeffect-upload"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setSoundEffectFile(file);
                                        setSoundEffectPreview(URL.createObjectURL(file));
                                        setSoundEffectFilename(file.name);
                                    }
                                }}
                            />
                            <label
                                htmlFor="soundeffect-upload"
                                className="flex items-center justify-center w-full py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition"
                            >
                                {soundEffectPreview ? (
                                    <div className="flex items-center gap-2 text-green-600">
                                        <Music className="w-5 h-5" />
                                        <span className="text-xs font-medium truncate max-w-[150px]">
                                            {soundEffectFilename || 'Sound Effect'}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Music className="w-6 h-6 mx-auto mb-1" />
                                        <span className="text-xs">Upload Sound Effect</span>
                                    </div>
                                )}
                            </label>
                        </div>
                        
                        {/* Preview/Play Button */}
                        {soundEffectPreview && (
                            <div className="space-y-2">
                                <audio 
                                    src={soundEffectPreview} 
                                    controls 
                                    className="w-full h-8"
                                    style={{ height: '32px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSoundEffectFile(null);
                                        setSoundEffectPreview(null);
                                        setSoundEffectFilename(null);
                                    }}
                                    className="w-full py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition"
                                >
                                    Remove Sound Effect
                                </button>
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Coloring Page Settings */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Coloring Page
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isColoringPage}
                                    onChange={(e) => setIsColoringPage(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="text-sm text-gray-700">This is a coloring page</span>
                            </label>
                            
                            {isColoringPage && (
                                <div className="ml-6 space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={coloringEndModalOnly}
                                            onChange={(e) => setColoringEndModalOnly(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">Show only at end of book</span>
                                    </label>
                                    <p className="text-xs text-gray-400">
                                        If checked, this coloring page appears in the "The End" modal. 
                                        If unchecked, it shows as a regular page in the book.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Text Tools */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</label>
                        <button
                            onClick={addTextBox}
                            className="w-full py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 transition"
                        >
                            <Type className="w-4 h-4" />
                            Add Text Box
                        </button>
                    </div>

                    {/* Selected Item Properties */}
                    {selectedBox && (
                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 space-y-3 animate-in fade-in slide-in-from-left-4">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-indigo-800 uppercase">Edit Text</span>
                                <button onClick={() => deleteTextBox(selectedBox.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="relative">
                                <textarea
                                    ref={textareaRef}
                                    value={selectedBox.text}
                                    onChange={e => handleTextChange(selectedBox.id, e.target.value)}
                                    onKeyDown={e => {
                                        // Handle arrow keys and enter for suggestion selection
                                        if (showCharacterSuggestions && filteredCharacters.length > 0) {
                                            if (e.key === 'Escape') {
                                                setShowCharacterSuggestions(false);
                                            } else if (e.key === 'Enter' || e.key === 'Tab') {
                                                e.preventDefault();
                                                insertCharacterName(selectedBox.id, filteredCharacters[0].characterName);
                                            }
                                        }
                                    }}
                                    onBlur={() => {
                                        // Delay hiding to allow click on suggestion
                                        setTimeout(() => setShowCharacterSuggestions(false), 200);
                                    }}
                                    className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                    rows={3}
                                    placeholder={characterVoices.length > 0 ? 'Type @ to insert character voice...' : 'Enter text...'}
                                />
                                
                                {/* Character voice autocomplete dropdown */}
                                {showCharacterSuggestions && filteredCharacters.length > 0 && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-indigo-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                        <div className="px-2 py-1 bg-indigo-50 text-xs text-indigo-600 font-medium border-b">
                                            🎭 Character Voices
                                        </div>
                                        {filteredCharacters.map((char, idx) => (
                                            <button
                                                key={char.characterName}
                                                onClick={() => insertCharacterName(selectedBox.id, char.characterName)}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2 ${idx === 0 ? 'bg-indigo-50' : ''}`}
                                            >
                                                <span 
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: char.color || '#6366f1' }}
                                                />
                                                <span className="font-medium">@{char.characterName}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {/* No character voices hint */}
                                {showCharacterSuggestions && filteredCharacters.length === 0 && characterVoices.length === 0 && (
                                    <div className="absolute z-50 mt-1 w-full bg-white border border-orange-200 rounded-lg shadow-lg p-3">
                                        <p className="text-xs text-orange-600">
                                            💡 No character voices configured. Go to Book Settings → Character Voices to add characters.
                                        </p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Enhance Buttons */}
                            <div className="flex gap-2">
                                {/* Emotion Enhance Button */}
                                <button
                                    onClick={() => handleEnhanceText(selectedBox.id)}
                                    disabled={enhancingText || enhancingSfx}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 transition"
                                    title="Add emotion prompts (e.g., [laughs], [whispers])"
                                >
                                    {enhancingText ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <>
                                            <Sparkles className="w-3 h-3" />
                                            Emotion
                                        </>
                                    )}
                                </button>
                                
                                {/* Sound Effect Enhance Button */}
                                <button
                                    onClick={() => handleEnhanceSfx(selectedBox.id)}
                                    disabled={enhancingText || enhancingSfx}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 px-2 bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs font-semibold rounded-lg hover:from-green-600 hover:to-teal-600 disabled:opacity-50 transition"
                                    title="Add sound effect prompts (e.g., [birds chirping], [thunder])"
                                >
                                    {enhancingSfx ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <>
                                            <Music className="w-3 h-3" />
                                            Sound FX
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Emotion: [laughs], [whispers] • SFX: [birds chirping], [thunder]
                            </p>
                            
                            <div className="flex gap-1 bg-white p-1 rounded border border-gray-200">
                                <button
                                    onClick={() => updateTextBox(selectedBox.id, { alignment: 'left' })}
                                    className={`p-1 rounded ${selectedBox.alignment === 'left' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                >
                                    <AlignLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => updateTextBox(selectedBox.id, { alignment: 'center' })}
                                    className={`p-1 rounded ${selectedBox.alignment === 'center' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                >
                                    <AlignCenter className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => updateTextBox(selectedBox.id, { alignment: 'right' })}
                                    className={`p-1 rounded ${selectedBox.alignment === 'right' ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                                >
                                    <AlignRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Position Controls */}
                            <div className="space-y-2 p-2 bg-white rounded border border-gray-200">
                                <label className="text-xs font-semibold text-gray-600">Position</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-500">X Position</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBox.x)}
                                            onChange={e => updateTextBox(selectedBox.id, { x: Math.max(0, Math.min(100, Number(e.target.value))) })}
                                            className="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                            min={0}
                                            max={100}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Y Position</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBox.y)}
                                            onChange={e => updateTextBox(selectedBox.id, { y: Math.max(0, Math.min(100, Number(e.target.value))) })}
                                            className="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                            min={0}
                                            max={100}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400">Lower Y = higher on page. Try Y: 40-45 for top of 60% scroll.</p>
                            </div>
                            
                            {/* Size Controls */}
                            <div className="space-y-2 p-2 bg-white rounded border border-gray-200">
                                <label className="text-xs font-semibold text-gray-600">Size (%)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-500">Width</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBox.width || 30)}
                                            onChange={e => updateTextBox(selectedBox.id, { width: Math.max(5, Math.min(100, Number(e.target.value))) })}
                                            className="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                            min={5}
                                            max={100}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Height (0=auto)</label>
                                        <input
                                            type="number"
                                            value={Math.round(selectedBox.height || 0)}
                                            onChange={e => {
                                                const val = Number(e.target.value);
                                                updateTextBox(selectedBox.id, { height: val > 0 ? Math.min(100, val) : undefined });
                                            }}
                                            className="w-full text-sm p-1 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                            min={0}
                                            max={100}
                                            placeholder="Auto"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400">Height 0 = auto-size based on text content.</p>
                            </div>

                            {/* Font Family */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600">Font</label>
                                <select
                                    value={selectedBox.fontFamily}
                                    onChange={e => updateTextBox(selectedBox.id, { fontFamily: e.target.value })}
                                    className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                >
                                    <option value="Comic Sans MS">Comic Sans MS</option>
                                    <option value="Bubblegum Sans">Bubblegum Sans</option>
                                    <option value="Fredoka One">Fredoka One</option>
                                    <option value="Baloo 2">Baloo 2</option>
                                    <option value="Chewy">Chewy</option>
                                    <option value="Luckiest Guy">Luckiest Guy</option>
                                    <option value="Bangers">Bangers</option>
                                    <option value="Pacifico">Pacifico</option>
                                    <option value="Caveat">Caveat</option>
                                    <option value="Patrick Hand">Patrick Hand</option>
                                </select>
                            </div>

                            {/* Font Size */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600">Size: {selectedBox.fontSize}px</label>
                                <input
                                    type="range"
                                    min="12"
                                    max="72"
                                    value={selectedBox.fontSize}
                                    onChange={e => updateTextBox(selectedBox.id, { fontSize: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                            </div>

                            {/* Color */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600">Color</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['#4a3b2a', '#000000', '#ffffff', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8', '#a29bfe'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => updateTextBox(selectedBox.id, { color })}
                                            className={`w-8 h-8 rounded border-2 ${selectedBox.color === color ? 'border-indigo-600 scale-110' : 'border-gray-300'} transition-transform`}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                                <input
                                    type="color"
                                    value={selectedBox.color}
                                    onChange={e => updateTextBox(selectedBox.id, { color: e.target.value })}
                                    className="w-full h-8 rounded border"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold shadow-md hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : <><Save className="w-5 h-5" /> {editingPageId ? 'Update Page' : 'Save Page'}</>}
                    </button>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 bg-gray-200 flex items-center justify-center p-8 overflow-auto relative">
                {/* Canvas Container */}
                <div
                    ref={canvasRef}
                    className="relative bg-white shadow-2xl overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                        width: `${canvasWidth}px`,
                        height: `${canvasHeight}px`,
                        backgroundImage: !backgroundPreview ? 'linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)' : 'none',
                        backgroundSize: '20px 20px',
                        backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                    }}
                >
                    {/* Canvas resize handle (bottom-right corner) */}
                    <div
                        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-indigo-500 hover:bg-indigo-600 transition-colors z-50"
                        style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsResizingCanvas(true);
                        }}
                    />
                    {/* Background Layer */}
                    {(() => {
                        // If video sequence is enabled and has videos, show the first video as background
                        if (useVideoSequence && videoSequence.length > 0) {
                            const sortedVideos = [...videoSequence].sort((a, b) => a.order - b.order);
                            const firstVideo = sortedVideos[0];
                            const videoSrc = firstVideo.preview || resolveUrl(firstVideo.url);
                            
                            return (
                                <div className="absolute inset-0 pointer-events-none">
                                    <video 
                                        src={videoSrc} 
                                        className="w-full h-full object-cover" 
                                        autoPlay 
                                        loop 
                                        muted 
                                        playsInline
                                    />
                                    {/* Indicator that this is from video sequence */}
                                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full z-10">
                                        📹 Video Sequence ({videoSequence.length} videos)
                                    </div>
                                </div>
                            );
                        }
                        
                        // If image sequence is enabled and has images, show the first image as background
                        if (useImageSequence && imageSequence.length > 0) {
                            const sortedImages = [...imageSequence].sort((a, b) => a.order - b.order);
                            const firstImage = sortedImages[0];
                            const imageSrc = firstImage.preview || resolveUrl(firstImage.url);
                            
                            return (
                                <div className="absolute inset-0 pointer-events-none">
                                    <img 
                                        src={imageSrc} 
                                        className="w-full h-full object-cover" 
                                        alt="Background"
                                    />
                                    {/* Indicator that this is from image sequence */}
                                    <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full z-10">
                                        🖼️ Image Sequence ({imageSequence.length} images)
                                    </div>
                                </div>
                            );
                        }
                        
                        // Regular background
                        if (backgroundPreview) {
                            return (
                                <div className="absolute inset-0 pointer-events-none">
                                    {backgroundType === 'image' ? (
                                        <img src={backgroundPreview} className="w-full h-full object-cover" alt="Background" />
                                    ) : (
                                        <video 
                                            src={backgroundPreview} 
                                            className="w-full h-full object-cover" 
                                            autoPlay 
                                            loop 
                                            muted 
                                            playsInline
                                            onError={(e) => console.error('❌ Video failed to load:', backgroundPreview, e)}
                                            onLoadedData={() => console.log('✅ Video loaded successfully:', backgroundPreview)}
                                        />
                                    )}
                                </div>
                            );
                        }
                        
                        return null;
                    })()}

                    {/* Scroll Overlay Layer */}
                    {scrollPreview && (
                        <div 
                            className="absolute left-0 right-0 pointer-events-none z-10"
                            style={{ 
                                height: `${scrollHeight}%`,
                                bottom: `${scrollOffsetY}%` // Apply vertical offset
                            }}
                        >
                            <img 
                                src={scrollPreview} 
                                className="w-full h-full object-fill" 
                                alt="Scroll"
                                crossOrigin="anonymous"
                                onLoad={() => console.log('✅ Scroll image loaded:', scrollPreview)}
                                onError={() => {
                                    console.error('❌ Scroll image failed to load:', scrollPreview);
                                }}
                            />
                        </div>
                    )}

                    {/* Text Boxes Layer - positioned relative to scroll overlay */}
                    {textBoxes.map(box => {
                        // Calculate text position relative to scroll (like the app does)
                        // When scroll exists, text top should be at least at the top of the scroll
                        // Account for scroll offset (scrollOffsetY moves scroll up from bottom)
                        const scrollTopPosition = scrollPreview ? `calc(100% - ${scrollHeight}% - ${scrollOffsetY}% + 12px)` : `${box.y}%`;
                        const textTop = scrollPreview 
                            ? `max(${box.y}%, ${scrollTopPosition})`
                            : `${box.y}%`;
                        
                        return (
                        <div
                            key={box.id}
                            onMouseDown={(e) => handleMouseDown(e, box.id)}
                            className={`absolute cursor-move p-2 z-20 group ${selectedBoxId === box.id ? 'ring-2 ring-indigo-500 bg-white/20 backdrop-blur-sm rounded' : 'hover:ring-1 hover:ring-indigo-300'
                                }`}
                            style={{
                                left: `${box.x}%`,
                                top: textTop,
                                width: `${box.width || 30}%`,
                                transform: 'translate(0, 0)', // Remove centering transform to make resizing easier to reason about
                                textAlign: box.alignment,
                                color: box.color,
                                fontFamily: box.fontFamily,
                                fontSize: `${box.fontSize}px`,
                                height: 'auto', // Allow height to grow
                                minHeight: '50px',
                                // Smooth transition when scroll height changes
                                transition: 'top 0.3s ease-in-out',
                            }}
                        >
                            {/* Drag Handle Icon (visible on hover or select) */}
                            <div className={`absolute -top-6 left-0 bg-indigo-600 text-white p-1 rounded-full ${selectedBoxId === box.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                <Move className="w-3 h-3" />
                            </div>

                            {/* Resize Handle (Right Edge) */}
                            {selectedBoxId === box.id && (
                                <div
                                    className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-indigo-400/50 transition-colors"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setResizingBoxId(box.id);
                                    }}
                                >
                                    <div className="absolute top-1/2 right-0 -translate-y-1/2 w-1 h-4 bg-indigo-500 rounded-full" />
                                </div>
                            )}

                            {box.text}
                        </div>
                        );
                    })}

                    {/* Sound Effect Bubble Preview */}
                    {soundEffectPreview && (
                        <div
                            className="absolute z-30 cursor-pointer"
                            style={{
                                right: '15%',
                                top: '15%',
                                animation: 'float 3s ease-in-out infinite'
                            }}
                            title="Sound Effect Bubble - will appear at random position in app"
                        >
                            <div className="w-16 h-16 bg-gradient-to-br from-yellow-300 to-orange-400 rounded-full shadow-lg flex items-center justify-center border-4 border-white/50 hover:scale-110 transition-transform">
                                <Music className="w-8 h-8 text-white drop-shadow" />
                            </div>
                            <p className="text-xs text-white text-center mt-1 bg-black/50 rounded px-1">
                                Tap to play
                            </p>
                        </div>
                    )}

                    {/* Empty State Hint */}
                    {!backgroundPreview && !(useVideoSequence && videoSequence.length > 0) && !(useImageSequence && imageSequence.length > 0) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-gray-400 text-center">
                                <p className="text-xl font-semibold">Canvas Empty</p>
                                <p className="text-sm">Upload a background, video sequence, or image sequence</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="absolute bottom-4 right-4 text-gray-500 text-xs bg-white/80 px-2 py-1 rounded">
                    Canvas: {canvasWidth}x{canvasHeight}px
                </div>
            </div>

            {/* Right Sidebar - Existing Pages */}
            <div className="bg-white border-l border-gray-200 flex flex-col shadow-xl overflow-hidden relative" style={{ width: `${rightPanelWidth}px` }}>
                {/* Resize handle */}
                <div
                    className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-indigo-500 bg-indigo-300 transition-colors z-50"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizingRight(true);
                    }}
                />

                <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Pages ({existingPages.length})</h3>
                    <button
                        onClick={createNewPage}
                        className="bg-indigo-600 text-white px-3 py-1 rounded text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1"
                        title="Add New Page"
                    >
                        <span className="text-lg leading-none">+</span> New
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {loadingPages ? (
                        <div className="text-center text-gray-400 text-sm py-8">Loading pages...</div>
                    ) : existingPages.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8">No pages yet</div>
                    ) : (
                        existingPages.map((page) => (
                            <div
                                key={page._id}
                                className={`border rounded-lg overflow-hidden transition cursor-pointer group ${editingPageId === page._id
                                    ? 'border-indigo-600 ring-2 ring-indigo-300'
                                    : 'border-gray-200 hover:border-indigo-400'
                                    }`}
                                onClick={() => loadPage(page)}
                            >
                                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                    {/* Check all possible background URL locations */}
                                    {(page.backgroundUrl || page.files?.background?.url) ? (
                                        (page.backgroundType || page.files?.background?.type) === 'video' ? (
                                            <video
                                                src={resolveUrl(page.backgroundUrl || page.files?.background?.url)}
                                                className="w-full h-full object-cover"
                                                muted
                                                autoPlay
                                                loop
                                                playsInline
                                            />
                                        ) : (
                                            <img
                                                src={resolveUrl(page.backgroundUrl || page.files?.background?.url)}
                                                alt={`Page ${page.pageNumber}`}
                                                className="w-full h-full object-cover"
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <ImageIcon className="w-8 h-8" />
                                        </div>
                                    )}

                                    {/* Page number badge */}
                                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded">
                                        #{page.pageNumber}
                                    </div>
                                    
                                    {/* Delete button - visible on hover */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePage(page._id, page.pageNumber);
                                        }}
                                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all"
                                        title="Delete page"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="p-2 bg-white group-hover:bg-indigo-50 transition">
                                    <p className="text-xs text-gray-600 truncate">
                                        {(page.content?.textBoxes?.length || page.textBoxes?.length || 0)} text box{(page.content?.textBoxes?.length || page.textBoxes?.length || 0) !== 1 ? 'es' : ''}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Template Dialog */}
            {showTemplateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Save as Template?</h3>
                        <p className="text-gray-600 mb-6">
                            Would you like to reuse the scroll image and text box layout for all future pages in this book?
                            This will save you time when creating new pages!
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    // Save template to localStorage
                                    const template = {
                                        scrollUrl: scrollPreview || '',
                                        scrollHeight,
                                        textBoxes: textBoxes.map(({ id, ...rest }) => rest)
                                    };
                                    localStorage.setItem(`pageTemplate_${bookId}`, JSON.stringify(template));
                                    setPageTemplate(template);
                                    setShowTemplateDialog(false);
                                    createNewPage();
                                }}
                                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition"
                            >
                                Yes, Reuse Layout
                            </button>
                            <button
                                onClick={() => {
                                    setShowTemplateDialog(false);
                                    createNewPage();
                                }}
                                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
                            >
                                No, Thanks
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PageEditor;
