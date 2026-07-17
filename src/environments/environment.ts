export const environment = {
  production: false,
  appVersion: '0.2.0',
  // Relative base: the browser calls same-origin (localhost:4200/api) and the
  // `ng serve` dev proxy (proxy.conf.json) forwards to the PRODUCTION backend, so
  // local dev sees the same tours/purchases as the mobile app and live site — with
  // no CORS issues. Point proxy.conf.json back at localhost:3000 for local-API dev.
  apiUrl: '/api',
  stripePublishableKey: 'pk_test_51TJWf4BctjJ9LyNmX96OuslbjzcOeU8A2WWHyZCTA44On5qRa5KNOs8PmKYdgGSbkIhbEaFDdluJ8Z8P8ErWEt6m00DJPNdBre',
  googleClientId: '403080956691-0u8cdisr5kebjm3lgttokt5i0fm80lm2.apps.googleusercontent.com'
};
