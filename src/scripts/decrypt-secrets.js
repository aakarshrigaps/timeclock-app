const path = require("path");
const { app } = require("electron");
const crypto = require("crypto");
const fs = require("fs");

// Get the correct path to the encrypted file
const encryptedSecretsPath = path.join(
   app.getAppPath(),
   "src",
   "encrypted-secrets.json"
);

// Load the encrypted secrets from the file
const encryptedSecrets = JSON.parse(
   fs.readFileSync(encryptedSecretsPath, "utf-8")
);

// Encryption configuration (must match the encryption settings)
const algorithm = "aes-256-ctr";
const secretKey = Buffer.from(
   "b052bd381f108d1938e95fdbe5792f4901252f090806dbbf803003a549647c08",
   "hex"
); // Use the key you saved securely

// Function to decrypt text
const decrypt = (hash) => {
   const decipher = crypto.createDecipheriv(
      algorithm,
      secretKey,
      Buffer.from(hash.iv, "hex")
   );
   const decrypted = Buffer.concat([
      decipher.update(Buffer.from(hash.content, "hex")),
      decipher.final(),
   ]);
   return JSON.parse(decrypted.toString());
};

// Decrypt the secrets
const secrets = decrypt(encryptedSecrets);

// Now you can use the decrypted secrets in your app
const client_id = secrets.client_id;
const tenant_id = secrets.tenant_id;
const client_secret = secrets.client_secret;
const mail_id = secrets.mail_id;
const mail_pass = secrets.mail_pass;

module.exports = { client_id, tenant_id, client_secret, mail_id, mail_pass };
