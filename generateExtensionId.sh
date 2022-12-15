## https://stackoverflow.com/questions/23873623/obtaining-chrome-extension-id-for-development/23877974#23877974

# Create private key called key.pem
2>/dev/null openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem

echo "key:"
# Generate string to be used as "key" in manifest.json (outputs to stdout)
2>/dev/null openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A

echo "\nextensionId:"
# Calculate extension ID (outputs to stdout)
2>/dev/null openssl rsa -in key.pem -pubout -outform DER |  shasum -a 256 | head -c32 | tr 0-9a-f a-p