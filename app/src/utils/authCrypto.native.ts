import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

const authCrypto = globalThis.crypto ?? ({} as Crypto);

if (!authCrypto.getRandomValues) {
  Object.defineProperty(authCrypto, 'getRandomValues', { value: getRandomValues });
}

if (!authCrypto.subtle?.digest) {
  const subtle = authCrypto.subtle ?? ({} as SubtleCrypto);
  Object.defineProperty(subtle, 'digest', {
    value: async (algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name.toUpperCase() !== 'SHA-256') {
        throw new Error('Unsupported authentication digest');
      }
      return digest(CryptoDigestAlgorithm.SHA256, data);
    },
  });
  Object.defineProperty(authCrypto, 'subtle', { value: subtle });
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: authCrypto, configurable: true });
}
