import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
    Save,
    Image as ImageIcon,
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
    X,
    Volume2,
    Smartphone,
    Monitor
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';

interface TextBox {
    id: string;
    text: string;
    x: number; // percentage (0-100)
    y: number; // percentage (0-100)
    width: number; // percentage (0-100)
    alignment: 'left' | 'center' | 'right';
    fontFamily: string;
    fontSize: number;
    color: string;
}

const PageEditor: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();

    // Core State
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
    const [scrollFile, setScrollFile] = useState<File | null>(null);
    const [soundEffectFiles, setSoundEffectFiles] = useState<File[]>([]);
    const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
    const [isColoringPage, setIsColoringPage] = useState(false);
    const [coloringEndModalOnly, setColoringEndModalOnly] = useState(true); // Default: show in end modal only
    const [loading, setLoading] = useState(false);

    // Previews
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const [scrollPreview, setScrollPreview] = useState<string | null>(null);
    const [soundEffects, setSoundEffects] = useState<Array<{ url: string; filename?: string; uploadedAt?: string }>>([]);
    
    // Scroll Height Settings (percentages)
    const [scrollMidHeight, setScrollMidHeight] = useState(30); // Mid state height %
    const [scrollMaxHeight, setScrollMaxHeight] = useState(60); // Max state height %
    const [scrollPreviewState, setScrollPreviewState] = useState<'hidden' | 'mid' | 'max'>('mid'); // Preview toggle

    // UI State
    const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [resizingBoxId, setResizingBoxId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);

    const [existingPages, setExistingPages] = useState<any[]>([]);
    const [loadingPages, setLoadingPages] = useState(true);
    const [editingPageId, setEditingPageId] = useState<string | null>(null);

    // Template for reusing scroll and text boxes
    const [pageTemplate, setPageTemplate] = useState<{
        scrollUrl: string;
        scrollMidHeight?: number;
        scrollMaxHeight?: number;
        textBoxes: Omit<TextBox, 'id'>[];
    } | null>(null);
    const [showScrollLibrary, setShowScrollLibrary] = useState(false);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [enhancingTextId, setEnhancingTextId] = useState<string | null>(null);
    const [enhancingSfxId, setEnhancingSfxId] = useState<string | null>(null);
    
    // Propagation dialogs for page 1 changes
    const [showScrollPropagateDialog, setShowScrollPropagateDialog] = useState(false);
    const [showColorPropagateDialog, setShowColorPropagateDialog] = useState(false);
    const [pendingScrollUrl, setPendingScrollUrl] = useState<string | null>(null);
    const [pendingTextColor, setPendingTextColor] = useState<string | null>(null);
    const [propagatingChanges, setPropagatingChanges] = useState(false);

    // Resizable panels
    const [leftPanelWidth, setLeftPanelWidth] = useState(320); // 320px = w-80
    const [rightPanelWidth, setRightPanelWidth] = useState(256); // 256px = w-64
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [isResizingCanvas, setIsResizingCanvas] = useState(false);
    
    // Book orientation
    const [bookOrientation, setBookOrientation] = useState<'portrait' | 'landscape'>('portrait');

    // Fetch book orientation first
    useEffect(() => {
        const fetchBookOrientation = async () => {
            if (!bookId) return;
            try {
                const res = await apiClient.get(`/api/books/${bookId}`);
                const orientation = res.data.orientation || 'portrait';
                setBookOrientation(orientation);
                
                // Set canvas dimensions based on orientation
                if (orientation === 'landscape') {
                    // 16:9 landscape aspect ratio
                    setCanvasWidth(960);
                    setCanvasHeight(540);
                } else {
                    // 9:16 portrait aspect ratio  
                    setCanvasWidth(540);
                    setCanvasHeight(960);
                }
            } catch (err) {
                console.error('Failed to fetch book orientation:', err);
            }
        };
        fetchBookOrientation();
    }, [bookId]);

    // Fetch existing pages for this book
    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                setExistingPages(res.data);

                // Auto-set page number to next available
                if (res.data.length > 0) {
                    const maxPageNum = Math.max(...res.data.map((p: any) => p.pageNumber));
                    setPageNumber(maxPageNum + 1);

                    // Load template from localStorage if it exists for this book
                    const savedTemplate = localStorage.getItem(`pageTemplate_${bookId}`);
                    if (savedTemplate) {
                        try {
                            const template = JSON.parse(savedTemplate);

                            // Clean up invalid blob URLs from template
                            if (template.scrollUrl && (template.scrollUrl.startsWith('blob:') || template.scrollUrl.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))) {
                                console.warn('Template contains invalid URL (blob or UUID), removing it:', template.scrollUrl);
                                template.scrollUrl = '';
                                // Update localStorage with cleaned template
                                localStorage.setItem(`pageTemplate_${bookId}`, JSON.stringify(template));
                            }

                            setPageTemplate(template);

                            // Apply template to new page
                            if (template.scrollUrl && !template.scrollUrl.startsWith('blob:')) {
                                // Resolve the URL to ensure it's absolute
                                const resolvedScrollUrl = resolveUrl(template.scrollUrl);
                                console.log('Loading template scroll:', { original: template.scrollUrl, resolved: resolvedScrollUrl });
                                setScrollPreview(resolvedScrollUrl);
                            }
                            
                            // Restore scroll height settings from template
                            if (template.scrollMidHeight) {
                                setScrollMidHeight(template.scrollMidHeight);
                            }
                            if (template.scrollMaxHeight) {
                                setScrollMaxHeight(template.scrollMaxHeight);
                            }

                            if (template.textBoxes && template.textBoxes.length > 0) {
                                const boxesWithIds = template.textBoxes.map((box: any, idx: number) => ({
                                    ...box,
                                    id: `template-${Date.now()}-${idx}`
                                }));
                                setTextBoxes(boxesWithIds);
                            }
                        } catch (err) {
                            console.error('Failed to parse template from localStorage:', err);
                            // Clear invalid template
                            localStorage.removeItem(`pageTemplate_${bookId}`);
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

    // Cleanup object URLs (only revoke blob URLs, not regular URLs)
    useEffect(() => {
        return () => {
            // Only revoke blob URLs on cleanup
            if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
                URL.revokeObjectURL(backgroundPreview);
            }
            if (scrollPreview && scrollPreview.startsWith('blob:')) {
                URL.revokeObjectURL(scrollPreview);
            }
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

    // Enhance text with ElevenLabs emotion prompts
    const enhanceText = async (id: string) => {
        const box = textBoxes.find(b => b.id === id);
        if (!box || !box.text.trim()) return;

        setEnhancingTextId(id);
        try {
            const response = await apiClient.post('/api/tts/enhance', { text: box.text });
            if (response.data.enhancedText) {
                updateTextBox(id, { text: response.data.enhancedText });
            }
        } catch (error) {
            console.error('Failed to enhance text:', error);
            alert('Failed to enhance text. Please try again.');
        } finally {
            setEnhancingTextId(null);
        }
    };

    // Enhance text with sound effect prompts
    const enhanceWithSoundEffects = async (id: string) => {
        const box = textBoxes.find(b => b.id === id);
        if (!box || !box.text.trim()) return;

        setEnhancingSfxId(id);
        try {
            const response = await apiClient.post('/api/tts/enhance-sfx', { text: box.text });
            if (response.data.enhancedText) {
                updateTextBox(id, { text: response.data.enhancedText });
            }
        } catch (error) {
            console.error('Failed to enhance text with sound effects:', error);
            alert('Failed to add sound effects. Please try again.');
        } finally {
            setEnhancingSfxId(null);
        }
    };

    // Helper to resolve image URLs
    const resolveUrl = (url?: string) => {
        if (!url) return '';
        // Allow blob URLs for preview
        if (url.startsWith('blob:')) return url;
        // Use the centralized getMediaUrl helper
        return getMediaUrl(url);
    };
    // Load existing page for editing
    const loadPage = (page: any) => {
        console.log('📄 Loading page data:', page);
        setEditingPageId(page._id);
        setPageNumber(page.pageNumber);
        
        // Load coloring page flags
        const isColoring = page.isColoringPage === true || page.isColoringPage === 'true';
        console.log('📄 Loading coloring state:', { 
            fromPage: page.isColoringPage, 
            parsed: isColoring 
        });
        setIsColoringPage(isColoring);
        
        // Only set modal-only flag if it exists, otherwise default to true
        const endModalOnly = page.coloringEndModalOnly !== false;
        console.log('📄 Loading end modal state:', { 
            fromPage: page.coloringEndModalOnly, 
            parsed: endModalOnly 
        });
        setColoringEndModalOnly(endModalOnly);

        // Get background type from legacy field or new structure
        const bgType = page.backgroundType || page.files?.background?.type || 'image';
        setBackgroundType(bgType);

        // Set background preview if URL exists - check both legacy and new structure
        const backgroundUrl = page.backgroundUrl || page.files?.background?.url;
        if (backgroundUrl) {
            setBackgroundPreview(resolveUrl(backgroundUrl));
            setBackgroundFile(null); // Clear file since we're using existing URL
        } else {
            setBackgroundPreview(null);
            setBackgroundFile(null);
        }

        // Set scroll preview if URL exists - check both legacy and new structure
        const scrollUrl = page.scrollUrl || page.files?.scroll?.url;
        if (scrollUrl) {
            setScrollPreview(resolveUrl(scrollUrl));
            setScrollFile(null);
        } else {
            setScrollPreview(null);
            setScrollFile(null);
        }
        
        // Load scroll height settings
        if (page.scrollMidHeight) {
            setScrollMidHeight(page.scrollMidHeight);
        }
        if (page.scrollMaxHeight) {
            setScrollMaxHeight(page.scrollMaxHeight);
        }

        // Load sound effects (multi) if exists; fallback to legacy single
        if (Array.isArray(page.files?.soundEffects) && page.files.soundEffects.length > 0) {
            setSoundEffects(page.files.soundEffects);
        } else if (page.files?.soundEffect?.url) {
            setSoundEffects([page.files.soundEffect]);
        } else {
            setSoundEffects([]);
        }
        setSoundEffectFiles([]);

        // Load text boxes with IDs for editing
        if (page.textBoxes && Array.isArray(page.textBoxes)) {
            const boxesWithIds = page.textBoxes.map((box: any, idx: number) => ({
                ...box,
                id: `${page._id}-${idx}`,
                fontFamily: box.fontFamily || 'Comic Sans MS',
                fontSize: box.fontSize || 24,
                color: box.color || '#4a3b2a',
                width: box.width || 30
            }));
            setTextBoxes(boxesWithIds);
        } else {
            setTextBoxes([]);
        }

        setSelectedBoxId(null);
    };

    // Delete page
    const handleDeletePage = async (pageId: string, pageNumber: number) => {
        if (!window.confirm(`Are you sure you want to delete page ${pageNumber}? This action cannot be undone.`)) {
            return;
        }

        try {
            await apiClient.delete(`/api/pages/${pageId}`);

            // Remove from existing pages list
            setExistingPages(existingPages.filter(p => p._id !== pageId));

            // If we were editing this page, clear the editor
            if (editingPageId === pageId) {
                createNewPage();
            }
        } catch (error) {
            console.error('Error deleting page:', error);
            alert('Failed to delete page. Please try again.');
        }
    };

    // Create new page (reset editor)
    const createNewPage = () => {
        setEditingPageId(null);
        const nextPageNum = existingPages.length > 0
            ? Math.max(...existingPages.map((p: any) => p.pageNumber)) + 1
            : 1;
        setPageNumber(nextPageNum);
        setIsColoringPage(false);
        setBackgroundType('image');
        setBackgroundFile(null);
        setBackgroundPreview(null);
        setScrollFile(null);
        setSoundEffectFiles([]);
        setSoundEffects([]);
        setSelectedBoxId(null);

        // Apply template if it exists
        if (pageTemplate) {
            if (pageTemplate.scrollUrl) {
                // Don't use blob URLs from template - they're invalid
                if (pageTemplate.scrollUrl.startsWith('blob:')) {
                    console.error('Template contains invalid blob URL, clearing scroll:', pageTemplate.scrollUrl);
                    setScrollPreview(null);
                    setScrollFile(null);
                } else {
                    // Use the template's scrollUrl directly (it's already the saved URL)
                    // Set preview to show it, but we'll use the template URL when saving
                    const templateScrollUrl = pageTemplate.scrollUrl;
                    setScrollPreview(resolveUrl(templateScrollUrl));
                    // Clear scrollFile so we use the template URL instead of trying to upload
                    setScrollFile(null);
                }
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
            // No template, but try to inherit scroll from previous page
            const lastPage = existingPages.find((p: any) => p.pageNumber === nextPageNum - 1);
            const lastScrollUrl = lastPage ? (lastPage.scrollUrl || lastPage.files?.scroll?.url) : null;

            if (lastScrollUrl) {
                console.log('Inheriting scroll from previous page:', lastScrollUrl);
                setScrollPreview(resolveUrl(lastScrollUrl));
            } else {
                setScrollPreview(null);
            }

            setScrollFile(null);
            setTextBoxes([]);
        }
    };

    // Propagate scroll to all pages
    const handlePropagateScroll = async (scrollUrl: string) => {
        if (!bookId || existingPages.length <= 1) return;
        
        setPropagatingChanges(true);
        try {
            // Update all pages except page 1 (which was just saved)
            const otherPages = existingPages.filter(p => p.pageNumber !== 1);
            
            for (const page of otherPages) {
                await apiClient.put(`/api/pages/${page._id}`, {
                    scrollUrl: scrollUrl,
                    scrollMidHeight: scrollMidHeight,
                    scrollMaxHeight: scrollMaxHeight
                });
            }
            
            // Update template
            const template = {
                scrollUrl: scrollUrl,
                scrollMidHeight: scrollMidHeight,
                scrollMaxHeight: scrollMaxHeight,
                textBoxes: pageTemplate?.textBoxes || textBoxes.map(({ id, ...rest }) => rest)
            };
            localStorage.setItem(`pageTemplate_${bookId}`, JSON.stringify(template));
            setPageTemplate(template);
            
            // Refresh pages list
            const res = await apiClient.get(`/api/pages/book/${bookId}`);
            setExistingPages(res.data);
            
            alert(`✅ Scroll background updated on ${otherPages.length} page(s)!`);
        } catch (error) {
            console.error('Error propagating scroll:', error);
            alert('Failed to update some pages. Please try again.');
        } finally {
            setPropagatingChanges(false);
            setShowScrollPropagateDialog(false);
            setPendingScrollUrl(null);
        }
    };

    // Propagate text color to all pages
    const handlePropagateTextColor = async (color: string) => {
        if (!bookId || existingPages.length <= 1) return;
        
        setPropagatingChanges(true);
        try {
            // Update all pages
            for (const page of existingPages) {
                if (page.textBoxes && page.textBoxes.length > 0) {
                    const updatedTextBoxes = page.textBoxes.map((box: any) => ({
                        ...box,
                        color: color
                    }));
                    
                    await apiClient.put(`/api/pages/${page._id}`, {
                        textBoxes: updatedTextBoxes
                    });
                }
            }
            
            // Update template with new color
            if (pageTemplate) {
                const updatedTemplate = {
                    ...pageTemplate,
                    textBoxes: pageTemplate.textBoxes.map(box => ({
                        ...box,
                        color: color
                    }))
                };
                localStorage.setItem(`pageTemplate_${bookId}`, JSON.stringify(updatedTemplate));
                setPageTemplate(updatedTemplate);
            }
            
            // Refresh pages list
            const res = await apiClient.get(`/api/pages/book/${bookId}`);
            setExistingPages(res.data);
            
            alert(`✅ Text color updated on all pages!`);
        } catch (error) {
            console.error('Error propagating text color:', error);
            alert('Failed to update some pages. Please try again.');
        } finally {
            setPropagatingChanges(false);
            setShowColorPropagateDialog(false);
            setPendingTextColor(null);
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

            // Prioritize uploading new file over using existing preview
            if (backgroundFile) {
                console.log('Uploading new background file:', {
                    filename: backgroundFile.name,
                    type: backgroundType,
                    currentPreview: backgroundPreview
                });
                const formData = new FormData();
                formData.append('file', backgroundFile);
                const endpoint = backgroundType === 'image' ? '/api/upload/image' : '/api/upload/video';
                // Upload with bookId and type for organized structure
                const uploadUrl = `${endpoint}?bookId=${bookId}&type=pages&pageNumber=${pageNumber}`;
                const res = await apiClient.post(uploadUrl, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                backgroundUrl = res.data.url;
                console.log('Background uploaded successfully:', backgroundUrl);

                // Clean up blob URL and update preview with the uploaded URL
                if (backgroundPreview && backgroundPreview.startsWith('blob:')) {
                    URL.revokeObjectURL(backgroundPreview);
                }
                setBackgroundPreview(backgroundUrl);
                setBackgroundFile(null); // Clear the file since it's now uploaded
            } else if (backgroundPreview) {
                // No new file, use existing preview URL
                // Don't use blob URLs - they're temporary and will fail
                if (backgroundPreview.startsWith('blob:')) {
                    console.warn('Background preview is a blob URL, cannot use for saving.');
                    backgroundUrl = ''; // Don't save invalid blob URLs
                } else if (backgroundPreview.startsWith('http')) {
                    backgroundUrl = backgroundPreview;
                } else {
                    // Try to resolve relative URLs
                    backgroundUrl = resolveUrl(backgroundPreview);
                }
                console.log('Using existing background preview:', backgroundUrl);
            } else {
                console.log('No background file or preview, backgroundUrl will be empty');
            }

            // Upload sound effects (multi)
            const uploadedSoundEffects: Array<{ url: string; filename?: string; uploadedAt?: string }> = [];
            if (soundEffectFiles.length > 0) {
                for (const f of soundEffectFiles) {
                    const formData = new FormData();
                    formData.append('file', f);
                    const soundEffectUploadUrl = `/api/upload/sound-effect?bookId=${bookId}&pageNumber=${pageNumber}`;
                    const res = await apiClient.post(soundEffectUploadUrl, formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    uploadedSoundEffects.push({
                        url: res.data.url,
                        filename: res.data.filename || f.name,
                        uploadedAt: new Date().toISOString(),
                    });
                }
                setSoundEffectFiles([]);
            }
            const finalSoundEffects = [...soundEffects, ...uploadedSoundEffects];
            if (uploadedSoundEffects.length > 0) {
                setSoundEffects(finalSoundEffects);
            }

            // Upload scroll
            let scrollUrl = '';

            // If there's a new file to upload, upload it
            if (scrollFile) {
                const formData = new FormData();
                formData.append('file', scrollFile);
                // Upload scroll with bookId and type for organized structure
                const scrollUploadUrl = `/api/upload/image?bookId=${bookId}&type=scroll&pageNumber=${pageNumber}`;
                const res = await apiClient.post(scrollUploadUrl, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                scrollUrl = res.data.url;

                // Clean up blob URL and update preview with the uploaded URL
                if (scrollPreview && scrollPreview.startsWith('blob:')) {
                    URL.revokeObjectURL(scrollPreview);
                }
                setScrollPreview(scrollUrl);
                setScrollFile(null); // Clear the file since it's now uploaded
            }
            // Otherwise, use the preview URL (could be from template or existing page)
            else if (scrollPreview) {
                // Don't use blob URLs - they're temporary and will fail
                if (scrollPreview.startsWith('blob:')) {
                    console.warn('Scroll preview is a blob URL, cannot use for saving. Using template URL if available.');
                    if (pageTemplate && pageTemplate.scrollUrl && !pageTemplate.scrollUrl.startsWith('blob:')) {
                        scrollUrl = pageTemplate.scrollUrl;
                    } else {
                        console.error('No valid template scrollUrl available and preview is blob URL');
                        scrollUrl = ''; // Don't save invalid blob URLs
                    }
                }
                // If it's from the template, prefer the template's scrollUrl (it's the saved URL)
                else if (pageTemplate && pageTemplate.scrollUrl && !pageTemplate.scrollUrl.startsWith('blob:')) {
                    scrollUrl = pageTemplate.scrollUrl;
                }
                // If it's already an absolute URL, use it directly
                else if (scrollPreview.startsWith('http')) {
                    scrollUrl = scrollPreview;
                }
                // Otherwise, try to resolve it (might be a relative URL)
                else {
                    scrollUrl = resolveUrl(scrollPreview);
                }
            }

            const payload: any = {
                bookId,
                pageNumber,
                backgroundUrl: backgroundUrl || null, // Explicitly set to null if empty
                backgroundType,
                scrollUrl: scrollUrl || null,
                scrollMidHeight: scrollMidHeight, // Dynamic scroll heights
                scrollMaxHeight: scrollMaxHeight,
                textBoxes: textBoxes.map(({ id, ...rest }) => rest), // Remove ID before sending
                isColoringPage,
                coloringEndModalOnly
            };

            console.log('Final payload before sending:', {
                backgroundUrl: payload.backgroundUrl,
                backgroundType: payload.backgroundType,
                pageNumber: payload.pageNumber,
                editingPageId
            });

            // Include sound effects if present
            if (finalSoundEffects.length > 0) {
                payload.files = payload.files || {};
                payload.files.soundEffects = finalSoundEffects.map((s) => ({
                    url: s.url,
                    filename: s.filename || 'sound-effect.mp3',
                    uploadedAt: s.uploadedAt ? new Date(s.uploadedAt) : undefined,
                }));
            }

            console.log('Sending payload:', JSON.stringify(payload, null, 2));

            // Use PUT to update existing page, POST to create new
            if (editingPageId) {
                await apiClient.put(`/api/pages/${editingPageId}`, payload);
                // Refresh pages list
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                setExistingPages(res.data);

                // Reload the updated page into the editor to keep state in sync
                const updatedPage = res.data.find((p: any) => p._id === editingPageId);
                if (updatedPage) {
                    console.log('Reloading updated page:', {
                        id: updatedPage._id,
                        backgroundUrl: updatedPage.backgroundUrl,
                        filesBackground: updatedPage.files?.background?.url,
                        backgroundType: updatedPage.backgroundType
                    });
                    loadPage(updatedPage);
                    
                    // If this is page 1 and there are other pages, offer to propagate scroll changes
                    if (pageNumber === 1 && res.data.length > 1 && scrollUrl && !scrollUrl.startsWith('blob:')) {
                        setPendingScrollUrl(scrollUrl);
                        setShowScrollPropagateDialog(true);
                    }
                } else {
                    console.error('Updated page not found in response');
                }

                if (!showScrollPropagateDialog) {
                    alert('Page updated successfully!');
                }
            } else {
                await apiClient.post('/api/pages', payload);

                // Refresh pages list
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                setExistingPages(res.data);

                // If this is page 1 and no template exists, ask if user wants to create one
                // Only show dialog if we have a valid scrollUrl (not blob URL)
                if (pageNumber === 1 && !pageTemplate && (scrollUrl && !scrollUrl.startsWith('blob:')) && textBoxes.length > 0) {
                    setShowTemplateDialog(true);
                } else if (pageNumber === 1 && !pageTemplate && scrollUrl && !scrollUrl.startsWith('blob:') && textBoxes.length === 0) {
                    // Only scroll, no text boxes - still offer template
                    setShowTemplateDialog(true);
                } else {
                    // Reset for new page - template will be auto-applied if it exists
                    createNewPage();
                }
                
                // If page 1 was saved and there are now other pages, offer to propagate scroll
                if (pageNumber === 1 && res.data.length > 1 && scrollUrl && !scrollUrl.startsWith('blob:')) {
                    setPendingScrollUrl(scrollUrl);
                    setShowScrollPropagateDialog(true);
                }
            }
        } catch (err: any) {
            console.error('Error saving page:', err);
            if (err.response) {
                console.error('Response data:', err.response.data);
                console.error('Response status:', err.response.status);

                // Handle duplicate page number error - offer to edit existing page
                if (err.response.data.error === 'DUPLICATE_PAGE_NUMBER' && err.response.data.existingPageId) {
                    const shouldEdit = window.confirm(
                        `Page ${pageNumber} already exists. Would you like to edit the existing page instead?`
                    );
                    if (shouldEdit) {
                        // Find and load the existing page
                        const existingPage = existingPages.find(p => p._id === err.response.data.existingPageId);
                        if (existingPage) {
                            loadPage(existingPage);
                            alert('Loaded existing page. Make your changes and click "Update Page" to save.');
                        } else {
                            // Page not in our list, fetch it
                            try {
                                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                                setExistingPages(res.data);
                                const page = res.data.find((p: any) => p._id === err.response.data.existingPageId);
                                if (page) {
                                    loadPage(page);
                                    alert('Loaded existing page. Make your changes and click "Update Page" to save.');
                                }
                            } catch {
                                alert('Could not load existing page. Please click on the page in the sidebar to edit it.');
                            }
                        }
                    }
                } else {
                    alert(`Failed to save page: ${err.response.data.message || 'Unknown error'}`);
                }
            } else {
                alert('Failed to save page');
            }
        } finally {
            setLoading(false);
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
                    </div>

                    {/* Coloring Page Toggle */}
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Coloring Page
                        </label>
                        <button
                            onClick={() => setIsColoringPage(!isColoringPage)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isColoringPage ? 'bg-purple-600' : 'bg-gray-200'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isColoringPage ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* Coloring Display Mode - Only visible when isColoringPage is ON */}
                    {isColoringPage && (
                        <div className="ml-4 p-3 bg-purple-50 rounded-lg border border-purple-200 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-purple-700">
                                    End Modal Only
                                </label>
                                <button
                                    onClick={() => setColoringEndModalOnly(!coloringEndModalOnly)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${coloringEndModalOnly ? 'bg-purple-600' : 'bg-gray-300'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${coloringEndModalOnly ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>
                            <p className="text-xs text-purple-600">
                                {coloringEndModalOnly 
                                    ? '✨ Page only accessible via "Color" button in end modal'
                                    : '📖 Page shows inline within the book during reading'
                                }
                            </p>
                        </div>
                    )}

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
                                className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
                            >
                                {backgroundPreview ? (
                                    backgroundType === 'image' ?
                                        <img src={backgroundPreview} className="w-full h-full object-cover rounded-lg opacity-50 group-hover:opacity-40" /> :
                                        <video src={backgroundPreview} className="w-full h-full object-cover rounded-lg opacity-50 group-hover:opacity-40" />
                                ) : (
                                    <div className="text-center text-gray-400">
                                        {backgroundType === 'image' ? <ImageIcon className="w-8 h-8 mx-auto mb-1" /> : <Video className="w-8 h-8 mx-auto mb-1" />}
                                        <span className="text-xs">Click to upload</span>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Scroll Overlay */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Scroll Overlay</label>
                            <button
                                onClick={() => setShowScrollLibrary(true)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                            >
                                <ImageIcon className="w-3 h-3" />
                                Select Existing
                            </button>
                        </div>
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
                                    }
                                }}
                            />
                            <label
                                htmlFor="scroll-upload"
                                className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
                            >
                                {scrollPreview && !scrollPreview.startsWith('blob:') ? (
                                    <img
                                        src={resolveUrl(scrollPreview)}
                                        className="w-full h-full object-contain rounded-lg opacity-80"
                                        onError={(e) => {
                                            console.error('Scroll preview image failed to load:', scrollPreview);
                                            const resolved = resolveUrl(scrollPreview);
                                            if (resolved && resolved !== scrollPreview) {
                                                e.currentTarget.src = resolved;
                                            } else {
                                                // Hide if can't load
                                                e.currentTarget.style.display = 'none';
                                            }
                                        }}
                                        alt="Scroll preview"
                                    />
                                ) : scrollPreview && scrollPreview.startsWith('blob:') ? (
                                    <div className="relative w-full h-full">
                                        <img
                                            src={scrollPreview}
                                            className="w-full h-full object-contain rounded-lg opacity-80"
                                            alt="Scroll preview"
                                            onError={(e) => {
                                                console.error('Scroll preview blob URL failed to load');
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs px-2 py-1 rounded text-center">
                                            Ready to upload
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-400">
                                        <Upload className="w-6 h-6 mx-auto mb-1" />
                                        <span className="text-xs">Upload Scroll Image</span>
                                    </div>
                                )}
                            </label>
                            {/* Delete Scroll Button */}
                            {scrollPreview && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (confirm('Are you sure you want to remove the scroll image from this page?')) {
                                            // Clean up blob URL if it exists
                                            if (scrollPreview.startsWith('blob:')) {
                                                URL.revokeObjectURL(scrollPreview);
                                            }
                                            setScrollPreview(null);
                                            setScrollFile(null);
                                        }
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors z-10"
                                    title="Remove scroll image"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        
                        {/* Scroll Height Controls */}
                        {scrollPreview && (
                            <div className="mt-4 space-y-3 p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                                        📜 Scroll Height Preview
                                    </label>
                                </div>
                                
                                {/* Preview State Toggle */}
                                <div className="flex gap-1 bg-amber-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setScrollPreviewState('hidden')}
                                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                                            scrollPreviewState === 'hidden' 
                                                ? 'bg-white text-amber-800 shadow' 
                                                : 'text-amber-600 hover:bg-white/50'
                                        }`}
                                    >
                                        Hidden
                                    </button>
                                    <button
                                        onClick={() => setScrollPreviewState('mid')}
                                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                                            scrollPreviewState === 'mid' 
                                                ? 'bg-white text-amber-800 shadow' 
                                                : 'text-amber-600 hover:bg-white/50'
                                        }`}
                                    >
                                        Mid ({scrollMidHeight}%)
                                    </button>
                                    <button
                                        onClick={() => setScrollPreviewState('max')}
                                        className={`flex-1 px-2 py-1.5 text-xs font-medium rounded transition-all ${
                                            scrollPreviewState === 'max' 
                                                ? 'bg-white text-amber-800 shadow' 
                                                : 'text-amber-600 hover:bg-white/50'
                                        }`}
                                    >
                                        Max ({scrollMaxHeight}%)
                                    </button>
                                </div>
                                
                                {/* Mid Height Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-amber-700 font-medium">Mid Height</span>
                                        <span className="text-amber-600 font-bold">{scrollMidHeight}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="15"
                                        max="50"
                                        value={scrollMidHeight}
                                        onChange={(e) => setScrollMidHeight(parseInt(e.target.value))}
                                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>
                                
                                {/* Max Height Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-amber-700 font-medium">Max Height</span>
                                        <span className="text-amber-600 font-bold">{scrollMaxHeight}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="40"
                                        max="80"
                                        value={scrollMaxHeight}
                                        onChange={(e) => setScrollMaxHeight(parseInt(e.target.value))}
                                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>
                                
                                <p className="text-[10px] text-amber-600 italic">
                                    💡 Users swipe up/down on the scroll to switch between Mid and Max heights
                                </p>
                                
                                {/* Apply to All Pages Button */}
                                {existingPages.length > 1 && scrollPreview && !scrollPreview.startsWith('blob:') && (
                                    <button
                                        onClick={() => {
                                            setPendingScrollUrl(scrollPreview);
                                            setShowScrollPropagateDialog(true);
                                        }}
                                        className="w-full mt-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <span>📜</span> Apply Scroll to All {existingPages.length - 1} Other Page(s)
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Sound Effects (multiple) */}
                    <div className="space-y-3">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Sound Effects (1-3 sec each)</label>
                        <div className="relative group">
                            <input
                                type="file"
                                accept="audio/*"
                                multiple
                                className="hidden"
                                id="sound-effect-upload"
                                onChange={e => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length === 0) return;

                                    const valid: File[] = [];
                                    for (const file of files) {
                                        // Validate file size (max 5MB)
                                        if (file.size > 5 * 1024 * 1024) {
                                            alert(`Sound effect "${file.name}" is too large. Maximum size is 5MB.`);
                                            continue;
                                        }
                                        valid.push(file);
                                    }
                                    if (valid.length > 0) {
                                        setSoundEffectFiles(prev => [...prev, ...valid]);
                                    }

                                    // Reset input so selecting the same file again works
                                    (e.target as HTMLInputElement).value = '';
                                }}
                            />
                            <label
                                htmlFor="sound-effect-upload"
                                className="flex items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition"
                            >
                                <div className="text-center text-gray-400">
                                    <Upload className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-xs">Upload Sound Effect(s)</span>
                                </div>
                            </label>
                        </div>
                        <p className="text-xs text-gray-500">
                            Add one or more short sound effects (1-3 seconds). Each will show as a tappable bubble in the book.
                        </p>

                        {/* Pending uploads */}
                        {soundEffectFiles.length > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="text-xs font-semibold text-yellow-800 mb-2">
                                    Pending uploads (will upload on Save)
                                </div>
                                <div className="space-y-2">
                                    {soundEffectFiles.map((f, idx) => (
                                        <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                                            <span className="truncate text-yellow-900">{f.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setSoundEffectFiles(prev => prev.filter((_, i) => i !== idx))}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Existing sound effects */}
                        {soundEffects.length > 0 && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                <div className="text-xs font-semibold text-gray-700 mb-2">
                                    Added sound effects
                                </div>
                                <div className="space-y-2">
                                    {soundEffects.map((s, idx) => (
                                        <div key={`${s.url}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                                            <a
                                                href={getMediaUrl(s.url)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="truncate text-indigo-700 hover:underline"
                                                title={s.filename || `Sound effect ${idx + 1}`}
                                            >
                                                {s.filename || `Sound effect ${idx + 1}`}
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => setSoundEffects(prev => prev.filter((_, i) => i !== idx))}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 text-[11px] text-gray-500">
                                    Note: removing here detaches it from the page (does not delete from storage).
                                </div>
                            </div>
                        )}
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
                            <textarea
                                value={selectedBox.text}
                                onChange={e => updateTextBox(selectedBox.id, { text: e.target.value })}
                                className="w-full text-sm p-2 border rounded focus:ring-2 focus:ring-indigo-300 outline-none"
                                rows={3}
                            />
                            {/* Enhance Buttons */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => enhanceText(selectedBox.id)}
                                    disabled={enhancingTextId === selectedBox.id || enhancingSfxId === selectedBox.id || !selectedBox.text.trim()}
                                    className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Add emotion prompts for ElevenLabs TTS (e.g., [laughs], [whispers], [excitedly])"
                                >
                                    {enhancingTextId === selectedBox.id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enhancing...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4" />
                                            TTS Emotions
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => enhanceWithSoundEffects(selectedBox.id)}
                                    disabled={enhancingSfxId === selectedBox.id || enhancingTextId === selectedBox.id || !selectedBox.text.trim()}
                                    className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-md font-medium text-sm flex items-center justify-center gap-2 hover:from-cyan-600 hover:to-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Add sound effect prompts (e.g., [gentle wind breeze], [door creaking], [birds chirping])"
                                >
                                    {enhancingSfxId === selectedBox.id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Adding SFX...
                                        </>
                                    ) : (
                                        <>
                                            <Volume2 className="w-4 h-4" />
                                            Sound Effects
                                        </>
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500">
                                <strong>TTS Emotions:</strong> [laughs], [whispers], [excitedly] • <strong>Sound Effects:</strong> [gentle wind breeze], [door creaking]
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
                                {/* Apply to All Pages Button */}
                                {existingPages.length > 1 && (
                                    <button
                                        onClick={() => {
                                            setPendingTextColor(selectedBox.color);
                                            setShowColorPropagateDialog(true);
                                        }}
                                        className="w-full mt-2 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 transition flex items-center justify-center gap-1.5"
                                    >
                                        <span>🎨</span> Apply Color to All Pages
                                    </button>
                                )}
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
            <div className="flex-1 bg-gray-200 flex flex-col items-center justify-center p-8 overflow-auto relative">
                {/* Orientation Indicator */}
                <div className="mb-4 flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                        bookOrientation === 'landscape' 
                            ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                            : 'bg-purple-100 text-purple-700 border border-purple-300'
                    }`}>
                        {bookOrientation === 'landscape' 
                            ? <><Monitor className="w-3.5 h-3.5" /> Landscape Mode</>
                            : <><Smartphone className="w-3.5 h-3.5" /> Portrait Mode</>
                        }
                    </span>
                    <span className="text-xs text-gray-500">
                        {canvasWidth} × {canvasHeight}px
                    </span>
                </div>
                
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
                    {backgroundPreview && (
                        <div className="absolute inset-0 pointer-events-none">
                            {backgroundType === 'image' ? (
                                <img src={backgroundPreview} className="w-full h-full object-cover" alt="Background" />
                            ) : (
                                <video src={backgroundPreview} className="w-full h-full object-cover" autoPlay loop muted />
                            )}
                        </div>
                    )}

                    {/* Scroll Overlay Layer */}
                    {scrollPreview && scrollPreviewState !== 'hidden' && (
                        <div 
                            className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 transition-all duration-300 ease-out"
                            style={{ 
                                height: scrollPreviewState === 'max' ? `${scrollMaxHeight}%` : `${scrollMidHeight}%` 
                            }}
                        >
                            <img
                                src={resolveUrl(scrollPreview)}
                                className="w-full h-full object-fill"
                                alt="Scroll"
                                onError={(e) => {
                                    console.error('Scroll image failed to load on canvas:', scrollPreview);
                                    const resolved = resolveUrl(scrollPreview);
                                    if (resolved && resolved !== scrollPreview) {
                                        e.currentTarget.src = resolved;
                                    } else {
                                        // Hide the image if it can't be loaded
                                        e.currentTarget.style.display = 'none';
                                    }
                                }}
                            />
                        </div>
                    )}
                    
                    {/* Scroll State Indicator */}
                    {scrollPreview && (
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full z-30 flex items-center gap-1">
                            📜 {scrollPreviewState === 'hidden' ? 'Hidden' : scrollPreviewState === 'mid' ? `Mid ${scrollMidHeight}%` : `Max ${scrollMaxHeight}%`}
                        </div>
                    )}
                    
                    {/* Scroll Boundary Guide Line */}
                    {scrollPreview && scrollPreviewState !== 'hidden' && (
                        <div 
                            className="absolute left-0 right-0 border-t-2 border-dashed border-amber-400/60 pointer-events-none z-5 transition-all duration-300 ease-out"
                            style={{ 
                                bottom: scrollPreviewState === 'max' ? `${scrollMaxHeight}%` : `${scrollMidHeight}%` 
                            }}
                        >
                            <span className="absolute -top-5 left-2 text-[10px] bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded font-medium">
                                📜 Text area starts here
                            </span>
                        </div>
                    )}

                    {/* Text Boxes Layer */}
                    {textBoxes.map(box => {
                        // Calculate scroll-responsive positioning
                        const hasScroll = !!scrollPreview && scrollPreviewState !== 'hidden';
                        const currentScrollHeight = scrollPreviewState === 'max' ? scrollMaxHeight : scrollMidHeight;
                        const scrollTopPercent = 100 - currentScrollHeight; // Where scroll starts from top
                        
                        // Text box top: either its own Y position or pushed up by scroll (whichever is lower on screen = higher %)
                        // We want the text to stay within the scroll area
                        const effectiveTop = hasScroll 
                            ? Math.max(box.y, scrollTopPercent + 5) // +5% padding from scroll top
                            : box.y;
                        
                        // Max height: prevent text from going below the canvas
                        const maxHeightPercent = hasScroll
                            ? (100 - effectiveTop - 10) // Leave some padding at bottom
                            : (100 - box.y - 10);
                        
                        return (
                        <div
                            key={box.id}
                            onMouseDown={(e) => handleMouseDown(e, box.id)}
                            className={`absolute cursor-move p-2 z-20 group transition-all duration-300 ease-out ${selectedBoxId === box.id ? 'ring-2 ring-indigo-500 bg-white/20 backdrop-blur-sm rounded' : 'hover:ring-1 hover:ring-indigo-300'
                                }`}
                            style={{
                                left: `${box.x}%`,
                                top: `${effectiveTop}%`,
                                width: `${box.width || 30}%`,
                                transform: 'translate(0, 0)', // Remove centering transform to make resizing easier to reason about
                                textAlign: box.alignment,
                                color: box.color,
                                fontFamily: box.fontFamily,
                                fontSize: `${box.fontSize}px`,
                                height: 'auto', // Allow height to grow
                                minHeight: '50px',
                                maxHeight: `${maxHeightPercent}%`,
                                overflowY: 'auto',
                                // Fade out when scroll is hidden
                                opacity: scrollPreview && scrollPreviewState === 'hidden' ? 0.3 : 1,
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

                    {/* Empty State Hint */}
                    {!backgroundPreview && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-gray-400 text-center">
                                <p className="text-xl font-semibold">Canvas Empty</p>
                                <p className="text-sm">Upload a background to start</p>
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
                                className={`border rounded-lg overflow-hidden transition group ${editingPageId === page._id
                                    ? 'border-indigo-600 ring-2 ring-indigo-300'
                                    : 'border-gray-200 hover:border-indigo-400'
                                    }`}
                            >
                                <div
                                    className="cursor-pointer"
                                    onClick={() => loadPage(page)}
                                >
                                    <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                                        {page.backgroundUrl ? (
                                            page.backgroundType === 'image' ? (
                                                <img
                                                    src={resolveUrl(page.backgroundUrl)}
                                                    alt={`Page ${page.pageNumber}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <video
                                                    src={resolveUrl(page.backgroundUrl)}
                                                    className="w-full h-full object-cover"
                                                    muted
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

                                        {/* Delete button - appears on hover */}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleDeletePage(page._id, page.pageNumber);
                                            }}
                                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                                            title="Delete page"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="p-2 bg-white group-hover:bg-indigo-50 transition">
                                        <p className="text-xs text-gray-600 truncate">
                                            {page.textBoxes?.length || 0} text box{page.textBoxes?.length !== 1 ? 'es' : ''}
                                        </p>
                                    </div>
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
                                onClick={async () => {
                                    // Get the actual scrollUrl from the saved page (not just preview)
                                    // The scrollUrl should be in the payload that was just saved
                                    let actualScrollUrl = '';

                                    // Always fetch from the saved page to get the real URL (not blob URL)
                                    try {
                                        const res = await apiClient.get(`/api/pages/book/${bookId}`);
                                        const page1 = res.data.find((p: any) => p.pageNumber === 1);
                                        if (page1 && page1.scrollUrl) {
                                            actualScrollUrl = page1.scrollUrl;
                                            console.log('Template: Using scrollUrl from saved page 1:', actualScrollUrl);
                                        } else {
                                            console.warn('Template: Page 1 not found or has no scrollUrl');
                                        }
                                    } catch (err) {
                                        console.error('Failed to fetch page 1 for template:', err);
                                        // Fallback: use scrollPreview but filter out blob URLs
                                        if (scrollPreview && !scrollPreview.startsWith('blob:')) {
                                            actualScrollUrl = scrollPreview;
                                        }
                                    }

                                    // Don't save blob URLs to template
                                    if (actualScrollUrl.startsWith('blob:')) {
                                        console.error('Template: Cannot save blob URL, skipping template creation');
                                        alert('Cannot save template: scroll image URL is invalid. Please try again.');
                                        setShowTemplateDialog(false);
                                        return;
                                    }

                                    // Save template to localStorage with the actual URL
                                    const template = {
                                        scrollUrl: actualScrollUrl,
                                        scrollMidHeight: scrollMidHeight,
                                        scrollMaxHeight: scrollMaxHeight,
                                        textBoxes: textBoxes.map(({ id, ...rest }) => rest)
                                    };
                                    localStorage.setItem(`pageTemplate_${bookId}`, JSON.stringify(template));
                                    setPageTemplate(template as any);
                                    console.log('Template saved:', template);
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

            {/* Scroll Propagation Dialog */}
            {showScrollPropagateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl border-2 border-amber-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">📜</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Apply Scroll to All Pages?</h3>
                        </div>
                        <p className="text-gray-600 mb-6">
                            You've updated the scroll background on <strong>Page 1</strong>. Would you like to apply this same scroll 
                            to all <strong>{existingPages.length - 1} other page(s)</strong> in this book?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => pendingScrollUrl && handlePropagateScroll(pendingScrollUrl)}
                                disabled={propagatingChanges}
                                className="flex-1 bg-amber-500 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {propagatingChanges ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Updating...
                                    </>
                                ) : (
                                    <>✓ Yes, Update All Pages</>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowScrollPropagateDialog(false);
                                    setPendingScrollUrl(null);
                                }}
                                disabled={propagatingChanges}
                                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
                            >
                                No, Just Page 1
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Text Color Propagation Dialog */}
            {showColorPropagateDialog && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl border-2 border-indigo-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-2xl">🎨</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Apply Text Color to All Pages?</h3>
                        </div>
                        <p className="text-gray-600 mb-4">
                            Would you like to apply this text color to all pages in this book?
                        </p>
                        <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
                            <div 
                                className="w-10 h-10 rounded-lg border-2 border-gray-300 shadow-inner"
                                style={{ backgroundColor: pendingTextColor || '#4a3b2a' }}
                            ></div>
                            <span className="text-gray-700 font-medium">{pendingTextColor}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => pendingTextColor && handlePropagateTextColor(pendingTextColor)}
                                disabled={propagatingChanges}
                                className="flex-1 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {propagatingChanges ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Updating...
                                    </>
                                ) : (
                                    <>✓ Yes, Update All Pages</>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowColorPropagateDialog(false);
                                    setPendingTextColor(null);
                                }}
                                disabled={propagatingChanges}
                                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
                            >
                                No, Just This Page
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Scroll Library Modal */}
            {showScrollLibrary && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowScrollLibrary(false)}>
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">Select Existing Scroll</h3>
                            <button onClick={() => setShowScrollLibrary(false)} className="text-gray-500 hover:text-gray-700">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-[200px]">
                            {(() => {
                                const uniqueScrolls = Array.from(new Set(
                                    existingPages
                                        .map((p: any) => p.scrollUrl || p.files?.scroll?.url)
                                        .filter((url: string) => url && !url.startsWith('blob:'))
                                ));

                                if (uniqueScrolls.length === 0) {
                                    return (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                            <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                                            <p>No existing scrolls found in this book.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="grid grid-cols-3 gap-4">
                                        {uniqueScrolls.map((url, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setScrollPreview(resolveUrl(url as string));
                                                    setScrollFile(null);
                                                    setShowScrollLibrary(false);
                                                }}
                                                className="border rounded-lg p-2 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition group relative aspect-video flex items-center justify-center bg-gray-100"
                                            >
                                                <img
                                                    src={resolveUrl(url as string)}
                                                    className="max-w-full max-h-full object-contain"
                                                    alt={`Scroll ${idx + 1}`}
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setShowScrollLibrary(false)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PageEditor;
