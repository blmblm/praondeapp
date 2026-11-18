import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')
    );
  });
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showTipOnOpen, setShowTipOnOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);
    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);

    // Check if standalone or previously accepted
    const checkInstalled = () => {
      let acceptedSaved = false;
      try {
        acceptedSaved = localStorage.getItem('praonde_pwa_accepted_v1') === '1';
      } catch {}

      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        // @ts-ignore
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');

      if (isStandaloneMode) {
        try {
          localStorage.setItem('praonde_pwa_accepted_v1', '1');
        } catch {}
      }

      setIsInstalled(isStandaloneMode || acceptedSaved);
    };

    checkInstalled();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        try {
          localStorage.setItem('praonde_pwa_accepted_v1', '1');
        } catch {}
        setIsInstalled(true);
      }
    };
    try {
      mediaQuery.addEventListener('change', handleMediaChange);
    } catch {
      // Older browsers
      mediaQuery.addListener(handleMediaChange);
    }

    // Capture beforeinstallprompt (including if fired before React mounted)
    // If Chromium fires beforeinstallprompt, the app is not currently installed on this device
    const win = window as unknown as { __deferredPWAInstallPrompt?: BeforeInstallPromptEvent | null };
    if (win.__deferredPWAInstallPrompt) {
      try {
        localStorage.removeItem('praonde_pwa_accepted_v1');
      } catch {}
      setIsInstalled(false);
      setDeferredPrompt(win.__deferredPWAInstallPrompt);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      win.__deferredPWAInstallPrompt = promptEvent;
      try {
        localStorage.removeItem('praonde_pwa_accepted_v1');
      } catch {}
      setIsInstalled(false);
      setDeferredPrompt(promptEvent);
    };

    // App installed event
    const handleAppInstalled = () => {
      try {
        localStorage.setItem('praonde_pwa_accepted_v1', '1');
      } catch {}
      setIsInstalled(true);
      win.__deferredPWAInstallPrompt = null;
      setDeferredPrompt(null);
      setIsModalOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      try {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } catch {
        // Older browsers
        mediaQuery.removeListener(handleMediaChange);
      }
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual'> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          try {
            localStorage.setItem('praonde_pwa_accepted_v1', '1');
          } catch {}
          setIsInstalled(true);
          setDeferredPrompt(null);
          setIsModalOpen(false);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.error('PWA install prompt error:', err);
        return 'manual';
      }
    }
    // No deferred prompt (e.g. iOS or manual)
    setIsModalOpen(true);
    return 'manual';
  }, [deferredPrompt]);

  const openInstallModal = useCallback((skipQuestion = false) => {
    setShowTipOnOpen(Boolean(skipQuestion));
    setIsModalOpen(true);
  }, []);

  const closeInstallModal = useCallback(() => {
    setIsModalOpen(false);
    setShowTipOnOpen(false);
  }, []);

  return {
    isInstallable: !!deferredPrompt || isIOS,
    hasNativePrompt: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isModalOpen,
    showTipOnOpen,
    openInstallModal,
    closeInstallModal,
    promptInstall,
  };
}
