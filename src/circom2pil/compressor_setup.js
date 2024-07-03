const {readR1cs} = require("r1csfile");
const plonkSetupC18 = require("./c18/compressor18_setup.js");
const plonkSetupC12 = require("./c12/compressor12_setup.js");
const { writeExecFile } = require("./exec_helpers");

module.exports.compressorSetup = async function compressorSetup(F, r1csFile, cols, pil2, options = {}) {
    const r1cs = await readR1cs(r1csFile, {F: F, logger:console });

    if(![12,18].includes(cols)) throw new Error("Invalid number of cols");

    let res;
    if(cols === 12) {
        res = await plonkSetupC12(F, r1cs, pil2, options);
    } else {
        res = await plonkSetupC18(F, r1cs, pil2, options);
    }

    const exec = await writeExecFile(res.plonkAdditions, res.sMap);

    return {exec, pilStr: res.pilStr, constPols: res.constPols};
}