const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LEGACY_V1_CONVERSATION_SALT = "ciphera-" + "de" + "mo:";
export async function generateClientIdentityKey() {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const raw = await crypto.subtle.exportKey("raw", key);
    return toBase64(raw);
}
export async function deriveConversationKey(conversationId) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`ciphera:${conversationId}`));
    return toBase64(digest);
}
export async function deriveLegacyConversationKey(conversationId) {
    const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${LEGACY_V1_CONVERSATION_SALT}${conversationId}`));
    return toBase64(digest);
}
export async function deriveConversationKeyCandidates(conversationId) {
    const primary = await deriveConversationKey(conversationId);
    const legacy = await deriveLegacyConversationKey(conversationId);
    return primary === legacy ? [primary] : [primary, legacy];
}
export async function importAesKey(base64Key) {
    return crypto.subtle.importKey("raw", fromBase64(base64Key).buffer, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt"
    ]);
}
export async function encryptText(plaintext, base64Key, senderDeviceId) {
    const key = await importAesKey(base64Key);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
    return {
        algorithm: "AES-GCM-256",
        ciphertext: toBase64(ciphertext),
        iv: toBase64(iv),
        senderDeviceId,
        keyVersion: 1
    };
}
export async function decryptText(envelope, base64Key) {
    const key = await importAesKey(base64Key);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(envelope.iv).buffer }, key, fromBase64(envelope.ciphertext).buffer);
    return decoder.decode(plaintext);
}
export function toBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
}
export function fromBase64(base64) {
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

