const {readR1cs} = require("r1csfile");
const plonkSetupCompressor = require("./compressor/compressor_setup.js");
const { writeExecFile } = require("./compressor_exec.js");

module.exports.compressorSetup = async function compressorSetup(r1csFile, cols, options = {}) {
    
    const r1cs = await readR1cs(r1csFile, { logger:console });

    if(cols != 36) throw new Error("Invalid number of cols");

    let res = await plonkSetupCompressor(r1cs, options);

    const exec = await writeExecFile(res.plonkAdditions, res.sMap);

    return {exec, pilStr: res.pilStr, fixedPols: res.fixedPols, nBits: res.nBits, pilout: res.pilout, airgroupName: res.airgroupName, airName: res.airName };
}