import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/lib/AppText';
import { useTheme, type Theme } from '@/lib/theme';

// Shared renderer for the Privacy Policy and Terms screens. Content lives in
// privacyContent / termsContent below; the screens are thin wrappers.
//
// EDIT BEFORE LAUNCH: point SUPPORT_EMAIL at a real inbox you monitor (either
// set up support@selftapebuddy.com as an alias, or change it to your own
// address), set JURISDICTION to your actual state/country for the Terms, and
// bump EFFECTIVE_DATE whenever you change either document. These are your own
// business's policies — plain-English and reasonable, but have a lawyer look
// them over before you rely on them.
export const SERVICE_NAME = 'Self Tape Buddy';
export const SITE = 'selftapebuddy.com';
export const SUPPORT_EMAIL = 'support@selftapebuddy.com';
export const JURISDICTION = 'the United States';
export const EFFECTIVE_DATE = 'July 22, 2026';

export interface LegalSection {
  heading: string;
  body: string[]; // one string per paragraph
}

export function LegalDoc({ title, sections }: { title: string; sections: LegalSection[] }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.effective}>Last updated: {EFFECTIVE_DATE}</Text>
      {sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text style={styles.heading}>{s.heading}</Text>
          {s.body.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}
        </View>
      ))}
      <Text style={styles.footer}>
        {SERVICE_NAME} · {SITE}
      </Text>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20, paddingBottom: 56, maxWidth: 720, width: '100%', alignSelf: 'center' },
    title: { fontSize: 24, fontWeight: '800', color: t.ink },
    effective: { fontSize: 12, color: t.inkSoft, marginTop: 4, marginBottom: 8 },
    section: { marginTop: 22 },
    heading: { fontSize: 16, fontWeight: '800', color: t.ink, marginBottom: 8 },
    paragraph: { fontSize: 14, color: t.ink, lineHeight: 21, marginBottom: 10 },
    footer: { fontSize: 12, color: t.inkSoft, textAlign: 'center', marginTop: 32 },
  });

// ---- Privacy Policy --------------------------------------------------------

export const privacyContent: LegalSection[] = [
  {
    heading: 'Who we are',
    body: [
      `${SERVICE_NAME} ("we", "us") operates the ${SITE} website and app, a tool that helps actors rehearse audition scripts with an AI scene reader. This policy explains what we collect, why, and your choices.`,
    ],
  },
  {
    heading: 'What we collect',
    body: [
      'Account information: the email address you use to sign up. Passwords are handled by our authentication provider and stored only as secure one-way hashes — we never see or store your actual password.',
      'Your content: the scripts you upload (photos or PDFs), the transcribed text, your character/line selections, director notes, per-character voice choices, and an optional profile photo. This is stored so it syncs across your devices.',
      'Usage information: counts we keep to enforce plan limits and estimate costs — such as how many auditions you have run this month and how much AI voice you have generated.',
      'Payment information: if you subscribe or buy an Audition Credit, payment is processed by Stripe. We do not receive or store your full card number — Stripe handles that. We store only a reference to your purchase and your current plan.',
    ],
  },
  {
    heading: 'How we use it',
    body: [
      'To provide the service: transcribe your scripts, generate the AI reader’s voice, interpret your director notes, save your work, and enforce your plan’s limits.',
      'To process payments and manage your subscription.',
      'To keep the service secure and prevent abuse (for example, per-account usage limits).',
      'We do not sell your personal information, and we do not use your scripts to train our own models.',
    ],
  },
  {
    heading: 'Third parties we share with',
    body: [
      'We rely on a few trusted service providers to run the app, and share only what each needs:',
      '• Supabase — hosting, database, and authentication (stores your account and your scripts).',
      '• Stripe — payment processing.',
      '• AI providers (such as Anthropic, OpenAI, and ElevenLabs) — we send your uploaded script pages, the text, and director notes to these services to transcribe them, interpret notes, and generate the reader’s voice. Their handling is governed by their own terms and privacy policies.',
      'We may also disclose information if required by law.',
    ],
  },
  {
    heading: 'Data retention and deletion',
    body: [
      'We keep your account and content until you delete them or ask us to. You can remove individual scripts in the app at any time.',
      `To delete your entire account and associated data, contact us at ${SUPPORT_EMAIL}. Deleting your account removes your profile and scripts from our database.`,
    ],
  },
  {
    heading: 'Storage on your device',
    body: [
      'The app stores your login session and caches generated audio and scripts in your browser or device storage so it works smoothly and doesn’t re-generate paid audio unnecessarily. You can clear this through your browser/device settings.',
    ],
  },
  {
    heading: 'Children',
    body: [
      'The service is not directed to children under 13, and we do not knowingly collect information from them. If you believe a child has provided us information, contact us and we will remove it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this policy from time to time. When we do, we’ll change the “Last updated” date above. Continued use after a change means you accept the updated policy.',
    ],
  },
  {
    heading: 'Contact',
    body: [`Questions about privacy? Email us at ${SUPPORT_EMAIL}.`],
  },
];

