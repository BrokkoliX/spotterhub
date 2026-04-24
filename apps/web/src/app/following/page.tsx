'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/lib/auth';

export default function FollowingPage() {
  const { ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready) {
      router.replace('/explore');
    }
  }, [ready, router]);

  return null;
}
