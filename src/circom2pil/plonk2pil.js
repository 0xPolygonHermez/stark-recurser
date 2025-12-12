const {readR1cs} = require("r1csfile");
const { aggregationCompressor } = require("./aggregation/aggregation_setup.js");
const { finalVadcopCompressor } = require("./final_vadcop/final_vadcop_setup.js");
const { lightCompressor } = require("./compressor_light/compressor_light.setup.js");
const { compressor } = require("./compressor/compressor_setup.js");

function writeExecFile(adds, sMap) {

    const size = 2 + adds.length*4 + sMap.length*sMap[0].length;
    const buff = new BigUint64Array(size);
    
    buff[0] = BigInt(adds.length);
    buff[1] = BigInt(sMap[0].length);
    
    for (let i=0; i< adds.length; i++) {
        buff[2 + i*4     ] = BigInt(adds[i][0]);
        buff[2 + i*4 + 1 ] = BigInt(adds[i][1]);
        buff[2 + i*4 + 2 ] = adds[i][2];
        buff[2 + i*4 + 3 ] = adds[i][3];
    }

    for (let i=0; i<sMap[0].length; i++) {
        for (let c=0; c<sMap.length; c++) {
            buff[2 + adds.length*4 + sMap.length*i + c] = BigInt(sMap[c][i]);
        }
    }
    
    return buff;
}

module.exports.plonk2pil = async function plonk2pil(r1csFile, type, options = {}) {
    
    if(!["compressor", "aggregation", "final_vadcop", "light"].includes(type)) {
        throw new Error("Invalid compressor type");
    }

    const r1cs = await readR1cs(r1csFile, { logger:console });

    let res;
    if (type == "compressor") {
        res = compressor(r1cs, options);
    } if (type == "aggregation") {
        res = aggregationCompressor(r1cs, options);
    } else if (type == "final_vadcop") {
        res = finalVadcopCompressor(r1cs, options);
    } else if (type == "light") {
        res = lightCompressor(r1cs, options);
    }

    const exec = writeExecFile(res.plonkAdditions, res.sMap);

    return {exec, pilStr: res.pilStr, fixedPols: res.fixedPols, nBits: res.nBits, pilout: res.pilout, airgroupName: res.airgroupName, airName: res.airName };
}