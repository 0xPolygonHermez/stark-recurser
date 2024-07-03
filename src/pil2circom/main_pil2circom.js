const fs = require("fs");
const version = require("../../package").version;

const pil2circom = require("./pil2circom.js");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });

const argv = require("yargs")
    .version(version)
    .usage("node main_pil2circom.js -o <verifier.circom> -v <verification_key.json> -s <starkinfo.json> -i <verifierinfo.json> [--skipMain] [--enableInput] [--verkeyInput]")
    .alias("s", "starkinfo")
    .alias("i", "verifierinfo")
    .alias("v", "verkey")
    .alias("o", "output")
    .argv;

async function run() {

    if(typeof (argv.output) !== "string") throw new Error("A valid output file must be provided!");
    const outputFile = argv.output;

    if(typeof (argv.starkinfo) !== "string") throw new Error("A valid stark info file must be provided!");
    const starkInfo = JSON.parse(await fs.promises.readFile(argv.starkinfo.trim(), "utf8"));
    
    if(typeof (argv.verifierinfo) !== "string") throw new Error("A valid verifier info file must be provided!");
    const verifierInfo = JSON.parse(await fs.promises.readFile(argv.verifierinfo.trim(), "utf8"));
        
    const options = {
        skipMain: argv.skipMain || false,
        enableInput: argv.enableInput || false,
        verkeyInput: argv.verkeyInput || false,
    }

    console.log("Options: ", options);

    let constRoot;

    if(!options.verkeyInput) {
        if(typeof (argv.verkey) !== "string") throw new Error("A valid verifier info file must be provided!");
        const verKey = JSONbig.parse(await fs.promises.readFile(argv.verkey, "utf8"));
        constRoot = verKey.constRoot;
    } 
    
    const verifier = await pil2circom(constRoot, starkInfo, verifierInfo, options);

    await fs.promises.writeFile(outputFile, verifier, "utf8");

    console.log("file Generated Correctly");

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});

