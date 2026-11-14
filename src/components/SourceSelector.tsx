import { Camera, Video, Phone } from 'lucide-react';

interface SourceSelectorProps {
  source: 'camera' | 'file' | null;
  onStartCamera: () => void;
  onStartFile: (file: File) => void;
  onSwitchCamera: () => void;
}

export default function SourceSelector({ source, onStartCamera, onStartFile, onSwitchCamera }: SourceSelectorProps) {
  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onStartFile(file);
  };

  return (
    <div className="fixed bottom-4 left-4 glass-panel p-3 z-40 pointer-events-auto">
      <div className="flex items-center gap-2 text-xs text-white/70 mb-2">
        <div className={`w-2 h-2 rounded-full ${source ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`}></div>
        <span>{source === 'camera' ? 'LIVE CAMERA' : source === 'file' ? 'VIDEO FILE' : 'NO SOURCE'}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button className="btn-industrial flex items-center justify-center gap-2" onClick={onStartCamera}>
          <Camera className="w-4 h-4" />
          <span>CAM</span>
        </button>
        <button className="btn-industrial flex items-center justify-center gap-2" onClick={() => document.getElementById('upload-file')?.click()}>
          <Video className="w-4 h-4" />
          <span>FILE</span>
        </button>
      </div>

      <button className="btn-industrial w-full mt-2 flex items-center justify-center gap-2 text-[10px]" onClick={onSwitchCamera}>
        <Phone className="w-3 h-3" />
        <span>SWITCH CAM</span>
      </button>

      <input id="upload-file" type="file" accept="video/*" className="hidden" onChange={onFilePick} />
    </div>
  );
}
