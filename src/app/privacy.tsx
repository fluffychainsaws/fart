import { LegalDoc, privacyContent } from '@/lib/LegalDoc';

export default function PrivacyScreen() {
  return <LegalDoc title="Privacy Policy" sections={privacyContent} />;
}
