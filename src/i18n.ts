import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

await i18next
    .use(LanguageDetector)
    .use(HttpApi)
    .init({
        fallbackLng: 'en',
        debug: true,
        backend: {
            loadPath: 'locales/{{lng}}.json'
        }
    });

export default i18next;
