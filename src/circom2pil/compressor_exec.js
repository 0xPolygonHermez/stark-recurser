const { WitnessCalculatorBuilder } = require("circom_runtime");
const fs = require("fs");
const { generateWtnsCols } = require("../utils/witnessCalculator");

module.exports.compressorExec = async function compressorExec(F, pil, wasm, input, exec, pil2 = false) {
    const cmPols = pil2 
        ? generateWtnsCols(pil.symbols, pil.numRows, true)
        : generateWtnsCols(pil.references, Object.values(pil.references)[0].polDeg, false);

    const nCommittedPols =cmPols.Compressor.a.length;
    
    const { nAdds, nSMap, addsBuff, sMapBuff } = exec;
    
    const wc = await WitnessCalculatorBuilder(wasm);
    const w = await wc.calculateWitness(input);

    const publics = w.slice(1, 1 + pil.publics.length);

    for (let i=0; i<nAdds; i++) {
        w.push( F.add( F.mul( w[addsBuff[i*4]], addsBuff[i*4 + 2]), F.mul( w[addsBuff[i*4+1]],  addsBuff[i*4+3]  )));
    }

    for (let i=0; i<nSMap; i++) {
        for (let j=0; j<nCommittedPols; j++) {
            if (sMapBuff[nCommittedPols*i+j] != 0) {
                cmPols.Compressor.a[j][i] = w[sMapBuff[nCommittedPols*i+j]];
            } else {
                cmPols.Compressor.a[j][i] = 0n;
            }
        }
    }

    return { cmPols, publics };
}

module.exports.readExecFile = async function readExecFile(execFile, nCols) {

    const fd =await fs.promises.open(execFile, "r");
    const buffH = new BigUint64Array(2);
    await fd.read(buffH, 0, 2*8);
    const nAdds= Number(buffH[0]);
    const nSMap= Number(buffH[1]);


    const addsBuff = new BigUint64Array(nAdds*4);
    await fd.read(addsBuff, 0, nAdds*4*8);

    const sMapBuff = new BigUint64Array(nSMap*nCols);
    await fd.read(sMapBuff, 0, nSMap*nCols*8);

    await fd.close();

    return { nAdds, nSMap, addsBuff, sMapBuff };

}

module.exports.writeExecFile = async function writeExecFile(adds, sMap) {

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