import React, { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, UtensilsCrossed } from 'lucide-react';
import { resizeImageFile } from '../utils/imageResize';

interface Props {
  imageUrl: string | null;
  onPick: (image: Blob) => void | Promise<void>;
  onRemove: () => void | Promise<void>;
  busy?: boolean;
  size?: 'md' | 'sm';
}

// Foto do produto no cardápio digital: escolher, trocar ou remover. A imagem já sai reduzida.
export const ProductPhotoField: React.FC<Props> = ({ imageUrl, onPick, onRemove, busy = false, size = 'md' }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const working = busy || processing;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      await onPick(await resizeImageFile(file));
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar a foto.');
    } finally {
      setProcessing(false);
    }
  };

  const box = size === 'sm' ? 'w-16 h-16 rounded-xl' : 'w-28 h-28 rounded-2xl';

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={working}
        title={imageUrl ? 'Trocar foto' : 'Adicionar foto'}
        className={`${box} shrink-0 relative overflow-hidden border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 hover:border-amber-500 transition cursor-pointer disabled:cursor-wait`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <UtensilsCrossed className={size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'} />
        )}
        {working && (
          <span className="absolute inset-0 bg-slate-950/50 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </span>
        )}
      </button>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={working}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            {imageUrl ? 'Trocar foto' : 'Adicionar foto'}
          </button>
          {imageUrl && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                onRemove();
              }}
              disabled={working}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-red-500 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remover
            </button>
          )}
        </div>
        {size === 'md' && (
          <p className="text-[10px] text-slate-500">JPEG, PNG ou WebP. A foto é reduzida automaticamente antes de enviar.</p>
        )}
        {error && <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
};
