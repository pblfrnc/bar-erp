import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, AlertTriangle, CheckCircle2, SwitchCamera } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Parar stream de câmera
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Iniciar câmera
  const startCamera = async () => {
    stopCamera();
    setErrorMsg(null);
    setHasPermission(null);
    setIsSuccess(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Seu navegador não possui suporte a acesso de câmera via página.');
      }

      // Listar câmeras disponíveis para saber se tem câmera frontal/traseira
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setAvailableCameras(videoDevices);
      } catch {
        // Ignora erro de enumeração
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Necessário no iOS Safari
        await videoRef.current.play();
        setHasPermission(true);
        startScanningLoop();
      }
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Permissão para acessar a câmera foi negada. Permita o acesso nas configurações do navegador.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('Nenhuma câmera foi encontrada neste dispositivo.');
      } else {
        setErrorMsg(err.message || 'Não foi possível inicializar a câmera.');
      }
    }
  };

  // Loop de escaneamento de frames
  const startScanningLoop = () => {
    // 1. Tenta usar BarcodeDetector nativo se existir no navegador
    const hasNativeBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let barcodeDetector: any = null;
    if (hasNativeBarcodeDetector) {
      try {
        barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        barcodeDetector = null;
      }
    }

    const scanFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;

      if (width === 0 || height === 0) {
        animationFrameId.current = requestAnimationFrame(scanFrame);
        return;
      }

      // Tentativa via API nativa rápida
      if (barcodeDetector) {
        try {
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue.trim()) {
              handleFoundCode(rawValue.trim());
              return;
            }
          }
        } catch {
          // Se falhar o detector nativo, segue para o jsQR
        }
      }

      // Fallback universal com jsQR
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && code.data.trim()) {
          handleFoundCode(code.data.trim());
          return;
        }
      }

      animationFrameId.current = requestAnimationFrame(scanFrame);
    };

    animationFrameId.current = requestAnimationFrame(scanFrame);
  };

  // Código QR encontrado com sucesso
  const handleFoundCode = (data: string) => {
    stopCamera();
    setIsSuccess(true);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(100);
      } catch {
        // Ignora
      }
    }
    setTimeout(() => {
      onScanSuccess(data);
    }, 400);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 my-auto relative text-white">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Escanear QR Code do Caixa</h3>
              <p className="text-xs text-slate-400">Aponte para a tela "Conectar Celular"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área do Visor da Câmera */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-800 shadow-inner">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Mira de Escaneamento Animada */}
          {!isSuccess && hasPermission && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
              <div className="relative w-56 h-56 border-2 border-amber-400/80 rounded-2xl shadow-lg shadow-amber-500/20">
                {/* Cantos estilizados */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />

                {/* Linha laser de escaneamento */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse absolute top-1/2 -translate-y-1/2 shadow-md shadow-amber-400" />
              </div>
            </div>
          )}

          {/* Estado de Sucesso */}
          {isSuccess && (
            <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-16 h-16 text-emerald-400 animate-bounce" />
              <span className="text-sm font-black text-emerald-300">QR Code Detectado!</span>
              <span className="text-xs text-emerald-200">Configurando servidor...</span>
            </div>
          )}

          {/* Mensagem de Erro / Sem Permissão */}
          {errorMsg && (
            <div className="absolute inset-0 bg-slate-950/90 p-5 flex flex-col items-center justify-center text-center gap-3">
              <AlertTriangle className="w-12 h-12 text-amber-400" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-200">{errorMsg}</p>
                <p className="text-xs text-slate-400">
                  Dica: Você também pode digitar o IP exibido na tela do caixa manualmente.
                </p>
              </div>
              <button
                onClick={startCamera}
                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar Câmera Novamente
              </button>
            </div>
          )}
        </div>

        {/* Controles Inferiores */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {availableCameras.length > 1 ? (
            <button
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              <SwitchCamera className="w-4 h-4 text-amber-400" />
              <span>Inverter Câmera</span>
            </button>
          ) : <div />}

          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer ml-auto"
          >
            Digitar IP Manualmente
          </button>
        </div>
      </div>
    </div>
  );
};
