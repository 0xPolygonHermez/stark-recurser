const {readR1cs} = require("r1csfile");
const plonkSetupCompressor = require("./compressor/compressor_setup.js");
const plonkSetupC12 = require("./c12_old/compressor12_setup.js");
const { writeExecFile } = require("./compressor_exec.js");
const F3g = require("../utils/f3g.js");

module.exports.compressorSetup = async function compressorSetup(r1csFile, cols, pil2, options = {}) {
    const F = new F3g();
    
    const r1cs = await readR1cs(r1csFile, {F: F, logger:console });

    if(![12,36].includes(cols)) throw new Error("Invalid number of cols");

    let res;
    if(cols === 12) {
        res = await plonkSetupC12(F, r1cs, pil2, options);
    } else {
        res = await plonkSetupCompressor(F, r1cs, options);
    }

    const exec = await writeExecFile(res.plonkAdditions, res.sMap);

    return {exec, pilStr: res.pilStr, constPols: res.constPols, nBits: res.nBits, pilout: res.pilout };
}