/**
 * Visitor statistics with Matomo (N10), self-hosted at analytics.chkania.net.
 *
 * Based on the Matomo tracking snippet, moved into a module so the Content Security Policy (N6)
 * needs no inline script. Privacy settings:
 * - no cookies, Do Not Track is respected, sensitive query parameters are excluded
 * - `discardHashTag`: the URL hash is never sent – shared links carry all inputs in "#s=…" (F9.2)
 * - `setDocumentTitle`: fixed page title, because the window title contains the scenario name (F16.1)
 * Only active in the production build (not in the dev server or tests).
 */

export const MATOMO_URL = 'https://analytics.chkania.net/';
export const MATOMO_SITE_ID = '2';

/** Query parameters Matomo removes from tracked URLs (list from the Matomo snippet). */
const EXCLUDED_QUERY_PARAMS = [
  'account', 'accountnum', 'address', 'address1', 'address2', 'address3', 'addressline1', 'addressline2', 'adres', 'adresse',
  'adresse1', 'adresse2', 'adresse3', 'adresse_email', 'adresseemail', 'adressepostale', 'age', 'alter', 'auth', 'authpw', 'bic',
  'billingaddress', 'billingaddress1', 'billingaddress2', 'calle', 'cardnumber', 'carte', 'cartebancaire', 'carteidentite', 'cb',
  'cc', 'ccc', 'cccsc', 'cccvc', 'cccvv', 'ccexpiry', 'ccexpmonth', 'ccexpyear', 'ccname', 'ccnumber', 'cctype', 'cell',
  'cellphone', 'city', 'civilite', 'civilité', 'cle', 'clientid', 'clientsecret', 'clé', 'codepostal', 'company', 'consumerkey',
  'consumersecret', 'contrasenya', 'contraseña', 'courriel', 'cp', 'creditcard', 'creditcardnumber', 'cvc', 'cvv',
  'datedenaissance', 'dateexpiration', 'datenaissance', 'dateofbirth', 'debitcard', 'departement', 'dirección', 'dob', 'domain',
  'département', 'ebost', 'email', 'emailaddress', 'emailadresse', 'entreprise', 'epos', 'epost', 'eposta', 'exp', 'expiration',
  'familyname', 'firma', 'firstname', 'formlogin', 'fullname', 'gender', 'genre', 'geschlecht', 'gst', 'gstnumber',
  'handynummer', 'hasło', 'heslo', 'iban', 'ibanaccountnum', 'ibanaccountnumber', 'id', 'identifiant', 'identifier',
  'identitenationale', 'indirizzo', 'kartakredytowa', 'kennwort', 'keyconsumerkey', 'keyconsumersecret', 'konto', 'kontonr',
  'kontonummer', 'kredietkaart', 'kreditkarte', 'kreditkort', 'lastname', 'login', 'mail', 'mdp', 'mobiili', 'mobile', 'mobilne',
  'mot_de_passe', 'motdepasse', 'nachname', 'name', 'nationalite', 'nickname', 'nom', 'nomcomplet', 'nomdefamille', 'nomfamille',
  'nss', 'numero_fiscal', 'numerocarte', 'numerocarteidentite', 'numerocompte', 'numerodecarte', 'numerofiscal',
  'numeroidentite', 'numeromobile', 'numeropasseport', 'numerosecuritesociale', 'numerotelephone', 'numerotva', 'numfiscal',
  'numsecu', 'numtva', 'osoite', 'parole', 'pass', 'passeport', 'passord', 'password', 'passwort', 'pasword', 'paswort',
  'paword', 'pays', 'phone', 'pin', 'plz', 'portable', 'postalcode', 'postcode', 'postleitzahl', 'prenom', 'privatekey',
  'prénom', 'publickey', 'pw', 'pwd', 'pword', 'pwrd', 'questionsecrete', 'region', 'reponsesecrete', 'rib', 'rue', 'secret',
  'secretclé', 'secretq', 'secretquestion', 'securitesociale', 'sexe', 'shippingaddress', 'shippingaddress1',
  'shippingaddress2', 'signature', 'siren', 'siret', 'socialsec', 'socialsecuritynumber', 'societe', 'socsec', 'sokak', 'ssn',
  'steuernummer', 'strasse', 'street', 'surname', 'swift', 'tax', 'taxnumber', 'tel', 'telefon', 'telefonnr', 'telefonnummer',
  'telefono', 'telephone', 'titre', 'token', 'token_auth', 'tokenauth', 'tva', 'téléphone', 'ulica', 'user', 'username',
  'utilisateur', 'vat', 'vatnumber', 'via', 'ville', 'voie', 'vorname', 'wachtwoord', 'wagwoord', 'webhooksecret', 'website',
  'zip', 'zipcode',
];

type MatomoQueue = unknown[][];

declare global {
  interface Window {
    _paq?: MatomoQueue;
  }
}

export interface AnalyticsOptions {
  /** Defaults to the production build only. */
  enabled?: boolean;
  win?: Window;
  doc?: Document;
}

/**
 * Starts Matomo tracking for a page.
 * @param pageTitle fixed title reported to Matomo, e.g. "Rechner" (never user input)
 */
export function initAnalytics(pageTitle: string, opts: AnalyticsOptions = {}): void {
  const { enabled = import.meta.env.PROD, win = window, doc = document } = opts;
  if (!enabled) return;
  const paq: MatomoQueue = (win._paq = win._paq || []);
  // tracker methods like "setCustomDimension" must be called before "trackPageView"
  paq.push(['setDoNotTrack', true]);
  paq.push(['setExcludedQueryParams', EXCLUDED_QUERY_PARAMS]);
  paq.push(['disableCookies']);
  paq.push(['discardHashTag', true]);
  paq.push(['setDocumentTitle', pageTitle]);
  paq.push(['trackPageView']);
  paq.push(['enableLinkTracking']);
  paq.push(['setTrackerUrl', `${MATOMO_URL}matomo.php`]);
  paq.push(['setSiteId', MATOMO_SITE_ID]);
  const script = doc.createElement('script');
  script.async = true;
  script.src = `${MATOMO_URL}matomo.js`;
  doc.head.appendChild(script);
}
