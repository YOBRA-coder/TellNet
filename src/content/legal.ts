/**
 * Customer-facing policies (read-only for customers).
 *
 * To edit the wording, change the text below. Rules for the body text:
 *   - "1. SOME HEADING"  (number + CAPITAL LETTERS) becomes a section heading
 *   - a line starting with "• " becomes a bullet
 *   - any other line becomes a paragraph
 * The text is exactly as supplied by the client (4 October 2026), pending their confirmation.
 */

export const LEGAL_BRAND = "HI-FI Wi-Fi";
export const LEGAL_COPYRIGHT = "© 2026 HI-FI Wi-Fi";
export const PURCHASE_CONSENT_PREFIX = "By purchasing a package, you agree to the HI-FI";

export type LegalSlug = "privacy" | "terms" | "acceptable-use" | "refund" | "contact";

export type LegalDoc = {
  slug: LegalSlug;
  /** short name used in the footer */
  label: string;
  /** shown above the page title; null for the contact page */
  title: string;
  effectiveDate: string | null;
  body: string;
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    label: "Privacy Policy",
    title: "PRIVACY POLICY",
    effectiveDate: "4 October 2026",
    body: `HI-FI Wi-Fi ("HI-FI", "we", "us", or "our") respects your privacy and is committed to protecting your personal information when you use our Wi-Fi services, website, and customer portal.

1. INFORMATION WE COLLECT

Depending on how you use our services, we may collect:

• Your mobile phone number
• M-Pesa transaction/reference number
• Payment amount and payment status
• Package purchased
• Date and time of payment
• Device and session information required to provide Wi-Fi access
• Connection, usage, and authentication information
• Information you provide when contacting customer support

HI-FI does not require or store your M-Pesa PIN. Never provide your M-Pesa PIN to HI-FI, its operators, employees, or anyone claiming to represent HI-FI.

2. HOW WE USE YOUR INFORMATION

We may use the information we collect to:

• Process and verify payments
• Activate and maintain Wi-Fi packages
• Authenticate customers and provide network access
• Prevent fraud, unauthorized access, and abuse
• Resolve payment and connection problems
• Provide customer support
• Monitor and improve network performance
• Maintain service and transaction records
• Comply with applicable legal and regulatory requirements

We will not use your personal information for unrelated purposes without an appropriate lawful basis.

3. M-PESA PAYMENTS

Payments may be processed through Safaricom M-Pesa and the relevant payment/API infrastructure.

HI-FI does not request or require your M-Pesa PIN.

To verify and manage your purchase, HI-FI may receive or retain relevant transaction information such as your phone number, transaction/reference number, amount, date, and payment status.

4. HOW WE SHARE INFORMATION

We may share information that is necessary to operate HI-FI with trusted service providers, including:

• Payment providers
• Hosting and cloud service providers
• Network and infrastructure providers
• Technical service providers
• Other service providers necessary to operate the HI-FI platform

We may also disclose information where required or permitted by applicable law or to protect the rights, safety, and security of HI-FI, our customers, or the network.

We do not sell customers' personal information.

5. DATA SECURITY

We take reasonable technical and organizational measures to protect personal information against unauthorized access, loss, misuse, alteration, disclosure, or destruction.

However, no internet-based service can guarantee absolute security.

6. DATA RETENTION

We retain personal information only for as long as reasonably necessary for the purposes for which it was collected, including providing services, processing transactions, resolving disputes, preventing fraud, maintaining business records, and complying with legal or regulatory obligations.

When information is no longer required, it may be securely deleted, anonymized, or otherwise disposed of where appropriate.

7. YOUR DATA PROTECTION RIGHTS

Subject to applicable law, you may have rights including:

• The right to know how your personal data is being used
• The right to request access to your personal data
• The right to request correction of inaccurate or incomplete information
• The right to object to certain processing of your personal data
• The right to request deletion of personal data where legally applicable
• The right to request restriction of certain processing where legally applicable

To exercise your rights or make a privacy-related request, please contact HI-FI using the contact details below.

8. CHILDREN

HI-FI services should be used responsibly by minors and under the supervision of a parent or guardian where appropriate.

We do not knowingly collect personal information from children for purposes unrelated to providing the service.

9. CHANGES TO THIS PRIVACY POLICY

We may update this Privacy Policy from time to time to reflect changes to our services, technology, legal requirements, or privacy practices.

When significant changes are made, we may provide appropriate notice through the HI-FI website, customer portal, or other available communication channels.

By using HI-FI Wi-Fi, you acknowledge that you have read and understood this Privacy Policy.`,
  },
  {
    slug: "terms",
    label: "Terms & Conditions",
    title: "TERMS & CONDITIONS",
    effectiveDate: "4 October 2026",
    body: `By purchasing, accessing, or using HI-FI Wi-Fi services, you agree to these Terms & Conditions.

1. WI-FI PACKAGES

Each HI-FI package provides the duration, data allowance, speed, number of devices, or other features displayed on the package-selection page at the time of purchase.

Package features may differ depending on the package selected.

2. PACKAGE ACTIVATION

A package is activated after successful payment confirmation.

Where automatic activation is unavailable, the customer may use the "Already Paid?" option and provide the required M-Pesa transaction information for verification.

HI-FI may verify payment before activating access.

3. PACKAGE VALIDITY

Once a package is activated, its validity period continues to run even when the customer disconnects from HI-FI Wi-Fi.

Disconnecting, switching between HI-FI access points, restarting a device, or temporarily leaving the network does not pause or reset the package.

A customer may reconnect during the active validity period without making another payment for the same package.

4. MULTIPLE ACCESS POINTS

Where HI-FI operates multiple access points, an active package may remain associated with the customer's authorized device or account.

Moving between HI-FI access points does not create a new package charge.

5. EXPIRED PACKAGES

Once a package expires, the customer must purchase another package to continue using the service.

6. CUSTOMER RESPONSIBILITIES

Customers must provide accurate information when purchasing or using HI-FI services.

Customers are responsible for keeping their access information secure and must not intentionally allow unauthorized persons to use their account or package.

7. PROHIBITED ACTIVITIES

Customers must not use HI-FI for:

• Illegal activities
• Fraud or scams
• Unauthorized access to computer systems or networks
• Hacking or cyberattacks
• Distribution of malware
• Attempting to bypass authentication or payment controls
• Interfering with other customers' network access
• Abuse of vulnerabilities in the HI-FI system
• Activities that violate applicable Kenyan law

8. NETWORK MANAGEMENT

HI-FI may apply reasonable network-management measures to maintain service quality, security, and availability for customers.

Certain packages may have restrictions relating to speed, data usage, applications, devices, or other network features. Where applicable, these restrictions should be displayed before purchase.

9. SERVICE INTERRUPTIONS

HI-FI may occasionally experience interruptions caused by:

• ISP outages
• Power failures
• Equipment failure
• Network maintenance
• Weather or environmental conditions
• Telecommunications problems
• Other circumstances outside our reasonable control

HI-FI will make reasonable efforts to restore service when interruptions occur.

10. PAYMENTS

All package prices displayed on the HI-FI portal are stated in Kenyan Shillings unless otherwise indicated.

Customers are responsible for confirming the selected package and payment amount before completing a transaction.

11. CHANGES TO SERVICES

HI-FI may modify, suspend, or discontinue packages or services where reasonably necessary.

Where appropriate, customers will be notified of significant changes.

By using HI-FI Wi-Fi, you agree to these Terms & Conditions.`,
  },
  {
    slug: "acceptable-use",
    label: "Acceptable Use",
    title: "ACCEPTABLE USE POLICY",
    effectiveDate: "4 October 2026",
    body: `This Acceptable Use Policy explains activities that are prohibited when using HI-FI Wi-Fi.

1. LAWFUL USE

Customers must use HI-FI Wi-Fi only for lawful purposes and in compliance with applicable Kenyan laws and regulations.

2. PROHIBITED ACTIVITIES

Customers must not use HI-FI Wi-Fi to:

• Conduct or facilitate illegal activities
• Commit fraud, scams, or identity theft
• Gain unauthorized access to computers, servers, accounts, or networks
• Conduct cyberattacks
• Spread viruses, malware, spyware, or other malicious software
• Attempt to bypass HI-FI authentication or payment systems
• Attempt to obtain unauthorized access to another customer's account or package
• Interfere with, damage, or disrupt the HI-FI network
• Conduct activities that negatively affect other customers' access
• Exploit security vulnerabilities without authorization
• Use the service to distribute content or conduct activities prohibited by applicable law

3. NETWORK ABUSE

Customers must not intentionally consume network resources in a manner that significantly interferes with the service provided to other customers.

HI-FI may take reasonable measures to protect network availability and service quality.

4. SECURITY

Customers must not attempt to circumvent security controls, authentication systems, access restrictions, bandwidth controls, or other technical protections used by HI-FI.

5. ENFORCEMENT

Where HI-FI reasonably believes that a customer has violated this policy, HI-FI may take appropriate action, including:

• Temporarily restricting access
• Suspending a package or account
• Terminating access
• Investigating suspected abuse
• Reporting unlawful activity to the appropriate authorities where required or permitted by law

6. REPORTING ABUSE

If you believe that HI-FI Wi-Fi is being used for illegal activity, fraud, network abuse, or another serious violation, contact us:`,
  },
  {
    slug: "refund",
    label: "Refund Policy",
    title: "REFUND & PAYMENT POLICY",
    effectiveDate: "4 October 2026",
    body: `This policy explains how HI-FI handles payments, failed activations, duplicate payments, and refund requests.

1. PAYMENT PROCESSING

HI-FI accepts payments through the payment methods displayed on the customer portal.

For M-Pesa payments, customers should follow the payment instructions displayed on the HI-FI portal.

HI-FI will never ask customers to provide their M-Pesa PIN.

2. SUCCESSFUL PAYMENT BUT FAILED ACTIVATION

If you have been charged but your HI-FI package was not activated, use the "Already Paid?" option on the customer portal and provide the requested M-Pesa transaction/reference information.

HI-FI may verify the transaction before activating the package.

3. DUPLICATE PAYMENT

If you accidentally pay more than once for the same package, contact HI-FI support and provide the relevant transaction/reference numbers.

HI-FI will review the transactions and determine the appropriate resolution.

4. WRONG PACKAGE PURCHASE

If you purchase the wrong package, contact HI-FI support as soon as possible.

Requests may be considered depending on the circumstances, particularly where the package has not yet been used.

5. ACTIVATED PACKAGES

Once a package has been successfully activated and used, refunds are generally not available simply because the customer disconnects from the network.

Package validity continues running after activation, even when the customer is temporarily disconnected.

6. SERVICE FAILURE

If HI-FI experiences a significant service failure, customers may contact support.

Depending on the circumstances and the cause of the interruption, HI-FI may provide an extension, replacement access, credit, refund, or another appropriate remedy.

7. REFUND REQUESTS

To request a refund or payment investigation, provide:

• Customer phone number
• M-Pesa transaction/reference number
• Amount paid
• Date and approximate time of payment
• Package purchased
• Description of the problem

HI-FI may request additional information reasonably required to investigate the transaction.

8. FRAUDULENT OR UNAUTHORIZED TRANSACTIONS

If you believe a payment was made without your authorization, contact HI-FI immediately and also contact the relevant payment provider where appropriate.

HI-FI may suspend access associated with a disputed transaction while an investigation is conducted.`,
  },
  {
    slug: "contact",
    label: "Contact",
    title: "CONTACT",
    effectiveDate: null,
    // The contact page shows the support phone / WhatsApp / message from Operator -> Settings.
    body: ``,
  },
];

export const LEGAL_BY_SLUG = Object.fromEntries(LEGAL_DOCS.map((d) => [d.slug, d])) as Record<LegalSlug, LegalDoc>;

export type LegalBlock =
  | { kind: "heading"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] };

/** Turns the plain-text body above into headings, paragraphs and bullet lists. */
export function parseLegalBody(body: string): LegalBlock[] {
  const out: LegalBlock[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("• ")) {
      const last = out[out.length - 1];
      const item = line.slice(2).trim();
      if (last?.kind === "ul") last.items.push(item);
      else out.push({ kind: "ul", items: [item] });
    } else if (/^\d+\.\s+[A-Z0-9 &'’\-/,()]+$/.test(line)) {
      out.push({ kind: "heading", text: line });
    } else {
      out.push({ kind: "p", text: line });
    }
  }
  return out;
}
