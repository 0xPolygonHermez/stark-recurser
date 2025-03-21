const F3g = require("../utils/f3g.js");
const { readR1cs } = require("r1csfile");
const { getCompressorConstraints } = require("../circom2pil/compressor_constraints.js");
const { log2 } = require("../utils/utils.js");
const fs = require("fs");
const path = require('path');
const { tmpName } = require('tmp-promise'); 
const pil2circom = require("stark-recurser/src/pil2circom/pil2circom.js");

const util = require('util');
const childProcess = require('child_process'); // Split into two lines for clarity
const exec = util.promisify(childProcess.exec);

module.exports.isCompressorNeeded = async function isCompressorNeeded(constRoot, starkInfo, verifierInfo, starkInfoFile) {
    let verifierCircomTemplate = await pil2circom(
        constRoot,
        starkInfo,
        verifierInfo,
        { skipMain: true }
    );

    verifierCircomTemplate +=
        `\n\ncomponent main = StarkVerifier${starkInfo.airgroupId}();\n\n`;
    
    const nameTmp = await tmpName();
    const folder = path.dirname(nameTmp);
    const tmpCircomFilename = nameTmp + ".circom";
    const tmpR1csFilename = nameTmp + ".r1cs";

    await fs.promises.writeFile(
        tmpCircomFilename,
        verifierCircomTemplate,
        "utf8"
    );
    
    const circuitsGLPath = path.join(__dirname, '../pil2circom/circuits.gl');
    const compileRecursiveCommand = `circom --O1 --r1cs --prime goldilocks -l ${circuitsGLPath} ${tmpCircomFilename} -o ${folder}`;
    console.log(compileRecursiveCommand);
    await exec(compileRecursiveCommand);
    
    const F = new F3g();
    const r1cs = await readR1cs(tmpR1csFilename, { F });

    const { NUsed: NUsedC18 } = getCompressorConstraints(F, r1cs, 21);
    
    await fs.promises.unlink(tmpR1csFilename);
    await fs.promises.unlink(tmpCircomFilename);

    console.log("Number of rows used", NUsedC18);

    let nBitsC18 = log2(NUsedC18 - 1) + 1;

    if(nBitsC18 > 17) {
        return { hasCompressor: true, nBits: nBitsC18 };
    } else if(nBitsC18 === 17) {
        return { hasCompressor: false, nCols: 21 };
    } else {
        const nRowsPerFri = NUsedC18 / starkInfo.starkStruct.nQueries;
        const minimumQueriesRequired = Math.ceil((2**16 + 2**12) / nRowsPerFri);
        
        starkInfo.starkStruct.nQueries = minimumQueriesRequired;
        await fs.promises.writeFile(starkInfoFile, JSON.stringify(starkInfo, null, 1), "utf8");

        return { hasCompressor: false, nCols: 21 };
    }   
}