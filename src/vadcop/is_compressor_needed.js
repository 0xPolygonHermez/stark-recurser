const F3g = require("pil2-stark-js/src/helpers/f3g");
const { readR1cs } = require("r1csfile");
const { getCompressorConstraints } = require("../circom2pil/compressor_constraints.js");
const { log2 } = require("../utils.js");


module.exports.isCompressorNeeded = async function isCompressorNeeded(r1csFilename) {
    const F = new F3g();
    const r1cs = await readR1cs(r1csFilename, { F });

    const { NUsed: NUsedC18 } = getCompressorConstraints(F, r1cs, 18);

    const { NUsed: NUsedC12 } = getCompressorConstraints(F, r1cs, 12);
    
    let nBitsC18 = log2(NUsedC18 - 1) + 1;

    let nBitsC12 = log2(NUsedC12 - 1) + 1;

    if (nBitsC18 === 17) {
        return { hasCompressor: false, nCols: 18 };
    } else if(nBitsC12 === 17) {
        return { hasCompressor: false, nCols: 12 };
    } else {
        const nBitsExt = nBits + 4;
        const nQueries =  nBits < 15 ? 64 : 32;

        const starkStructCompressor = {
            nBits,
            nBitsExt,
            nQueries,
            hashCommits: true,
            verificationHashType: "GL",
            steps: [{ nBits: nBitsExt }],
        };

        let friStepBits = nBits + 4;
        while (friStepBits > 5) {
            friStepBits = Math.max(friStepBits - 4, 5);
            starkStructCompressor.steps.push({
                nBits: friStepBits,
            });
        }

        return { hasCompressor: true, nCols: 18, starkStruct: starkStructCompressor }
    }
}