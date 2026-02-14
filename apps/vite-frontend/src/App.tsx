import {Outlet} from 'react-router-dom';
import {HelmetProvider} from 'react-helmet-async';
import {I18nextProvider} from 'react-i18next';
import i18n from './i18n/config.ts';
import {LanguageSync} from './i18n/LanguageSync.tsx';
import {ReactQueryProvider} from '@/providers/react-query/react-query.provider';
import {ToastProvider} from '@/providers/toast/toast.provider';
import {ConfirmProvider} from '@/providers/confirm/confirm.provider';
import {ZodErrorProvider} from '@/providers/zod-error/zod-error.provider';
import {Header} from '@/components/header/header.component.tsx';
import {Footer} from '@/components/footer/footer.component';
import {LoadingAnimation} from '@/components/loading-animation/loading-animation.component';

export function App() {
  return (
    <HelmetProvider>
      <I18nextProvider i18n={i18n}>
        <LanguageSync />
        <ZodErrorProvider>
          <ToastProvider>
            <ConfirmProvider>
              <ReactQueryProvider>
                <LoadingAnimation />
                <Header />
                <main className="mx-auto my-6 flex w-full max-w-7xl flex-col px-2 md:my-8 md:px-4 lg:my-12 min-h-screen">
                  <Outlet />
                </main>
                <Footer />
              </ReactQueryProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ZodErrorProvider>
      </I18nextProvider>
    </HelmetProvider>
  );
}
