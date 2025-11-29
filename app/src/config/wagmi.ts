import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: '',
  projectId: 'c58836ab9c22430d9189bfbadfa938b9',
  chains: [sepolia],
  ssr: false,
});
