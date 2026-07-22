import { LegalDoc, termsContent } from '@/lib/LegalDoc';

export default function TermsScreen() {
  return <LegalDoc title="Terms of Service" sections={termsContent} />;
}
