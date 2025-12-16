import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
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
    Video
} from 'lucide-react';

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
    const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
    const [loading, setLoading] = useState(false);

    // Previews
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const [scrollPreview, setScrollPreview] = useState<string | null>(null);

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
        scrollHeight: number;
        textBoxes: Omit<TextBox, 'id'>[];
    } | null>(null);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);

    // Resizable panels
    const [leftPanelWidth, setLeftPanelWidth] = useState(320); // 320px = w-80
    const [rightPanelWidth, setRightPanelWidth] = useState(256); // 256px = w-64
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [canvasHeight, setCanvasHeight] = useState(600);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [isResizingCanvas, setIsResizingCanvas] = useState(false);

    // Fetch existing pages for this book
    useEffect(() => {
        const fetchPages = async () => {
            if (!bookId) return;
            try {
                const res = await axios.get(`http://localhost:5001/api/pages/book/${bookId}`);
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

    // Helper to resolve image URLs
    const resolveUrl = (url?: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/uploads')) return `http://localhost:5001${url}`;
        return url;
    };

    // Load existing page for editing
    const loadPage = (page: any) => {
        setEditingPageId(page._id);
        setPageNumber(page.pageNumber);
        setBackgroundType(page.backgroundType || 'image');

        // Set background preview if URL exists
        if (page.backgroundUrl) {
            setBackgroundPreview(resolveUrl(page.backgroundUrl));
            setBackgroundFile(null); // Clear file since we're using existing URL
        }

        // Set scroll preview if URL exists
        if (page.scrollUrl) {
            setScrollPreview(resolveUrl(page.scrollUrl));
            setScrollFile(null);
        }

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
        setSelectedBoxId(null);

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
                const endpoint = backgroundType === 'image' ? '/api/upload/image' : '/api/upload/video';
                const res = await axios.post(`http://localhost:5001${endpoint}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                backgroundUrl = res.data.url;
            }

            // Upload scroll
            let scrollUrl = '';
            if (scrollPreview && scrollPreview.startsWith('http')) {
                scrollUrl = scrollPreview;
            }

            if (scrollFile) {
                const formData = new FormData();
                formData.append('file', scrollFile);
                const res = await axios.post('http://localhost:5001/api/upload/image', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                scrollUrl = res.data.url;
            }

            const payload = {
                bookId,
                pageNumber,
                backgroundUrl,
                backgroundType,
                scrollUrl,
                scrollHeight: 200, // Fixed for now, could make dynamic
                textBoxes: textBoxes.map(({ id, ...rest }) => rest), // Remove ID before sending
            };

            console.log('Sending payload:', JSON.stringify(payload, null, 2));

            // Use PUT to update existing page, POST to create new
            if (editingPageId) {
                await axios.put(`http://localhost:5001/api/pages/${editingPageId}`, payload);
                // Refresh pages list
                const res = await axios.get(`http://localhost:5001/api/pages/book/${bookId}`);
                setExistingPages(res.data);

                // Reload the updated page into the editor to keep state in sync
                const updatedPage = res.data.find((p: any) => p._id === editingPageId);
                if (updatedPage) {
                    loadPage(updatedPage);
                }

                alert('Page updated successfully!');
            } else {
                await axios.post('http://localhost:5001/api/pages', payload);

                // Refresh pages list
                const res = await axios.get(`http://localhost:5001/api/pages/book/${bookId}`);
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
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Scroll Overlay</label>
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
                    {scrollPreview && (
                        <div className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none z-10">
                            <img src={scrollPreview} className="w-full h-full object-fill" alt="Scroll" />
                        </div>
                    )}

                    {/* Text Boxes Layer */}
                    {textBoxes.map(box => (
                        <div
                            key={box.id}
                            onMouseDown={(e) => handleMouseDown(e, box.id)}
                            className={`absolute cursor-move p-2 z-20 group ${selectedBoxId === box.id ? 'ring-2 ring-indigo-500 bg-white/20 backdrop-blur-sm rounded' : 'hover:ring-1 hover:ring-indigo-300'
                                }`}
                            style={{
                                left: `${box.x}%`,
                                top: `${box.y}%`,
                                width: `${box.width || 30}%`,
                                transform: 'translate(0, 0)', // Remove centering transform to make resizing easier to reason about
                                textAlign: box.alignment,
                                color: box.color,
                                fontFamily: box.fontFamily,
                                fontSize: `${box.fontSize}px`,
                                height: 'auto', // Allow height to grow
                                minHeight: '50px',
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
                    ))}

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
                                className={`border rounded-lg overflow-hidden transition cursor-pointer group ${editingPageId === page._id
                                    ? 'border-indigo-600 ring-2 ring-indigo-300'
                                    : 'border-gray-200 hover:border-indigo-400'
                                    }`}
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
                                </div>

                                <div className="p-2 bg-white group-hover:bg-indigo-50 transition">
                                    <p className="text-xs text-gray-600 truncate">
                                        {page.textBoxes?.length || 0} text box{page.textBoxes?.length !== 1 ? 'es' : ''}
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
                                        scrollHeight: 200,
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
