export interface VideoUploadResult {
  videoUrl: string;
  imageUrl?: string;
}

const STREAM_LIMIT_BYTES = 10 * 1024 * 1024; // 10 MB envio direto (abaixo do limite de 32 MB do Cloud Run)
const CHUNK_SIZE_BYTES = 5 * 1024 * 1024; // Blocos de 5 MB para arquivos grandes (até 80 MB)

function postBinaryWithProgress(
  url: string,
  headers: Record<string, string>,
  body: Blob | File,
  onUploadByteProgress: (loadedBytes: number, totalBytes: number) => void,
  onUploadBytesComplete?: () => void
): Promise<{ status: number; ok: boolean; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onUploadByteProgress(event.loaded, event.total);
      }
    };

    xhr.upload.onload = () => {
      onUploadBytesComplete?.();
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      let parsed: any = {};
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        parsed = {};
      }
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        data: parsed,
      });
    };

    xhr.onerror = () => {
      reject(new Error('Erro de rede ao enviar vídeo para o servidor. Verifique sua conexão.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('O envio demorou mais que o esperado. Tente novamente ou use um vídeo menor.'));
    };

    xhr.send(body);
  });
}

export async function uploadVideoFileToServer(
  file: File,
  onProgress?: (percent: number, statusMessage?: string) => void
): Promise<VideoUploadResult> {
  const rawName = file.name ? file.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_') : 'video.mp4';
  const hasKnownExt = /\.(mp4|webm|mov|m4v|3gp|ogg)$/i.test(rawName);
  const sanitizedName = hasKnownExt ? rawName : `${rawName}.mp4`;
  const uniqueName = `${Date.now()}-${sanitizedName}`;
  const mimeType = file.type || 'video/mp4';

  let finalizationTimer: ReturnType<typeof setInterval> | null = null;
  const startFinalizationHeartbeat = (startPct: number) => {
    if (finalizationTimer) clearInterval(finalizationTimer);
    let current = Math.max(startPct, 85);
    onProgress?.(
      current,
      'Aguarde o término do carregamento: finalizando e gravando o vídeo no servidor...'
    );
    finalizationTimer = setInterval(() => {
      if (current < 98) {
        current += 1;
        onProgress?.(
          current,
          'Aguarde o término do carregamento: finalizando e gravando o vídeo no servidor...'
        );
      }
    }, 800);
  };

  const stopFinalizationHeartbeat = () => {
    if (finalizationTimer) {
      clearInterval(finalizationTimer);
      finalizationTimer = null;
    }
  };

  try {
    if (file.size <= STREAM_LIMIT_BYTES) {
      onProgress?.(5, 'Iniciando envio do vídeo...');
      const { ok, data } = await postBinaryWithProgress(
        '/api/upload/video-stream',
        {
          'Content-Type': mimeType,
          'x-filename': uniqueName,
        },
        file,
        (loaded, total) => {
          const pct = Math.min(84, Math.max(5, Math.round((loaded / total) * 85)));
          onProgress?.(
            pct,
            pct >= 75
              ? 'Aguarde o término do carregamento: preparando gravação no servidor...'
              : 'Enviando arquivo de vídeo para o servidor...'
          );
        },
        () => {
          startFinalizationHeartbeat(85);
        }
      );

      stopFinalizationHeartbeat();
      if (!ok || !data?.videoUrl) {
        throw new Error(data?.error || 'Falha ao enviar arquivo de vídeo para o servidor.');
      }
      onProgress?.(100, 'Vídeo carregado e salvo com sucesso!');
      return {
        videoUrl: data.videoUrl,
        imageUrl: data.imageUrl || undefined,
      };
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE_BYTES);
    const uploadId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE_BYTES;
      const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
      const chunkBlob = file.slice(start, end);
      const isLastChunk = chunkIndex === totalChunks - 1;

      const { ok, data } = await postBinaryWithProgress(
        '/api/upload/video-chunk',
        {
          'Content-Type': 'application/octet-stream',
          'x-upload-id': uploadId,
          'x-chunk-index': String(chunkIndex),
          'x-total-chunks': String(totalChunks),
          'x-filename': uniqueName,
          'x-mime-type': mimeType,
        },
        chunkBlob,
        (loaded, total) => {
          const totalSent = start + Math.min(loaded, total);
          const pct = Math.min(84, Math.max(2, Math.round((totalSent / file.size) * 85)));
          onProgress?.(
            pct,
            pct >= 75
              ? 'Aguarde o término do carregamento: quase concluído, gravando vídeo no servidor...'
              : 'Enviando arquivo de vídeo para o servidor...'
          );
        },
        () => {
          if (isLastChunk) {
            startFinalizationHeartbeat(85);
          }
        }
      );

      if (!ok) {
        throw new Error(data?.error || `Falha ao enviar parte ${chunkIndex + 1} de ${totalChunks}.`);
      }

      if (data?.completed && data?.videoUrl) {
        stopFinalizationHeartbeat();
        onProgress?.(100, 'Vídeo carregado e salvo com sucesso!');
        return {
          videoUrl: data.videoUrl,
          imageUrl: data.imageUrl || undefined,
        };
      }
    }

    throw new Error('O envio foi concluído, mas o servidor não retornou o endereço do vídeo.');
  } finally {
    stopFinalizationHeartbeat();
  }
}
