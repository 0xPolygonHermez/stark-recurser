const F3g = require("../utils/f3g.js");
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
        return { hasCompressor: true, nBits: nBitsC18 }
    }
}