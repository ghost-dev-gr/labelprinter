// qzSignature.js
// Digital signature utilities for QZ Tray certificate authentication

/**
 * Signs a message using a private key for QZ Tray certificate authentication
 * @param {string} toSign - The message to sign (provided by QZ Tray)
 * @param {string} privateKey - Your private key in PEM format
 * @returns {Promise<string>} The signature
 */
export async function signRequest(toSign, privateKey) {
  if (!privateKey) {
    throw new Error('Private key is required for signing');
  }

  try {
    // Import the private key
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    
    let keyData = privateKey.trim();
    
    // Remove PEM headers if present
    if (keyData.includes(pemHeader)) {
      keyData = keyData
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '');
    }

    // Convert base64 to ArrayBuffer
    const binaryKey = atob(keyData);
    const keyBuffer = new Uint8Array(binaryKey.length);
    for (let i = 0; i < binaryKey.length; i++) {
      keyBuffer[i] = binaryKey.charCodeAt(i);
    }

    // Import the private key
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-512',
      },
      false,
      ['sign']
    );

    // Convert message to buffer
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(toSign);

    // Sign the message
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      messageBuffer
    );

    // Convert signature to base64
    const signatureArray = new Uint8Array(signature);
    let binary = '';
    for (let i = 0; i < signatureArray.length; i++) {
      binary += String.fromCharCode(signatureArray[i]);
    }
    
    return btoa(binary);
  } catch (err) {
    console.error('[qzSignature] Signing failed:', err);
    throw new Error(`Failed to sign request: ${err.message}`);
  }
}

/**
 * Validates a certificate (basic check)
 * @param {string} certificate - The certificate in PEM format
 * @returns {boolean} True if certificate appears valid
 */
export function validateCertificate(certificate) {
  if (!certificate) return false;
  
  const pemStart = '-----BEGIN CERTIFICATE-----';
  const pemEnd = '-----END CERTIFICATE-----';
  
  return certificate.includes(pemStart) && certificate.includes(pemEnd);
}

/**
 * Validates a private key (basic check)
 * @param {string} privateKey - The private key in PEM format
 * @returns {boolean} True if private key appears valid
 */
export function validatePrivateKey(privateKey) {
  if (!privateKey) return false;
  
  const validHeaders = [
    '-----BEGIN PRIVATE KEY-----',
    '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN EC PRIVATE KEY-----'
  ];
  
  return validHeaders.some(header => privateKey.includes(header));
}
