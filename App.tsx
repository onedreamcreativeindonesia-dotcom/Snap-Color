import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Photo, EditSettings, DEFAULT_SETTINGS, Lut } from './types.ts';
import { processImage } from './utils/imageProcessing.ts';
import { parseCubeLut } from './utils/lutParser.ts';
import { PhotoGrid } from './components/PhotoGrid.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { ProcessedThumbnail } from './components/ProcessedThumbnail.tsx';
import { FolderOpen, Download, LayoutGrid, Maximize2, ChevronLeft, ChevronRight, Crop, Check, X, Undo2, Redo2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { GeminiAssistant } from './components/GeminiAssistant.tsx';

type HistoryItem = Record<string, EditSettings>;

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [luts, setLuts] = useState<Lut[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
  const [settingsMap, setSettingsMap] = useState<Record<string, EditSettings>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'edit'>('grid');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCropMode, setIsCropMode] = useState(false);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 1, h: 1 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenImageRef = useRef<HTMLImageElement>(new Image());

  const currentPhoto = photos.find(p => p.id === currentPhotoId);
  const currentSettings = currentPhotoId ? (settingsMap[currentPhotoId] || { ...DEFAULT_SETTINGS }) : DEFAULT_SETTINGS;

  const pushHistory = useCallback((newSettings: Record<string, EditSettings>) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(JSON.parse(JSON.stringify(newSettings)));
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setSettingsMap(JSON.parse(JSON.stringify(history[prevIdx])));
      setHistoryIndex(prevIdx);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setSettingsMap(JSON.parse(JSON.stringify(history[nextIdx])));
      setHistoryIndex(nextIdx);
    }
  }, [historyIndex, history]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos: Photo[] = Array.from(e.target.files)
        .filter((file: File) => file.type.startsWith('image/'))
        .map((file: File) => ({
          id: Math.random().toString(36).substr(2, 9),
          file,
          previewUrl: URL.createObjectURL(file),
          name: file.name
        }));
      setPhotos(prev => [...prev, ...newPhotos]);
    }
  };

  const handleImportLut = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const loadedLuts: Lut[] = [];
      for (const file of files) {
        if (file.name.toLowerCase().endsWith('.cube')) {
          const text = await file.text();
          try { loadedLuts.push(parseCubeLut(file.name.replace('.cube', ''), text)); } catch (err) { }
        }
      }
      setLuts(prev => [...prev, ...loadedLuts]);
    }
  };

  const updateSetting = (key: keyof EditSettings, value: any, saveToHistory = true) => {
    if (!currentPhotoId) return;
    setSettingsMap(prev => {
      const next = {
        ...prev,
        [currentPhotoId]: { ...(prev[currentPhotoId] || DEFAULT_SETTINGS), [key]: value }
      };
      if (saveToHistory) pushHistory(next);
      return next;
    });
  };

  const syncSettings = useCallback((all: boolean) => {
    if (!currentPhotoId) return;
    const sourceSettings = settingsMap[currentPhotoId] || DEFAULT_SETTINGS;
    const targets = all ? photos.map(p => p.id) : Array.from(selectedIds);
    setSettingsMap(prev => {
      const next = { ...prev };
      targets.forEach(id => { 
        next[id] = JSON.parse(JSON.stringify(sourceSettings));
      });
      pushHistory(next);
      return next;
    });
  }, [currentPhotoId, settingsMap, photos, selectedIds, pushHistory]);

  const handleExportAll = async () => {
    setIsProcessing(true);
    for (const photo of photos) {
      const settings = settingsMap[photo.id] || DEFAULT_SETTINGS;
      const activeLut = settings.lutId ? luts.find(l => l.id === settings.lutId) || null : null;
      const img = new Image();
      img.src = photo.previewUrl;
      await new Promise(r => img.onload = r);
      
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) continue;

      if (settings.crop) {
        exportCanvas.width = img.naturalWidth * settings.crop.width;
        exportCanvas.height = img.naturalHeight * settings.crop.height;
        ctx.drawImage(img, settings.crop.x * img.naturalWidth, settings.crop.y * img.naturalHeight, exportCanvas.width, exportCanvas.height, 0, 0, exportCanvas.width, exportCanvas.height);
      } else {
        exportCanvas.width = img.naturalWidth;
        exportCanvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }
      
      const processed = processImage(ctx.getImageData(0,0,exportCanvas.width,exportCanvas.height), settings, activeLut);
      ctx.putImageData(processed, 0, 0);
      
      const link = document.createElement('a');
      link.download = `Snap_${photo.name}`;
      link.href = exportCanvas.toDataURL('image/jpeg', 0.95);
      link.click();
    }
    setIsProcessing(false);
  };

  const confirmCrop = useCallback(() => {
    if (!isCropMode) return;
    updateSetting('crop', {
      x: cropRect.x,
      y: cropRect.y,
      width: cropRect.w,
      height: cropRect.h
    });
    setIsCropMode(false);
  }, [isCropMode, cropRect, updateSetting]);

  const toggleCropMode = useCallback(() => {
    if (isCropMode) {
      confirmCrop();
    } else {
      if (currentSettings.crop) {
        setCropRect({
          x: currentSettings.crop.x,
          y: currentSettings.crop.y,
          w: currentSettings.crop.width,
          h: currentSettings.crop.height
        });
      } else {
        setCropRect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 });
      }
      setIsCropMode(true);
    }
  }, [isCropMode, currentSettings.crop, confirmCrop]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isCropMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const hitTest = (hx: number, hy: number) => Math.sqrt((x - hx) ** 2 + (y - hy) ** 2) < 0.05;
    
    if (hitTest(cropRect.x, cropRect.y)) setActiveHandle('tl');
    else if (hitTest(cropRect.x + cropRect.w, cropRect.y)) setActiveHandle('tr');
    else if (hitTest(cropRect.x, cropRect.y + cropRect.h)) setActiveHandle('bl');
    else if (hitTest(cropRect.x + cropRect.w, cropRect.y + cropRect.h)) setActiveHandle('br');
    else if (hitTest(cropRect.x + cropRect.w / 2, cropRect.y)) setActiveHandle('t');
    else if (hitTest(cropRect.x + cropRect.w / 2, cropRect.y + cropRect.h)) setActiveHandle('b');
    else if (hitTest(cropRect.x, cropRect.y + cropRect.h / 2)) setActiveHandle('l');
    else if (hitTest(cropRect.x + cropRect.w, cropRect.y + cropRect.h / 2)) setActiveHandle('r');
    else if (x > cropRect.x && x < cropRect.x + cropRect.w && y > cropRect.y && y < cropRect.y + cropRect.h) setActiveHandle('move');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeHandle || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setCropRect(prev => {
      let { x: nx, y: ny, w: nw, h: nh } = prev;
      if (activeHandle === 'tl') { nw += nx - x; nh += ny - y; nx = x; ny = y; }
      else if (activeHandle === 'tr') { nw = x - nx; nh += ny - y; ny = y; }
      else if (activeHandle === 'bl') { nw += nx - x; nx = x; nh = y - ny; }
      else if (activeHandle === 'br') { nw = x - nx; nh = y - ny; }
      else if (activeHandle === 't') { nh += ny - y; ny = y; }
      else if (activeHandle === 'b') { nh = y - ny; }
      else if (activeHandle === 'l') { nw += nx - x; nx = x; }
      else if (activeHandle === 'r') { nw = x - nx; }
      else if (activeHandle === 'move') { /* Move logic if desired */ }
      return { x: nx, y: ny, w: Math.max(0.05, nw), h: Math.max(0.05, nh) };
    });
  };

  const handleMouseUp = () => setActiveHandle(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isInput) return;

      if (e.key.toLowerCase() === 'c') {
        toggleCropMode();
      } else if (e.key === 'Enter') {
        if (isCropMode) confirmCrop();
      } else if (e.key.toLowerCase() === 'a') {
        syncSettings(true);
      } else if (e.key.toLowerCase() === 'z' && (e.metaKey || e.ctrlKey)) {
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === 'y' && (e.metaKey || e.ctrlKey)) {
        redo();
      } else if (e.key === 'Escape' && isCropMode) {
        setIsCropMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCropMode, cropRect, undo, redo, syncSettings, confirmCrop, toggleCropMode]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    const container = containerRef.current;
    if (!ctx || !container || !hiddenImageRef.current.complete) return;
    
    const img = hiddenImageRef.current;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const padding = 80; 
    let maxWidth = container.clientWidth - padding;
    let maxHeight = container.clientHeight - padding;
    let w = maxWidth;
    let h = w / imgRatio;
    if (h > maxHeight) { h = maxHeight; w = h * imgRatio; }
    
    if (canvas.width !== Math.floor(w) || canvas.height !== Math.floor(h)) {
      canvas.width = Math.floor(w);
      canvas.height = Math.floor(h);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentSettings.crop && !isCropMode) {
      const cx = currentSettings.crop.x * img.naturalWidth;
      const cy = currentSettings.crop.y * img.naturalHeight;
      const cw = currentSettings.crop.width * img.naturalWidth;
      const ch = currentSettings.crop.height * img.naturalHeight;
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    const processed = processImage(ctx.getImageData(0,0,canvas.width,canvas.height), currentSettings, luts.find(l => l.id === currentSettings.lutId) || null);
    ctx.putImageData(processed, 0, 0);

    if (isCropMode) {
      const { x: rx, y: ry, w: rw, h: rh } = cropRect;
      const px = rx * canvas.width;
      const py = ry * canvas.height;
      const pw = rw * canvas.width;
      const ph = rh * canvas.height;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width, py);
      ctx.fillRect(0, py + ph, canvas.width, canvas.height - py - ph);
      ctx.fillRect(0, py, px, ph);
      ctx.fillRect(px + pw, py, canvas.width - px - pw, ph);
      ctx.strokeStyle = '#355faa';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
      ctx.fillStyle = '#355faa';
      const hs = 12;
      ctx.fillRect(px - hs/2, py - hs/2, hs, hs);
      ctx.fillRect(px + pw - hs/2, py - hs/2, hs, hs);
      ctx.fillRect(px - hs/2, py + ph - hs/2, hs, hs);
      ctx.fillRect(px + pw - hs/2, py + ph - hs/2, hs, hs);
    }
  }, [currentSettings, luts, isCropMode, cropRect]);

  useEffect(() => {
    if (viewMode === 'edit' && currentPhoto) {
      if (hiddenImageRef.current.src !== currentPhoto.previewUrl) {
        hiddenImageRef.current.src = currentPhoto.previewUrl;
        hiddenImageRef.current.onload = render;
      } else { render(); }
    }
  }, [viewMode, currentPhoto, render]);

  useEffect(() => {
    const observer = new ResizeObserver(render);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [render]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 text-slate-800 overflow-hidden select-none">
      <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8 shadow-sm z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-[#355faa] rounded-xl shadow-lg flex items-center justify-center text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800 tracking-tight">Snap Color</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Professional AI Colorist</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-[#355faa] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={20} /></button>
            <button onClick={() => { if(photos.length) { setCurrentPhotoId(currentPhotoId || photos[0].id); setViewMode('edit'); } }} className={`p-2 rounded-lg transition-all ${viewMode === 'edit' ? 'bg-white text-[#355faa] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><Maximize2 size={20} /></button>
          </div>
          
          <div className="flex items-center gap-1.5 border-l border-slate-100 pl-3">
            <button onClick={undo} disabled={historyIndex <= 0} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"><Undo2 size={18} /></button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 disabled:opacity-30 transition-all"><Redo2 size={18} /></button>
          </div>

          <button 
            onClick={toggleCropMode} 
            className={`p-2.5 rounded-xl border transition-all ${isCropMode || currentSettings.crop ? 'bg-[#fbdc00] text-slate-800 border-[#eab308] shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            {isCropMode ? <Check size={20} /> : currentSettings.crop ? <X size={20} onClick={(e) => { if(currentSettings.crop) { e.stopPropagation(); updateSetting('crop', null); } }} /> : <Crop size={20} />}
          </button>
          
          <button onClick={handleExportAll} disabled={isProcessing || photos.length === 0} className="px-5 py-2.5 bg-[#355faa] text-white hover:opacity-90 rounded-xl font-semibold text-xs uppercase tracking-widest shadow-lg shadow-blue-900/10 transition-all flex items-center gap-2">
            <Download size={14} /> Export
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className={`${viewMode === 'grid' ? 'w-full' : 'w-0 md:w-72'} transition-all duration-300 border-r border-slate-100 bg-white flex flex-col overflow-hidden`}>
            <div className={`flex-1 overflow-y-auto p-5 custom-scrollbar ${viewMode === 'grid' ? 'hidden' : 'block'}`}>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-[0.2em]">Library</span>
                <label className="cursor-pointer text-[#355faa] hover:underline text-[10px] font-bold">
                  <FolderOpen size={14} className="inline mr-1" /> Add
                  <input type="file" multiple {...{ webkitdirectory: "", directory: "" } as any} onChange={handleImport} className="hidden" />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {photos.map(p => {
                  const settings = settingsMap[p.id] || DEFAULT_SETTINGS;
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => setCurrentPhotoId(p.id)} 
                      className={`aspect-square rounded-2xl overflow-hidden cursor-pointer border-2 transition-all relative group shadow-sm ${currentPhotoId === p.id ? 'border-[#355faa] ring-4 ring-blue-50' : 'border-transparent hover:border-slate-200'}`}
                    >
                      <ProcessedThumbnail photo={p} settings={settings} luts={luts} />
                      <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>
            </div>
            {viewMode === 'grid' && (
              <div className="flex-1 flex flex-col bg-slate-50">
                <div className="p-8 pb-4">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-3xl cursor-pointer bg-white hover:bg-slate-50 hover:border-blue-400 transition-all group shadow-sm mb-6">
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <FolderOpen className="text-slate-400 group-hover:text-[#355faa] mb-2 transition-colors" size={32} />
                      <p className="text-xs font-bold text-slate-500">Drop your photo folder here</p>
                      <p className="text-[10px] text-slate-400 mt-1">Images will stay on your device</p>
                    </div>
                    <input type="file" multiple {...{ webkitdirectory: "", directory: "" } as any} onChange={handleImport} className="hidden" />
                  </label>
                </div>
                <PhotoGrid 
                  photos={photos} 
                  selectedIds={selectedIds} 
                  onSelect={(id, m) => setSelectedIds(s => { const n = new Set(m ? s : []); n.has(id) ? n.delete(id) : n.add(id); return n; })} 
                  currentPhotoId={currentPhotoId} 
                  onOpen={p => { setCurrentPhotoId(p.id); setViewMode('edit'); }} 
                  settingsMap={settingsMap}
                  luts={luts}
                />
              </div>
            )}
        </div>

        {viewMode === 'edit' && (
          <div ref={containerRef} className="flex-1 bg-[#f1f5f9] relative flex items-center justify-center overflow-hidden checkerboard-bg">
            <div className="relative inline-block max-w-full max-h-full fade-in">
              <canvas 
                ref={canvasRef} 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className={`max-w-full max-h-full shadow-2xl rounded-sm ${isCropMode ? 'cursor-crosshair' : 'cursor-default'}`} 
              />
              {isCropMode && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white text-slate-800 px-6 py-2.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-xl border border-slate-100 flex items-center gap-3">
                  <span className="text-[#355faa] flex items-center gap-1.5">Crop Mode</span>
                  <div className="h-3 w-px bg-slate-200"></div>
                  <span>Enter to Confirm</span>
                </div>
              )}
            </div>
            
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-white/90 backdrop-blur-xl px-8 py-4 rounded-3xl border border-slate-100 shadow-2xl z-40">
              <button 
                className="text-slate-400 hover:text-[#355faa] transition-all hover:scale-125 disabled:opacity-20" 
                onClick={() => { const i = photos.findIndex(p => p.id === currentPhotoId); if(i > 0) setCurrentPhotoId(photos[i-1].id); }}
                disabled={photos.findIndex(p => p.id === currentPhotoId) <= 0}
              >
                <ChevronLeft size={28} />
              </button>
              <div className="flex flex-col items-center min-w-[100px]">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">IMAGE</span>
                <span className="text-sm font-bold text-slate-800">{photos.findIndex(p => p.id === currentPhotoId) + 1} / {photos.length}</span>
              </div>
              <button 
                className="text-slate-400 hover:text-[#355faa] transition-all hover:scale-125 disabled:opacity-20" 
                onClick={() => { const i = photos.findIndex(p => p.id === currentPhotoId); if(i < photos.length-1) setCurrentPhotoId(photos[i+1].id); }}
                disabled={photos.findIndex(p => p.id === currentPhotoId) >= photos.length - 1}
              >
                <ChevronRight size={28} />
              </button>
            </div>
          </div>
        )}

        {viewMode === 'edit' && currentPhotoId && (
          <div className="flex flex-col h-full bg-white shadow-2xl z-40 border-l border-slate-100 w-80 shrink-0">
            <ControlPanel 
              settings={currentSettings} 
              updateSetting={(k, v) => updateSetting(k, v)} 
              syncSettings={syncSettings} 
              selectedCount={selectedIds.size} 
              totalCount={photos.length} 
              luts={luts} 
              onImportLut={handleImportLut} 
            />
            <div className="p-5 bg-slate-50 border-t border-slate-100">
              <GeminiAssistant currentImageBase64={canvasRef.current?.toDataURL('image/jpeg', 0.4) || null} onApplySuggestion={(s) => {
                Object.entries(s).forEach(([k, v]) => updateSetting(k as any, v));
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}