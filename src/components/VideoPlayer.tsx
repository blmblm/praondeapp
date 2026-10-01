import React, { useState } from 'react';
import { parseVideoUrl } from '../lib/videoUtils';
import { Play, ExternalLink, RefreshCw, AlertCircle, Eye, Lock, HelpCircle } from 'lucide-react';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  autoPlay?: boolean;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  title = 'Vídeo de Divulgação',
  autoPlay = false,
  className = '',
}) => {
  const parsed = parseVideoUrl(videoUrl);
  // For Facebook: allow switching between post mode and video mode
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string | undefined>(
    parsed?.embedUrl
  );
  const [isUsingAlternateFb, setIsUsingAlternateFb] = useState(false);

  // Sync if videoUrl changes
  React.useEffect(() => {
    const p = parseVideoUrl(videoUrl);
    setActiveEmbedUrl(p?.embedUrl);
    setIsUsingAlternateFb(false);
  }, [videoUrl]);

  if (!parsed || !videoUrl) {
    return (
      <div className="w-full p-8 text-center bg-slate-950/80 rounded-2xl border border-slate-800 text-slate-400 text-xs">
        Nenhum link de vídeo fornecido.
      </div>
    );
  }

  // 1. FACEBOOK
  if (parsed.type === 'facebook') {
    const handleToggleFbMode = () => {
      if (parsed.alternateEmbedUrl) {
        if (!isUsingAlternateFb) {
          setActiveEmbedUrl(parsed.alternateEmbedUrl);
          setIsUsingAlternateFb(true);
        } else {
          setActiveEmbedUrl(parsed.embedUrl);
          setIsUsingAlternateFb(false);
        }
      }
    };

    return (
      <div className={`w-full flex flex-col rounded-2xl bg-slate-950 border border-blue-500/30 overflow-hidden shadow-2xl ${className}`}>
        {/* Facebook Header Bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-950/40 border-b border-blue-500/20 text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-extrabold text-xs shadow">
              f
            </span>
            <span className="font-bold text-blue-200">
              {parsed.platformName} • {isUsingAlternateFb ? 'Player de Vídeo' : 'Publicação Embutida'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {parsed.alternateEmbedUrl && (
              <button
                type="button"
                onClick={handleToggleFbMode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 hover:text-white border border-blue-500/40 text-[11px] font-semibold transition-all cursor-pointer"
                title="Alternar entre modo Publicação e modo Player Direto"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{isUsingAlternateFb ? 'Ver como Publicação' : 'Alternar para Player de Vídeo'}</span>
              </button>
            )}

            <a
              href={parsed.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold shadow transition-colors"
              title="Abrir diretamente na rede social Facebook"
            >
              <span>Abrir no Facebook</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Facebook Embed iframe container */}
        <div className="relative w-full flex flex-col items-center justify-center bg-slate-900/60 p-2 sm:p-4 min-h-[460px] sm:min-h-[520px]">
          <iframe
            key={activeEmbedUrl || videoUrl}
            src={activeEmbedUrl}
            title={title}
            className="w-full max-w-[500px] h-[480px] sm:h-[540px] border-0 rounded-xl shadow-lg bg-white"
            scrolling="no"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen={true}
          />
        </div>

        {/* Informative Guidance Box regarding Facebook Privacy */}
        <div className="px-4 py-3 bg-blue-950/20 border-t border-slate-800/90 text-[11px] text-slate-300 space-y-2">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-slate-300 leading-relaxed">
              <strong className="text-white">Apareceu mensagem de "post não disponível"?</strong>
              <p className="mt-0.5 text-slate-400">
                O Facebook exige que a publicação ou vídeo esteja com privacidade definida como <strong>Pública (Globo 🌐)</strong> e tenha sido postado em uma <strong>Página aberta ou Perfil público</strong>. Publicações dentro de <em>Grupos privados/fechados</em> ou com privacidade restrita a amigos não podem ser carregadas pelo Facebook dentro de outros aplicativos.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 flex-wrap gap-2">
            <span className="flex items-center gap-1 text-blue-300">
              <HelpCircle className="w-3 h-3" />
              Dica: clique em <strong>"Abrir no Facebook"</strong> acima para acessar o conteúdo na íntegra.
            </span>
            <span className="text-slate-500 font-mono">Facebook Official Plugin</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. YOUTUBE
  if (parsed.type === 'youtube' && parsed.embedUrl) {
    return (
      <div className={`w-full flex flex-col rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl ${className}`}>
        <div className="relative w-full aspect-video bg-black">
          <iframe
            key={parsed.embedUrl}
            src={parsed.embedUrl}
            title={title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="font-semibold text-rose-400 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 fill-rose-500" /> YouTube
          </span>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white hover:underline font-medium"
          >
            <span>Assistir no YouTube</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // 3. INSTAGRAM
  if (parsed.type === 'instagram' && parsed.embedUrl) {
    return (
      <div className={`w-full flex flex-col rounded-2xl bg-slate-950 border border-pink-500/30 overflow-hidden shadow-2xl ${className}`}>
        <div className="flex items-center justify-between px-3.5 py-2 bg-pink-950/30 border-b border-pink-500/20 text-xs">
          <span className="font-bold text-pink-300">Instagram Reel / Post</span>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold shadow transition-colors"
          >
            <span>Abrir no Instagram</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative w-full flex items-center justify-center p-2 min-h-[460px] bg-slate-900/60">
          <iframe
            key={parsed.embedUrl}
            src={parsed.embedUrl}
            title={title}
            className="w-full max-w-[440px] h-[500px] border-0 rounded-xl shadow-lg bg-white"
            scrolling="no"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 4. TIKTOK
  if (parsed.type === 'tiktok' && parsed.embedUrl) {
    return (
      <div className={`w-full flex flex-col rounded-2xl bg-slate-950 border border-cyan-500/30 overflow-hidden shadow-2xl ${className}`}>
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-xs">
          <span className="font-bold text-cyan-300">TikTok</span>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold shadow"
          >
            <span>Abrir no TikTok</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative w-full flex items-center justify-center p-2 min-h-[500px] bg-slate-900/60">
          <iframe
            key={parsed.embedUrl}
            src={parsed.embedUrl}
            title={title}
            className="w-full max-w-[400px] h-[540px] border-0 rounded-xl shadow-lg"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  // 5. VIMEO
  if (parsed.type === 'vimeo' && parsed.embedUrl) {
    return (
      <div className={`w-full flex flex-col rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl ${className}`}>
        <div className="relative w-full aspect-video bg-black">
          <iframe
            key={parsed.embedUrl}
            src={parsed.embedUrl}
            title={title}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="font-semibold text-blue-400">Vimeo</span>
          <a
            href={parsed.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white hover:underline font-medium"
          >
            <span>Assistir no Vimeo</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // 6. DIRECT VIDEO (MP4, WEBM, OGG, BLOB)
  if (parsed.isDirectVideo) {
    return (
      <div className={`w-full flex flex-col rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-2xl ${className}`}>
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
          <video
            key={videoUrl}
            src={parsed.embedUrl || videoUrl}
            controls
            autoPlay={autoPlay}
            muted={false}
            playsInline
            className="w-full h-full object-contain"
          >
            Seu navegador não suporta reprodução deste arquivo de vídeo.
          </video>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
          <span className="font-semibold text-emerald-400">Arquivo de Vídeo Direto (MP4/WebM)</span>
          <a
            href={parsed.embedUrl || videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-slate-300 hover:text-white hover:underline font-medium"
          >
            <span>Abrir arquivo</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // 7. UNKNOWN LINK FALLBACK
  return (
    <div className={`w-full p-6 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 text-center ${className}`}>
      <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-white">Link de Mídia Externa</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Este link não possui reprodutor embutido direto. Recomendamos utilizar links de <strong>YouTube</strong>, <strong>Facebook</strong>, <strong>Instagram</strong>, <strong>Vimeo</strong> ou arquivo <strong>MP4</strong>.
        </p>
      </div>
      <div className="pt-2">
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-semibold text-xs border border-slate-700 transition-colors"
        >
          <span>Abrir link em nova aba</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
