const assert = require("node:assert/strict");

const { MediaService } = require("../dist/modules/media/media.service.js");

function config(values) {
  return {
    get: (key) => values[key]
  };
}

assert.throws(
  () => new MediaService(config({})).createUploadSignature(),
  (error) => error?.name === "ServiceUnavailableException" && /not configured/i.test(error.message),
  "media signing must fail closed when Cloudinary env vars are missing"
);

const signature = new MediaService(
  config({
    CLOUDINARY_CLOUD_NAME: "ciphera-cloud",
    CLOUDINARY_API_KEY: "api-key",
    CLOUDINARY_API_SECRET: "api-secret"
  })
).createUploadSignature();

assert.equal(signature.cloudName, "ciphera-cloud");
assert.equal(signature.apiKey, "api-key");
assert.match(signature.uploadUrl, /^https:\/\/api\.cloudinary\.com\/v1_1\/ciphera-cloud\/auto\/upload$/);
assert.match(signature.publicId, /^ciphera\//);
assert.equal(typeof signature.timestamp, "number");
assert.match(signature.signature, /^[a-f0-9]{40}$/);
