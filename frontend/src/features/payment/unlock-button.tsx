'use client';

import { useCreateCheckout } from './payment.api';

export function UnlockButton() {
  const createCheckout = useCreateCheckout();

  const handleUnlock = async () => {
    try {
      // Success and cancel URLs set to dashboard
      const result = await createCheckout.mutateAsync({
        successUrl: `${window.location.origin}/dashboard`,
        cancelUrl: `${window.location.origin}/dashboard`,
      });
      window.location.href = result.checkoutUrl;
    } catch (e) {
      console.error('Failed to create checkout:', e);
    }
  };

  return (
    <button
      onClick={() => { void handleUnlock(); }}
      disabled={createCheckout.isPending}
      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {createCheckout.isPending ? 'Loading...' : 'Unlock Unlimited Tasks ($5)'}
    </button>
  );
}
