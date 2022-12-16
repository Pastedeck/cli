#!/usr/bin/env node
const sjcl = require("sjcl");
const yargs = require("yargs");
const {default: axios} = require("axios");

const makeKey = (entropy) => {
  entropy = Math.ceil(entropy / 6) * 6;
  const key = sjcl.bitArray.clamp(
    sjcl.random.randomWords(Math.ceil(entropy / 32), 0),
    entropy
  );
  return sjcl.codec.base64
    .fromBits(key)
    .replace(/\=+$/, "")
    .replace(/\//, "-");
};

const args = yargs
  .command(
    "create [content]",
    "Create Pastedeck paste",
    (y) => {
      return y.option("title", {
        alias: "t",
        describe: "Title of the paste",
        type: "string",
      })
      .option("expiration", {
        alias: "e",
        describe: "Expiration time of the paste (0 = Never; 1 = Burn after reading; 2 = 1d; 3 = 1m;)",
        type: "number",
      })
      .option("url-only", {
        alias: "u",
        describe: "Only print the URL",
        type: "boolean",
      })
      .option("silent", {
        alias: "s",
        describe: "Don't print errors",
        type: "boolean",
      })
      .positional("content", {
        describe: "Content of the paste",
        type: "string",
        demandOption: true
      })
    },
    async (argv) => {
      if (!argv.content) {
        console.error("Error: no content specified");
        process.exit(1);
      }
      const key = makeKey(256);
      const content = sjcl.codec.base64.fromBits(sjcl.codec.utf8String.toBits(argv.content));
      const encrypted = sjcl.encrypt(key, content);
      const res = await axios.post("https://pastedeck.suzuneu.com/api/v1/paste", {
        title: argv.title,
        expiration: argv.expiration,
        content: encrypted,
      }, {
        validateStatus: () => true
      });
      if (res.status !== 200) {
        if (!argv.silent) {
          console.error("Error: " + res.data);
        }
        process.exit(1);
      }
      if (argv["url-only"]) {
        console.log("https://pastedeck.suzuneu.com/paste/" + res.data.code + "?key=" + key);
      } else {
        console.log("https://pastedeck.suzuneu.com/paste/" + res.data.code + "?key=" + key);
        console.log("Paste ID: " + res.data.code);
        console.log("Paste Key: " + key);
        console.log("Owner Key: " + res.data.ownerKey);
      }
    }
  )
  .command(
    "fetch [url]",
    "Fetch Pastedeck paste",
    (y) => {
      return y.option("silent", {
        alias: "s",
        describe: "Don't print errors",
        type: "boolean",
      })
      .option("content-only", {
        alias: "c",
        describe: "Only print the content",
        type: "boolean",
      })
      .positional("url", {
        describe: "URL of the paste",
        type: "string",
        demandOption: true
      })
    },
    async (argv) => {
      if (!argv.url) {
        console.error("Error: no URL specified");
        process.exit(1);
      }
      const url = new URL(argv.url);
      const key = argv.url.replace(/.*key=([^&]+).*/, "$1");
      const res = await axios.get("https://pastedeck.suzuneu.com/api/v1/paste/" + url.pathname.split("/")[2], {
        validateStatus: () => true
      });
      if (res.status !== 200) {
        if (!argv.silent) {
          console.error("Error: " + res.data);
        }
        process.exit(1);
      }
      const decrypted = sjcl.decrypt(key, res.data.body);
      if (argv["content-only"]) {
        console.log( sjcl.codec.utf8String.fromBits(sjcl.codec.base64.toBits(decrypted)));
      } else {
        console.log("Title: " + res.data.title);
        console.log("Content: " +  sjcl.codec.utf8String.fromBits(sjcl.codec.base64.toBits(decrypted)));
      }
      process.exit(0);
    }
  )
  .help()
  .parse();
