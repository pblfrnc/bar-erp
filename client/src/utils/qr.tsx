import React, { useState } from 'react';
import { QrCode as QrIcon } from 'lucide-react';

export const QrCodeSvg: React.FC<{
  value: string;
  size?: number;
  className?: string;
}> = ({ value, size = 180, className = '' }) => {
  const [loadError, setLoadError] = useState(false);
  const encoded = encodeURIComponent(value);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=1`;

  return (
    <div
      style={{ minWidth: size + 24, minHeight: size + 24 }}
      className={`relative flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-md border border-slate-200 ${className}`}
    >
      {!loadError ? (
        <img
          src={qrUrl}
          alt={`QR Code para ${value}`}
          width={size}
          height={size}
          className="rounded-lg"
          loading="eager"
          onError={() => setLoadError(true)}
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-800 p-2 text-center h-full max-w-[200px]">
          <QrIcon className="w-12 h-12 text-slate-700 mb-1" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Rede Local Offline</span>
          <span className="text-xs font-mono font-black text-amber-600 break-all select-all mt-1">{value}</span>
        </div>
      )}
    </div>
  );
};
