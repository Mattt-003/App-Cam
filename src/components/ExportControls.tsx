import { Download } from 'lucide-react';

interface ExportControlsProps {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function ExportControls({ isRecording, onStart, onStop }: ExportControlsProps) {
  return (
    <div className="fixed bottom-4 right-4 glass-panel p-3 z-40 pointer-events-auto">
      <button className={`btn-industrial w-full ${isRecording ? 'btn-active' : ''} flex items-center justify-center gap-2`} onClick={isRecording ? onStop : onStart}>
        <Download className="w-4 h-4" />
        <span className={`text-xs font-bold ${isRecording ? 'text-red-500' : 'text-white'} uppercase`}>
          {isRecording ? 'STOP REC' : 'RECORD'}
        </span>
      </button>
      <p className="text-[10px] text-white/40 text-center mt-2">
        {isRecording ? 'Capturing processed output…' : 'WebM / VP9 capture'}
      </p>
    </div>
  );
}
