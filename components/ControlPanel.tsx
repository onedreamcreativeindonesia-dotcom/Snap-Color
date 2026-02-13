import React from 'react';
import { EditSettings, Lut } from '../types.ts';
import { Sun, Contrast, Cloud, CloudRain, Zap, Palette, Upload, Sliders, Target, Droplet, Scissors, Info } from 'lucide-react';

interface ControlPanelProps {
  settings: EditSettings;
  updateSetting: (key: keyof EditSettings, value: any) => void;
  syncSettings: (all: boolean) => void;
  selectedCount: number;
  totalCount: number;
  luts: Lut[];
  onImportLut: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ 
  settings, 
  updateSetting, 
  syncSettings,
  selectedCount,
  totalCount,
  luts,
  onImportLut
}) => {

  const Slider = ({ label, icon: Icon, value, onChange, min = -100, max = 100, step = 1, gradient = '' }: { label: string, icon: any, value: number, onChange: (v: number) => void, min?: number, max?: number, step?: number, gradient?: string }) => (
    <div className="mb-5 group">
      <div className="flex justify-between items-center mb-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold group-hover:text-slate-600 transition-colors">
        <div className="flex items-center gap-2">
          <Icon size={12} className="text-slate-300 group-hover:text-[#355faa] transition-colors" />
          {label}
        </div>
        <div className="flex items-center gap-2 font-mono">
           <button onClick={() => onChange(0)} className="opacity-0 group-hover:opacity-100 text-[9px] text-[#355faa] hover:underline transition-opacity">Reset</button>
           <span className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded min-w-[24px] text-center">{Math.round(value)}</span>
        </div>
      </div>
      <div className="relative flex items-center h-4">
        {gradient ? (
          <div className="absolute inset-x-0 h-1 rounded-full z-0 opacity-40" style={{ background: gradient }}></div>
        ) : (
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 pointer-events-none z-0"></div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1 bg-slate-200 rounded-full appearance-none cursor-pointer range-slider focus:outline-none z-10"
        />
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-6 bg-white custom-scrollbar">
      
      <div className="grid grid-cols-2 gap-3 mb-8">
        <button onClick={() => syncSettings(false)} disabled={selectedCount < 2} className="flex items-center justify-center py-2.5 bg-white hover:bg-slate-50 disabled:opacity-30 text-slate-600 text-[10px] rounded-xl border border-slate-200 font-bold uppercase tracking-widest transition-all shadow-sm">
          Selected ({selectedCount})
        </button>
        <button onClick={() => syncSettings(true)} className="flex items-center justify-center py-2.5 bg-[#355faa] hover:opacity-90 text-white text-[10px] rounded-xl font-bold shadow-lg shadow-blue-900/10 uppercase tracking-widest transition-all">
          Sync All ({totalCount})
        </button>
      </div>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                <Target size={14} className="text-[#355faa]" /> Smart Selection
            </h3>
            <div className="p-1 text-slate-300 hover:text-slate-400 cursor-help" title="Refine color masks for skin tones"><Info size={12} /></div>
        </div>
        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
          <Slider 
            label="Target Hue" 
            icon={Palette} 
            value={settings.skinHue} 
            onChange={(v) => updateSetting('skinHue', v)} 
            min={0} 
            max={100} 
            gradient="linear-gradient(to right, #ff0000 0%, #ff8c00 50%, #ffff00 100%)"
          />
          <Slider label="Range" icon={Target} value={settings.skinDetectionRange} onChange={(v) => updateSetting('skinDetectionRange', v)} min={0} max={100} />
          
          <div className="h-px bg-slate-200 my-5"></div>
          
          <Slider label="Saturation" icon={Droplet} value={settings.skinSaturation} onChange={(v) => updateSetting('skinSaturation', v)} />
          <Slider label="Luminance" icon={Sun} value={settings.skinLuminance} onChange={(v) => updateSetting('skinLuminance', v)} />
          
          <div className="h-px bg-slate-200 my-5"></div>
          
          <Slider label="Texture" icon={Scissors} value={settings.skinTexture} onChange={(v) => updateSetting('skinTexture', v)} />
          <Slider label="Clarity" icon={Contrast} value={settings.skinClarity} onChange={(v) => updateSetting('skinClarity', v)} />
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
          <Sun size={14} className="text-[#fbdc00]" /> Global Adjust
        </h3>
        <Slider label="Exposure" icon={Zap} value={settings.exposure} onChange={(v) => updateSetting('exposure', v)} />
        <Slider label="Contrast" icon={Contrast} value={settings.contrast} onChange={(v) => updateSetting('contrast', v)} />
        <Slider label="Highlights" icon={Cloud} value={settings.highlights} onChange={(v) => updateSetting('highlights', v)} />
        <Slider label="Shadows" icon={CloudRain} value={settings.shadows} onChange={(v) => updateSetting('shadows', v)} />
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
                <Palette size={14} className="text-[#355faa]" /> Color Profiles
            </h3>
            <label className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-lg cursor-pointer flex items-center gap-1 border border-slate-200 transition-colors font-bold">
                <Upload size={10} /> .cube
                <input type="file" accept=".cube" multiple onChange={onImportLut} className="hidden" />
            </label>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => updateSetting('lutId', null)} className={`text-[10px] px-3 py-2 rounded-xl border transition-all font-bold ${!settings.lutId ? 'border-[#355faa] bg-[#355faa] text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>Standard</button>
            {luts.map(lut => (
                <button key={lut.id} onClick={() => updateSetting('lutId', lut.id)} className={`text-[10px] px-3 py-2 rounded-xl border transition-all font-bold truncate ${settings.lutId === lut.id ? 'border-[#355faa] bg-[#355faa] text-white shadow-md' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>
                    {lut.name}
                </button>
            ))}
        </div>
        {settings.lutId && (
            <Slider label="Intensity" icon={Sliders} value={settings.lutIntensity} onChange={(v) => updateSetting('lutIntensity', v)} min={0} max={100} />
        )}
      </section>
    </div>
  );
};