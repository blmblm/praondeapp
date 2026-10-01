export type VideoPlatform =
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'vimeo'
  | 'direct'
  | 'unknown';

export interface VideoInfo {
  type: VideoPlatform;
  embedUrl?: string;
  alternateEmbedUrl?: string;
  thumbnailUrl?: string;
  videoId?: string;
  originalUrl: string;
  isDirectVideo: boolean;
  platformName: string;
  isGroupPost?: boolean;
}

export function isVideoFormatUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t) return false;
  if (
    t.startsWith('data:video/') ||
    t.startsWith('data:application/octet-stream') ||
    t.startsWith('blob:') ||
    /\.(mp4|webm|ogg|mov|m4v)($|\?|#)/i.test(t) ||
    /video\/mp4/i.test(t) ||
    t.includes('youtube.com') ||
    t.includes('youtu.be') ||
    t.includes('facebook.com') ||
    t.includes('fb.watch') ||
    t.includes('fb.') ||
    t.includes('instagram.com/reel') ||
    t.includes('tiktok.com') ||
    t.includes('vimeo.com')
  ) {
    return true;
  }
  const parsed = parseVideoUrl(t);
  return Boolean(parsed && parsed.type !== 'unknown');
}

export function parseVideoUrl(url: string | undefined | null): VideoInfo | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. Direct video file or data URL (MP4, WEBM, OGG, MOV, blob, data URL)
  if (
    trimmed.startsWith('data:video/') ||
    trimmed.startsWith('data:application/octet-stream') ||
    trimmed.startsWith('blob:') ||
    /\.(mp4|webm|ogg|mov|m4v)($|\?|#)/i.test(trimmed) ||
    /video\/mp4/i.test(trimmed)
  ) {
    return {
      type: 'direct',
      embedUrl: trimmed,
      originalUrl: trimmed,
      isDirectVideo: true,
      platformName: 'Vídeo Direto (MP4)',
    };
  }

  // 2. YouTube matchers
  // Handles: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/shorts/ID, youtube.com/embed/ID, youtube.com/live/ID
  try {
    if (trimmed.includes('youtu.be')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      const id = u.pathname.slice(1).split('/')[0].split('?')[0];
      const cleanId = id.match(/[\w-]{11}/)?.[0];
      if (cleanId) {
        return {
          type: 'youtube',
          videoId: cleanId,
          embedUrl: `https://www.youtube.com/embed/${cleanId}?autoplay=0&rel=0`,
          thumbnailUrl: `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`,
          originalUrl: trimmed,
          isDirectVideo: false,
          platformName: 'YouTube',
        };
      }
    } else if (trimmed.includes('youtube.com')) {
      const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      let id = u.searchParams.get('v');
      if (!id && u.pathname.startsWith('/shorts/')) {
        id = u.pathname.replace('/shorts/', '').split('/')[0].split('?')[0];
      } else if (!id && u.pathname.startsWith('/embed/')) {
        id = u.pathname.replace('/embed/', '').split('/')[0].split('?')[0];
      } else if (!id && u.pathname.startsWith('/live/')) {
        id = u.pathname.replace('/live/', '').split('/')[0].split('?')[0];
      }
      const cleanId = id ? (id.match(/[\w-]{11}/)?.[0] || id) : null;
      if (cleanId && cleanId.length === 11) {
        return {
          type: 'youtube',
          videoId: cleanId,
          embedUrl: `https://www.youtube.com/embed/${cleanId}?autoplay=0&rel=0`,
          thumbnailUrl: `https://img.youtube.com/vi/${cleanId}/hqdefault.jpg`,
          originalUrl: trimmed,
          isDirectVideo: false,
          platformName: 'YouTube',
        };
      }
    }
  } catch {
    // fallback regex if URL parsing fails
  }

  const youtubeMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i
  );
  if (youtubeMatch && youtubeMatch[1]) {
    const videoId = youtubeMatch[1];
    return {
      type: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      originalUrl: trimmed,
      isDirectVideo: false,
      platformName: 'YouTube',
    };
  }

  // 3. Facebook matchers
  // Handles:
  // - https://www.facebook.com/share/p/ID/ (Facebook Share Post)
  // - https://www.facebook.com/share/v/ID/ (Facebook Share Video)
  // - https://www.facebook.com/share/r/ID/ (Facebook Share Reel)
  // - https://www.facebook.com/watch/?v=ID (Facebook Watch)
  // - https://www.facebook.com/{user}/videos/ID
  // - https://www.facebook.com/reel/ID
  // - https://fb.watch/ID
  // - https://www.facebook.com/{user}/posts/ID
  if (
    /facebook\.com/i.test(trimmed) ||
    /fb\.watch/i.test(trimmed) ||
    /fb\.com/i.test(trimmed)
  ) {
    const isGroupPost = /\/groups\//i.test(trimmed);
    const encodedUrl = encodeURIComponent(trimmed);
    const isVideoSpecific =
      /\/share\/v\//i.test(trimmed) ||
      /\/share\/r\//i.test(trimmed) ||
      /\/videos\//i.test(trimmed) ||
      /\/reel\//i.test(trimmed) ||
      /fb\.watch/i.test(trimmed) ||
      /\/watch/i.test(trimmed);

    // For posts (/share/p/, /posts/, or general share), Facebook's post plugin embeds the post containing the video/media.
    // For direct videos/reels, Facebook's video plugin is used.
    // We also provide alternateEmbedUrl so the user can easily toggle between post mode and direct video player mode!
    const postEmbedUrl = `https://www.facebook.com/plugins/post.php?href=${encodedUrl}&show_text=true&width=500`;
    const videoEmbedUrl = `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=0&width=500`;

    const primaryEmbedUrl = isVideoSpecific ? videoEmbedUrl : postEmbedUrl;
    const alternateEmbedUrl = isVideoSpecific ? postEmbedUrl : videoEmbedUrl;

    return {
      type: 'facebook',
      embedUrl: primaryEmbedUrl,
      alternateEmbedUrl,
      originalUrl: trimmed,
      isDirectVideo: false,
      platformName: isGroupPost ? 'Facebook (Grupo)' : 'Facebook',
      isGroupPost,
    };
  }

  // 4. Instagram matchers
  // instagram.com/reel/ID or instagram.com/p/ID
  const instaMatch = trimmed.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/i);
  if (instaMatch && instaMatch[1]) {
    const shortcode = instaMatch[1];
    return {
      type: 'instagram',
      videoId: shortcode,
      embedUrl: `https://www.instagram.com/p/${shortcode}/embed`,
      originalUrl: trimmed,
      isDirectVideo: false,
      platformName: 'Instagram',
    };
  }

  // 5. TikTok matchers
  // tiktok.com/@user/video/ID
  const tiktokMatch = trimmed.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (tiktokMatch && tiktokMatch[1]) {
    const videoId = tiktokMatch[1];
    return {
      type: 'tiktok',
      videoId,
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
      originalUrl: trimmed,
      isDirectVideo: false,
      platformName: 'TikTok',
    };
  }

  // 6. Vimeo matchers
  // vimeo.com/12345678
  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/i
  );
  if (vimeoMatch && vimeoMatch[3]) {
    const videoId = vimeoMatch[3];
    return {
      type: 'vimeo',
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}`,
      originalUrl: trimmed,
      isDirectVideo: false,
      platformName: 'Vimeo',
    };
  }

  // 7. Unknown Web URL (DO NOT treat random webpage URLs as direct videos!)
  return {
    type: 'unknown',
    originalUrl: trimmed,
    isDirectVideo: false,
    platformName: 'Link Externo',
  };
}
