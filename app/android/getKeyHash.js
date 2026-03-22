const cp = require('child_process');
try {
  const output = cp.execSync('keytool -list -v -keystore app/debug.keystore -alias androiddebugkey -storepass android -keypass android', {encoding: 'utf-8'});
  const match = output.match(/SHA1:\s+([0-9A-F:]+)/);
  if (match) {
    const sha1Hex = match[1];
    const sha1Bytes = sha1Hex.split(':').map(x => parseInt(x, 16));
    console.log("Your Key Hash is:");
    console.log(Buffer.from(sha1Bytes).toString('base64'));
  } else {
    console.error("Could not find SHA1 in output:\n", output);
  }
} catch(e) {
  console.error("Error running keytool:", e.message);
}
