const fs = require("fs");
const version = require("../../package").version;

const {readR1cs} = require("r1csfile");
const F3g = require("../../src/utils/f3g.js");
const plonkSetup = require("./plonksetup.js");
const { writeExecFile } = require("../../src/circom2pil/compressor_exec.js");


const argv = require("yargs")
    .version(version)
    .usage("node main_plonksetup.js -r <circuit.r1cs> -p <pil.json> -c <circuit.const> -e <circuit.exec>")
    .alias("r", "r1cs")   // Input -> r1cs fil
    .alias("p", "pil")    // Input -> Proposed PIL
    .alias("c", "const")  // Output -> file required to build the constants
    .alias("e", "exec")   // Output -> File required to execute
    .argv;

async function run() {
    const F = new F3g();

    const r1csFile = typeof(argv.r1cs) === "string" ?  argv.r1cs.trim() : "mycircuit.r1cs";
    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const constFile = typeof(argv.const) === "string" ?  argv.const.trim() : "mycircuit.const";
    const execFile = typeof(argv.exec) === "string" ?  argv.exec.trim() : "mycircuit.exec";

    const r1cs = await readR1cs(r1csFile, {F: F, logger:console });

    const res = await plonkSetup(r1cs);

    await fs.promises.writeFile(pilFile, res.pilStr, "utf8");

    await res.constPols.saveToFile(constFile);

    const exec = await writeExecFile(res.plonkAdditions, res.sMap);

    const fd = await fs.promises.open(execFile, "w+");
    await fd.write(exec);
    await fd.close();

    console.log("files Generated Correctly");
}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});
