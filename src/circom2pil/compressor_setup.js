const {readR1cs} = require("r1csfile");
const plonkSetupC18 = require("./c18/compressor18_setup.js");
const plonkSetupC12 = require("./c12/compressor12_setup.js");
const { writeExecFile } = require("./compressor_exec.js");
const fs = require("fs");

module.exports.compressorSetup = async function compressorSetup(r1csFile, constFile, execFile, pilFile, cols, pil2, options = {}) {
    const r1cs = await readR1cs(r1csFile);

    if(![12,24].includes(cols)) throw new Error("Invalid number of cols");

    let res;
    if(cols === 12) {
        res = await plonkSetupC12(r1cs, pil2, options);
    } else {
        res = await plonkSetupC18(r1cs, pil2, options);
    }

    const exec = await writeExecFile(res.plonkAdditions, res.sMap);

    const fd =await fs.promises.open(execFile, "w+");
    await fd.write(exec);
    await fd.close();

    await fs.promises.writeFile(pilFile, res.pilStr, "utf8");

    await res.constPols.saveToFile(constFile);

    return {nBits: res.nBits, pilout: res.pilout};
}