// ---- Terms of Service ------------------------------------------------------

export const termsContent: LegalSection[] = [
  {
    heading: 'Agreement',
    body: [
      `These Terms of Service govern your use of ${SERVICE_NAME} at ${SITE} (the "Service"). By creating an account or using the Service, you agree to these terms. If you don’t agree, please don’t use the Service.`,
    ],
  },
  {
    heading: 'What the Service is',
    body: [
      'The Service is a rehearsal aid: it reads scene partner lines aloud with an AI voice and helps you practice. It is a practice tool, not a casting service, and the AI reader is an approximation — not a substitute for a human scene partner or professional coaching.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You’re responsible for keeping your login secure and for activity under your account. Provide accurate information when you sign up. You must be old enough to form a binding contract in your location to subscribe.',
    ],
  },
  {
    heading: 'Your content',
    body: [
      'You keep ownership of the scripts and material you upload. You’re responsible for having the right to use what you upload, and you agree not to upload content you don’t have permission to use.',
      'You grant us a limited license to store, process, and transmit your content solely to operate the Service — including sending it to the AI providers described in our Privacy Policy to transcribe it, interpret notes, and generate audio.',
    ],
  },
  {
    heading: 'Subscriptions, credits, and billing',
    body: [
      'Paid plans are billed through Stripe on a recurring basis (for example, monthly) until you cancel. You can cancel anytime from your receipt/billing email or by contacting us; cancellation stops future charges and your plan drops to Free at the end of the current period.',
      'Audition Credits are a one-time purchase, do not expire, and are consumed one per script.',
      'Except where required by law, payments and Audition Credits are non-refundable. Plan features and prices may change; we’ll give notice of material changes.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      'Don’t misuse the Service. In particular, don’t: attempt to break, overload, or bypass limits or security; access other users’ data; resell or redistribute the Service; upload unlawful or infringing content; or use automated means to abuse the paid features.',
    ],
  },
  {
    heading: 'AI-generated output',
    body: [
      'Transcriptions, interpreted director notes, and generated voices are produced by AI and may contain errors or inaccuracies. Review important results yourself; we’re not liable for reliance on imperfect output.',
    ],
  },
  {
    heading: 'Disclaimers and limitation of liability',
    body: [
      'The Service is provided “as is” and “as available,” without warranties of any kind, to the fullest extent permitted by law. We don’t guarantee it will be uninterrupted or error-free.',
      'To the maximum extent permitted by law, our total liability for any claim relating to the Service is limited to the amount you paid us in the 12 months before the claim.',
    ],
  },
  {
    heading: 'Termination',
    body: [
      'You can stop using the Service and delete your account at any time. We may suspend or terminate access if you violate these terms or to protect the Service. ',
    ],
  },
  {
    heading: 'Changes to these terms',
    body: [
      'We may update these terms; when we do, we’ll change the “Last updated” date above. Continued use after a change means you accept the updated terms.',
    ],
  },
  {
    heading: 'Governing law and contact',
    body: [
      `These terms are governed by the laws of ${JURISDICTION}, without regard to conflict-of-laws rules.`,
      `Questions? Email us at ${SUPPORT_EMAIL}.`,
    ],
  },
];
