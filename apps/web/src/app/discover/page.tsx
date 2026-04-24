'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DiscoverPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/explore');
  }, [router]);

  return null;
}
