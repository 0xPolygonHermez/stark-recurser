const { plonk2pil } = require("./circom2pil/plonk2pil");
const version = require("../package").version;

const argv = require("yargs")
    .version(version)
    .usage("node src/main_plonk2pil.js -r <verifier.r1cs> -t <type>")
    .alias("r", "r1cs")
    .alias("t", "type")
    .argv;

async function run() {
    const r1csFile = typeof(argv.r1cs) === "string" ?  argv.r1cs.trim() : "mycircuit.verifier.r1cs";
    
    // assert type is either aggregation, final or light
    const type = typeof(argv.type) === "string" ? argv.type.trim() : "aggregation";
    if (type != "compressor" && type !== "aggregation" && type !== "final_vadcop" && type !== "light") {
        throw new Error("type must be either aggregation, final_vadcop or light");
    }

    await plonk2pil(r1csFile, type);

    console.log("files Generated Correctly");

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});