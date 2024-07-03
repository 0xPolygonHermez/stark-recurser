const version = require("../package").version;
const fs = require("fs");
const { isCompressorNeeded } = require("./is_compressor_needed");
const argv = require("yargs")
    .version(version)
    .usage("node main_is_compressor_needed.js -r <filename.r1cs> -o <output.json>")
    .alias("r1cs", "r1csfile")
    .alias("o", "outputfile")
    .argv;


async function run() {

    const outputFile = argv.outputfile;
    if(!outputFile) throw new Error("A valid output file has to be provided!");

    const r1csFile = argv.r1csfile;
    if(!r1csFile) throw new Error("A valid r1cs file must be provided!");

    const compressorInfo = isCompressorNeeded(r1csFile);

    await fs.promises.writeFile(outputFile, JSON.stringify(compressorInfo), "utf8");

    console.log("file Generated Correctly");

}
run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
