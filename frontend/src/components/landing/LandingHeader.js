import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

export default function LandingHeader({ continueHref }) {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{ background: 'rgba(247,248,250,0.85)', borderBottom: '1px solid var(--line)' }}
    >
      <div className="container mx-auto px-4 sm:px-6 h-16 lg:h-20 flex items-center justify-between max-w-7xl">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="SlayHealth" width={140} height={80} priority className="h-8 lg:h-10 w-auto object-contain" />
        </Link>

        {continueHref ? (
          <Link
            href={continueHref}
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full font-semibold text-sm text-white shadow-sm transition-all hover:scale-105"
            style={{ background: 'var(--pink)' }}
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full font-semibold text-sm text-white shadow-sm transition-all hover:scale-105"
            style={{ background: 'var(--teal)' }}
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
