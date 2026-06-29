const assert = require("node:assert/strict");

const {
  getRefreshCookieOptions,
  isAllowedCorsOrigin,
  normalizeWebOrigin,
  validateSecurityEnvironment
} = require("../dist/config/security.config.js");

function config(values) {
  return {
    get: (key) => values[key]
  };
}

assert.equal(normalizeWebOrigin("https://ciphera.app/"), "https://ciphera.app");

assert.throws(
  () =>
    validateSecurityEnvironment(
      config({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "short",
        JWT_REFRESH_SECRET: "another-short"
      })
    ),
  /JWT_ACCESS_SECRET/
);

assert.throws(
  () =>
    validateSecurityEnvironment(
      config({
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "a".repeat(40),
        JWT_REFRESH_SECRET: "a".repeat(40)
      })
    ),
  /must be different/
);

assert.doesNotThrow(() =>
  validateSecurityEnvironment(
    config({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "a".repeat(40),
      JWT_REFRESH_SECRET: "b".repeat(40)
    })
  )
);

const productionCookie = getRefreshCookieOptions(config({ NODE_ENV: "production" }));
assert.equal(productionCookie.httpOnly, true);
assert.equal(productionCookie.secure, true);
assert.equal(productionCookie.sameSite, "none");
assert.equal(productionCookie.path, "/api");

const localCookie = getRefreshCookieOptions(config({ NODE_ENV: "development" }));
assert.equal(localCookie.httpOnly, true);
assert.equal(localCookie.secure, false);
assert.equal(localCookie.sameSite, "lax");

const localCookieWithProductionLikeEnvValues = getRefreshCookieOptions(
  config({ NODE_ENV: "development", COOKIE_SAME_SITE: "none", COOKIE_SECURE: "true" })
);
assert.equal(localCookieWithProductionLikeEnvValues.secure, false, "localhost refresh cookies must survive HTTP dev reloads");
assert.equal(localCookieWithProductionLikeEnvValues.sameSite, "lax");

assert.equal(isAllowedCorsOrigin(config({ CORS_ORIGIN: "https://ciphera.app/" }), "https://ciphera.app"), true);
assert.equal(isAllowedCorsOrigin(config({ NODE_ENV: "production", CORS_ORIGIN: "https://ciphera.app" }), "https://evil.test"), false);
