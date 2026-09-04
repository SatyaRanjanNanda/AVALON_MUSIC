// This is a dummy file to satisfy the Wispbyte panel's "Main File" check.
// The actual bot code runs from dist/index.js after it is built.
console.log("Starting Wispbyte build process...");
try {
    require('./dist/index.js');
} catch (e) {
    console.log("dist/index.js not found yet. The startup script will build it shortly.");
}
