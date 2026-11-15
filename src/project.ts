/** Public project links (F19): source code, issue tracker and contribution guide on GitHub. */
export const REPO_URL = 'https://github.com/chkania/waermepumpen-umruestungsrechner';
/** Issue form for errors and outdated values (.github/ISSUE_TEMPLATE/bug_report.yml). */
export const BUG_REPORT_URL = `${REPO_URL}/issues/new?template=bug_report.yml`;
/** Issue form for ideas and feature requests (.github/ISSUE_TEMPLATE/feature_request.yml). */
export const FEATURE_REQUEST_URL = `${REPO_URL}/issues/new?template=feature_request.yml`;
export const CONTRIBUTING_URL = `${REPO_URL}/blob/main/CONTRIBUTING.md`;
/** Voluntary support of the hobby project (F19.4) – plain links, no embedded widgets or images. */
export const PAYPAL_URL = 'https://paypal.me/ChristophKania';
export const BUY_ME_A_COFFEE_URL = 'https://buymeacoffee.com/chkania';
/** Bank account for voluntary support by SEPA transfer (F19.5): shown with a GiroCode (EPC QR code) generated locally. */
export const DONATION_ACCOUNT = {
  name: 'Christoph Kania',
  iban: 'DE62500240240752943331',
  /** Remittance information (Verwendungszweck); ASCII only, some banking apps mishandle umlauts in the QR code. */
  purpose: 'Spende Waermepumpen-Investitionsrechner',
} as const;
