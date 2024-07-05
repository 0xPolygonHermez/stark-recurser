const version = require("../package").version;
const fs = require("fs");
const JSONbig = require('json-bigint')({ useNativeBigInt: true, alwaysParseAsBig: true });
const { genCircom } = require("./gencircom");
const argv = require("yargs")
    .version(version)
    .usage("node main_gencircom.js -a <agg_vks.json> -b <basic_vks.json> -s starkinfo.json -t template.ejs ")
    .array("s").alias("s", "starkinfo")
    .array("a").alias("a", "aggverkey")
    .array("b").alias("b", "basicverkey")
    .array("n").alias("n", "verifierfile")
    .array("p").alias("p", "publics")
    .alias("v", "vadcopinfo")
    .alias("t", "template")
    .alias("o", "outputfile")
    .argv;


async function run() {
    
    const starkInfos = [];
    const aggVerificationKeys = [];
    const basicVerificationKeys = [];
    const verifierFilenames = [];
    const publics = [];

    const outputFile = argv.outputfile;
    if(!outputFile) throw new Error("A valid output file has to be provided!");

    const templateFile = argv.template;
    if(!templateFile) throw new Error("A valid template file must be provided!");

    if(argv.starkinfo.length === 0) throw new Error("At least one stark info file must be provided!");
    for(let i = 0; i < argv.starkinfo.length; ++i) {
        if(typeof (argv.starkinfo[i]) !== "string") throw new Error("A valid stark info file must be provided!");
        starkInfos.push(JSON.parse(await fs.promises.readFile(argv.starkinfo[i].trim(), "utf8")));
    }

    if(argv.aggverkey) {
        for(let i = 0; i < argv.aggverkey.length; ++i) {
            if(typeof (argv.aggverkey[i]) !== "string") throw new Error("A valid verification key file must be provided!");
            const verkey = JSONbig.parse(await fs.promises.readFile(argv.aggverkey[i].trim(), "utf8"));
            if(!verkey.constRoot) throw new Error("Invalid verification key file!");
            aggVerificationKeys.push(verkey.constRoot);
        }
    }

    if(argv.basicverkey) {
        for(let i = 0; i < argv.basicverkey.length; ++i) {
            if(typeof (argv.basicverkey[i]) !== "string") throw new Error("A valid verification key file must be provided!");
            const verkey = JSONbig.parse(await fs.promises.readFile(argv.basicverkey[i].trim(), "utf8"));
            if(!verkey.constRoot) throw new Error("Invalid verification key file!");
            basicVerificationKeys.push(verkey.constRoot);
        }
    }

    for(let i = 0; i < argv.verifierfile.length; ++i) {
        if(typeof (argv.verifierfile[i]) !== "string") throw new Error("A valid verification file name must be provided!");
        verifierFilenames.push(argv.verifierfile[i]);
    }
    
    for(let i = 0; i < argv.publics.length; ++i) {
        if(typeof (argv.publics[i]) !== "string") throw new Error("A valid publics file name must be provided!");
        const publicsInfo = JSON.parse(await fs.promises.readFile(argv.publics[i].trim(), "utf8"));
        // TODO: VERIFY FORMAT
        publics.push(publicsInfo);
    }

    let vadcopInfo;
    if(argv.vadcopInfo) {
        vadcopInfo = JSON.parse(await fs.promises.readFile(argv.vadcopInfo.trim(), "utf8"));
    }

    const options = {}
    
    //TODO: ADD OPTIONS

    const circomVerifier = await genCircom(templateFile, starkInfos, vadcopInfo, verifierFilenames, basicVerificationKeys, aggVerificationKeys, publics, options);
    
    await fs.promises.writeFile(outputFile, circomVerifier, "utf8");

    console.log("file Generated Correctly");

}
run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
