const fs = require("fs");
const version = require("../../package").version;

const { compile } = require("pilcom");
const F3g = require("../../src/utils/f3g.js");
const binFileUtils = require("@iden3/binfileutils");
const { readExecFile, compressorExec } = require("../../src/circom2pil/compressor_exec.js");


const argv = require("yargs")
    .version(version)
    .usage("node main_plonkexec.js -w <circuit.wasm> -e <circuit.exec> -m <circuit.commit>")
    .alias("w", "wasm")
    .alias("p", "pil")
    .alias("P", "pilconfig")
    .alias("e", "exec")
    .alias("i", "input")
    .alias("m", "commit")
    .argv;

async function run() {

    const F = new F3g();

    const inputFile = typeof(argv.input) === "string" ?  argv.input.trim() : "inputs.json";
    const wasmFile = typeof(argv.wasm) === "string" ?  argv.wasm.trim() : "mycircuit.verifier.wasm";
    const pilFile = typeof(argv.pil) === "string" ?  argv.pil.trim() : "mycircuit.pil";
    const pilConfig = typeof(argv.pilconfig) === "string" ? JSON.parse(fs.readFileSync(argv.pilconfig.trim())) : {};
    const execFile = typeof(argv.exec) === "string" ?  argv.exec.trim() : "mycircuit.exec";
    const commitFile = typeof(argv.commit) === "string" ?  argv.commit.trim() : "mycircuit.exec";

    const pil = await compile(F, pilFile, null, pilConfig);

    const input = JSON.parse(await fs.promises.readFile(inputFile, "utf8"));

    const exec = await readExecFile(execFile, pil.references["Compressor.a"].len);

    const fd =await fs.promises.open(wasmFile, "r");
    const st =await fd.stat();
    const wasm = new Uint8Array(st.size);
    await fd.read(wasm, 0, st.size);
    await fd.close();

    const cmPols = await compressorExec(F, pil, wasm, input, exec);

    await cmPols.saveToFile(commitFile);

}

run().then(()=> {
    process.exit(0);
}, (err) => {
    console.log(err.message);
    console.log(err.stack);
    process.exit(1);
});


async function readWtns(fileName) {

    const {fd, sections} = await binFileUtils.readBinFile(fileName, "wtns", 2);

    const {n8, nWitness} = await readHeader(fd, sections);

    await binFileUtils.startReadUniqueSection(fd, sections, 2);
    const res = [];
    for (let i=0; i<nWitness; i++) {
        const v = await binFileUtils.readBigInt(fd, n8);
        res.push(v);
    }
    await binFileUtils.endReadSection(fd);

    await fd.close();

    return res;


    async function readHeader(fd, sections) {

        await binFileUtils.startReadUniqueSection(fd, sections, 1);
        const n8 = await fd.readULE32();
        const q = await binFileUtils.readBigInt(fd, n8);
        const nWitness = await fd.readULE32();
        await binFileUtils.endReadSection(fd);

        return {n8, q, nWitness};

    }
}
